<?php
namespace App\Controllers;

use App\Repositories\ProductoRepository;
use App\Helpers\Response;
use App\Helpers\Validator;

class ProductoController {
    private ProductoRepository $repo;

    public function __construct() {
        $this->repo = new ProductoRepository();
    }

    public function index(): void {
        $sucursalId = isset($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;
        $categoriaId = isset($_GET['categoria_id']) ? (int)$_GET['categoria_id'] : null;
        $search = $_GET['search'] ?? null;

        if ($sucursalId) {
            $productos = $this->repo->getBySucursal($sucursalId, $categoriaId, $search);
        } else {
            $productos = $this->repo->getAll(true);
        }

        Response::success($productos);
    }

    public function show(string $id): void {
        $producto = $this->repo->getById((int)$id);
        if (!$producto) {
            Response::error('Producto no encontrado', 404);
        }
        Response::success($producto);
    }

    public function store(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'categoria_id'  => 'required|numeric',
            'codigo_sku'    => 'required',
            'codigo_barras' => 'required',
            'nombre'        => 'required',
            'precio_venta'  => 'required|positive',
            'costo_base'    => 'required|positive'
        ]);

        if ($validator->fails()) {
            Response::error('Datos inválidos de producto', 422, $validator->getErrors());
        }

        $id = $this->repo->create($input);

        // Inicializar automáticamente el inventario para todas las sucursales
        $db = \App\Helpers\Database::getConnection();
        $sucursales = $db->query("SELECT id FROM sucursales WHERE estado = 1")->fetchAll(\PDO::FETCH_COLUMN);

        $stockInicial = isset($input['stock_inicial']) ? max(0, (int)$input['stock_inicial']) : 50;
        $fechaVenc = !empty($input['fecha_vencimiento']) ? $input['fecha_vencimiento'] : date('Y-m-d', strtotime('+6 months'));

        foreach ($sucursales as $sucId) {
            $stmtInv = $db->prepare(
                "INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden, clasificacion_abc)
                 VALUES (:suc, :prod, :stock, 10, 200, 25, 'B')
                 ON DUPLICATE KEY UPDATE stock_actual = :stock_upd"
            );
            $stmtInv->execute([
                ':suc'       => $sucId,
                ':prod'      => $id,
                ':stock'     => $stockInicial,
                ':stock_upd' => $stockInicial
            ]);

            // Si hay stock inicial, generar su lote inicial para rotación PEPS
            if ($stockInicial > 0) {
                $codigoLote = 'LOT-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $input['codigo_sku']), 0, 4)) . '-' . date('ymd');
                $stmtLote = $db->prepare(
                    "INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, ubicacion_almacen, estado)
                     VALUES (:suc, :prod, :lote, CURDATE(), :venc, :cant, :disp, :costo, 'PASAJE-A1', 'DISPONIBLE')"
                );
                $stmtLote->execute([
                    ':suc'   => $sucId,
                    ':prod'  => $id,
                    ':lote'  => $codigoLote,
                    ':venc'  => $input['es_perecedero'] ? $fechaVenc : null,
                    ':cant'  => $stockInicial,
                    ':disp'  => $stockInicial,
                    ':costo' => (float)$input['costo_base']
                ]);
                $loteId = (int)$db->lastInsertId();

                // Asiento en Kardex
                $stmtKardex = $db->prepare(
                    "INSERT INTO movimientos_inventario (sucursal_id, producto_id, lote_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                     VALUES (:suc, :prod, :lote, 'ENTRADA_COMPRA', 'ALTA-INICIAL', :cant, :costo, 0, :nuevo, 'Alta de nuevo producto en catálogo maestro con stock inicial')"
                );
                $stmtKardex->execute([
                    ':suc'   => $sucId,
                    ':prod'  => $id,
                    ':lote'  => $loteId,
                    ':cant'  => $stockInicial,
                    ':costo' => (float)$input['costo_base'],
                    ':nuevo' => $stockInicial
                ]);
            }
        }

