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
            $productos = $this->repo->getAll(true, $categoriaId, $search);
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

        // Actualizar stock en sucursal si fue especificado y asegurar sincronización con lotes PEPS
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

            // Sincronizar o crear lote activo si no existía ningún lote disponible
            $stmtCheckLotes = $db->prepare("SELECT COALESCE(SUM(cantidad_disponible), 0) FROM lotes WHERE sucursal_id = :suc AND producto_id = :prod AND estado = 'DISPONIBLE'");
            $stmtCheckLotes->execute([':suc' => $sucId, ':prod' => $prodId]);
            $currentLotesQty = (int)$stmtCheckLotes->fetchColumn();

            if ($newStock > 0 && $currentLotesQty === 0) {
                $sku = $input['codigo_sku'] ?? ($existing['codigo_sku'] ?? 'PROD');
                $codigoLote = 'LOT-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $sku), 0, 4)) . '-' . date('ymd');
                $costoUnitario = isset($input['costo_base']) ? (float)$input['costo_base'] : (float)$existing['costo_base'];
                $esPerecedero = isset($input['es_perecedero']) ? (int)$input['es_perecedero'] : (int)$existing['es_perecedero'];
                $fechaVenc = $esPerecedero ? date('Y-m-d', strtotime('+6 months')) : null;

                $stmtLote = $db->prepare(
                    "INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, ubicacion_almacen, estado)
                     VALUES (:suc, :prod, :lote, CURDATE(), :venc, :cant, :disp, :costo, 'PASAJE-A1', 'DISPONIBLE')"
                );
                $stmtLote->execute([
                    ':suc'   => $sucId,
                    ':prod'  => $prodId,
                    ':lote'  => $codigoLote,
                    ':venc'  => $fechaVenc,
                    ':cant'  => $newStock,
                    ':disp'  => $newStock,
                    ':costo' => $costoUnitario
                ]);
                $loteId = (int)$db->lastInsertId();

                $stmtKardex = $db->prepare(
                    "INSERT INTO movimientos_inventario (sucursal_id, producto_id, lote_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                     VALUES (:suc, :prod, :lote, 'ENTRADA_COMPRA', 'AJUSTE-EDICION', :cant, :costo, 0, :nuevo, 'Ajuste de inventario por edición de producto en catálogo')"
                );
                $stmtKardex->execute([
                    ':suc'   => $sucId,
                    ':prod'  => $prodId,
                    ':lote'  => $loteId,
                    ':cant'  => $newStock,
                    ':costo' => $costoUnitario,
                    ':nuevo' => $newStock
                ]);
            }
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

        // Mapear categorías existentes por nombre y por id (soportando nombres acentuados)
        $catsRaw = $db->query("SELECT id, nombre, LOWER(nombre) as nombre_norm FROM categorias WHERE estado = 1")->fetchAll(\PDO::FETCH_ASSOC);
        $catMap = [];
        foreach ($catsRaw as $c) {
            $catMap[$c['id']] = (int)$c['id'];
            $catMap[trim($c['nombre_norm'])] = (int)$c['id'];
            $noAccents = str_replace(['á', 'é', 'í', 'ó', 'ú'], ['a', 'e', 'i', 'o', 'u'], trim($c['nombre_norm']));
            $catMap[$noAccents] = (int)$c['id'];
        }

        // Sucursales activas: Supervisor solo su sucursal; Administrador sucursal seleccionada
        $targetBranches = $isSupervisor ? [$supervisorBranchId] : [$targetSucursalId];

        $totalProcesados = count($rows);
        $importados = 0;
        $actualizados = 0;
        $omitidosDuplicados = 0;
        $errores = 0;
        $detallesErrores = [];
        $productosCreados = [];
        $productosActualizados = [];
        $batchSkus = [];
        $batchBarcodes = [];

        // Helper para extraer campos flexibles (soporta encabezados de catálogo y técnicos)
        $getVal = function(array $r, array $keys, $default = '') {
            foreach ($keys as $k) {
                if (isset($r[$k]) && trim((string)$r[$k]) !== '') {
                    return trim((string)$r[$k]);
                }
                $lowerK = strtolower($k);
                if (isset($r[$lowerK]) && trim((string)$r[$lowerK]) !== '') {
                    return trim((string)$r[$lowerK]);
                }
            }
            return $default;
        };

        foreach ($rows as $index => $row) {
            $numFila = $index + 1;
            
            // Extracción con soporte dual (Columnas del Catálogo Oficial vs Técnicas)
            $sku = strtoupper($getVal($row, ['SKU / BARRAS', 'SKU/BARRAS', 'sku_barras', 'codigo_sku', 'sku', 'Código SKU', 'SKU']));
            $barcode = $getVal($row, ['codigo_barras', 'codigo_barra', 'barcode', 'Barras', 'Código de Barras']);
            $nombre = $getVal($row, ['NOMBRE DEL PRODUCTO', 'NOMBRE', 'nombre del producto', 'nombre', 'producto', 'Nombre']);
            $descripcion = $getVal($row, ['descripcion', 'DESCRIPCIÓN', 'descripcion_producto'], '');
            $categoriaInput = $getVal($row, ['CATEGORÍA', 'CATEGORIA', 'categoría', 'categoria', 'categoria_id', 'Categoría']);
            $precioRaw = $getVal($row, ['PRECIO DE VENTA', 'PRECIO', 'precio de venta', 'precio_venta', 'precio', 'Precio de Venta'], '0');
            $costoRaw = $getVal($row, ['COSTO BASE', 'COSTO', 'costo base', 'costo_base', 'costo', 'Costo Base'], '0');
            $stockRaw = $getVal($row, ['STOCK ACTUAL', 'STOCK', 'stock actual', 'stock_actual', 'stock_inicial', 'stock', 'Stock Actual'], '50');
            $tipoRaw = $getVal($row, ['TIPO', 'tipo', 'es_perecedero', 'Tipo', 'Tipo de Producto'], 'No Perecedero');
            $fotoRaw = $getVal($row, ['FOTO', 'foto', 'Foto', 'IMAGEN', 'imagen', 'imagen_url'], '');

            $precioVenta = (float)str_replace(',', '.', (string)$precioRaw);
            $costoBase = (float)str_replace(',', '.', (string)$costoRaw);
            $stockInicial = max(0, (int)$stockRaw);
            $esPerecedero = in_array(strtoupper(trim((string)$tipoRaw)), ['PERECEDERO', '1', 'SI', 'TRUE', 'S', 'PEPS', 'FRESCO PEPS'], true) ? 1 : 0;

            // 1. Validaciones de campos obligatorios
            if ($sku === '') {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => 'N/A', 'error' => 'El código SKU / BARRAS es obligatorio.'];
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
            if ((int)$stockRaw < 0) {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "El stock inicial ({$stockRaw}) no puede ser negativo."];
                continue;
            }

            // 2. Validación de categoría contra la base de datos
            $catId = null;
            if (is_numeric($categoriaInput) && isset($catMap[(int)$categoriaInput])) {
                $catId = (int)$categoriaInput;
            } else {
                $catNorm = strtolower(trim((string)$categoriaInput));
                $catSimple = str_replace(['á', 'é', 'í', 'ó', 'ú'], ['a', 'e', 'i', 'o', 'u'], $catNorm);
                if (isset($catMap[$catNorm])) {
                    $catId = $catMap[$catNorm];
                } elseif (isset($catMap[$catSimple])) {
                    $catId = $catMap[$catSimple];
                } else {
                    foreach ($catsRaw as $c) {
                        $dbSimple = str_replace(['á', 'é', 'í', 'ó', 'ú'], ['a', 'e', 'i', 'o', 'u'], strtolower($c['nombre']));
                        if ($catSimple === $dbSimple || strpos($dbSimple, $catSimple) !== false) {
                            $catId = (int)$c['id'];
                            break;
                        }
                    }
                }
            }

            if (!$catId) {
                $errores++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "La categoría '{$categoriaInput}' no existe en el catálogo del sistema. Revise las categorías activas."];
                continue;
            }

            // 3. Detección de duplicados dentro del mismo archivo
            if (isset($batchSkus[$sku])) {
                $omitidosDuplicados++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "Código SKU repetido dentro del mismo archivo Excel (Fila {$batchSkus[$sku]})."];
                continue;
            }
            $batchSkus[$sku] = $numFila;

            // Barcode derivation si viene vacío
            if ($barcode === '') {
                if (preg_match('/^\d{8,14}$/', $sku)) {
                    $barcode = $sku;
                } else {
                    $barcode = '775' . str_pad((string)(abs(crc32($sku)) % 10000000000), 10, '0', STR_PAD_LEFT);
                }
            }
            if (isset($batchBarcodes[$barcode])) {
                $omitidosDuplicados++;
                $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => "Código de barras repetido dentro del archivo (Fila {$batchBarcodes[$barcode]})."];
                continue;
            }
            $batchBarcodes[$barcode] = $numFila;

            // 4. Identificar si el producto ya existe en la base de datos
            $existingProd = $this->repo->getBySku($sku);
            if (!$existingProd && $barcode !== '') {
                $existingProd = $this->repo->getByBarcode($barcode);
            }

            // Caso A: Producto Existente -> Actualizar datos e inventario de sucursal
            if ($existingProd) {
                try {
                    $prodId = (int)$existingProd['id'];
                    $resolvedImg = \App\Services\ProductExcelTemplateService::resolveProductImage($fotoRaw, $existingProd['imagen_url']);

                    $updatePayload = [
                        'categoria_id'  => $catId,
                        'nombre'        => $nombre,
                        'precio_venta'  => $precioVenta,
                        'costo_base'    => $costoBase,
                        'es_perecedero' => $esPerecedero,
                        'imagen_url'    => $resolvedImg
                    ];
                    if ($descripcion !== '') {
                        $updatePayload['descripcion'] = $descripcion;
                    }
                    $this->repo->update($prodId, $updatePayload);

                    // Actualizar inventario en la sucursal seleccionada
                    $fechaVenc = $esPerecedero ? date('Y-m-d', strtotime('+6 months')) : null;
                    foreach ($targetBranches as $sucId) {
                        $stmtInv = $db->prepare(
                            "INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden, clasificacion_abc)
                             VALUES (:suc, :prod, :stock, 10, 200, 25, 'B')
                             ON DUPLICATE KEY UPDATE stock_actual = :stock_upd"
                        );
                        $stmtInv->execute([
                            ':suc'       => $sucId,
                            ':prod'      => $prodId,
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
                                ':prod'  => $prodId,
                                ':lote'  => $codigoLote,
                                ':venc'  => $fechaVenc,
                                ':cant'  => $stockInicial,
                                ':disp'  => $stockInicial,
                                ':costo' => $costoBase
                            ]);
                            $loteId = (int)$db->lastInsertId();

                            $stmtKardex = $db->prepare(
                                "INSERT INTO movimientos_inventario (sucursal_id, producto_id, lote_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                                 VALUES (:suc, :prod, :lote, 'ENTRADA_COMPRA', 'IMPORT-EXCEL-UPD', :cant, :costo, 0, :nuevo, 'Actualización masiva Excel')"
                            );
                            $stmtKardex->execute([
                                ':suc'   => $sucId,
                                ':prod'  => $prodId,
                                ':lote'  => $loteId,
                                ':cant'  => $stockInicial,
                                ':costo' => $costoBase,
                                ':nuevo' => $stockInicial
                            ]);
                        }
                    }

                    $actualizados++;
                    $productosActualizados[] = [
                        'id'           => $prodId,
                        'codigo_sku'   => $sku,
                        'nombre'       => $nombre,
                        'precio_venta' => $precioVenta,
                        'stock_actual' => $stockInicial
                    ];
                } catch (\Exception $e) {
                    $errores++;
                    $detallesErrores[] = ['fila' => $numFila, 'codigo_sku' => $sku, 'error' => 'Error al actualizar producto: ' . $e->getMessage()];
                }
                continue;
            }

            // Caso B: Producto Nuevo -> Insertar en base de datos e inventarios
            try {
                $resolvedImg = \App\Services\ProductExcelTemplateService::resolveProductImage($fotoRaw);

                $newProdId = $this->repo->create([
                    'categoria_id'  => $catId,
                    'codigo_sku'    => $sku,
                    'codigo_barras' => $barcode,
                    'nombre'        => $nombre,
                    'descripcion'   => $descripcion,
                    'unidad_medida' => 'UNIDAD',
                    'precio_venta'  => $precioVenta,
                    'costo_base'    => $costoBase,
                    'es_perecedero' => $esPerecedero,
                    'imagen_url'    => $resolvedImg,
                    'estado'        => 1
                ]);

                // Asignar a inventarios de sucursales autorizadas
                $fechaVenc = $esPerecedero ? date('Y-m-d', strtotime('+6 months')) : null;
                foreach ($targetBranches as $sucId) {
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
            'total_nuevos'              => $importados,
            'total_actualizados'        => $actualizados,
            'total_omitidos_duplicados' => $omitidosDuplicados,
            'total_errores'             => $errores,
            'detalles_errores'          => $detallesErrores,
            'productos_importados'      => $productosCreados,
            'productos_actualizados'    => $productosActualizados,
            'sucursal_id'               => $targetSucursalId
        ], "Importación finalizada: {$importados} productos nuevos registrados, {$actualizados} actualizados, {$omitidosDuplicados} omitidos por duplicidad y {$errores} errores detectados.");
    }

    /**
     * GET /api/productos/template-excel
     * Retorna la plantilla oficial Excel (.xlsx) o estructura JSON
     */
    public function templateExcel(): void {
        $format = strtolower(trim((string)($_GET['format'] ?? '')));
        if ($format === 'xlsx' || isset($_GET['download'])) {
            $service = new \App\Services\ProductExcelTemplateService();
            $binary = $service->getBinaryContent();
            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            header('Content-Disposition: attachment; filename="Plantilla_Oficial_Importacion_Productos_Mass.xlsx"');
            header('Content-Length: ' . strlen($binary));
            header('Cache-Control: max-age=0, must-revalidate');
            echo $binary;
            exit;
        }

        $headers = [
            'FOTO',
            'SKU / BARRAS',
            'NOMBRE DEL PRODUCTO',
            'CATEGORÍA',
            'PRECIO DE VENTA',
            'COSTO BASE',
            'STOCK ACTUAL',
            'TIPO'
        ];

        $sampleRows = [
            [
                'FOTO'                => 'imagen_producto.jpg',
                'SKU / BARRAS'        => 'SKU-ACE-002',
                'NOMBRE DEL PRODUCTO' => 'Aceite Vegetal Primor Clásico 900 ml',
                'CATEGORÍA'           => 'Abarrotes y Despensa',
                'PRECIO DE VENTA'     => 8.90,
                'COSTO BASE'          => 6.20,
                'STOCK ACTUAL'        => 54,
                'TIPO'                => 'No Perecedero'
            ],
            [
                'FOTO'                => 'imagen_producto.jpg',
                'SKU / BARRAS'        => 'SKU-ARR-001',
                'NOMBRE DEL PRODUCTO' => 'Arroz Costeño Extra 1 kg',
                'CATEGORÍA'           => 'Abarrotes y Despensa',
                'PRECIO DE VENTA'     => 4.50,
                'COSTO BASE'          => 3.50,
                'STOCK ACTUAL'        => 90,
                'TIPO'                => 'No Perecedero'
            ],
            [
                'FOTO'                => 'imagen_producto.jpg',
                'SKU / BARRAS'        => 'SKU-MASS-016',
                'NOMBRE DEL PRODUCTO' => 'Arroz Extra Grano Largo Mass Bolsa 5 kg',
                'CATEGORÍA'           => 'Abarrotes y Despensa',
                'PRECIO DE VENTA'     => 22.90,
                'COSTO BASE'          => 18.20,
                'STOCK ACTUAL'        => 35,
                'TIPO'                => 'No Perecedero'
            ]
        ];

        Response::success([
            'headers'      => $headers,
            'categorias'   => [
                '1' => 'Abarrotes y Despensa',
                '2' => 'Lácteos y Huevos',
                '3' => 'Bebidas y Licores',
                '4' => 'Limpieza y Cuidado',
                '5' => 'Frutas y Verduras'
            ],
            'samples'      => $sampleRows,
            'download_url' => '/tiendasmass/backend/public/index.php/api/productos/template-excel?format=xlsx'
        ]);
    }
}
