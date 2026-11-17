<?php
declare(strict_types=1);

namespace App\Services;

class GeminiChatbotService {
    private string $apiKey;
    private string $model;
    private int $timeoutSeconds;

    public function __construct(?string $apiKey = null, ?string $model = null, int $timeoutSeconds = 8) {
        $config = [];
        $configFile = __DIR__ . '/../../config/config.php';
        if (file_exists($configFile)) {
            $config = require $configFile;
        }

        $this->apiKey = $apiKey ?: (string)($config['gemini']['api_key'] ?? getenv('GEMINI_API_KEY') ?: '');
        $this->model = $model ?: (string)($config['gemini']['model'] ?? getenv('GEMINI_MODEL') ?: 'gemini-1.5-flash');
        $this->timeoutSeconds = $timeoutSeconds;
    }

    /**
     * Obtiene recomendaciones inteligentes estructuradas basadas en el carrito del cliente.
     *
     * @param array<int, array{id: int, nombre: string, cantidad: int, precio: float, categoria: string}> $cartItems
     * @param array<int, array{id: int, nombre: string, precio: float, categoria: string, stock: int}> $availableProducts
     * @param string $userMessage
     * @param string|null $branchName
     * @return array{success: bool, mensaje: string, productos_recomendados_ids: array<int>, motivo_recomendacion: string, source: string}
     */
    public function getRecommendations(
        array $cartItems,
        array $availableProducts,
        string $userMessage = '',
        ?string $branchName = null
    ): array {
        // Si no hay candidatos o el carrito está vacío, responder directamente
        if (empty($availableProducts)) {
            return [
                'success' => true,
                'mensaje' => '¡Hola! En este momento no hay productos adicionales con stock disponible en esta sucursal.',
                'productos_recomendados_ids' => [],
                'motivo_recomendacion' => 'Sin stock complementario',
                'source' => 'system'
            ];
        }

        // Si la clave de Gemini no está configurada, usar el motor heurístico local de ahorro
        if (empty($this->apiKey)) {
            return $this->fallbackHeuristicRecommendations($cartItems, $availableProducts, $userMessage);
        }

        try {
            $response = $this->callGeminiApi($cartItems, $availableProducts, $userMessage, $branchName);
            if (!empty($response) && isset($response['mensaje'])) {
                $response['source'] = 'gemini';
                return $response;
            }
        } catch (\Throwable $e) {
            // Log silencioso o manejo de contingencia sin romper el flujo
            error_log('Error en comunicación con Gemini API: ' . $e->getMessage());
        }

        // Si Gemini falló o devolvió respuesta no válida, usar el motor heurístico
        return $this->fallbackHeuristicRecommendations($cartItems, $availableProducts, $userMessage);
    }

