<?php
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

require_once __DIR__ . '/../config/config.php';

echo "=== INICIANDO PRUEBAS DE INTEGRACIÓN: CHATBOT MASSI (IA GEMINI) ===\n\n";

$testsPassed = 0;
$totalTests = 0;

function assertTest(string $desc, bool $condition): void {
    global $testsPassed, $totalTests;
    $totalTests++;
    if ($condition) {
        $testsPassed++;
        echo "✓ [PASS] {$desc}\n";
    } else {
        echo "✗ [FAIL] {$desc}\n";
    }
}

// 1. Probar Instanciación del Servicio
$service = new \App\Services\GeminiChatbotService();
assertTest("Instanciación de GeminiChatbotService", $service instanceof \App\Services\GeminiChatbotService);

// 2. Probar Motor Heurístico con Carrito y Candidatos simulados
$simulatedCart = [
    ['id' => 1, 'nombre' => 'Arroz Costeño Extra 1 kg', 'cantidad' => 2, 'precio' => 4.20, 'categoria' => 'Abarrotes']
];
$simulatedCandidates = [
    ['id' => 2, 'nombre' => 'Aceite Vegetal Primor 900 ml', 'precio' => 7.80, 'categoria' => 'Abarrotes', 'stock' => 15],
    ['id' => 3, 'nombre' => 'Atún Campomar en Trozos', 'precio' => 4.50, 'categoria' => 'Conservas', 'stock' => 20],
    ['id' => 4, 'nombre' => 'Gaseosa Inka Kola 1.5 L', 'precio' => 6.20, 'categoria' => 'Bebidas', 'stock' => 8]
];

$rec = $service->getRecommendations($simulatedCart, $simulatedCandidates, "¿Qué combina con mi arroz?", "Huancayo Central");
assertTest("Generación de recomendaciones estructuradas", !empty($rec['mensaje']));
assertTest("IDs recomendados son subconjunto válido de candidatos", count($rec['productos_recomendados_ids']) > 0);
foreach ($rec['productos_recomendados_ids'] as $rId) {
    $found = false;
    foreach ($simulatedCandidates as $c) {
        if ($c['id'] === $rId) $found = true;
    }
    assertTest("ID recomendado {$rId} existe en candidatos autorizados", $found);
}

// 3. Probar Endpoint HTTP local vía cURL a Apache
$url = "http://localhost/tiendasmass/backend/public/api/chat/recommendations";
$payload = json_encode([
    'sucursal_id' => 1,
    'cart_items' => [
        ['producto' => ['id' => 1], 'cantidad' => 1]
    ],
    'message' => '¿Qué me recomiendas para preparar el almuerzo?'
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$resp = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

assertTest("Endpoint HTTP /api/chat/recommendations responde HTTP 200", $httpCode === 200);

$json = json_decode((string)$resp, true);
assertTest("Respuesta es JSON válido con success=true", isset($json['success']) && $json['success'] === true);
assertTest("Respuesta contiene campo 'mensaje_ia'", isset($json['data']['mensaje_ia']));
assertTest("Respuesta contiene lista de productos con stock", isset($json['data']['productos']) && is_array($json['data']['productos']));

// 4. Probar Carrito Vacío
$payloadEmpty = json_encode([
    'sucursal_id' => 1,
    'cart_items' => []
]);
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadEmpty);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$respEmpty = curl_exec($ch);
curl_close($ch);
$jsonEmpty = json_decode((string)$respEmpty, true);
assertTest("Carrito vacío devuelve mensaje instructivo amigable sin fallos", !empty($jsonEmpty['data']['mensaje_ia']) && count($jsonEmpty['data']['productos']) === 0);

echo "\n=======================================================\n";
echo "RESULTADOS: {$testsPassed} de {$totalTests} pruebas pasaron exitosamente.\n";
echo "=======================================================\n";
