<?php
namespace App\Controllers;

use App\Services\GoogleMapsDistanceService;
use App\Repositories\SucursalRepository;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Helpers\Database;

class DeliveryController {
    private GoogleMapsDistanceService $distanceService;
    private SucursalRepository $sucursalRepo;

    public function __construct() {
        $this->distanceService = new GoogleMapsDistanceService();
        $this->sucursalRepo = new SucursalRepository();
    }

    /**
     * POST /api/delivery/quote
     * Cotiza el costo de envío y valida el radio de cobertura
     */
    public function quote(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'sucursal_id' => 'required|numeric',
            'latitud'     => 'required|numeric',
            'longitud'    => 'required|numeric'
        ]);

        if ($validator->fails()) {
            Response::error('Parámetros de ubicación incompletos', 422, $validator->getErrors());
        }

        $sucursal = $this->sucursalRepo->getById((int)$input['sucursal_id']);
        if (!$sucursal) {
            Response::error('Sucursal no encontrada', 404);
        }

        $metrics = $this->distanceService->calculateDeliveryMetrics(
            (float)$sucursal['latitud'],
            (float)$sucursal['longitud'],
            (float)$input['latitud'],
            (float)$input['longitud'],
            (float)$sucursal['radio_cobertura_km'],
            (float)$sucursal['costo_envio_base'],
            (float)$sucursal['costo_km_adicional']
        );

        Response::success($metrics);
    }

    /**
     * GET /api/delivery/track/{pedido_id}
     */
    public function track(string $pedidoId): void {
        $db = Database::getConnection();
        $sql = "SELECT d.*, 
                       p.codigo_pedido,
                       p.estado_pedido,
                       s.nombre AS sucursal_nombre,
                       s.latitud AS sucursal_lat,
                       s.longitud AS sucursal_lng
                FROM deliveries d
                JOIN pedidos p ON d.pedido_id = p.id
                JOIN sucursales s ON p.sucursal_id = s.id
                WHERE d.pedido_id = :id";
        $stmt = $db->prepare($sql);
        $stmt->execute([':id' => (int)$pedidoId]);
        $delivery = $stmt->fetch();

        if (!$delivery) {
            Response::error('Seguimiento de delivery no encontrado', 404);
        }

        Response::success($delivery);
    }

    /**
     * POST /api/delivery/update-location
     * Actualiza la posición GPS del repartidor
     */
    public function updateLocation(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'pedido_id' => 'required|numeric',
            'latitud'   => 'required|numeric',
            'longitud'  => 'required|numeric'
        ]);

        if ($validator->fails()) {
            Response::error('Coordenadas incompletas', 422, $validator->getErrors());
        }

        $db = Database::getConnection();
        $stmt = $db->prepare(
            "UPDATE deliveries 
             SET latitud_actual_repartidor = :lat, 
                 longitud_actual_repartidor = :lng, 
                 updated_at = NOW() 
             WHERE pedido_id = :pedido_id"
        );
        $stmt->execute([
            ':lat'       => $input['latitud'],
            ':lng'       => $input['longitud'],
            ':pedido_id' => (int)$input['pedido_id']
        ]);

        Response::success(null, 'Posición GPS actualizada');
    }
}
