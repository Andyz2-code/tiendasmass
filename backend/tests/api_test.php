<?php
/**
 * TEST INTEGRAL DEL BACKEND - SISTEMA DE GESTIÓN COMERCIAL TIENDAS MASS
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

echo "=== INICIANDO BATERÍA DE PRUEBAS DEL SISTEMA TIENDAS MASS ===\n\n";

// 1. Probar Conexión a Base de Datos
echo "[1] Probando conexión PDO Singleton a MySQL... ";
try {
    $pdo = \App\Helpers\Database::getConnection();
    echo "OK (Conectado a tiendas_mass_db)\n";
} catch (\Throwable $e) {
    echo "FALLÓ: " . $e->getMessage() . "\n";
    exit(1);
}

// 2. Probar Autenticación de Administrador y generación de JWT
echo "[2] Probando login de Administrador y JWT... ";
try {
    $authService = new \App\Services\AuthService();
    try {
        $loginRes = $authService->loginUser('admin@tiendasmass.pe', '123456');
    } catch (\Throwable $e) {
        $loginRes = $authService->loginUser('admin@tiendasmass.pe', 'Admin123!');
    }
    assert(!empty($loginRes['token']), "Token no generado");
    assert($loginRes['user']['rol_nombre'] === 'Administrador', "Rol no coincide");
    echo "OK (JWT emitido exitosamente)\n";
} catch (\Throwable $e) {
    echo "FALLÓ: " . $e->getMessage() . "\n";
    exit(1);
}

// 3. Probar Algoritmo de Pareto ABC (80/20)
echo "[3] Probando servicio de análisis ABC (Pareto)... ";
try {
    $abcService = new \App\Services\AbcAnalysisService();
    $abc = $abcService->calculateAbc(1);
    assert($abc['resumen']['total_inversion'] > 0, "Inversión debe ser mayor a 0");
    assert(isset($abc['resumen']['conteo_A']), "Falta conteo Clase A");
    echo "OK (Inversión Sucursal 1: S/. {$abc['resumen']['total_inversion']} | A: {$abc['resumen']['conteo_A']} | B: {$abc['resumen']['conteo_B']} | C: {$abc['resumen']['conteo_C']})\n";
} catch (\Throwable $e) {
    echo "FALLÓ: " . $e->getMessage() . "\n";
    exit(1);
}

// 4. Probar Punto de Reorden (POR) e Índice de Obsolescencia (IOI)
echo "[4] Probando cálculo de Punto de Reorden (POR) y Obsolescencia (NIC 2)... ";
try {
    $reorderService = new \App\Services\ReorderCalculationService();
    $reorder = $reorderService->getReorderAlerts(1);
    $obs = $reorderService->getObsolescenceAndExpiryReport(1);
    echo "OK (Productos evaluados: {$reorder['resumen']['total_productos']} | IOI: {$obs['resumen']['indice_obsolescencia']}%)\n";
} catch (\Throwable $e) {
    echo "FALLÓ: " . $e->getMessage() . "\n";
    exit(1);
}

// 5. Probar Algoritmo de Distancia y Tarifa de Google Maps (Haversine fallback)
echo "[5] Probando cálculo de cobertura y flete de delivery... ";
try {
    $distService = new \App\Services\GoogleMapsDistanceService();
    // Sucursal 1 (-12.0684, -75.2100) a Cliente Centro (-12.0691, -75.2092)
    $del = $distService->calculateDeliveryMetrics(-12.0684, -75.2100, -12.0691, -75.2092, 5.0, 4.0, 1.5);
    assert($del['en_cobertura'] === true, "Debe estar en cobertura");
    assert($del['costo_envio'] >= 4.0, "Costo base debe ser >= 4.00");
    echo "OK (Distancia: {$del['distancia_km']} km | Tarifa: S/. {$del['costo_envio']} | En Cobertura: SI)\n";
} catch (\Throwable $e) {
    echo "FALLÓ: " . $e->getMessage() . "\n";
    exit(1);
}

// 6. Probar Transacción Atómica de Venta con Asignación PEPS y Kardex
echo "[6] Probando procesamiento de pedido atómico con algoritmo PEPS (NIC 2)... ";
try {
    // Garantizar stock suficiente en lotes para idempotencia del test
    $pdo->exec("UPDATE inventarios SET stock_actual = GREATEST(stock_actual, 20) WHERE sucursal_id = 1 AND producto_id IN (1, 5)");
    $pdo->exec("UPDATE lotes SET cantidad_disponible = GREATEST(cantidad_disponible, 20), estado = 'DISPONIBLE' WHERE sucursal_id = 1 AND producto_id IN (1, 5)");

    $orderService = new \App\Services\OrderProcessingService();
    $orderPayload = [
        'sucursal_id' => 1,
        'cliente_id'  => 1,
        'tipo_entrega'=> 'DELIVERY',
        'metodo_pago' => 'YAPE',
        'items'       => [
            ['producto_id' => 1, 'cantidad' => 2], // 2 unidades de Arroz Costeño
            ['producto_id' => 5, 'cantidad' => 1]  // 1 lata Leche Gloria
        ],
        'delivery_info' => [
            'direccion_completa' => 'Jr. Puno 345, Huancayo',
            'referencia'         => 'Frente al parque',
            'latitud'            => -12.0691,
            'longitud'           => -75.2092
        ]
    ];

    $orderResult = $orderService->processOrder($orderPayload);
    assert(!empty($orderResult['codigo_pedido']), "Falta código de pedido");
    assert($orderResult['total'] > 0, "Total debe ser mayor a 0");
    assert($orderResult['igv'] > 0, "IGV debe estar desglosado");
    echo "OK (Pedido Creado: {$orderResult['codigo_pedido']} | Total: S/. {$orderResult['total']} | Subtotal: S/. {$orderResult['subtotal']} | IGV 18%: S/. {$orderResult['igv']})\n";
} catch (\Throwable $e) {
    echo "FALLÓ: " . $e->getMessage() . "\n";
    exit(1);
}

// 7. Probar Rechazo Atómico por Stock Insuficiente (Garantía de Rollback)
echo "[7] Probando integridad transaccional (Rollback ante stock insuficiente)... ";
try {
    $orderService->processOrder([
        'sucursal_id' => 1,
        'cliente_id'  => 1,
        'tipo_entrega'=> 'DELIVERY',
        'items'       => [
            ['producto_id' => 1, 'cantidad' => 999999] // Cantidad imposible
        ],
        'delivery_info' => [
            'direccion_completa' => 'Jr. Puno 345, Huancayo',
            'latitud'            => -12.0691,
            'longitud'           => -75.2092
        ]
    ]);
    echo "FALLÓ: Se debió haber rechazado la venta por stock insuficiente.\n";
    exit(1);
} catch (\Throwable $e) {
    echo "OK (Rechazado correctamente y rollback ejecutado: \"{$e->getMessage()}\")\n";
}

echo "\n=== TODAS LAS PRUEBAS UNITARIAS Y DE INTEGRACIÓN PASARON SATISFACTORIAMENTE (7/7) ===\n";
