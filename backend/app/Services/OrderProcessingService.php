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
    }

    /**
     * Procesa una venta u orden de compra completa bajo transacción atómica ACID.
     * 
     * @param array $payload Datos del pedido [cliente_id, sucursal_id, items, tipo_entrega, metodo_pago, delivery_info, notas]
     * @return array Detalle completo del pedido creado
     * @throws Exception En caso de falta de stock, fuera de cobertura o fallo de integridad
     */
    public function processOrder(array $payload): array {
        $clienteId  = (int)$payload['cliente_id'];
        $sucursalId = (int)$payload['sucursal_id'];
        $items      = $payload['items']; // [['producto_id' => int, 'cantidad' => int], ...]
        $tipoEntrega= $payload['tipo_entrega'] ?? 'DELIVERY';
        $metodoPago = $payload['metodo_pago'] ?? 'YAPE';
        $notas      = $payload['notas'] ?? null;
        $deliveryInfo = $payload['delivery_info'] ?? null;

        if (empty($items)) {
            throw new Exception("El carrito de compras no contiene productos.");
        }

        // Obtener datos de la sucursal despachadora
        $stmtSuc = $this->db->prepare("SELECT * FROM sucursales WHERE id = :id AND estado = 1");
        $stmtSuc->execute([':id' => $sucursalId]);
        $sucursal = $stmtSuc->fetch();
        if (!$sucursal) {
            throw new Exception("La sucursal seleccionada no existe o está inactiva.");
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

            // 1. Validar y procesar cada producto bajo algoritmo PEPS
            foreach ($items as $item) {
                $productoId = (int)$item['producto_id'];
                $cantidad = (int)$item['cantidad'];

                if ($cantidad <= 0) {
                    throw new Exception("La cantidad solicitada para el producto ID {$productoId} debe ser mayor a 0.");
                }

                // Consultar producto y stock general en sucursal con bloqueo FOR UPDATE
                $stmtProd = $this->db->prepare(
                    "SELECT p.id, p.nombre, p.precio_venta, i.stock_actual 
                     FROM productos p
                     JOIN inventarios i ON i.producto_id = p.id AND i.sucursal_id = :sucursal_id
                     WHERE p.id = :producto_id AND p.estado = 1
                     FOR UPDATE"
                );
                $stmtProd->execute([
                    ':sucursal_id' => $sucursalId,
                    ':producto_id' => $productoId
                ]);
                $prodData = $stmtProd->fetch();

                if (!$prodData) {
                    throw new Exception("El producto ID {$productoId} no está disponible en la sucursal seleccionada.");
                }

                $stockActual = (int)$prodData['stock_actual'];
                if ($stockActual < $cantidad) {
                    throw new Exception("Stock insuficiente para '{$prodData['nombre']}'. Disponible: {$stockActual}, Solicitado: {$cantidad}.");
                }

                $precioUnitario = (float)$prodData['precio_venta'];
                $subtotalItem = round($precioUnitario * $cantidad, 2);
                $totalProductos += $subtotalItem;

                // Aplicar algoritmo PEPS (reserva y descuento de lotes más antiguos)
                $lotesAsignados = $this->fifoService->allocateFifoLots($sucursalId, $productoId, $cantidad);

                // Descontar inventario consolidado
                $nuevoStock = $stockActual - $cantidad;
                $stmtUpdInv = $this->db->prepare("UPDATE inventarios SET stock_actual = :nuevo_stock WHERE sucursal_id = :sucursal_id AND producto_id = :producto_id");
                $stmtUpdInv->execute([
                    ':nuevo_stock'  => $nuevoStock,
                    ':sucursal_id'  => $sucursalId,
                    ':producto_id'  => $productoId
                ]);

                // Preparar detalles y registros de kardex por cada lote PEPS descontado
                foreach ($lotesAsignados as $asig) {
                    $detallesParaInsertar[] = [
                        'producto_id'     => $productoId,
                        'lote_id'         => $asig['lote_id'],
                        'cantidad'        => $asig['cantidad_descontada'],
                        'precio_unitario' => $precioUnitario,
                        'subtotal'        => round($precioUnitario * $asig['cantidad_descontada'], 2)
                    ];

                    $kardexParaInsertar[] = [
                        'sucursal_id'     => $sucursalId,
                        'producto_id'     => $productoId,
                        'lote_id'         => $asig['lote_id'],
                        'usuario_id'      => null, // Venta automática desde cliente
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
            // Subtotal sin IGV = Total Mercadería / 1.18
            // IGV (18%) = Total Mercadería - Subtotal sin IGV
            $subtotalSinIgv = round($totalProductos / 1.18, 2);
            $igvCalculado = round($totalProductos - $subtotalSinIgv, 2);
            $totalFinal = round($totalProductos + $costoEnvio, 2);

            // 3. Generar código único de pedido (ej: PED-202611-0089)
            $codigoPedido = 'PED-' . date('Ym') . '-' . strtoupper(bin2hex(random_bytes(3)));

            // 4. Insertar Pedido
            $stmtPed = $this->db->prepare(
                "INSERT INTO pedidos 
                 (codigo_pedido, cliente_id, sucursal_id, fecha_pedido, subtotal, igv, costo_envio, total, tipo_entrega, metodo_pago, estado_pedido, notas)
                 VALUES 
                 (:codigo, :cliente_id, :sucursal_id, NOW(), :subtotal, :igv, :costo_envio, :total, :tipo_entrega, :metodo_pago, 'PENDIENTE', :notas)"
            );
            $stmtPed->execute([
                ':codigo'       => $codigoPedido,
                ':cliente_id'   => $clienteId,
                ':sucursal_id'  => $sucursalId,
                ':subtotal'     => $subtotalSinIgv,
                ':igv'          => $igvCalculado,
                ':costo_envio'  => $costoEnvio,
                ':total'        => $totalFinal,
                ':tipo_entrega' => $tipoEntrega,
                ':metodo_pago'  => $metodoPago,
                ':notas'        => $notas
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
                'pedido_id'      => $pedidoId,
                'codigo_pedido'  => $codigoPedido,
                'fecha_pedido'   => date('Y-m-d H:i:s'),
                'subtotal'       => $subtotalSinIgv,
                'igv'            => $igvCalculado,
                'costo_envio'    => $costoEnvio,
                'total'          => $totalFinal,
                'tipo_entrega'   => $tipoEntrega,
                'metodo_pago'    => $metodoPago,
                'estado'         => 'PENDIENTE',
                'delivery'       => $deliveryMetrics
            ];

        } catch (Exception $e) {
            // Revertir cualquier cambio en la base de datos
            $this->db->rollBack();
            throw $e;
        }
    }
}
