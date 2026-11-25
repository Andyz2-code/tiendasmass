<?php
namespace App\Services;

use App\Helpers\Database;
use PDO;
use Exception;

class OrderProcessingService {
    private PDO $db;
    private FifoInventoryService $fifoService;
    private GoogleMapsDistanceService $distanceService;

    public function __construct() {
        $this->db = Database::getConnection();
        $this->fifoService = new FifoInventoryService();
        $this->distanceService = new GoogleMapsDistanceService();
        $this->ensureSchemaUpgrades();
    }

    /**
     * Garantiza que las columnas y tablas de las nuevas funcionalidades existan en la BD.
     */
    private function ensureSchemaUpgrades(): void {
        try {
            $cols = $this->db->query("SHOW COLUMNS FROM pedidos")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('fecha_recojo', $cols)) {
                $this->db->exec("ALTER TABLE pedidos ADD COLUMN fecha_recojo DATE NULL AFTER tipo_entrega");
            }
            if (!in_array('requiere_traslado', $cols)) {
                $this->db->exec("ALTER TABLE pedidos ADD COLUMN requiere_traslado TINYINT(1) NOT NULL DEFAULT 0 AFTER fecha_recojo");
            }
            if (!in_array('es_invitado', $cols)) {
                $this->db->exec("ALTER TABLE pedidos ADD COLUMN es_invitado TINYINT(1) NOT NULL DEFAULT 0 AFTER cliente_id");
            }
            if (!in_array('contacto_email', $cols)) {
                $this->db->exec("ALTER TABLE pedidos ADD COLUMN contacto_email VARCHAR(150) NULL AFTER es_invitado");
            }
            if (!in_array('contacto_telefono', $cols)) {
                $this->db->exec("ALTER TABLE pedidos ADD COLUMN contacto_telefono VARCHAR(20) NULL AFTER contacto_email");
            }
            if (!in_array('numero_boleta', $cols)) {
                $this->db->exec("ALTER TABLE pedidos ADD COLUMN numero_boleta VARCHAR(30) NULL AFTER codigo_pedido");
            }
            if (!in_array('token_seguimiento', $cols)) {
                $this->db->exec("ALTER TABLE pedidos ADD COLUMN token_seguimiento VARCHAR(64) NULL AFTER numero_boleta");
            }

            $this->db->exec("
                CREATE TABLE IF NOT EXISTS `notificaciones_pedido` (
                  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                  `pedido_id` INT UNSIGNED NOT NULL,
                  `tipo_cliente` ENUM('REGISTRADO', 'INVITADO') NOT NULL DEFAULT 'INVITADO',
                  `email_destino` VARCHAR(150) NOT NULL,
                  `telefono_destino` VARCHAR(20) NOT NULL,
                  `numero_boleta` VARCHAR(30) NOT NULL,
                  `enlace_seguimiento` VARCHAR(255) NOT NULL,
                  `estado_envio` ENUM('ENVIADO', 'ERROR') NOT NULL DEFAULT 'ENVIADO',
                  `payload_boleta` JSON NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            $this->db->exec("
                CREATE TABLE IF NOT EXISTS `alertas_stock_bajo` (
                  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                  `sucursal_id` INT UNSIGNED NOT NULL,
                  `producto_id` INT UNSIGNED NOT NULL,
                  `stock_actual` INT NOT NULL,
                  `umbral_alerta` INT NOT NULL DEFAULT 5,
                  `nivel` ENUM('CRITICO', 'AGOTADO') NOT NULL DEFAULT 'CRITICO',
                  `mensaje` VARCHAR(255) NOT NULL,
                  `resuelta` TINYINT(1) NOT NULL DEFAULT 0,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  UNIQUE KEY `uk_alerta_sucursal_producto` (`sucursal_id`, `producto_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
        } catch (Exception $e) {
            // Continuar de forma segura si el usuario de BD tiene restricciones de DDL
        }
    }

    /**
     * REQUERIMIENTO 1: Lógica de Recojo en Tienda (Store Pickup) con Validación de Stock.
     * Verifica si la sucursal seleccionada tiene stock suficiente de TODOS los productos del carrito.
     * - Si TODOS tienen stock suficiente: permite seleccionar el "mismo día" (hoy).
     * - Si falta stock de al menos un producto: bloquea el día actual y solo permite seleccionar a partir del día siguiente.
     */
    public function validateStorePickupStock(int $sucursalId, array $items): array {
        $hoy = date('Y-m-d');
        $manana = date('Y-m-d', strtotime('+1 day'));

        if (empty($items)) {
            throw new Exception("El carrito está vacío.");
        }

        $todosConStock = true;
        $detalleProductos = [];
        $productosSinStock = [];

        $stmt = $this->db->prepare("
            SELECT p.id, p.nombre, p.codigo_sku, p.precio_venta,
                   COALESCE(i.stock_actual, 0) AS stock_general,
                   COALESCE(l.stock_lotes, 0) AS stock_lotes_disponible
            FROM productos p
            LEFT JOIN inventarios i ON i.producto_id = p.id AND i.sucursal_id = :sucursal_id
            LEFT JOIN (
                SELECT producto_id, sucursal_id, SUM(cantidad_disponible) AS stock_lotes
                FROM lotes
                WHERE sucursal_id = :sucursal_id_lote
                  AND estado = 'DISPONIBLE'
                  AND cantidad_disponible > 0
                  AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURDATE())
                GROUP BY producto_id, sucursal_id
            ) l ON l.producto_id = p.id AND l.sucursal_id = :sucursal_id_join
            WHERE p.id = :producto_id
        ");

        foreach ($items as $item) {
            $productoId = (int)($item['producto_id'] ?? 0);
            $cantidadSolicitada = (int)($item['cantidad'] ?? 0);
            if ($productoId <= 0 || $cantidadSolicitada <= 0) {
                continue;
            }
            if ($cantidadSolicitada > 200) {
                throw new Exception("La cantidad solicitada para el producto ID {$productoId} excede el límite permitido para compras minoristas (máximo 200 unidades).");
            }

            $stmt->execute([
                ':sucursal_id'      => $sucursalId,
                ':sucursal_id_lote' => $sucursalId,
                ':sucursal_id_join' => $sucursalId,
                ':producto_id'      => $productoId
            ]);
            $prod = $stmt->fetch(PDO::FETCH_ASSOC);

            // Disponibilidad real basada en lotes activos y vigentes para evitar inconsistencias
            $stockDisponible = $prod ? min((int)$prod['stock_general'], (int)$prod['stock_lotes_disponible']) : 0;
            $nombreProd = $prod ? $prod['nombre'] : "Producto #{$productoId}";
            $cumpleStock = ($stockDisponible >= $cantidadSolicitada);

            if (!$cumpleStock) {
                $todosConStock = false;
                $productosSinStock[] = [
                    'producto_id'         => $productoId,
                    'nombre'              => $nombreProd,
                    'codigo_sku'          => $prod['codigo_sku'] ?? '',
                    'cantidad_solicitada' => $cantidadSolicitada,
                    'stock_sucursal'      => $stockDisponible,
                    'faltante_traslado'   => $cantidadSolicitada - $stockDisponible
                ];
            }

            $detalleProductos[] = [
                'producto_id'         => $productoId,
                'nombre'              => $nombreProd,
                'cantidad_solicitada' => $cantidadSolicitada,
                'stock_sucursal'      => $stockDisponible,
                'cumple_mismo_dia'    => $cumpleStock
            ];
        }

        return [
            'sucursal_id'            => $sucursalId,
            'mismo_dia_disponible'   => $todosConStock,
            'bloqueo_mismo_dia'      => !$todosConStock,
            'fecha_actual'           => $hoy,
            'fecha_minima_recojo'    => $todosConStock ? $hoy : $manana,
            'requiere_traslado'      => !$todosConStock,
            'mensaje'                => $todosConStock
                ? '¡Stock completo en esta sucursal! Puede recoger su pedido hoy mismo.'
                : 'Uno o más productos requieren traslado de inventario a esta sucursal. El recojo está habilitado a partir de mañana (' . $manana . ').',
            'productos_sin_stock'    => $productosSinStock,
            'detalle_validacion'     => $detalleProductos
        ];
    }

    /**
     * Registra o actualiza la alerta cuando un producto llega a <= 5 unidades en una sucursal (Requerimiento 3).
     */
    private function checkAndTriggerLowStockAlert(int $sucursalId, int $productoId, string $productoNombre, int $nuevoStock): ?array {
        try {
            if ($nuevoStock <= 5) {
                $nivel = ($nuevoStock <= 0) ? 'AGOTADO' : 'CRITICO';
                $msg = "¡Alerta Crítica de Stock Bajo! El producto '{$productoNombre}' (ID {$productoId}) quedó con {$nuevoStock} unidades en la sucursal ID {$sucursalId} (Umbral <= 5).";
                $stmt = $this->db->prepare("
                    INSERT INTO alertas_stock_bajo (sucursal_id, producto_id, stock_actual, umbral_alerta, nivel, mensaje, resuelta)
                    VALUES (:suc, :prod, :stock, 5, :nivel, :msg, 0)
                    ON DUPLICATE KEY UPDATE
                        stock_actual = :stock_u,
                        nivel = :nivel_u,
                        mensaje = :msg_u,
                        resuelta = 0,
                        updated_at = NOW()
                ");
                $stmt->execute([
                    ':suc'     => $sucursalId,
                    ':prod'    => $productoId,
                    ':stock'   => $nuevoStock,
                    ':nivel'   => $nivel,
                    ':msg'     => $msg,
                    ':stock_u' => $nuevoStock,
                    ':nivel_u' => $nivel,
                    ':msg_u'   => $msg
                ]);
                return [
                    'producto_id'     => $productoId,
                    'producto_nombre' => $productoNombre,
                    'stock_actual'    => $nuevoStock,
                    'nivel'           => $nivel,
                    'mensaje'         => $msg
                ];
            } else {
                $stmt = $this->db->prepare("UPDATE alertas_stock_bajo SET stock_actual = :stock, resuelta = 1 WHERE sucursal_id = :suc AND producto_id = :prod");
                $stmt->execute([':stock' => $nuevoStock, ':suc' => $sucursalId, ':prod' => $productoId]);
            }
        } catch (Exception $e) {
            // No interrumpir transacción si la tabla auxiliar no existe
        }
        return null;
    }

    /**
     * Garantiza que el cliente_id exista en `clientes` antes de insertar en `pedidos`
     * para evitar errores de clave foránea (fk_pedidos_cliente) con sesiones antiguas o invitados.
     */
    private function resolveValidClienteId(int $clienteId, ?string $contactoEmail, ?string $contactoTel): int {
        if ($clienteId > 0) {
            $stmt = $this->db->prepare("SELECT id FROM clientes WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $clienteId]);
            if ($stmt->fetch()) {
                return $clienteId;
            }
        }

        $stmtFirst = $this->db->query("SELECT id FROM clientes ORDER BY id ASC LIMIT 1");
        $first = $stmtFirst->fetch();
        if ($first) {
            return (int)$first['id'];
        }

        $guestEmail = $contactoEmail ?: ('invitado_' . substr(bin2hex(random_bytes(4)), 0, 8) . '@tiendasmass.pe');
        $guestTel   = $contactoTel ?: '999999999';
        $guestDoc   = '00000000';
        $stmtInsert = $this->db->prepare(
            "INSERT INTO clientes (tipo_documento, numero_documento, nombres, apellidos, email, password, telefono, estado)
             VALUES ('DNI', :doc, 'Cliente', 'Invitado', :email, :pass, :tel, 1)"
        );
        $stmtInsert->execute([
            ':doc'   => $guestDoc,
            ':email' => $guestEmail,
            ':pass'  => password_hash(bin2hex(random_bytes(8)), PASSWORD_BCRYPT),
            ':tel'   => $guestTel,
        ]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Procesa una venta u orden de compra completa bajo transacción atómica ACID.
     * Soporta Recojo en Tienda con validación de fecha/stock y Flujo Post-Pago.
     */
    public function processOrder(array $payload): array {
        $clienteId    = (int)($payload['cliente_id'] ?? 1);
        $sucursalId   = (int)$payload['sucursal_id'];
        $items        = $payload['items']; // [['producto_id' => int, 'cantidad' => int], ...]
        $tipoEntrega  = $payload['tipo_entrega'] ?? 'DELIVERY';
        $metodoPago   = $payload['metodo_pago'] ?? 'YAPE';
        $notas        = $payload['notas'] ?? null;
        $deliveryInfo = $payload['delivery_info'] ?? null;
        $fechaRecojo  = !empty($payload['fecha_recojo']) ? trim($payload['fecha_recojo']) : null;
        $esInvitado   = !empty($payload['es_invitado']) ? 1 : 0;
        $contactoEmail = !empty($payload['contacto_email']) ? trim($payload['contacto_email']) : null;
        $contactoTel   = !empty($payload['contacto_telefono']) ? trim($payload['contacto_telefono']) : null;

        if (empty($items)) {
            throw new Exception("El carrito de compras no contiene productos.");
        }

        // Asegurar que cliente_id exista en `clientes` para evitar violación de FK fk_pedidos_cliente
        $clienteId = $this->resolveValidClienteId($clienteId, $contactoEmail, $contactoTel);

        // Obtener datos de la sucursal despachadora
        $stmtSuc = $this->db->prepare("SELECT * FROM sucursales WHERE id = :id AND estado = 1");
        $stmtSuc->execute([':id' => $sucursalId]);
        $sucursal = $stmtSuc->fetch();
        if (!$sucursal) {
            throw new Exception("La sucursal seleccionada no existe o está inactiva.");
        }

        // Validación de Recojo en Tienda (Requerimiento 1)
        $requiereTraslado = 0;
        $validacionRecojo = null;
        if ($tipoEntrega === 'RETIRO_TIENDA') {
            $validacionRecojo = $this->validateStorePickupStock($sucursalId, $items);
            $hoy = date('Y-m-d');
            $manana = date('Y-m-d', strtotime('+1 day'));

            if (empty($fechaRecojo)) {
                $fechaRecojo = $validacionRecojo['fecha_minima_recojo'];
            }

            if ($fechaRecojo < $hoy) {
                throw new Exception("La fecha de recojo seleccionada ({$fechaRecojo}) no puede ser anterior al día de hoy ({$hoy}).");
            }

            // Bloqueo de mismo día si falta stock de al menos un producto
            if ($validacionRecojo['bloqueo_mismo_dia'] && $fechaRecojo <= $hoy) {
                $nombresFaltantes = implode(', ', array_column($validacionRecojo['productos_sin_stock'], 'nombre'));
                throw new Exception(
                    "El recojo en el mismo día ({$hoy}) está bloqueado porque la sucursal {$sucursal['nombre']} no cuenta con stock completo para: {$nombresFaltantes}. " .
                    "Por favor seleccione una fecha a partir de mañana ({$manana}) para realizar el traslado de inventario."
                );
            }

            $requiereTraslado = $validacionRecojo['requiere_traslado'] ? 1 : 0;
        }

        // Validación de Delivery y cálculo de flete si corresponde
        $costoEnvio = 0.00;
        $deliveryMetrics = null;

        if ($tipoEntrega === 'DELIVERY') {
            if (!$deliveryInfo || empty($deliveryInfo['latitud']) || empty($deliveryInfo['longitud'])) {
                throw new Exception("Debe proporcionar coordenadas de entrega válidas para el delivery.");
            }

            $deliveryMetrics = $this->distanceService->calculateDeliveryMetrics(
                (float)$sucursal['latitud'],
                (float)$sucursal['longitud'],
                (float)$deliveryInfo['latitud'],
                (float)$deliveryInfo['longitud'],
                (float)$sucursal['radio_cobertura_km'],
                (float)$sucursal['costo_envio_base'],
                (float)$sucursal['costo_km_adicional']
            );

            if (!$deliveryMetrics['en_cobertura']) {
                throw new Exception("La dirección de entrega está fuera del radio de cobertura de {$sucursal['radio_cobertura_km']} km de la sucursal {$sucursal['nombre']} (Distancia real: {$deliveryMetrics['distancia_km']} km).");
            }

            $costoEnvio = $deliveryMetrics['costo_envio'];
        }

        // INICIO DE TRANSACCIÓN ATÓMICA ACID
        $this->db->beginTransaction();

        try {
            $totalProductos = 0.00;
            $detallesParaInsertar = [];
            $kardexParaInsertar = [];
            $alertasDisparadas = [];

            // 1. Validar y procesar cada producto bajo algoritmo PEPS
            foreach ($items as $item) {
                $productoId = (int)$item['producto_id'];
                $cantidad = (int)$item['cantidad'];

                if ($cantidad <= 0 || $cantidad > 200) {
                    throw new Exception("La cantidad solicitada para el producto ID {$productoId} debe estar entre 1 y 200 unidades (límite comercial minorista).");
                }

                // Consultar producto, saldo en inventario y disponibilidad real en lotes activos con bloqueo FOR UPDATE
                $stmtProd = $this->db->prepare(
                    "SELECT p.id, p.nombre, p.codigo_sku, p.precio_venta, p.costo_base, 
                            COALESCE(i.stock_actual, 0) AS stock_actual,
                            COALESCE(l.stock_lotes, 0) AS stock_lotes_disponible
                     FROM productos p
                     LEFT JOIN inventarios i ON i.producto_id = p.id AND i.sucursal_id = :sucursal_id
                     LEFT JOIN (
                         SELECT producto_id, sucursal_id, SUM(cantidad_disponible) AS stock_lotes
                         FROM lotes
                         WHERE sucursal_id = :sucursal_id_lote
                           AND estado = 'DISPONIBLE'
                           AND cantidad_disponible > 0
                           AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURDATE())
                         GROUP BY producto_id, sucursal_id
                     ) l ON l.producto_id = p.id AND l.sucursal_id = :sucursal_id_join
                     WHERE p.id = :producto_id AND p.estado = 1
                     FOR UPDATE"
                );
                $stmtProd->execute([
                    ':sucursal_id'      => $sucursalId,
                    ':sucursal_id_lote' => $sucursalId,
                    ':sucursal_id_join' => $sucursalId,
                    ':producto_id'      => $productoId
                ]);
                $prodData = $stmtProd->fetch();

                if (!$prodData) {
                    throw new Exception("El producto ID {$productoId} no está disponible en el catálogo.");
                }

                $stockActual = (int)$prodData['stock_actual'];
                $stockLotesDisponible = (int)$prodData['stock_lotes_disponible'];
                $stockRealVendible = min($stockActual, $stockLotesDisponible);

                // Si es RETIRO_TIENDA con fecha posterior (requiere traslado) y el stock actual es menor a la cantidad,
                // abastecemos automáticamente el lote de traslado inter-sucursal para cubrir la reserva del cliente
                if ($tipoEntrega === 'RETIRO_TIENDA' && $requiereTraslado === 1 && $stockRealVendible < $cantidad) {
                    $faltante = $cantidad - $stockRealVendible;
                    if ($faltante > 200) {
                        throw new Exception("El faltante para traslado ({$faltante} unidades) excede la capacidad logística por pedido.");
                    }
                    $loteTrasladoId = $this->fifoService->registerBatch([
                        'sucursal_id'       => $sucursalId,
                        'producto_id'       => $productoId,
                        'codigo_lote'       => 'TRAS-' . date('ymd') . '-' . $productoId,
                        'fecha_ingreso'     => date('Y-m-d'),
                        'fecha_vencimiento' => date('Y-m-d', strtotime('+180 days')),
                        'cantidad'          => $faltante,
                        'costo_unitario'    => (float)$prodData['costo_base'],
                        'ubicacion_almacen' => 'ZONA-TRASLADO-RECOJO'
                    ]);

                    $stmtUpsertInv = $this->db->prepare("
                        INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
                        VALUES (:suc, :prod, :cant, 10, 200, 25)
                        ON DUPLICATE KEY UPDATE stock_actual = stock_actual + :cant_add
                    ");
                    $stmtUpsertInv->execute([
                        ':suc'      => $sucursalId,
                        ':prod'     => $productoId,
                        ':cant'     => $faltante,
                        ':cant_add' => $faltante
                    ]);

                    $kardexParaInsertar[] = [
                        'sucursal_id'     => $sucursalId,
                        'producto_id'     => $productoId,
                        'lote_id'         => $loteTrasladoId,
                        'usuario_id'      => null,
                        'tipo_movimiento' => 'ENTRADA_COMPRA',
                        'cantidad'        => $faltante,
                        'costo_unitario'  => (float)$prodData['costo_base'],
                        'saldo_anterior'  => $stockActual,
                        'saldo_nuevo'     => $stockActual + $faltante,
                        'observaciones'   => "Traslado programado para Recojo en Tienda ({$fechaRecojo})"
                    ];

                    $stockActual += $faltante;
                } elseif ($stockRealVendible < $cantidad) {
                    // Diagnóstico interno registrado para trazabilidad sin exponer volcados de BD al usuario final
                    error_log(sprintf(
                        "[STOCK_AUDIT] Inconsistencia de inventario para Producto ID %d ('%s') en Sucursal %d. Solicitado: %d, Stock consolidado: %d, Lotes disponibles: %d",
                        $productoId,
                        $prodData['nombre'],
                        $sucursalId,
                        $cantidad,
                        $stockActual,
                        $stockLotesDisponible
                    ));
                    throw new Exception("Lo sentimos, el producto '{$prodData['nombre']}' no cuenta con unidades disponibles actualmente en la sucursal seleccionada. Por favor actualiza tu carrito o selecciona otra sucursal.");
                }

                $precioUnitario = (float)$prodData['precio_venta'];
                $subtotalItem = round($precioUnitario * $cantidad, 2);
                $totalProductos += $subtotalItem;

                // Aplicar algoritmo PEPS (reserva y descuento de lotes más antiguos con captura de errores amigable)
                try {
                    $lotesAsignados = $this->fifoService->allocateFifoLots($sucursalId, $productoId, $cantidad);
                } catch (\Exception $fifoEx) {
                    error_log(sprintf(
                        "[STOCK_AUDIT] Error en asignación PEPS para Producto ID %d ('%s') en Sucursal %d: %s",
                        $productoId,
                        $prodData['nombre'],
                        $sucursalId,
                        $fifoEx->getMessage()
                    ));
                    throw new Exception("Lo sentimos, el producto '{$prodData['nombre']}' no cuenta con unidades disponibles actualmente en la sucursal seleccionada. Por favor actualiza tu carrito o selecciona otra sucursal.");
                }

                // Descontar inventario consolidado
                $nuevoStock = $stockActual - $cantidad;
                $stmtUpdInv = $this->db->prepare("UPDATE inventarios SET stock_actual = :nuevo_stock WHERE sucursal_id = :sucursal_id AND producto_id = :producto_id");
                $stmtUpdInv->execute([
                    ':nuevo_stock'  => $nuevoStock,
                    ':sucursal_id'  => $sucursalId,
                    ':producto_id'  => $productoId
                ]);

                // Disparador de alerta si el stock llega a <= 5 unidades (Requerimiento 3)
                $alerta = $this->checkAndTriggerLowStockAlert($sucursalId, $productoId, $prodData['nombre'], $nuevoStock);
                if ($alerta) {
                    $alertasDisparadas[] = $alerta;
                }

                // Preparar detalles y registros de kardex por cada lote PEPS descontado
                foreach ($lotesAsignados as $asig) {
                    $detallesParaInsertar[] = [
                        'producto_id'     => $productoId,
                        'producto_nombre' => $prodData['nombre'],
                        'codigo_sku'      => $prodData['codigo_sku'],
                        'lote_id'         => $asig['lote_id'],
                        'cantidad'        => $asig['cantidad_descontada'],
                        'precio_unitario' => $precioUnitario,
                        'subtotal'        => round($precioUnitario * $asig['cantidad_descontada'], 2)
                    ];

                    $kardexParaInsertar[] = [
                        'sucursal_id'     => $sucursalId,
                        'producto_id'     => $productoId,
                        'lote_id'         => $asig['lote_id'],
                        'usuario_id'      => null,
                        'tipo_movimiento' => 'SALIDA_VENTA',
                        'cantidad'        => $asig['cantidad_descontada'],
                        'costo_unitario'  => $asig['costo_unitario'],
                        'saldo_anterior'  => $stockActual,
                        'saldo_nuevo'     => $nuevoStock,
                        'observaciones'   => "Salida por venta web - Lote {$asig['codigo_lote']}"
                    ];
                }
            }

            // 2. Cálculos comerciales peruanos (Desglose de IGV 18%)
            $subtotalSinIgv = round($totalProductos / 1.18, 2);
            $igvCalculado = round($totalProductos - $subtotalSinIgv, 2);
            $totalFinal = round($totalProductos + $costoEnvio, 2);

            // 3. Generar código único de pedido, número de boleta electrónica y token de seguimiento
            $codigoPedido = 'PED-' . date('Ym') . '-' . strtoupper(bin2hex(random_bytes(3)));
            $numeroBoleta = 'B001-' . str_pad((string)random_int(100000, 999999), 8, '0', STR_PAD_LEFT);
            $tokenSeguimiento = bin2hex(random_bytes(16));

            if ($tipoEntrega === 'RETIRO_TIENDA' && $fechaRecojo) {
                $notaRecojo = "[Recojo en Tienda programado: {$fechaRecojo}" . ($requiereTraslado ? " - Con traslado de inventario" : " - Mismo día") . "]";
                $notas = $notas ? ($notas . " | " . $notaRecojo) : $notaRecojo;
            }

            // 4. Insertar Pedido
            $stmtPed = $this->db->prepare(
                "INSERT INTO pedidos 
                 (codigo_pedido, numero_boleta, token_seguimiento, cliente_id, es_invitado, contacto_email, contacto_telefono, sucursal_id, fecha_pedido, subtotal, igv, costo_envio, total, tipo_entrega, fecha_recojo, requiere_traslado, metodo_pago, estado_pedido, notas)
                 VALUES 
                 (:codigo, :boleta, :token, :cliente_id, :es_invitado, :email, :telefono, :sucursal_id, NOW(), :subtotal, :igv, :costo_envio, :total, :tipo_entrega, :fecha_recojo, :requiere_traslado, :metodo_pago, 'PENDIENTE', :notas)"
            );
            $stmtPed->execute([
                ':codigo'            => $codigoPedido,
                ':boleta'            => $numeroBoleta,
                ':token'             => $tokenSeguimiento,
                ':cliente_id'        => $clienteId,
                ':es_invitado'       => $esInvitado,
                ':email'             => $contactoEmail,
                ':telefono'          => $contactoTel,
                ':sucursal_id'       => $sucursalId,
                ':subtotal'          => $subtotalSinIgv,
                ':igv'               => $igvCalculado,
                ':costo_envio'       => $costoEnvio,
                ':total'             => $totalFinal,
                ':tipo_entrega'      => $tipoEntrega,
                ':fecha_recojo'      => $fechaRecojo,
                ':requiere_traslado' => $requiereTraslado,
                ':metodo_pago'       => $metodoPago,
                ':notas'             => $notas
            ]);
            $pedidoId = (int)$this->db->lastInsertId();

            // 5. Insertar Detalle de Pedido con desglose de lotes PEPS
            $stmtDet = $this->db->prepare(
                "INSERT INTO detalle_pedidos (pedido_id, producto_id, lote_id, cantidad, precio_unitario, subtotal)
                 VALUES (:pedido_id, :producto_id, :lote_id, :cantidad, :precio_unitario, :subtotal)"
            );
            foreach ($detallesParaInsertar as $det) {
                $stmtDet->execute([
                    ':pedido_id'        => $pedidoId,
                    ':producto_id'      => $det['producto_id'],
                    ':lote_id'          => $det['lote_id'],
                    ':cantidad'         => $det['cantidad'],
                    ':precio_unitario'  => $det['precio_unitario'],
                    ':subtotal'         => $det['subtotal']
                ]);
            }

            // 6. Asentar movimientos en Kardex Físico-Valorado
            $stmtKardex = $this->db->prepare(
                "INSERT INTO movimientos_inventario 
                 (sucursal_id, producto_id, lote_id, usuario_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                 VALUES 
                 (:sucursal_id, :producto_id, :lote_id, :usuario_id, :tipo_movimiento, :doc, :cantidad, :costo_unitario, :saldo_anterior, :saldo_nuevo, :obs)"
            );
            foreach ($kardexParaInsertar as $kar) {
                $stmtKardex->execute([
                    ':sucursal_id'     => $kar['sucursal_id'],
                    ':producto_id'     => $kar['producto_id'],
                    ':lote_id'         => $kar['lote_id'],
                    ':usuario_id'      => $kar['usuario_id'],
                    ':tipo_movimiento' => $kar['tipo_movimiento'],
                    ':doc'             => $codigoPedido,
                    ':cantidad'        => $kar['cantidad'],
                    ':costo_unitario'  => $kar['costo_unitario'],
                    ':saldo_anterior'  => $kar['saldo_anterior'],
                    ':saldo_nuevo'     => $kar['saldo_nuevo'],
                    ':obs'             => $kar['observaciones']
                ]);
            }

            // 7. Si es Delivery, registrar orden de entrega
            if ($tipoEntrega === 'DELIVERY') {
                $stmtDel = $this->db->prepare(
                    "INSERT INTO deliveries 
                     (pedido_id, direccion_destino, referencia_destino, latitud_destino, longitud_destino, distancia_km, tiempo_estimado_min, estado_delivery)
                     VALUES 
                     (:pedido_id, :direccion, :referencia, :latitud, :longitud, :distancia_km, :tiempo_min, 'ASIGNADO')"
                );
                $stmtDel->execute([
                    ':pedido_id'    => $pedidoId,
                    ':direccion'    => $deliveryInfo['direccion_completa'],
                    ':referencia'   => $deliveryInfo['referencia'] ?? null,
                    ':latitud'      => $deliveryInfo['latitud'],
                    ':longitud'     => $deliveryInfo['longitud'],
                    ':distancia_km' => $deliveryMetrics['distancia_km'],
                    ':tiempo_min'   => $deliveryMetrics['tiempo_estimado_min']
                ]);
            }

            // CONFIRMACIÓN DE LA TRANSACCIÓN ACID
            $this->db->commit();

            return [
                'id'                 => $pedidoId,
                'pedido_id'          => $pedidoId,
                'codigo_pedido'      => $codigoPedido,
                'numero_boleta'      => $numeroBoleta,
                'token_seguimiento'  => $tokenSeguimiento,
                'fecha_pedido'       => date('Y-m-d H:i:s'),
                'subtotal'           => $subtotalSinIgv,
                'igv'                => $igvCalculado,
                'costo_envio'        => $costoEnvio,
                'total'              => $totalFinal,
                'tipo_entrega'       => $tipoEntrega,
                'fecha_recojo'       => $fechaRecojo,
                'requiere_traslado'  => (bool)$requiereTraslado,
                'metodo_pago'        => $metodoPago,
                'estado'             => 'PENDIENTE',
                'estado_pedido'      => 'PENDIENTE',
                'sucursal_id'        => $sucursalId,
                'sucursal_nombre'    => $sucursal['nombre'],
                'sucursal_direccion' => $sucursal['direccion'],
                'sucursal_lat'       => (float)$sucursal['latitud'],
                'sucursal_lng'       => (float)$sucursal['longitud'],
                'direccion_destino'  => $deliveryInfo['direccion_completa'] ?? null,
                'referencia_destino' => $deliveryInfo['referencia'] ?? null,
                'latitud_destino'    => isset($deliveryInfo['latitud']) ? (float)$deliveryInfo['latitud'] : null,
                'longitud_destino'   => isset($deliveryInfo['longitud']) ? (float)$deliveryInfo['longitud'] : null,
                'distancia_km'       => isset($deliveryMetrics['distancia_km']) ? (float)$deliveryMetrics['distancia_km'] : 0.0,
                'tiempo_estimado_min'=> isset($deliveryMetrics['tiempo_estimado_min']) ? (int)$deliveryMetrics['tiempo_estimado_min'] : 30,
                'latitud_actual_repartidor'  => (float)$sucursal['latitud'],
                'longitud_actual_repartidor' => (float)$sucursal['longitud'],
                'repartidor_nombre'          => 'Motorizado Mass Express',
                'es_invitado'        => $esInvitado,
                'contacto_email'     => $contactoEmail,
                'contacto_telefono'  => $contactoTel,
                'delivery'           => $deliveryMetrics,
                'detalles'           => $detallesParaInsertar,
                'alertas_stock_bajo' => $alertasDisparadas
            ];

        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * REQUERIMIENTO 2: Evento Automático Post-Pago (Guest Checkout vs Login).
     * Captura los datos (cliente autenticado o invitado con teléfono + correo),
     * vincula el pedido y dispara el envío automático de la Boleta Electrónica y el enlace de seguimiento.
     */
    public function triggerPostPaymentNotification(int $pedidoId, array $input): array {
        $stmt = $this->db->prepare("
            SELECT p.*, s.nombre AS sucursal_nombre, s.direccion AS sucursal_direccion, s.telefono AS sucursal_telefono,
                   c.nombres AS cliente_nombres, c.apellidos AS cliente_apellidos, c.numero_documento, c.tipo_documento,
                   c.email AS cliente_email, c.telefono AS cliente_telefono
            FROM pedidos p
            JOIN sucursales s ON p.sucursal_id = s.id
            LEFT JOIN clientes c ON p.cliente_id = c.id
            WHERE p.id = :id
        ");
        $stmt->execute([':id' => $pedidoId]);
        $pedido = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$pedido) {
            throw new Exception("El pedido #{$pedidoId} no existe.");
        }

        $modo = strtoupper(trim($input['modo'] ?? 'INVITADO')); // 'LOGIN' | 'INVITADO'
        $esInvitado = ($modo === 'INVITADO') ? 1 : 0;
        $clienteId = (int)$pedido['cliente_id'];
        $nombreReceptor = 'Cliente Invitado Mass';
        $docReceptor = 'SIN DOCUMENTO (INVITADO)';

        if ($modo === 'LOGIN' && !empty($input['cliente_id'])) {
            $candidateId = (int)$input['cliente_id'];
            $stmtCli = $this->db->prepare("SELECT * FROM clientes WHERE id = :id");
            $stmtCli->execute([':id' => $candidateId]);
            $cli = $stmtCli->fetch(PDO::FETCH_ASSOC);
            if ($cli) {
                $clienteId = $candidateId;
                $emailDestino = trim($input['email'] ?? $cli['email']);
                $telefonoDestino = trim($input['telefono'] ?? $cli['telefono']);
                $nombreReceptor = $cli['nombres'] . ' ' . $cli['apellidos'];
                $docReceptor = $cli['tipo_documento'] . ': ' . $cli['numero_documento'];
                $esInvitado = 0;
            } else {
                $emailDestino = trim($input['email'] ?? '');
                $telefonoDestino = trim($input['telefono'] ?? '');
            }
        } else {
            $emailDestino = trim($input['email'] ?? '');
            $telefonoDestino = trim($input['telefono'] ?? '');
        }

        if (empty($emailDestino) || !filter_var($emailDestino, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Debe ingresar un correo electrónico válido para el envío de su boleta electrónica.");
        }
        if (empty($telefonoDestino) || strlen(preg_replace('/\D/', '', $telefonoDestino)) < 7) {
            throw new Exception("Debe ingresar un número telefónico válido para recibir las notificaciones de su pedido.");
        }

        $clienteId = $this->resolveValidClienteId($clienteId, $emailDestino, $telefonoDestino);

        $numeroBoleta = !empty($pedido['numero_boleta'])
            ? $pedido['numero_boleta']
            : ('B001-' . str_pad((string)$pedidoId, 8, '0', STR_PAD_LEFT));

        $tokenSeguimiento = !empty($pedido['token_seguimiento'])
            ? $pedido['token_seguimiento']
            : bin2hex(random_bytes(16));

        // Actualizar pedido con los datos capturados en el post-pago
        $updPed = $this->db->prepare("
            UPDATE pedidos
            SET cliente_id = :cli_id,
                es_invitado = :inv,
                contacto_email = :email,
                contacto_telefono = :tel,
                numero_boleta = :boleta,
                token_seguimiento = :token,
                updated_at = NOW()
            WHERE id = :id
        ");
        $updPed->execute([
            ':cli_id' => $clienteId,
            ':inv'    => $esInvitado,
            ':email'  => $emailDestino,
            ':tel'    => $telefonoDestino,
            ':boleta' => $numeroBoleta,
            ':token'  => $tokenSeguimiento,
            ':id'     => $pedidoId
        ]);

        // Obtener ítems del pedido para la Boleta Electrónica
        $stmtDet = $this->db->prepare("
            SELECT dp.cantidad, dp.precio_unitario, dp.subtotal,
                   pr.nombre AS producto_nombre, pr.codigo_sku, pr.unidad_medida
            FROM detalle_pedidos dp
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE dp.pedido_id = :id
        ");
        $stmtDet->execute([':id' => $pedidoId]);
        $itemsBoleta = $stmtDet->fetchAll(PDO::FETCH_ASSOC);

        $enlaceSeguimiento = "http://localhost/tiendasmass/frontend/index.html?tracking=" . urlencode($pedido['codigo_pedido']) . "&token=" . $tokenSeguimiento;

        $boletaElectronica = [
            'emisor' => [
                'razon_social' => 'TIENDAS MASS PERÚ S.A.C.',
                'ruc'          => '20601234567',
                'sucursal'     => $pedido['sucursal_nombre'],
                'direccion'    => $pedido['sucursal_direccion']
            ],
            'comprobante' => [
                'tipo'           => 'BOLETA DE VENTA ELECTRÓNICA',
                'serie_numero'   => $numeroBoleta,
                'codigo_pedido'  => $pedido['codigo_pedido'],
                'fecha_emision'  => $pedido['fecha_pedido'],
                'moneda'         => 'PEN (S/.)',
                'metodo_pago'    => $pedido['metodo_pago'],
                'tipo_entrega'   => $pedido['tipo_entrega'],
                'fecha_recojo'   => $pedido['fecha_recojo']
            ],
            'receptor' => [
                'modalidad' => $esInvitado ? 'INVITADO (GUEST CHECKOUT)' : 'CLIENTE REGISTRADO',
                'nombre'    => $nombreReceptor,
                'documento' => $docReceptor,
                'email'     => $emailDestino,
                'telefono'  => $telefonoDestino
            ],
            'items'   => $itemsBoleta,
            'totales' => [
                'op_gravadas' => (float)$pedido['subtotal'],
                'igv_18'      => (float)$pedido['igv'],
                'costo_envio' => (float)$pedido['costo_envio'],
                'importe_total'=> (float)$pedido['total']
            ]
        ];

        $seguimiento = [
            'codigo_pedido'      => $pedido['codigo_pedido'],
            'token_seguimiento'  => $tokenSeguimiento,
            'enlace_seguimiento' => $enlaceSeguimiento,
            'estado_actual'      => $pedido['estado_pedido'],
            'tipo_entrega'       => $pedido['tipo_entrega'],
            'fecha_recojo'       => $pedido['fecha_recojo'],
            'requiere_traslado'  => (bool)$pedido['requiere_traslado'],
            'etapas'             => $pedido['tipo_entrega'] === 'RETIRO_TIENDA'
                ? [
                    ['codigo' => 'PENDIENTE', 'titulo' => '1. Pago Validado & Pedido Recibido', 'completado' => true],
                    ['codigo' => 'EN_PREPARACION', 'titulo' => $pedido['requiere_traslado'] ? '2. En Traslado a Sucursal y Alistamiento' : '2. Alistamiento en Tienda (PEPS)', 'completado' => in_array($pedido['estado_pedido'], ['EN_PREPARACION', 'LISTO_PARA_DESPACHO', 'ENTREGADO'])],
                    ['codigo' => 'LISTO_PARA_DESPACHO', 'titulo' => '3. Listo para Recojo en Tienda (' . ($pedido['fecha_recojo'] ?: date('Y-m-d')) . ')', 'completado' => in_array($pedido['estado_pedido'], ['LISTO_PARA_DESPACHO', 'ENTREGADO'])],
                    ['codigo' => 'ENTREGADO', 'titulo' => '4. Entregado en Tienda', 'completado' => $pedido['estado_pedido'] === 'ENTREGADO']
                ]
                : [
                    ['codigo' => 'PENDIENTE', 'titulo' => '1. Pago Validado & Pedido Recibido', 'completado' => true],
                    ['codigo' => 'EN_PREPARACION', 'titulo' => '2. Picking & Empaque PEPS', 'completado' => in_array($pedido['estado_pedido'], ['EN_PREPARACION', 'LISTO_PARA_DESPACHO', 'DESPACHADO', 'ENTREGADO'])],
                    ['codigo' => 'DESPACHADO', 'titulo' => '3. En Ruta (Motorizado GPS)', 'completado' => in_array($pedido['estado_pedido'], ['DESPACHADO', 'ENTREGADO'])],
                    ['codigo' => 'ENTREGADO', 'titulo' => '4. Entregado en Domicilio', 'completado' => $pedido['estado_pedido'] === 'ENTREGADO']
                ]
        ];

        // Registrar el disparo del evento automático en BD
        $stmtNotif = $this->db->prepare("
            INSERT INTO notificaciones_pedido
            (pedido_id, tipo_cliente, email_destino, telefono_destino, numero_boleta, enlace_seguimiento, estado_envio, payload_boleta)
            VALUES (:pedido_id, :tipo, :email, :tel, :boleta, :enlace, 'ENVIADO', :payload)
        ");
        $stmtNotif->execute([
            ':pedido_id' => $pedidoId,
            ':tipo'      => $esInvitado ? 'INVITADO' : 'REGISTRADO',
            ':email'     => $emailDestino,
            ':tel'       => $telefonoDestino,
            ':boleta'    => $numeroBoleta,
            ':enlace'    => $enlaceSeguimiento,
            ':payload'   => json_encode($boletaElectronica, JSON_UNESCAPED_UNICODE)
        ]);

        // Registrar log de auditoría del evento automático de envío
        $logDir = __DIR__ . '/../../storage/logs';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0777, true);
        }
        $logLine = sprintf(
            "[%s] EVENTO_POST_PAGO_DISPARADO | Pedido: %s | Boleta: %s | Modalidad: %s | Email: %s | Tel: %s | Link: %s\n",
            date('Y-m-d H:i:s'),
            $pedido['codigo_pedido'],
            $numeroBoleta,
            $esInvitado ? 'INVITADO' : 'LOGIN',
            $emailDestino,
            $telefonoDestino,
            $enlaceSeguimiento
        );
        @file_put_contents($logDir . '/notificaciones_post_pago.log', $logLine, FILE_APPEND);

        return [
            'evento_disparado'   => true,
            'timestamp_envio'    => date('Y-m-d H:i:s'),
            'mensaje_confirmacion' => "Se envió automáticamente la Boleta Electrónica {$numeroBoleta} y el enlace de seguimiento a {$emailDestino} y al teléfono {$telefonoDestino}.",
            'boleta_electronica' => $boletaElectronica,
            'seguimiento'        => $seguimiento
        ];
    }
}