    /**
     * Llamada HTTP segura a Google Gemini API
     */
    private function callGeminiApi(
        array $cartItems,
        array $availableProducts,
        string $userMessage,
        ?string $branchName
    ): ?array {
        $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key=" . urlencode($this->apiKey);

        // 1. Resumen de productos en el carrito
        $cartLines = [];
        foreach ($cartItems as $item) {
            $nom = (string)($item['nombre'] ?? 'Producto');
            $cant = (int)($item['cantidad'] ?? 1);
            $prec = number_format((float)($item['precio'] ?? 0), 2);
            $cat = (string)($item['categoria'] ?? 'General');
            $cartLines[] = "- [{$cat}] {$nom} (Cantidad: {$cant}, Precio unitario: S/. {$prec})";
        }
        $cartText = implode("\n", $cartLines);

        // 2. Resumen de candidatos disponibles con stock
        $candidateLines = [];
        $validCandidateIds = [];
        foreach ($availableProducts as $prod) {
            $id = (int)$prod['id'];
            $validCandidateIds[$id] = true;
            $nom = (string)$prod['nombre'];
            $prec = number_format((float)$prod['precio'], 2);
            $cat = (string)($prod['categoria'] ?? 'General');
            $stk = (int)$prod['stock'];
            $candidateLines[] = "ID: {$id} | Cat: {$cat} | {$nom} | S/. {$prec} | Stock: {$stk}";
        }
        $candidateText = implode("\n", $candidateLines);

        // 3. Instrucción del sistema
        $branchInfo = $branchName ? "en la sucursal {$branchName}" : "en Tiendas Mass";
        $systemInstruction = <<<SYS
Eres "Massi", el asistente inteligente y amigable de ahorro de Tiendas Mass (Perú).
Tu misión es sugerir al cliente entre 1 y 3 productos complementarios o de gran ahorro {$branchInfo} que combinen con lo que lleva en su carrito.

REGLAS DE ORO:
1. SOLO puedes sugerir productos cuyos IDs aparezcan explícitamente en la lista de CANDIDATOS DISPONIBLES. Jamás inventes productos ni IDs.
2. Si el usuario hace una pregunta sobre una comida, receta o necesidad (ejemplo: "¿qué me falta para un arroz con pollo?" o "¿algo para tomar?"), responde amablemente y selecciona los candidatos de la lista que mejor encajen.
3. Si el cliente pide algo económico, prioriza los de menor precio en la lista.
4. Responde SIEMPRE con un objeto JSON estrictamente válido, sin texto adicional fuera del JSON:
{
  "mensaje": "Respuesta breve, cálida y entusiasta (máximo 2 oraciones, tono peruano cercano y educado)",
  "productos_recomendados_ids": [id1, id2],
  "motivo_recomendacion": "Explicación breve del porqué combinan o convienen para el ahorro"
}
SYS;

        $userPrompt = "CARRITO ACTUAL:\n{$cartText}\n\nCANDIDATOS DISPONIBLES CON STOCK:\n{$candidateText}";
        if (!empty($userMessage)) {
            $cleanUserMsg = substr(strip_tags($userMessage), 0, 300);
            $userPrompt .= "\n\nCONSULTA DEL CLIENTE: \"{$cleanUserMsg}\"";
        } else {
            $userPrompt .= "\n\nCONSULTA DEL CLIENTE: \"Recomiéndame los mejores complementos a precio bajo para lo que llevo.\"";
        }

        $payload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $systemInstruction . "\n\n" . $userPrompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.3,
                'responseMimeType' => 'application/json'
            ]
        ];

        $ch = curl_init($apiUrl);
        if ($ch === false) return null;

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeoutSeconds);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($response)) {
            return null;
        }

        $decoded = json_decode((string)$response, true);
        $rawText = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
        if (empty($rawText)) return null;

        // Limpiar posibles bloques markdown ```json ... ```
        $cleanJson = trim($rawText);
        if (str_starts_with($cleanJson, '```')) {
            $cleanJson = preg_replace('/^```(?:json)?\s*/i', '', $cleanJson);
            $cleanJson = preg_replace('/\s*```$/', '', $cleanJson);
        }

        $result = json_decode((string)$cleanJson, true);
        if (!is_array($result) || !isset($result['mensaje'])) {
            return null;
        }

        // Validar que los IDs recomendados sean un subconjunto estricto de los candidatos
        $recommendedIds = [];
        if (isset($result['productos_recomendados_ids']) && is_array($result['productos_recomendados_ids'])) {
            foreach ($result['productos_recomendados_ids'] as $id) {
                $numId = (int)$id;
                if (isset($validCandidateIds[$numId])) {
                    $recommendedIds[] = $numId;
                }
            }
        }

        // Limitar a máximo 3
        $recommendedIds = array_slice(array_unique($recommendedIds), 0, 3);

        return [
            'success' => true,
            'mensaje' => (string)$result['mensaje'],
            'productos_recomendados_ids' => $recommendedIds,
            'motivo_recomendacion' => (string)($result['motivo_recomendacion'] ?? 'Productos complementarios sugeridos.')
        ];
    }

    /**
     * Motor heurístico local de recomendaciones (Fallback seguro sin fallos)
     * Se activa cuando no hay API Key configurada o cuando el servicio externo de Gemini no responde.
     */
    public function fallbackHeuristicRecommendations(
        array $cartItems,
        array $availableProducts,
        string $userMessage = ''
    ): array {
        $recommendedIds = [];
        $reasons = [];

        // Extraer categorías presentes en el carrito
        $cartCategories = [];
        $cartNames = [];
        foreach ($cartItems as $item) {
            $cat = mb_strtolower(trim((string)($item['categoria'] ?? '')));
            if ($cat !== '') $cartCategories[$cat] = true;
            $cartNames[] = (string)($item['nombre'] ?? '');
        }

        // Mapeo inteligente de complementariedades típicas en supermercados
        $affinityMap = [
            'abarrotes' => ['conservas', 'salsas', 'lácteos', 'bebidas', 'aceites'],
            'pastas' => ['salsas', 'conservas', 'quesos', 'abarrotes'],
            'arroz' => ['conservas', 'aceites', 'abarrotes'],
            'bebidas' => ['snacks', 'galletas', 'confitería'],
            'lácteos' => ['panadería', 'galletas', 'cereales'],
            'limpieza' => ['cuidado personal', 'hogar']
        ];

        // Buscar productos afines
        foreach ($availableProducts as $prod) {
            $prodCat = mb_strtolower(trim((string)($prod['categoria'] ?? '')));
            $prodName = mb_strtolower((string)$prod['nombre']);
            $score = 0;

            // Coincidencia con palabras clave de la consulta del usuario
            if (!empty($userMessage)) {
                $userMsgLower = mb_strtolower($userMessage);
                $terms = preg_split('/\s+/', $userMsgLower);
                foreach ($terms as $term) {
                    if (mb_strlen($term) > 3 && strpos($prodName, $term) !== false) {
                        $score += 10;
                    }
                }
            }

            // Coincidencia por afinidad de categorías
            foreach (array_keys($cartCategories) as $cCat) {
                if (isset($affinityMap[$cCat]) && in_array($prodCat, $affinityMap[$cCat], true)) {
                    $score += 5;
                }
            }

            // Bonificación a productos económicos
            if ((float)$prod['precio'] < 5.00) {
                $score += 2;
            }

            if ($score > 0) {
                $recommendedIds[$prod['id']] = $score;
            }
        }

        // Si no hubo suficientes coincidencias por afinidad, tomar los productos más económicos y con mayor stock
        if (count($recommendedIds) < 2) {
            usort($availableProducts, function($a, $b) {
                return ((float)$a['precio'] <=> (float)$b['precio']);
            });
            foreach ($availableProducts as $p) {
                if (!isset($recommendedIds[$p['id']])) {
                    $recommendedIds[$p['id']] = 1;
                }
                if (count($recommendedIds) >= 3) break;
            }
        } else {
            // Ordenar por score de mayor a menor
            arsort($recommendedIds);
        }

        $finalIds = array_slice(array_keys($recommendedIds), 0, 3);

        // Construir mensaje personalizado y cálido
        $firstItemName = !empty($cartNames) ? $cartNames[0] : 'tus productos';
        $mensaje = "¡Hola! Para complementar {$firstItemName}, seleccioné estas opciones de gran ahorro disponibles en tu tienda:";
        if (!empty($userMessage) && (strpos(mb_strtolower($userMessage), 'sopa') !== false || strpos(mb_strtolower($userMessage), 'almuerzo') !== false)) {
            $mensaje = "¡Excelente idea! Aquí tienes los ingredientes y complementos ideales a precio bajo para tu preparación:";
        }

        return [
            'success' => true,
            'mensaje' => $mensaje,
            'productos_recomendados_ids' => $finalIds,
            'motivo_recomendacion' => 'Sugerencias complementarias con precios bajos garantizados en tu sucursal.',
            'source' => 'heuristic_engine'
        ];
    }
}
