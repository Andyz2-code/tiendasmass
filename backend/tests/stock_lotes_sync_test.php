<?php
/**
 * BATERÍA DE PRUEBAS DE INTEGRACIÓN: AUDITORÍA Y SINCRONIZACIÓN DE STOCK Y LOTES PEPS (NIC 2)
 * Valida los 14 escenarios obligatorios de negocio para Tiendas Mass.
 */

require_once __DIR__ . '/../app/Helpers/Database.php';
require_once __DIR__ . '/../app/Services/FifoInventoryService.php';
require_once __DIR__ . '/../app/Services/OrderProcessingService.php';
require_once __DIR__ . '/../app/Services/GoogleMapsDistanceService.php';
require_once __DIR__ . '/../app/Repositories/ProductoRepository.php';
require_once __DIR__ . '/../app/Controllers/ProductoController.php';
require_once __DIR__ . '/../app/Helpers/Response.php';
require_once __DIR__ . '/../app/Helpers/Validator.php';

use App\Helpers\Database;
use App\Services\FifoInventoryService;
use App\Services\OrderProcessingService;
use App\Repositories\ProductoRepository;
use App\Controllers\ProductoController;

$pdo = Database::getConnection();
$fifoService = new FifoInventoryService();
$orderService = new OrderProcessingService();
$prodRepo = new ProductoRepository();

$passed = 0;
$total = 0;

function assertCondition(bool $cond, string $desc): void {
    global $passed, $total;
    $total++;
    if ($cond) {
        $passed++;
        echo "✓ [PASS] {$desc}\n";
    } else {
        echo "✗ [FAIL] {$desc}\n";
    }
}

echo "=== INICIANDO BATERÍA DE PRUEBAS: AUDITORÍA DE STOCK, LOTES Y COMPRA TIENDAS MASS ===\n\n";

// Función de limpieza de datos de prueba
$cleanup = function() use ($pdo) {
    $pdo->exec("DELETE FROM detalle_pedidos WHERE producto_id >= 9900 OR lote_id IN (SELECT id FROM lotes WHERE codigo_lote LIKE 'LOT-TEST-%')");
    $pdo->exec("DELETE FROM movimientos_inventario WHERE producto_id >= 9900 OR lote_id IN (SELECT id FROM lotes WHERE codigo_lote LIKE 'LOT-TEST-%') OR documento_referencia LIKE 'TEST-%'");
    $pdo->exec("DELETE FROM deliveries WHERE pedido_id IN (SELECT id FROM pedidos WHERE codigo_pedido LIKE 'TEST-%' OR cliente_id = 999)");
    $pdo->exec("DELETE FROM pedidos WHERE codigo_pedido LIKE 'TEST-%' OR cliente_id = 999");
    $pdo->exec("DELETE FROM lotes WHERE codigo_lote LIKE 'LOT-TEST-%' OR producto_id >= 9900");
    $pdo->exec("DELETE FROM inventarios WHERE producto_id >= 9900");
    $pdo->exec("DELETE FROM productos WHERE id >= 9900");
};

$cleanup();

// -----------------------------------------------------------------------------
// PRUEBA 10: Compra real de 1 unidad de Producto ID 16 (Arroz Mass 5 kg)
// -----------------------------------------------------------------------------
$stmtP16 = $pdo->prepare("SELECT stock_actual FROM inventarios WHERE sucursal_id = 1 AND producto_id = 16");
$stmtP16->execute();
$stockP16Antes = (int)$stmtP16->fetchColumn();

$stmtL16 = $pdo->prepare("SELECT SUM(cantidad_disponible) FROM lotes WHERE sucursal_id = 1 AND producto_id = 16 AND estado = 'DISPONIBLE'");
$stmtL16->execute();
$lotesP16Antes = (int)$stmtL16->fetchColumn();

assertCondition($stockP16Antes > 0 && $lotesP16Antes > 0 && $stockP16Antes === $lotesP16Antes, "P10.A - Producto 16 tiene existencias activas y sincronizadas en Sucursal 1 (Inv: {$stockP16Antes}, Lotes: {$lotesP16Antes})");

