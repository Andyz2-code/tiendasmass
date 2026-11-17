<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;

class PedidoRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getAll(?int $sucursalId = null, ?int $clienteId = null, ?string $estado = null): array {
        $sql = "SELECT p.*, 
                       s.nombre AS sucursal_nombre,
                       c.nombres AS cliente_nombres,
                       c.apellidos AS cliente_apellidos,
                       c.tipo_documento,
                       c.numero_documento,
                       c.telefono AS cliente_telefono,
                       d.estado_delivery,
                       d.direccion_destino,
                       d.distancia_km,
                       d.repartidor_nombre
                FROM pedidos p
                JOIN sucursales s ON p.sucursal_id = s.id
                JOIN clientes c ON p.cliente_id = c.id
                LEFT JOIN deliveries d ON d.pedido_id = p.id
                WHERE 1=1";

        $params = [];

        if ($sucursalId) {
            $sql .= " AND p.sucursal_id = :sucursal_id";
            $params[':sucursal_id'] = $sucursalId;
        }

        if ($clienteId) {
            $sql .= " AND p.cliente_id = :cliente_id";
            $params[':cliente_id'] = $clienteId;
        }

        if ($estado) {
            $sql .= " AND p.estado_pedido = :estado";
            $params[':estado'] = $estado;
        }

        $sql .= " ORDER BY p.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array {
        $sql = "SELECT p.*, 
                       s.nombre AS sucursal_nombre,
                       s.direccion AS sucursal_direccion,
                       s.latitud AS sucursal_lat,
                       s.longitud AS sucursal_lng,
                       c.nombres AS cliente_nombres,
                       c.apellidos AS cliente_apellidos,
                       c.tipo_documento,
                       c.numero_documento,
                       c.email AS cliente_email,
                       c.telefono AS cliente_telefono,
                       d.id AS delivery_id,
                       d.direccion_destino,
                       d.referencia_destino,
                       d.latitud_destino,
                       d.longitud_destino,
                       d.distancia_km,
                       d.tiempo_estimado_min,
                       d.repartidor_nombre,
                       d.repartidor_telefono,
                       d.latitud_actual_repartidor,
                       d.longitud_actual_repartidor,
                       d.estado_delivery,
                       d.fecha_salida,
                       d.fecha_entrega
                FROM pedidos p
                JOIN sucursales s ON p.sucursal_id = s.id
                JOIN clientes c ON p.cliente_id = c.id
                LEFT JOIN deliveries d ON d.pedido_id = p.id
                WHERE p.id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $pedido = $stmt->fetch();

        if (!$pedido) {
            return null;
        }

        // Obtener detalles con desglose de lotes PEPS
        $detSql = "SELECT dp.*, 
                          pr.nombre AS producto_nombre, 
                          pr.codigo_sku, 
                          pr.codigo_barras,
                          pr.unidad_medida,
                          l.codigo_lote,
                          l.fecha_ingreso,
                          l.fecha_vencimiento,
                          l.ubicacion_almacen
                   FROM detalle_pedidos dp
                   JOIN productos pr ON dp.producto_id = pr.id
                   JOIN lotes l ON dp.lote_id = l.id
                   WHERE dp.pedido_id = :id";
        $detStmt = $this->db->prepare($detSql);
        $detStmt->execute([':id' => $id]);
        $pedido['detalles'] = $detStmt->fetchAll();

        return $pedido;
    }

    public function updateEstado(int $id, string $nuevoEstado): bool {
        $sql = "UPDATE pedidos SET estado_pedido = :estado, updated_at = NOW() WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([':estado' => $nuevoEstado, ':id' => $id]);
    }
}
