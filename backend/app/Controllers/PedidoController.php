<?php
namespace App\Controllers;

use App\Repositories\PedidoRepository;
use App\Services\OrderProcessingService;
use App\Middleware\JwtAuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Helpers\Database;
use PDO;
use Exception;

class PedidoController {
    private PedidoRepository $repo;
    private OrderProcessingService $orderService;

    public function __construct() {
        $this->repo = new PedidoRepository();
        $this->orderService = new OrderProcessingService();
    }

    public function index(): void {
        $user = JwtAuthMiddleware::getUser();
        $sucursalId = isset($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;
        $estado = $_GET['estado'] ?? null;
        $clienteId = isset($_GET['cliente_id']) && is_numeric($_GET['cliente_id']) ? (int)$_GET['cliente_id'] : null;

        if ($user) {
            $userRole = $user['rol_nombre'] ?? $user['rol'] ?? '';
            if ($userRole === 'Cliente') {
                $clienteId = (int)$user['sub'];
            } elseif ($userRole === 'Supervisor') {
                $sucursalId = (int)($user['sucursal_id'] ?? $sucursalId);
            }
        }

        $pedidos = $this->repo->getAll($sucursalId, $clienteId, $estado);
        Response::success($pedidos);
    }

    public function show(string $id): void {
        $pedido = $this->repo->getById((int)$id);
        if (!$pedido) {
            Response::error('Pedido no encontrado', 404);
        }

        $user = JwtAuthMiddleware::getUser();
        if ($user && ($user['rol_nombre'] ?? '') === 'Cliente') {
            if ((int)$pedido['cliente_id'] !== (int)$user['sub']) {
                Response::error('No autorizado para ver este pedido', 403);
            }
        }

        Response::success($pedido);
    }

    /**
     * POST /api/pedidos/validar-stock-recojo
     * Requerimiento 1: Valida si todos los productos del carrito tienen stock en la sucursal
     * para habilitar o bloquear el recojo el mismo día.
     */
    public function validarStockRecojo(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $sucursalId = (int)($input['sucursal_id'] ?? 1);
        $items = $input['items'] ?? [];

        if (empty($items) || !is_array($items)) {
            Response::error('Debe enviar los productos del carrito para validar el stock de recojo.', 422);
        }

        try {
            $result = $this->orderService->validateStorePickupStock($sucursalId, $items);
            Response::success($result, $result['mensaje']);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function store(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'sucursal_id' => 'required|numeric',
            'items'       => 'required'
        ]);

        if ($validator->fails()) {
            Response::error('Datos incompletos para procesar el pedido', 422, $validator->getErrors());
        }

        $user = JwtAuthMiddleware::getUser();
        if ($user && ($user['tipo_usuario'] ?? '') === 'cliente') {
            $input['cliente_id'] = (int)$user['sub'];
        } elseif (empty($input['cliente_id'])) {
            $input['cliente_id'] = 1;
        }

        try {
            $result = $this->orderService->processOrder($input);
            Response::success($result, '¡Pago validado y pedido registrado con éxito! Seleccione cómo desea recibir su boleta electrónica y enlace de seguimiento.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * POST /api/pedidos/{id}/notificar-boleta
     * Requerimiento 2: Flujo Post-Pago (Iniciar sesión o Continuar como invitado con teléfono y correo).
     * Dispara el evento automático que envía la boleta electrónica y el enlace de seguimiento.
     */
    public function notificarBoleta(string $id): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $pedidoId = (int)$id;

        try {
            $result = $this->orderService->triggerPostPaymentNotification($pedidoId, $input);
            Response::success($result, $result['mensaje_confirmacion']);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * GET /api/pedidos/seguimiento/{codigo}
     * Consulta pública de seguimiento de estado de pedido por código de pedido o token.
     */
    public function seguimientoPublico(string $codigo): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT p.id, p.codigo_pedido, p.numero_boleta, p.token_seguimiento, p.fecha_pedido,
                   p.subtotal, p.igv, p.costo_envio, p.total, p.tipo_entrega, p.fecha_recojo,
                   p.requiere_traslado, p.metodo_pago, p.estado_pedido, p.es_invitado,
                   p.contacto_email, p.contacto_telefono,
                   s.nombre AS sucursal_nombre, s.direccion AS sucursal_direccion, s.telefono AS sucursal_telefono,
                   d.direccion_destino, d.estado_delivery, d.repartidor_nombre, d.tiempo_estimado_min
            FROM pedidos p
            JOIN sucursales s ON p.sucursal_id = s.id
            LEFT JOIN deliveries d ON d.pedido_id = p.id
            WHERE p.codigo_pedido = :cod OR p.id = :id_num
            LIMIT 1
        ");
        $stmt->execute([
            ':cod'    => trim($codigo),
            ':id_num' => is_numeric($codigo) ? (int)$codigo : 0
        ]);
        $pedido = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$pedido) {
            Response::error('No se encontró ningún pedido con el código proporcionado.', 404);
        }

        $stmtDet = $db->prepare("
            SELECT dp.cantidad, dp.precio_unitario, dp.subtotal, pr.nombre AS producto_nombre, pr.codigo_sku
            FROM detalle_pedidos dp
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE dp.pedido_id = :id
        ");
        $stmtDet->execute([':id' => $pedido['id']]);
        $pedido['detalles'] = $stmtDet->fetchAll(PDO::FETCH_ASSOC);

        Response::success($pedido);
    }

    public function updateStatus(string $id): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $nuevoEstado = $input['estado_pedido'] ?? '';

        $estadosValidos = ['PENDIENTE', 'EN_PREPARACION', 'LISTO_PARA_DESPACHO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];
        if (!in_array($nuevoEstado, $estadosValidos)) {
            Response::error('Estado de pedido no válido', 422);
        }

        $pedido = $this->repo->getById((int)$id);
        if (!$pedido) {
            Response::error('Pedido no encontrado', 404);
        }

        $user = JwtAuthMiddleware::getUser();
        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            RoleMiddleware::validateBranchAccess((int)$pedido['sucursal_id']);
        }

        $this->repo->updateEstado((int)$id, $nuevoEstado);

        if ($nuevoEstado === 'DESPACHADO' && !empty($pedido['delivery_id'])) {
            $db = Database::getConnection();
            $updDel = $db->prepare("UPDATE deliveries SET estado_delivery = 'EN_RUTA', fecha_salida = NOW() WHERE pedido_id = :id");
            $updDel->execute([':id' => (int)$id]);
        } elseif ($nuevoEstado === 'ENTREGADO' && !empty($pedido['delivery_id'])) {
            $db = Database::getConnection();
            $updDel = $db->prepare("UPDATE deliveries SET estado_delivery = 'ENTREGADO', fecha_entrega = NOW() WHERE pedido_id = :id");
            $updDel->execute([':id' => (int)$id]);
        }

        Response::success(['estado_pedido' => $nuevoEstado], "Estado del pedido actualizado a {$nuevoEstado}.");
    }
}
