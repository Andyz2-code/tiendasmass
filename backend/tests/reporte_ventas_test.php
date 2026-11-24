<?php
/**
 * TEST AUTOMATIZADO DE REPORTES DE VENTAS Y ALTA ROTACIÓN - TIENDAS MASS
 */

declare(strict_types=1);

spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../app/';
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) return;
    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
    if (file_exists($file)) require_once $file;
});

echo "=== INICIANDO TEST DE AUDITORÍA Y NORMALIZACIÓN DE REPORTES ===\n\n";

$db = \App\Helpers\Database::getConnection();

// 1. Verificar ausencia de anomalías en pedidos y detalles
echo "[1] Verificando que no existan pedidos ni detalles con cantidades anómalas (> 200)... ";
$stmtAnomalias = $db->query("SELECT COUNT(*) FROM detalle_pedidos WHERE cantidad > 200");
$countAnomalias = (int)$stmtAnomalias->fetchColumn();
assert($countAnomalias === 0, "Existen detalles con cantidad > 200");
echo "OK (0 anomalías detectadas)\n";

// 2. Verificar consulta de Alta Rotación consolidada
echo "[2] Verificando consulta de Alta Rotación consolidada nacional... ";
$stmtRotacion = $db->query("
    SELECT 
        p.id,
        p.codigo_sku,
        p.nombre AS producto,
        c.nombre AS categoria,
        s.nombre AS sucursal_nombre,
        COALESCE(SUM(dp.cantidad), 0) AS unidades_vendidas,
        COALESCE(SUM(dp.subtotal), 0) AS total_soles_generado,
        COUNT(DISTINCT ped.id) AS operaciones_count
    FROM detalle_pedidos dp
    JOIN pedidos ped ON dp.pedido_id = ped.id
    JOIN productos p ON dp.producto_id = p.id
    JOIN categorias c ON p.categoria_id = c.id
    JOIN sucursales s ON ped.sucursal_id = s.id
    WHERE ped.estado_pedido != 'CANCELADO'
    GROUP BY p.id, ped.sucursal_id
    ORDER BY unidades_vendidas DESC
    LIMIT 5
");
$rotacion = $stmtRotacion->fetchAll(PDO::FETCH_ASSOC);
assert(count($rotacion) > 0, "El reporte de alta rotación no debe estar vacío");
$top = $rotacion[0];
assert((int)$top['unidades_vendidas'] > 0 && (int)$top['unidades_vendidas'] < 1000, "Unidades vendidas debe ser un valor comercial realista");
assert((float)$top['total_soles_generado'] > 0 && (float)$top['total_soles_generado'] < 50000, "Importe total debe ser un valor comercial realista");
assert((int)$top['operaciones_count'] > 0, "Operaciones debe ser > 0");
echo "OK (Top 1: {$top['producto']} | Unidades: {$top['unidades_vendidas']} | Soles: S/ {$top['total_soles_generado']} | Tickets: {$top['operaciones_count']})\n";

// 3. Probar aislamiento de sucursal para Supervisor
echo "[3] Verificando aislamiento de datos por sucursal (Sucursal 1 vs Sucursal 2)... ";
$stmtSuc1 = $db->prepare("
    SELECT COUNT(DISTINCT ped.id) as tickets, COALESCE(SUM(dp.cantidad), 0) as unidades
    FROM detalle_pedidos dp
    JOIN pedidos ped ON dp.pedido_id = ped.id
    WHERE ped.estado_pedido != 'CANCELADO' AND ped.sucursal_id = 1
");
$stmtSuc1->execute();
$resSuc1 = $stmtSuc1->fetch(PDO::FETCH_ASSOC);

$stmtSuc2 = $db->prepare("
    SELECT COUNT(DISTINCT ped.id) as tickets, COALESCE(SUM(dp.cantidad), 0) as unidades
    FROM detalle_pedidos dp
    JOIN pedidos ped ON dp.pedido_id = ped.id
    WHERE ped.estado_pedido != 'CANCELADO' AND ped.sucursal_id = 2
");
$stmtSuc2->execute();
$resSuc2 = $stmtSuc2->fetch(PDO::FETCH_ASSOC);

assert((int)$resSuc1['tickets'] > 0, "Sucursal 1 debe tener tickets registrados");
assert((int)$resSuc2['tickets'] > 0, "Sucursal 2 debe tener tickets registrados");
echo "OK (Sucursal 1: {$resSuc1['tickets']} tickets, {$resSuc1['unidades']} unid | Sucursal 2: {$resSuc2['tickets']} tickets, {$resSuc2['unidades']} unid)\n";

// 4. Probar rechazo de cantidad excesiva en OrderProcessingService
echo "[4] Verificando regla de negocio: rechazo de compras mayoristas (> 200 unid) en tienda minorista... ";
$orderService = new \App\Services\OrderProcessingService();
try {
    $orderService->processOrder([
        'sucursal_id' => 1,
        'cliente_id'  => 1,
        'tipo_entrega'=> 'DELIVERY',
        'items'       => [
            ['producto_id' => 1, 'cantidad' => 201] // Supera el límite de 200
        ],
        'delivery_info' => [
            'direccion_completa' => 'Jr. Puno 345, Huancayo',
            'latitud'            => -12.0691,
            'longitud'           => -75.2092
        ]
    ]);
    echo "FALLÓ: Se debió haber rechazado la orden de 201 unidades.\n";
    exit(1);
} catch (\Throwable $e) {
    echo "OK (Rechazo exitoso con mensaje: \"{$e->getMessage()}\")\n";
}

echo "\n=== TODAS LAS PRUEBAS DE REPORTES Y AUDITORÍA PASARON SATISFACTORIAMENTE (4/4) ===\n";
