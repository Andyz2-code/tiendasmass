<?php
namespace App\Controllers;

use App\Repositories\PedidoRepository;
use App\Services\OrderProcessingService;
use App\Middleware\JwtAuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Helpers\Response;
use App\Helpers\Validator;
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
        $clienteId = null;

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
            // Cliente predeterminado si es compra rápida
            $input['cliente_id'] = 1;
        }

        try {
            $result = $this->orderService->processOrder($input);
            Response::success($result, '¡Pedido registrado con éxito! El almacén ha asignado los lotes correspondientes bajo el principio PEPS.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
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

        $user = \App\Middleware\JwtAuthMiddleware::getUser();
        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            RoleMiddleware::validateBranchAccess((int)$pedido['sucursal_id']);
        }

        $this->repo->updateEstado((int)$id, $nuevoEstado);

        // Si se marca como DESPACHADO y tiene delivery, actualizar fecha_salida y estado del delivery
        if ($nuevoEstado === 'DESPACHADO' && !empty($pedido['delivery_id'])) {
            $db = \App\Helpers\Database::getConnection();
            $updDel = $db->prepare("UPDATE deliveries SET estado_delivery = 'EN_RUTA', fecha_salida = NOW() WHERE pedido_id = :id");
            $updDel->execute([':id' => (int)$id]);
        } elseif ($nuevoEstado === 'ENTREGADO' && !empty($pedido['delivery_id'])) {
            $db = \App\Helpers\Database::getConnection();
            $updDel = $db->prepare("UPDATE deliveries SET estado_delivery = 'ENTREGADO', fecha_entrega = NOW() WHERE pedido_id = :id");
            $updDel->execute([':id' => (int)$id]);
        }

        Response::success(['estado_pedido' => $nuevoEstado], "Estado del pedido actualizado a {$nuevoEstado}.");
    }
}
