<?php
namespace App\Controllers;

use App\Services\GoogleMapsDistanceService;
use App\Repositories\SucursalRepository;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Helpers\Database;
use App\Helpers\JWT;
use PDO;

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
     * Devuelve la posición GPS actual del repartidor y metadatos del delivery
     */
    public function track(string $pedido_id): void {
        $db = Database::getConnection();
        $sql = "SELECT d.*,
                       p.id AS pedido_id,
                       p.codigo_pedido,
                       p.numero_boleta,
                       p.token_seguimiento,
                       p.estado_pedido,
                       p.tipo_entrega,
                       p.es_invitado,
                       p.contacto_email,
                       p.contacto_telefono,
                       s.nombre AS sucursal_nombre,
                       s.direccion AS sucursal_direccion,
                       s.latitud AS sucursal_lat,
                       s.longitud AS sucursal_lng,
                       COALESCE(c.nombres, p.contacto_email, 'Cliente Invitado') AS cliente_nombres,
                       COALESCE(c.apellidos, '') AS cliente_apellidos,
                       COALESCE(c.telefono, p.contacto_telefono, '') AS cliente_telefono
                FROM deliveries d
                JOIN pedidos p ON d.pedido_id = p.id
                JOIN sucursales s ON p.sucursal_id = s.id
                LEFT JOIN clientes c ON p.cliente_id = c.id
                WHERE d.pedido_id = :id OR p.codigo_pedido = :cod OR p.token_seguimiento = :tok
                LIMIT 1";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':id'  => is_numeric($pedido_id) ? (int)$pedido_id : 0,
            ':cod' => trim($pedido_id),
            ':tok' => trim($pedido_id)
        ]);
        $delivery = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$delivery) {
            Response::error('Seguimiento de delivery no encontrado', 404);
        }

        // Si el repartidor aún no ha emitido coordenadas en vivo, se inicializa en la sucursal de origen
        if (empty($delivery['latitud_actual_repartidor']) || empty($delivery['longitud_actual_repartidor'])) {
            $delivery['latitud_actual_repartidor'] = $delivery['sucursal_lat'];
            $delivery['longitud_actual_repartidor'] = $delivery['sucursal_lng'];
            $delivery['posicion_origen_sucursal'] = true;
        }

        Response::success($delivery);
    }

    /**
     * POST /api/delivery/update-location
     * Actualiza la posición GPS del repartidor en MySQL para consultas en tiempo real
     */
    public function updateLocation(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'pedido_id' => 'required',
            'latitud'   => 'required|numeric',
            'longitud'  => 'required|numeric'
        ]);

        if ($validator->fails()) {
            Response::error('Coordenadas incompletas', 422, $validator->getErrors());
        }

        $db = Database::getConnection();
        $pedidoParam = trim((string)$input['pedido_id']);

        // Resolver el ID numérico si vino código de pedido o token
        $stmtId = $db->prepare("SELECT id FROM pedidos WHERE id = :id OR codigo_pedido = :cod OR token_seguimiento = :tok LIMIT 1");
        $stmtId->execute([
            ':id'  => is_numeric($pedidoParam) ? (int)$pedidoParam : 0,
            ':cod' => $pedidoParam,
            ':tok' => $pedidoParam
        ]);
        $realPedidoId = $stmtId->fetchColumn();
        if (!$realPedidoId) {
            Response::error('Pedido no encontrado para actualizar ubicación', 404);
        }

        $repartidorNombre = isset($input['repartidor_nombre']) ? trim((string)$input['repartidor_nombre']) : null;

        if ($repartidorNombre !== null && $repartidorNombre !== '') {
            $stmt = $db->prepare(
                "UPDATE deliveries
                 SET latitud_actual_repartidor = :lat,
                     longitud_actual_repartidor = :lng,
                     repartidor_nombre = :rep_nombre,
                     updated_at = NOW()
                 WHERE pedido_id = :pedido_id"
            );
            $stmt->execute([
                ':lat'        => (float)$input['latitud'],
                ':lng'        => (float)$input['longitud'],
                ':rep_nombre' => $repartidorNombre,
                ':pedido_id'  => (int)$realPedidoId
            ]);
        } else {
            $stmt = $db->prepare(
                "UPDATE deliveries
                 SET latitud_actual_repartidor = :lat,
                     longitud_actual_repartidor = :lng,
                     updated_at = NOW()
                 WHERE pedido_id = :pedido_id"
            );
            $stmt->execute([
                ':lat'       => (float)$input['latitud'],
                ':lng'       => (float)$input['longitud'],
                ':pedido_id' => (int)$realPedidoId
            ]);
        }

        Response::success([
            'pedido_id'  => (int)$input['pedido_id'],
            'latitud'    => (float)$input['latitud'],
            'longitud'   => (float)$input['longitud'],
            'updated_at' => date('c')
        ], 'Posición GPS actualizada');
    }

    /**
     * POST /api/riders/login
     * Autentica al repartidor de la app móvil Mass Rider contra la tienda web
     */
    public function riderLogin(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $code = strtoupper(trim((string)($input['employee_code'] ?? $input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');

        if ($code === '' || $password === '') {
            Response::error('Código de repartidor y contraseña requeridos', 422);
        }

        $db = Database::getConnection();
        $stmtSuc = $db->query("SELECT id, nombre FROM sucursales WHERE estado = 1 ORDER BY id ASC LIMIT 1");
        $sucursal = $stmtSuc->fetch(PDO::FETCH_ASSOC) ?: ['id' => 1, 'nombre' => 'Tiendas Mass Principal'];

        // Verificar si coincide con algún usuario registrado en la BD (por email)
        $stmtUser = $db->prepare("SELECT u.*, r.nombre AS rol_nombre, s.nombre AS sucursal_nombre
                                  FROM usuarios u
                                  JOIN roles r ON u.rol_id = r.id
                                  LEFT JOIN sucursales s ON u.sucursal_id = s.id
                                  WHERE UPPER(u.email) = :code AND u.estado = 1
                                  LIMIT 1");
        $stmtUser->execute([':code' => $code]);
        $dbUser = $stmtUser->fetch(PDO::FETCH_ASSOC);

        $riderProfile = null;
        if ($dbUser && password_verify($password, $dbUser['password_hash'])) {
            $riderProfile = [
                'rider_id'        => 'MASS-U-' . $dbUser['id'],
                'employee_code'   => $code,
                'full_name'       => trim($dbUser['nombres'] . ' ' . $dbUser['apellidos']),
                'phone'           => $dbUser['telefono'] ?? '+51987654321',
                'vehicle_type'    => 'MOTO',
                'vehicle_plate'   => 'MASS-01',
                'home_store_name' => $dbUser['sucursal_nombre'] ?? $sucursal['nombre'],
                'sucursal_id'     => (int)($dbUser['sucursal_id'] ?? $sucursal['id']),
            ];
        } else {
            // Credenciales operativas de repartidores Mass
            $ridersCatalog = [
                'MASS-R-804' => [
                    'password'      => '1234',
                    'rider_id'      => 'MASS-R-804',
                    'full_name'     => 'Pedro Ramírez',
                    'phone'         => '+51987654321',
                    'vehicle_type'  => 'MOTO',
                    'vehicle_plate' => '4821-AM',
                ],
                'MASS-R-001' => [
                    'password'      => '1234',
                    'rider_id'      => 'MASS-R-001',
                    'full_name'     => 'Carlos Mendoza',
                    'phone'         => '+51965432100',
                    'vehicle_type'  => 'MOTO',
                    'vehicle_plate' => '7310-HY',
                ],
            ];

            if (!isset($ridersCatalog[$code]) || $ridersCatalog[$code]['password'] !== $password) {
                Response::error('Código de repartidor o contraseña incorrectos', 401);
            }

            $r = $ridersCatalog[$code];
            $riderProfile = [
                'rider_id'        => $r['rider_id'],
                'employee_code'   => $code,
                'full_name'       => $r['full_name'],
                'phone'           => $r['phone'],
                'vehicle_type'    => $r['vehicle_type'],
                'vehicle_plate'   => $r['vehicle_plate'],
                'home_store_name' => $sucursal['nombre'],
                'sucursal_id'     => (int)$sucursal['id'],
            ];
        }

        $secret = $_ENV['JWT_SECRET'] ?? 'TiendasMass_SuperSecretKey_Huancayo_2026_Key_MustBeLongAndSecure!';
        $token = JWT::encode([
            'sub'           => $riderProfile['rider_id'],
            'employee_code' => $riderProfile['employee_code'],
            'rol'           => 'Rider',
            'sucursal_id'   => $riderProfile['sucursal_id'],
        ], $secret, 24);

        $riderProfile['auth_token'] = $token;
        Response::success($riderProfile, 'Turno de repartidor iniciado');
    }

    /**
     * GET /api/riders/orders
     * Lista pedidos DELIVERY reales desde MySQL para la app Mass Rider
     */
    public function riderOrders(): void {
        $db = Database::getConnection();
        $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id'])
            ? (int)$_GET['sucursal_id']
            : null;

        $sql = "SELECT p.id,
                       p.codigo_pedido,
                       p.sucursal_id,
                       p.total,
                       p.costo_envio,
                       p.metodo_pago,
                       p.estado_pedido,
                       p.contacto_telefono,
                       p.fecha_pedido,
                       s.nombre AS sucursal_nombre,
                       s.direccion AS sucursal_direccion,
                       s.latitud AS sucursal_lat,
                       s.longitud AS sucursal_lng,
                       c.nombres AS cliente_nombres,
                       c.apellidos AS cliente_apellidos,
                       c.telefono AS cliente_telefono,
                       d.direccion_destino,
                       d.referencia_destino,
                       d.latitud_destino,
                       d.longitud_destino,
                       d.distancia_km,
                       d.repartidor_nombre,
                       d.estado_delivery
                FROM pedidos p
                JOIN sucursales s ON p.sucursal_id = s.id
                JOIN clientes c ON p.cliente_id = c.id
                JOIN deliveries d ON d.pedido_id = p.id
                WHERE p.tipo_entrega = 'DELIVERY'
                  AND p.estado_pedido != 'CANCELADO'";

        $params = [];
        if ($sucursalId) {
            $sql .= " AND p.sucursal_id = :sucursal_id";
            $params[':sucursal_id'] = $sucursalId;
        }
        $sql .= " ORDER BY p.id DESC LIMIT 50";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmtItems = $db->prepare(
            "SELECT dp.cantidad, dp.precio_unitario, pr.codigo_sku, pr.nombre AS producto_nombre
             FROM detalle_pedidos dp
             JOIN productos pr ON dp.producto_id = pr.id
             WHERE dp.pedido_id = :pedido_id"
        );

        $orders = [];
        foreach ($rows as $row) {
            $stmtItems->execute([':pedido_id' => $row['id']]);
            $rawItems = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

            $items = array_map(static function (array $it): array {
                return [
                    'sku'          => $it['codigo_sku'] ?? '',
                    'product_name' => $it['producto_nombre'] ?? 'Producto Mass',
                    'category'     => 'TIENDA',
                    'quantity'     => (int)$it['cantidad'],
                    'unit_price'   => (float)$it['precio_unitario'],
                ];
            }, $rawItems);

            // Mapear estado de BD web -> estado app Mass Rider
            $riderStatus = 'PENDIENTE';
            $estadoPedido = strtoupper((string)$row['estado_pedido']);
            $estadoDelivery = strtoupper((string)($row['estado_delivery'] ?? 'ASIGNADO'));

            if ($estadoPedido === 'ENTREGADO' || $estadoDelivery === 'ENTREGADO') {
                $riderStatus = 'ENTREGADO';
            } elseif ($estadoPedido === 'DESPACHADO' || $estadoDelivery === 'EN_RUTA') {
                $riderStatus = 'EN_CAMINO';
            } elseif ($estadoPedido === 'LISTO_PARA_DESPACHO') {
                $riderStatus = 'ASIGNADO';
            }

            $customerPhone = $row['contacto_telefono'] ?: ($row['cliente_telefono'] ?: '+51999000000');
            $commission = max(4.50, round((float)$row['costo_envio'] * 0.85, 2));

            $orders[] = [
                'order_id'            => (string)$row['id'],
                'order_code'          => $row['codigo_pedido'],
                'store_name'          => $row['sucursal_nombre'],
                'store_address'       => $row['sucursal_direccion'],
                'store_lat'           => (float)$row['sucursal_lat'],
                'store_lng'           => (float)$row['sucursal_lng'],
                'customer_name'       => trim($row['cliente_nombres'] . ' ' . $row['cliente_apellidos']),
                'customer_phone'      => $customerPhone,
                'delivery_address'    => $row['direccion_destino'],
                'delivery_reference'  => $row['referencia_destino'] ?? '',
                'delivery_lat'        => (float)$row['latitud_destino'],
                'delivery_lng'        => (float)$row['longitud_destino'],
                'estimated_distance_km' => (float)$row['distancia_km'],
                'bags_count'          => max(1, count($items)),
                'requires_cold_chain' => false,
                'total_amount'        => (float)$row['total'],
                'rider_commission'    => $commission,
                'payment_method'      => $row['metodo_pago'] === 'EFECTIVO_CONTRA_ENTREGA' ? 'EFECTIVO' : 'ONLINE_PAGADO',
                'is_paid'             => $row['metodo_pago'] !== 'EFECTIVO_CONTRA_ENTREGA',
                'status'              => $riderStatus,
                'items'               => $items,
            ];
        }

        Response::success($orders);
    }

    /**
     * POST /api/riders/orders/{id}/status
     * Sincroniza el estado del pedido desde la app Mass Rider hacia MySQL (pedidos + deliveries)
     */
    public function riderUpdateOrderStatus(string $id): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = strtoupper(trim((string)($input['status'] ?? '')));
        $riderName = trim((string)($input['rider_name'] ?? 'Motorizado Mass'));
        $riderPhone = trim((string)($input['rider_phone'] ?? ''));

        $db = Database::getConnection();
        $id = (int)$id;

        if ($status === 'ASIGNADO') {
            $db->prepare("UPDATE pedidos SET estado_pedido = 'LISTO_PARA_DESPACHO', updated_at = NOW() WHERE id = :id")
               ->execute([':id' => $id]);
            $db->prepare("UPDATE deliveries SET estado_delivery = 'ASIGNADO', repartidor_nombre = :rep, repartidor_telefono = :tel, updated_at = NOW() WHERE pedido_id = :id")
               ->execute([':rep' => $riderName, ':tel' => $riderPhone ?: null, ':id' => $id]);
        } elseif ($status === 'EN_CAMINO') {
            $db->prepare("UPDATE pedidos SET estado_pedido = 'DESPACHADO', updated_at = NOW() WHERE id = :id")
               ->execute([':id' => $id]);
            $db->prepare("UPDATE deliveries SET estado_delivery = 'EN_RUTA', repartidor_nombre = :rep, repartidor_telefono = :tel, fecha_salida = COALESCE(fecha_salida, NOW()), updated_at = NOW() WHERE pedido_id = :id")
               ->execute([':rep' => $riderName, ':tel' => $riderPhone ?: null, ':id' => $id]);
        } elseif ($status === 'ENTREGADO') {
            $db->prepare("UPDATE pedidos SET estado_pedido = 'ENTREGADO', updated_at = NOW() WHERE id = :id")
               ->execute([':id' => $id]);
            $db->prepare("UPDATE deliveries SET estado_delivery = 'ENTREGADO', fecha_entrega = NOW(), updated_at = NOW() WHERE pedido_id = :id")
               ->execute([':id' => $id]);
        } else {
            Response::error('Estado no válido para repartidor', 422);
        }

        Response::success([
            'pedido_id' => $id,
            'status'    => $status,
        ], 'Estado sincronizado con Tiendas Mass');
    }

    /**
     * GET /api/riders/settlement
     * Resumen de entregas y comisiones del repartidor basado en pedidos reales
     */
    public function riderSettlement(): void {
        $db = Database::getConnection();
        $stmt = $db->query("
            SELECT COUNT(*) AS entregados,
                   COALESCE(SUM(GREATEST(4.50, p.costo_envio * 0.85)), 0) AS comisiones,
                   COALESCE(SUM(CASE WHEN p.metodo_pago = 'EFECTIVO_CONTRA_ENTREGA' THEN p.total ELSE 0 END), 0) AS efectivo_cobrado
            FROM pedidos p
            JOIN deliveries d ON d.pedido_id = p.id
            WHERE p.tipo_entrega = 'DELIVERY'
              AND p.estado_pedido = 'ENTREGADO'
              AND DATE(p.updated_at) = CURDATE()
        ");
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['entregados' => 0, 'comisiones' => 0, 'efectivo_cobrado' => 0];

        $gross = (float)$row['comisiones'];
        $cash = (float)$row['efectivo_cobrado'];

        Response::success([
            'period_label'      => 'Jornada de hoy (' . date('d/m/Y') . ')',
            'delivered_orders'  => (int)$row['entregados'],
            'gross_commissions' => round($gross, 2),
            'cash_collected'    => round($cash, 2),
            'net_payable'       => round($gross - $cash, 2),
            'status'            => 'ACTIVO',
        ]);
    }
}
