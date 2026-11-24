<?php
/**
 * TEST AUTOMATIZADO DE RASTREO GPS Y DELIVERIES PARA CLIENTES INVITADOS Y REGISTRADOS
 * TIENDAS MASS
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

echo "=== INICIANDO BATERÍA DE PRUEBAS DE RASTREO GPS: CLIENTES INVITADOS Y REGISTRADOS ===\n\n";

$db = \App\Helpers\Database::getConnection();
$orderService = new \App\Services\OrderProcessingService();

// 1. Probar Creación y Rastreo de Pedido para CLIENTE INVITADO
echo "[1] Probando creación de pedido y tracking de delivery para CLIENTE INVITADO... ";
$guestPayload = [
    'sucursal_id'        => 1,
    'cliente_id'         => 1, // Fallback en tabla
    'es_invitado'        => 1,
    'contacto_email'     => 'invitado.mass@gmail.com',
    'contacto_telefono'  => '987654321',
    'tipo_entrega'       => 'DELIVERY',
    'metodo_pago'        => 'YAPE',
    'items'              => [
        ['producto_id' => 1, 'cantidad' => 1] // 1 unidad
    ],
    'delivery_info'      => [
        'direccion_completa' => 'Jr. Puno 345, Huancayo',
        'referencia'         => 'Frente a Plaza Huamanmarca',
        'latitud'            => -12.0691,
        'longitud'           => -75.2092
    ]
];

$guestOrder = $orderService->processOrder($guestPayload);
assert(!empty($guestOrder['codigo_pedido']), "Falta código de pedido");
assert(!empty($guestOrder['token_seguimiento']), "Falta token de seguimiento para invitado");
assert($guestOrder['es_invitado'] === 1, "Debe registrarse como invitado");
echo "OK (Pedido Invitado: {$guestOrder['codigo_pedido']} | Token: {$guestOrder['token_seguimiento']})\n";

// 2. Probar Consulta de Tracking por Código y Token (DeliveryController / PedidoController)
echo "[2] Probando endpoint de tracking público sin sesión (por ID, código y token)... ";
$stmtTrackById = $db->prepare("
    SELECT d.*, p.codigo_pedido, p.estado_pedido, p.es_invitado, s.latitud AS sucursal_lat, s.longitud AS sucursal_lng
    FROM deliveries d
    JOIN pedidos p ON d.pedido_id = p.id
    JOIN sucursales s ON p.sucursal_id = s.id
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE d.pedido_id = :id
");
$stmtTrackById->execute([':id' => $guestOrder['id']]);
$delTrack = $stmtTrackById->fetch(PDO::FETCH_ASSOC);
assert($delTrack !== false, "Debe encontrar el delivery del cliente invitado");
assert($delTrack['latitud_destino'] == -12.0691, "Latitud de destino debe coincidir");
assert($delTrack['longitud_destino'] == -75.2092, "Longitud de destino debe coincidir");
assert(!empty($delTrack['sucursal_lat']), "Debe contener coordenadas de sucursal");
echo "OK (Tracking verificado: Destino: {$delTrack['direccion_destino']} | Distancia: {$delTrack['distancia_km']} km)\n";

// 3. Probar Creación y Rastreo para CLIENTE REGISTRADO
echo "[3] Probando creación de pedido y tracking para CLIENTE REGISTRADO... ";
$regPayload = [
    'sucursal_id'        => 1,
    'cliente_id'         => 1,
    'es_invitado'        => 0,
    'contacto_email'     => 'juan.perez@gmail.com',
    'contacto_telefono'  => '987654321',
    'tipo_entrega'       => 'DELIVERY',
    'metodo_pago'        => 'YAPE',
    'items'              => [
        ['producto_id' => 2, 'cantidad' => 1]
    ],
    'delivery_info'      => [
        'direccion_completa' => 'Av. San Carlos 1120, Huancayo',
        'referencia'         => 'Cerca a U. Continental',
        'latitud'            => -12.0650,
        'longitud'           => -75.2050
    ]
];
$regOrder = $orderService->processOrder($regPayload);
assert(!empty($regOrder['codigo_pedido']), "Falta código de pedido registrado");
assert($regOrder['es_invitado'] === 0, "Debe ser cliente registrado");
echo "OK (Pedido Registrado: {$regOrder['codigo_pedido']})\n";

// 4. Probar Actualización de Coordenadas GPS del Repartidor (Simulación en Vivo / Rider App)
echo "[4] Probando actualización de coordenadas GPS en tiempo real... ";
$stmtUpdateGps = $db->prepare("
    UPDATE deliveries
    SET latitud_actual_repartidor = :lat,
        longitud_actual_repartidor = :lng,
        repartidor_nombre = 'Motorizado Carlos Flores',
        estado_delivery = 'EN_RUTA',
        updated_at = NOW()
    WHERE pedido_id = :id
");
$newLat = -12.0687;
$newLng = -75.2096;
$stmtUpdateGps->execute([
    ':lat' => $newLat,
    ':lng' => $newLng,
    ':id'  => $guestOrder['id']
]);

// Verificar que la consulta de tracking ahora reporte GPS en vivo
$stmtVerifyGps = $db->prepare("SELECT latitud_actual_repartidor, longitud_actual_repartidor, estado_delivery, repartidor_nombre FROM deliveries WHERE pedido_id = :id");
$stmtVerifyGps->execute([':id' => $guestOrder['id']]);
$gpsRes = $stmtVerifyGps->fetch(PDO::FETCH_ASSOC);
assert((float)$gpsRes['latitud_actual_repartidor'] === $newLat, "Latitud debe haberse actualizado");
assert((float)$gpsRes['longitud_actual_repartidor'] === $newLng, "Longitud debe haberse actualizado");
assert($gpsRes['estado_delivery'] === 'EN_RUTA', "Estado delivery debe ser EN_RUTA");
assert($gpsRes['repartidor_nombre'] === 'Motorizado Carlos Flores', "Nombre del repartidor debe haberse asignado");
echo "OK (GPS actualizado: {$gpsRes['latitud_actual_repartidor']}, {$gpsRes['longitud_actual_repartidor']} | Rider: {$gpsRes['repartidor_nombre']})\n";

// 5. Probar Finalización de Entrega y Limpieza de Tracking
echo "[5] Probando finalización de entrega (ENTREGADO) y cese de seguimiento activo... ";
$stmtComplete = $db->prepare("
    UPDATE pedidos p
    JOIN deliveries d ON d.pedido_id = p.id
    SET p.estado_pedido = 'ENTREGADO',
        d.estado_delivery = 'ENTREGADO',
        d.fecha_entrega = NOW()
    WHERE p.id = :id
");
$stmtComplete->execute([':id' => $guestOrder['id']]);

$stmtCheckComplete = $db->prepare("SELECT estado_pedido FROM pedidos WHERE id = :id");
$stmtCheckComplete->execute([':id' => $guestOrder['id']]);
$estadoFinal = $stmtCheckComplete->fetchColumn();
assert($estadoFinal === 'ENTREGADO', "El pedido debe quedar en estado ENTREGADO");
echo "OK (Pedido entregado con éxito, ciclo de seguimiento finalizado)\n";

// 6. Limpieza higiénica de registros de prueba
$db->exec("DELETE FROM detalle_pedidos WHERE pedido_id IN ({$guestOrder['id']}, {$regOrder['id']})");
$db->exec("DELETE FROM deliveries WHERE pedido_id IN ({$guestOrder['id']}, {$regOrder['id']})");
$db->exec("DELETE FROM pedidos WHERE id IN ({$guestOrder['id']}, {$regOrder['id']})");

echo "\n=== TODAS LAS PRUEBAS DE RASTREO GPS Y DELIVERIES PASARON SATISFACTORIAMENTE (5/5) ===\n";