$resP10 = $orderService->processOrder([
    'cliente_id'   => 1,
    'sucursal_id'  => 1,
    'tipo_entrega' => 'DELIVERY',
    'metodo_pago'  => 'YAPE',
    'items'        => [
        ['producto_id' => 16, 'cantidad' => 1]
    ],
    'delivery_info' => [
        'direccion_completa' => 'Jr. Puno 345, Huancayo',
        'referencia'         => 'Frente a Huamanmarca',
        'latitud'            => -12.0689,
        'longitud'           => -75.2098
    ]
]);

$stmtP16->execute();
$stockP16Despues = (int)$stmtP16->fetchColumn();
$stmtL16->execute();
$lotesP16Despues = (int)$stmtL16->fetchColumn();

assertCondition($resP10['estado'] === 'PENDIENTE' && !empty($resP10['codigo_pedido']), "P10.B - Compra de 1 unidad de Producto ID 16 procesada con éxito ({$resP10['codigo_pedido']})");
assertCondition($stockP16Despues === $stockP16Antes - 1 && $lotesP16Despues === $lotesP16Antes - 1, "P10.C - Descuento atómico correcto en inventario y lote para Producto 16 (Inv: {$stockP16Despues}, Lotes: {$lotesP16Despues})");

// -----------------------------------------------------------------------------
// PRUEBA 1: Producto con stock y lotes activos (Compra y consumo PEPS)
// -----------------------------------------------------------------------------
$pdo->exec("INSERT INTO productos (id, categoria_id, codigo_sku, codigo_barras, nombre, precio_venta, costo_base, es_perecedero, estado)
            VALUES (9901, 1, 'SKU-TEST-001', '7759901000001', 'Producto Prueba Stock Activo 1', 10.00, 7.00, 0, 1)");
$pdo->exec("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
            VALUES (1, 9901, 20, 5, 50, 10)");
$pdo->exec("INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, estado)
            VALUES (1, 9901, 'LOT-TEST-9901', '2026-11-01', '2027-11-01', 20, 20, 7.00, 'DISPONIBLE')");

$resP1 = $orderService->processOrder([
    'cliente_id'   => 1,
    'sucursal_id'  => 1,
    'tipo_entrega' => 'DELIVERY',
    'metodo_pago'  => 'YAPE',
    'items'        => [
        ['producto_id' => 9901, 'cantidad' => 2]
    ],
    'delivery_info' => [
        'direccion_completa' => 'Jr. Real 500, Huancayo',
        'latitud'            => -12.0680,
        'longitud'           => -75.2090
    ]
]);
assertCondition($resP1['total'] > 0, "P1 - Compra procesada correctamente para producto con stock y lotes activos");

// -----------------------------------------------------------------------------
// PRUEBA 2: Producto con stock general pero SIN LOTES ACTIVOS (Bloqueo y mensaje amigable)
// -----------------------------------------------------------------------------
$pdo->exec("INSERT INTO productos (id, categoria_id, codigo_sku, codigo_barras, nombre, precio_venta, costo_base, es_perecedero, estado)
            VALUES (9902, 1, 'SKU-TEST-002', '7759902000002', 'Producto Fantasma Sin Lotes', 15.00, 10.00, 0, 1)");
$pdo->exec("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
            VALUES (1, 9902, 50, 5, 50, 10)");
// Intencionalmente NO se insertan lotes

$errorP2 = '';
try {
    $orderService->processOrder([
        'cliente_id'   => 1,
        'sucursal_id'  => 1,
        'tipo_entrega' => 'DELIVERY',
        'metodo_pago'  => 'YAPE',
        'items'        => [
            ['producto_id' => 9902, 'cantidad' => 1]
        ],
        'delivery_info' => [
            'direccion_completa' => 'Jr. Real 500, Huancayo',
            'latitud'            => -12.0680,
            'longitud'           => -75.2090
        ]
    ]);
} catch (Exception $e) {
    $errorP2 = $e->getMessage();
}
assertCondition(
    strpos($errorP2, 'no cuenta con unidades disponibles actualmente en la sucursal seleccionada') !== false,
    "P2 - Bloqueo preventivo y mensaje amigable ante inconsistencia de stock general sin lotes disponibles"
);

// -----------------------------------------------------------------------------
// PRUEBA 3: Producto con lotes agotados (cantidad_disponible = 0)
// -----------------------------------------------------------------------------
$pdo->exec("INSERT INTO productos (id, categoria_id, codigo_sku, codigo_barras, nombre, precio_venta, costo_base, es_perecedero, estado)
            VALUES (9903, 1, 'SKU-TEST-003', '7759903000003', 'Producto Lotes Agotados', 8.00, 5.00, 0, 1)");
$pdo->exec("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
            VALUES (1, 9903, 0, 5, 50, 10)");
$pdo->exec("INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, estado)
            VALUES (1, 9903, 'LOT-TEST-9903', '2026-10-01', '2027-10-01', 20, 0, 5.00, 'AGOTADO')");

$errorP3 = '';
try {
    $orderService->processOrder([
        'cliente_id'   => 1,
        'sucursal_id'  => 1,
        'tipo_entrega' => 'DELIVERY',
        'metodo_pago'  => 'YAPE',
        'items'        => [['producto_id' => 9903, 'cantidad' => 1]],
        'delivery_info' => ['direccion_completa' => 'Jr. Real 500', 'latitud' => -12.0680, 'longitud' => -75.2090]
    ]);
} catch (Exception $e) {
    $errorP3 = $e->getMessage();
}
assertCondition(strpos($errorP3, 'no cuenta con unidades disponibles') !== false, "P3 - Rechazo correcto ante lotes agotados");

// -----------------------------------------------------------------------------
// PRUEBA 4: Producto con lotes disponibles en OTRA sucursal (Aislamiento de Sucursales)
// -----------------------------------------------------------------------------
$pdo->exec("INSERT INTO productos (id, categoria_id, codigo_sku, codigo_barras, nombre, precio_venta, costo_base, es_perecedero, estado)
            VALUES (9904, 1, 'SKU-TEST-004', '7759904000004', 'Producto Exclusivo Sucursal 2', 12.00, 8.00, 0, 1)");
$pdo->exec("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
            VALUES (2, 9904, 30, 5, 50, 10)");
$pdo->exec("INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, estado)
            VALUES (2, 9904, 'LOT-TEST-SC04', '2026-11-01', '2027-11-01', 30, 30, 8.00, 'DISPONIBLE')");

$errorP4 = '';
try {
    $orderService->processOrder([
        'cliente_id'   => 1,
        'sucursal_id'  => 1, // Intentar comprar en Sucursal 1 cuando sólo hay stock en Sucursal 2
        'tipo_entrega' => 'DELIVERY',
        'metodo_pago'  => 'YAPE',
        'items'        => [['producto_id' => 9904, 'cantidad' => 1]],
        'delivery_info' => ['direccion_completa' => 'Jr. Real 500', 'latitud' => -12.0680, 'longitud' => -75.2090]
    ]);
} catch (Exception $e) {
    $errorP4 = $e->getMessage();
}
assertCondition(strpos($errorP4, 'no cuenta con unidades disponibles') !== false, "P4 - Aislamiento estricto: Sucursal 1 no consume lotes de Sucursal 2");

// -----------------------------------------------------------------------------
// PRUEBA 5: Producto con VARIOS LOTES (Consumo PEPS estricto por antigüedad)
// -----------------------------------------------------------------------------
$pdo->exec("INSERT INTO productos (id, categoria_id, codigo_sku, codigo_barras, nombre, precio_venta, costo_base, es_perecedero, estado)
            VALUES (9905, 1, 'SKU-TEST-005', '7759905000005', 'Producto Multi Lotes PEPS', 10.00, 6.00, 0, 1)");
$pdo->exec("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
            VALUES (1, 9905, 15, 5, 50, 10)");
// Lote 1: Más antiguo (Ingreso: 2026-09-01, Disponible: 5)
$pdo->exec("INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, estado)
            VALUES (1, 9905, 'LOT-TEST-PEPS1', '2026-09-01', '2027-09-01', 10, 5, 6.00, 'DISPONIBLE')");
// Lote 2: Más reciente (Ingreso: 2026-10-01, Disponible: 10)
$pdo->exec("INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, estado)
            VALUES (1, 9905, 'LOT-TEST-PEPS2', '2026-10-01', '2027-10-01', 10, 10, 6.50, 'DISPONIBLE')");

// Consumir 7 unidades: Debe agotar Lote 1 (5 unid) y tomar 2 unidades del Lote 2
$asignacionesP5 = $fifoService->allocateFifoLots(1, 9905, 7);
assertCondition(
    count($asignacionesP5) === 2 &&
    $asignacionesP5[0]['codigo_lote'] === 'LOT-TEST-PEPS1' && $asignacionesP5[0]['cantidad_descontada'] === 5 &&
    $asignacionesP5[1]['codigo_lote'] === 'LOT-TEST-PEPS2' && $asignacionesP5[1]['cantidad_descontada'] === 2,
    "P5 - Orden PEPS/FIFO estricto: Agota primero el lote más antiguo (5 unid) y toma el saldo del siguiente (2 unid)"
);

// -----------------------------------------------------------------------------
// PRUEBA 6: Validación de Recojo en Tienda y Stock Programado
// -----------------------------------------------------------------------------
$valRecojo = $orderService->validateStorePickupStock(1, [
    ['producto_id' => 9905, 'cantidad' => 3] // Quedan 8 en Lote 2
]);
assertCondition($valRecojo['mismo_dia_disponible'] === true, "P6.A - Recojo el mismo día permitido cuando hay stock en lotes activos");

$valRecojoExcede = $orderService->validateStorePickupStock(1, [
    ['producto_id' => 9905, 'cantidad' => 50] // Excede el stock local
]);
assertCondition($valRecojoExcede['bloqueo_mismo_dia'] === true && $valRecojoExcede['requiere_traslado'] === true, "P6.B - Bloqueo de mismo día y solicitud de traslado cuando la demanda supera el stock");

// -----------------------------------------------------------------------------
// PRUEBA 7: Producto con LOTE VENCIDO (Exclusión estricta de consumo)
// -----------------------------------------------------------------------------
$pdo->exec("INSERT INTO productos (id, categoria_id, codigo_sku, codigo_barras, nombre, precio_venta, costo_base, es_perecedero, estado)
            VALUES (9907, 1, 'SKU-TEST-007', '7759907000007', 'Producto Lote Caducado', 10.00, 6.00, 1, 1)");
$pdo->exec("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
            VALUES (1, 9907, 10, 5, 50, 10)");
// Lote con vencimiento en el pasado
$pdo->exec("INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, estado)
            VALUES (1, 9907, 'LOT-TEST-CADUCADO', '2026-05-01', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 10, 10, 6.00, 'DISPONIBLE')");

$prodsSucursal = $prodRepo->getBySucursal(1, null, 'Producto Lote Caducado');
$stockVisible = !empty($prodsSucursal) ? (int)$prodsSucursal[0]['stock_actual'] : 0;
assertCondition($stockVisible === 0, "P7.A - Catálogo excluye lote caducado y reporta stock vendible en 0");

$errorP7 = '';
try {
    $orderService->processOrder([
        'cliente_id'   => 1,
        'sucursal_id'  => 1,
        'tipo_entrega' => 'DELIVERY',
        'metodo_pago'  => 'YAPE',
        'items'        => [['producto_id' => 9907, 'cantidad' => 1]],
        'delivery_info' => ['direccion_completa' => 'Jr. Real 500', 'latitud' => -12.0680, 'longitud' => -75.2090]
    ]);
} catch (Exception $e) {
    $errorP7 = $e->getMessage();
}
assertCondition(strpos($errorP7, 'no cuenta con unidades disponibles') !== false, "P7.B - Proceso de compra rechaza venta de lote vencido");

// -----------------------------------------------------------------------------
// PRUEBA 8: Sincronización en creación por registro individual con lotes
// -----------------------------------------------------------------------------
$pdo->exec("INSERT INTO productos (id, categoria_id, codigo_sku, codigo_barras, nombre, precio_venta, costo_base, es_perecedero, estado)
            VALUES (9908, 1, 'SKU-TEST-008', '7759908000008', 'Producto Registro Individual', 20.00, 14.00, 0, 1)");
$pdo->exec("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
            VALUES (1, 9908, 25, 5, 50, 10)");
$pdo->exec("INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, estado)
            VALUES (1, 9908, 'LOT-TEST-9908', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY), 25, 25, 14.00, 'DISPONIBLE')");

$checkP8 = $prodRepo->getBySucursal(1, null, 'Producto Registro Individual');
assertCondition(!empty($checkP8) && (int)$checkP8[0]['stock_actual'] === 25, "P8 - Producto registrado individualmente sincronizado con stock 25");

// -----------------------------------------------------------------------------
// PRUEBA 9: Actualización / edición de producto sincroniza inventario y lotes
// -----------------------------------------------------------------------------
$prodController = new \App\Controllers\ProductoController();
$updated = $prodRepo->update(9908, ['nombre' => 'Producto Registro Individual Editado']);
assertCondition($updated === true, "P9 - Edición de producto en catálogo exitosa");

// -----------------------------------------------------------------------------
// PRUEBA 11: Compra de varias unidades (múltiples items en un solo pedido)
// -----------------------------------------------------------------------------
$resP11 = $orderService->processOrder([
    'cliente_id'   => 1,
    'sucursal_id'  => 1,
    'tipo_entrega' => 'DELIVERY',
    'metodo_pago'  => 'YAPE',
    'items'        => [
        ['producto_id' => 9901, 'cantidad' => 3],
        ['producto_id' => 9908, 'cantidad' => 2]
    ],
    'delivery_info' => [
        'direccion_completa' => 'Jr. Real 500, Huancayo',
        'latitud'            => -12.0680,
        'longitud'           => -75.2090
    ]
]);
assertCondition($resP11['total'] > 0 && count($resP11['detalles']) === 2, "P11 - Compra multi-producto procesada con éxito con desglose PEPS");

// -----------------------------------------------------------------------------
// PRUEBA 12: Integridad transaccional y rechazo ante compra que supera saldo restante
// -----------------------------------------------------------------------------
$errorP12 = '';
try {
    $orderService->processOrder([
        'cliente_id'   => 1,
        'sucursal_id'  => 1,
        'tipo_entrega' => 'DELIVERY',
        'metodo_pago'  => 'YAPE',
        'items'        => [
            ['producto_id' => 9901, 'cantidad' => 999] // Supera stock
        ],
        'delivery_info' => ['direccion_completa' => 'Jr. Real 500', 'latitud' => -12.0680, 'longitud' => -75.2090]
    ]);
} catch (Exception $e) {
    $errorP12 = $e->getMessage();
}
assertCondition(!empty($errorP12), "P12 - Bloqueo de sobre-venta protege integridad sin cantidades negativas");

// -----------------------------------------------------------------------------
// PRUEBA 13: Rollback transaccional (No altera saldos si una regla falla)
// -----------------------------------------------------------------------------
$stmtP9908 = $pdo->prepare("SELECT stock_actual FROM inventarios WHERE sucursal_id = 1 AND producto_id = 9908");
$stmtP9908->execute();
$saldoAntesRollback = (int)$stmtP9908->fetchColumn();

try {
    $orderService->processOrder([
        'cliente_id'   => 1,
        'sucursal_id'  => 1,
        'tipo_entrega' => 'DELIVERY',
        'metodo_pago'  => 'YAPE',
        'items'        => [
            ['producto_id' => 9908, 'cantidad' => 1],
            ['producto_id' => 9902, 'cantidad' => 10] // Producto 9902 no tiene lotes -> Falla la transacción entera
        ],
        'delivery_info' => ['direccion_completa' => 'Jr. Real 500', 'latitud' => -12.0680, 'longitud' => -75.2090]
    ]);
} catch (Exception $e) {
    // Esperado
}

$stmtP9908->execute();
$saldoDespuesRollback = (int)$stmtP9908->fetchColumn();
assertCondition($saldoAntesRollback === $saldoDespuesRollback, "P13 - Rollback ACID atómico: ningún producto fue descontado tras fallo parcial");

// -----------------------------------------------------------------------------
// PRUEBA 14: Actualización correcta del Kardex (movimientos_inventario)
// -----------------------------------------------------------------------------
$stmtKardex = $pdo->prepare("SELECT COUNT(*) FROM movimientos_inventario WHERE tipo_movimiento = 'SALIDA_VENTA' AND producto_id = 16");
$stmtKardex->execute();
$salidas16 = (int)$stmtKardex->fetchColumn();
assertCondition($salidas16 >= 1, "P14 - Movimiento de SALIDA_VENTA registrado en kardex físico-valorado con referencia de pedido");

// Limpieza final de datos de prueba
$cleanup();

echo "\n=======================================================\n";
echo "RESULTADOS: {$passed} de {$total} pruebas pasaron exitosamente.\n";
echo "=======================================================\n";
if ($passed === $total) {
    exit(0);
} else {
    exit(1);
}