        Response::success(['id' => $id, 'stock_inicial' => $stockInicial], 'Producto registrado exitosamente e inventario activado en sucursales.', 201);
    }

    /**
     * PUT /api/productos/{id}
     * Edición de producto existente con validación de imagen y stock
     */
    public function update(string $id): void {
        $prodId = (int)$id;
        $existing = $this->repo->getById($prodId);
        if (!$existing) {
            Response::error('Producto no encontrado para editar.', 404);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'categoria_id'  => 'required|numeric',
            'codigo_sku'    => 'required',
            'codigo_barras' => 'required',
            'nombre'        => 'required',
            'precio_venta'  => 'required|positive',
            'costo_base'    => 'required|positive'
        ]);

        if ($validator->fails()) {
            Response::error('Datos inválidos para actualizar producto', 422, $validator->getErrors());
        }

        // Validar unicidad de SKU y código de barras excluyendo este producto
        if ($this->repo->existsBySku($input['codigo_sku'], $prodId)) {
            Response::error("El código SKU '{$input['codigo_sku']}' ya está en uso por otro producto.", 422);
        }
        if ($this->repo->existsByBarcode($input['codigo_barras'], $prodId)) {
            Response::error("El código de barras '{$input['codigo_barras']}' ya está en uso por otro producto.", 422);
        }

        // Si no se envía una imagen nueva o viene vacía, conservar la imagen existente
        $imagenUrl = !empty($input['imagen_url']) ? trim($input['imagen_url']) : $existing['imagen_url'];

        $updateData = [
            'categoria_id'  => (int)$input['categoria_id'],
            'codigo_sku'    => trim($input['codigo_sku']),
            'codigo_barras' => trim($input['codigo_barras']),
            'nombre'        => trim($input['nombre']),
            'descripcion'   => $input['descripcion'] ?? $existing['descripcion'],
            'unidad_medida' => $input['unidad_medida'] ?? $existing['unidad_medida'],
            'precio_venta'  => (float)$input['precio_venta'],
            'costo_base'    => (float)$input['costo_base'],
            'es_perecedero' => isset($input['es_perecedero']) ? (int)$input['es_perecedero'] : $existing['es_perecedero'],
            'imagen_url'    => $imagenUrl,
            'estado'        => isset($input['estado']) ? (int)$input['estado'] : $existing['estado']
        ];

        $this->repo->update($prodId, $updateData);

        // Actualizar stock en sucursal si fue especificado
        $db = \App\Helpers\Database::getConnection();
        if (isset($input['sucursal_id']) && isset($input['stock_actual'])) {
            $sucId = (int)$input['sucursal_id'];
            $newStock = max(0, (int)$input['stock_actual']);
            $stmtInv = $db->prepare(
                "INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
                 VALUES (:suc, :prod, :stock, 10, 200, 25)
                 ON DUPLICATE KEY UPDATE stock_actual = :stock_upd"
            );
            $stmtInv->execute([
                ':suc'       => $sucId,
                ':prod'      => $prodId,
                ':stock'     => $newStock,
                ':stock_upd' => $newStock
            ]);
        }

        $updatedProduct = $this->repo->getById($prodId);
        Response::success($updatedProduct, 'Producto actualizado correctamente en base de datos y sincronizado con catálogo.');
    }

    /**
     * POST /api/productos/import-excel
     * Importación masiva de productos desde Excel / CSV con validación y reporte
     */
    public function importExcel(): void {
        $user = $GLOBALS['auth_user'] ?? \App\Middleware\JwtAuthMiddleware::getUser();
        $isSupervisor = ($user && ($user['rol_nombre'] ?? '') === 'Supervisor');
        $supervisorBranchId = $isSupervisor ? (int)$user['sucursal_id'] : null;

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $rows = $input['rows'] ?? [];
        $targetSucursalId = isset($input['sucursal_id']) ? (int)$input['sucursal_id'] : ($supervisorBranchId ?: 1);

        if ($isSupervisor && $supervisorBranchId && $targetSucursalId !== $supervisorBranchId) {
            Response::error("Acceso restringido: El supervisor solo puede importar productos a su sucursal asignada (ID {$supervisorBranchId}).", 403);
        }

        if (empty($rows) || !is_array($rows)) {
            Response::error('No se recibieron filas válidas para la importación.', 422);
        }

        $db = \App\Helpers\Database::getConnection();

        // Mapear categorías existentes por nombre y por id
        $catsRaw = $db->query("SELECT id, LOWER(nombre) as nombre_norm FROM categorias")->fetchAll(\PDO::FETCH_ASSOC);
        $catMap = [];
        foreach ($catsRaw as $c) {
            $catMap[$c['id']] = (int)$c['id'];
            $catMap[trim($c['nombre_norm'])] = (int)$c['id'];
        }

        // Sucursales activas para administradores
        $activeBranches = $isSupervisor 
            ? [$supervisorBranchId] 
            : $db->query("SELECT id FROM sucursales WHERE estado = 1")->fetchAll(\PDO::FETCH_COLUMN);

        $totalProcesados = count($rows);
        $importados = 0;
        $omitidosDuplicados = 0;
        $errores = 0;
        $detallesErrores = [];
        $productosCreados = [];
        $batchSkus = [];
        $batchBarcodes = [];

        foreach ($rows as $index => $row) {
            $numFila = $index + 1;
            $sku = strtoupper(trim((string)($row['codigo_sku'] ?? '')));
            $barcode = trim((string)($row['codigo_barras'] ?? ''));
            $nombre = trim((string)($row['nombre'] ?? ''));
            $descripcion = trim((string)($row['descripcion'] ?? ''));
            $categoriaInput = trim((string)($row['categoria'] ?? $row['categoria_id'] ?? ''));
            $precioVenta = (float)($row['precio_venta'] ?? 0);
            $costoBase = (float)($row['costo_base'] ?? 0);
            $stockInicial = isset($row['stock_inicial']) ? max(0, (int)$row['stock_inicial']) : 50;
            $unidadMedida = strtoupper(trim((string)($row['unidad_medida'] ?? 'UNIDAD')));
            $esPerecedero = (!empty($row['es_perecedero']) && in_array(strtoupper((string)$row['es_perecedero']), ['1', 'SI', 'TRUE', 'S'])) ? 1 : 0;
            $imagenUrl = trim((string)($row['imagen_url'] ?? 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400'));

            // 1. Validaciones de campos obligatorios
            if ($sku === '') {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => 'N/A', 'error' => 'El código SKU es obligatorio.'];
                continue;
            }
            if ($barcode === '') {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => 'El código de barras es obligatorio.'];
                continue;
            }
            if ($nombre === '') {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => 'El nombre del producto es obligatorio.'];
                continue;
            }
            if ($precioVenta <= 0) {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "El precio de venta (S/. {$precioVenta}) debe ser un número mayor a 0."];
                continue;
            }
            if ($costoBase <= 0) {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "El costo base (S/. {$costoBase}) debe ser un número mayor a 0."];
                continue;
            }

            // 2. Validación de categoría
            $catId = null;
            if (is_numeric($categoriaInput) && isset($catMap[(int)$categoriaInput])) {
                $catId = (int)$categoriaInput;
            } else {
                $catNorm = strtolower($categoriaInput);
                if (isset($catMap[$catNorm])) {
                    $catId = $catMap[$catNorm];
                } else {
                    $catId = 1; // Default a Abarrotes y Despensa si no coincide
                }
            }

            // 3. Detección de duplicados en el lote actual
            if (isset($batchSkus[$sku])) {
                $omitidosDuplicados++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "Código SKU repetido dentro del mismo archivo Excel (Fila {$batchSkus[$sku]})."];
                continue;
            }
            if ($barcode !== '' && isset($batchBarcodes[$barcode])) {
                $omitidosDuplicados++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "Código de barras repetido dentro del archivo (Fila {$batchBarcodes[$barcode]})."];
                continue;
            }

            // 4. Detección de duplicados contra la base de datos
            if ($this->repo->existsBySku($sku)) {
                $omitidosDuplicados++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "El producto con SKU '{$sku}' ya existe en la base de datos."];
                continue;
            }
            if ($barcode !== '' && $this->repo->existsByBarcode($barcode)) {
                $omitidosDuplicados++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "El código de barras '{$barcode}' ya está registrado en el catálogo."];
                continue;
            }

            // Registrar en seguimiento del lote
            $batchSkus[$sku] = $numFila;
            $batchBarcodes[$barcode] = $numFila;

            // 5. Inserción del producto
            try {
                $newProdId = $this->repo->create([
                    'categoria_id'  => $catId,
                    'codigo_sku'    => $sku,
                    'codigo_barras' => $barcode,
                    'nombre'        => $nombre,
                    'descripcion'   => $descripcion,
                    'unidad_medida' => $unidadMedida ?: 'UNIDAD',
                    'precio_venta'  => $precioVenta,
                    'costo_base'    => $costoBase,
                    'es_perecedero' => $esPerecedero,
                    'imagen_url'    => $imagenUrl,
                    'estado'        => 1
                ]);

                // Asignar a inventarios
                $fechaVenc = $esPerecedero ? date('Y-m-d', strtotime('+6 months')) : null;
                foreach ($activeBranches as $sucId) {
                    $stmtInv = $db->prepare(
                        "INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden, clasificacion_abc)
                         VALUES (:suc, :prod, :stock, 10, 200, 25, 'B')
                         ON DUPLICATE KEY UPDATE stock_actual = :stock_upd"
                    );
                    $stmtInv->execute([
                        ':suc'       => $sucId,
                        ':prod'      => $newProdId,
                        ':stock'     => $stockInicial,
                        ':stock_upd' => $stockInicial
                    ]);

                    if ($stockInicial > 0) {
                        $codigoLote = 'LOT-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $sku), 0, 4)) . '-' . date('ymd');
                        $stmtLote = $db->prepare(
                            "INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, ubicacion_almacen, estado)
                             VALUES (:suc, :prod, :lote, CURDATE(), :venc, :cant, :disp, :costo, 'PASAJE-EXCEL', 'DISPONIBLE')"
                        );
                        $stmtLote->execute([
                            ':suc'   => $sucId,
                            ':prod'  => $newProdId,
                            ':lote'  => $codigoLote,
                            ':venc'  => $fechaVenc,
                            ':cant'  => $stockInicial,
                            ':disp'  => $stockInicial,
                            ':costo' => $costoBase
                        ]);
                        $loteId = (int)$db->lastInsertId();

                        $stmtKardex = $db->prepare(
                            "INSERT INTO movimientos_inventario (sucursal_id, producto_id, lote_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                             VALUES (:suc, :prod, :lote, 'ENTRADA_COMPRA', 'IMPORT-EXCEL', :cant, :costo, 0, :nuevo, 'Importación masiva Excel')"
                        );
                        $stmtKardex->execute([
                            ':suc'   => $sucId,
                            ':prod'  => $newProdId,
                            ':lote'  => $loteId,
                            ':cant'  => $stockInicial,
                            ':costo' => $costoBase,
                            ':nuevo' => $stockInicial
                        ]);
                    }
                }

                $importados++;
                $productosCreados[] = [
                    'id'            => $newProdId,
                    'codigo_sku'    => $sku,
                    'nombre'        => $nombre,
                    'precio_venta'  => $precioVenta,
                    'stock_inicial' => $stockInicial
                ];
            } catch (\Exception $e) {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => 'Error de base de datos: ' . $e->getMessage()];
            }
        }

        Response::success([
            'total_procesados'          => $totalProcesados,
            'total_importados'          => $importados,
            'total_omitidos_duplicados' => $omitidosDuplicados,
            'total_errores'             => $errores,
            'detalles_errores'          => $detallesErrores,
            'productos_importados'      => $productosCreados
        ], "Importación finalizada: {$importados} productos registrados, {$omitidosDuplicados} omitidos por duplicidad y {$errores} errores detectados.");
    }

    /**
     * GET /api/productos/template-excel
     * Retorna la plantilla oficial con estructura y ejemplos
     */
    public function templateExcel(): void {
        $headers = [
            'codigo_sku',
            'codigo_barras',
            'nombre',
            'descripcion',
            'categoria',
            'precio_venta',
            'costo_base',
            'stock_inicial',
            'unidad_medida',
            'es_perecedero',
            'imagen_url'
        ];

        $sampleRows = [
            [
                'codigo_sku'    => 'SKU-ARR-010',
                'codigo_barras' => '7750123450011',
                'nombre'        => 'Arroz Extra Costeño 1kg',
                'descripcion'   => 'Arroz seleccionado de grano largo y rendidor.',
                'categoria'     => 'Abarrotes y Despensa',
                'precio_venta'  => 4.80,
                'costo_base'    => 3.70,
                'stock_inicial' => 80,
                'unidad_medida' => 'BOLSA',
                'es_perecedero' => 0,
                'imagen_url'    => 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400'
            ],
            [
                'codigo_sku'    => 'SKU-BEB-011',
                'codigo_barras' => '7750123450022',
                'nombre'        => 'Agua Mineral San Luis 625ml',
                'descripcion'   => 'Agua de mesa sin gas purificada.',
                'categoria'     => 'Bebidas y Licores',
                'precio_venta'  => 2.00,
                'costo_base'    => 1.30,
                'stock_inicial' => 120,
                'unidad_medida' => 'BOTELLA',
                'es_perecedero' => 0,
                'imagen_url'    => 'https://images.unsplash.com/photo-1559839914-ba2ac55d683a?w=400'
            ],
            [
                'codigo_sku'    => 'SKU-LAC-012',
                'codigo_barras' => '7750123450033',
                'nombre'        => 'Leche Evaporada Gloria Azul 400g',
                'descripcion'   => 'Leche entera enriquecida con vitaminas A y D.',
                'categoria'     => 'Lácteos y Huevos',
                'precio_venta'  => 4.20,
                'costo_base'    => 3.20,
                'stock_inicial' => 100,
                'unidad_medida' => 'LATA',
                'es_perecedero' => 1,
                'imagen_url'    => 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400'
            ]
        ];

        Response::success([
            'headers'    => $headers,
            'categorias' => [
                '1' => 'Abarrotes y Despensa',
                '2' => 'Lácteos y Huevos',
                '3' => 'Bebidas y Licores',
                '4' => 'Limpieza y Cuidado',
                '5' => 'Frutas y Verduras'
            ],
            'samples'    => $sampleRows
        ]);
    }
}
