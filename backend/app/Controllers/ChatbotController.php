<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Repositories\ProductoRepository;
use App\Repositories\SucursalRepository;
use App\Services\GeminiChatbotService;
use App\Helpers\Response;
use App\Helpers\Database;
use PDO;

class ChatbotController {
    private ProductoRepository $productoRepo;
    private SucursalRepository $sucursalRepo;
    private GeminiChatbotService $aiService;
    private PDO $db;

    public function __construct() {
        $this->productoRepo = new ProductoRepository();
        $this->sucursalRepo = new SucursalRepository();
        $this->aiService = new GeminiChatbotService();
        $this->db = Database::getConnection();
    }

    /**
     * Endpoint: POST /api/chat/recommendations
     * Recibe el carrito actual y la sucursal, devuelve recomendaciones inteligentes de ahorro.
     */
    public function getRecommendations(): void {
        $raw = file_get_contents('php://input');
        $input = json_decode((string)$raw, true) ?: [];

        // 1. Validar y resolver sucursal
        $sucursalId = (int)($input['sucursal_id'] ?? 1);
        if ($sucursalId <= 0) {
            $sucursalId = 1;
        }

        $sucursal = $this->sucursalRepo->getById($sucursalId);
        if (!$sucursal || (int)($sucursal['estado'] ?? 0) !== 1) {
            // Si la sucursal no existe o está inactiva, tomar la primera sucursal activa
            $activas = $this->sucursalRepo->getAll(true);
            $sucursal = !empty($activas) ? $activas[0] : null;
            $sucursalId = $sucursal ? (int)$sucursal['id'] : 1;
        }

        $branchName = $sucursal ? (string)$sucursal['nombre'] : 'Huancayo';

        // 2. Extraer y validar el carrito del cliente
        $rawCart = $input['cart_items'] ?? $input['items'] ?? [];
        if (!is_array($rawCart) || empty($rawCart)) {
            Response::success([
                'mensaje_ia' => '¡Hola! Soy Arki, tu asistente de ahorro. Agrega tus productos favoritos a la canasta y te sugeriré las mejores ofertas y combinaciones para tu compra.',
                'motivo' => 'Canasta vacía',
                'productos' => [],
                'source' => 'system'
            ]);
            return;
        }

        // 3. Validar productos del carrito contra la BD real
        $cartIds = [];
        $validatedCartItems = [];
        foreach ($rawCart as $it) {
            $pId = (int)($it['producto']['id'] ?? $it['id'] ?? 0);
            $cant = max(1, (int)($it['cantidad'] ?? 1));
            if ($pId > 0 && !isset($cartIds[$pId])) {
                $cartIds[$pId] = true;
                $dbProd = $this->productoRepo->getById($pId);
                if ($dbProd && (int)$dbProd['estado'] === 1) {
                    $validatedCartItems[] = [
                        'id' => $pId,
                        'nombre' => (string)$dbProd['nombre'],
                        'cantidad' => $cant,
                        'precio' => (float)$dbProd['precio_venta'],
                        'categoria' => (string)($dbProd['categoria_nombre'] ?? 'Abarrotes')
                    ];
                }
            }
        }

        if (empty($validatedCartItems)) {
            Response::success([
                'mensaje_ia' => '¡Hola! Selecciona productos de nuestro catálogo para que pueda recomendarte complementos ideales.',
                'motivo' => 'Sin productos válidos en el carrito',
                'productos' => [],
                'source' => 'system'
            ]);
            return;
        }

        // 4. Consultar en MySQL los productos candidatos que tengan stock real > 0 en la sucursal
        // y que NO estén ya en el carrito
        $excludedIds = array_keys($cartIds);
        $placeholders = implode(',', array_fill(0, count($excludedIds), '?'));

        $sql = "SELECT p.id, p.categoria_id, c.nombre AS categoria_nombre, p.codigo_sku,
                       p.nombre, p.descripcion, p.unidad_medida, p.precio_venta, p.imagen_url,
                       i.stock_actual, i.clasificacion_abc
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                JOIN inventarios i ON i.producto_id = p.id
                WHERE i.sucursal_id = ? 
                  AND p.estado = 1 
                  AND i.stock_actual > 0 
                  AND p.id NOT IN ($placeholders)
                ORDER BY (p.precio_venta < 6.00) DESC, i.stock_actual DESC, p.nombre ASC
                LIMIT 35";

        $stmt = $this->db->prepare($sql);
        $params = array_merge([$sucursalId], $excludedIds);
        $stmt->execute($params);
        $candidateRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($candidateRows)) {
            Response::success([
                'mensaje_ia' => "¡Llevas excelentes productos en tu canasta! No tenemos más complementos con stock disponible en la sucursal {$branchName}.",
                'motivo' => 'Sin stock complementario',
                'productos' => [],
                'source' => 'system'
            ]);
            return;
        }

        // Indexar candidatos por ID para validación inmediata
        $candidatesById = [];
        $candidatesForAi = [];
        foreach ($candidateRows as $cand) {
            $cId = (int)$cand['id'];
            $candidatesById[$cId] = $cand;
            $candidatesForAi[] = [
                'id' => $cId,
                'nombre' => (string)$cand['nombre'],
                'precio' => (float)$cand['precio_venta'],
                'categoria' => (string)$cand['categoria_nombre'],
                'stock' => (int)$cand['stock_actual']
            ];
        }

        // 5. Invocar al servicio de IA
        $userMessage = trim((string)($input['message'] ?? ''));
        $aiResult = $this->aiService->getRecommendations(
            $validatedCartItems,
            $candidatesForAi,
            $userMessage,
            $branchName
        );

        // 6. Validar IDs devueltos por la IA contra los candidatos reales
        $finalRecommendedProducts = [];
        $recommendedIds = $aiResult['productos_recomendados_ids'] ?? [];
        foreach ($recommendedIds as $rId) {
            $intId = (int)$rId;
            if (isset($candidatesById[$intId])) {
                $finalRecommendedProducts[] = $candidatesById[$intId];
            }
        }

        // Si la IA no devolvió ningún ID válido, tomar los 2 más económicos
        if (empty($finalRecommendedProducts) && !empty($candidateRows)) {
            $finalRecommendedProducts = array_slice($candidateRows, 0, 2);
        }

        // 7. Responder con estructura canónica
        Response::success([
            'mensaje_ia' => $aiResult['mensaje'] ?? 'Te recomiendo estos productos para completar tu compra:',
            'motivo' => $aiResult['motivo_recomendacion'] ?? 'Recomendación de ahorro',
            'productos' => $finalRecommendedProducts,
            'source' => $aiResult['source'] ?? 'gemini'
        ]);
    }
}
