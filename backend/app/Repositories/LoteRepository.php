<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;

class LoteRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getBySucursal(int $sucursalId, ?int $productoId = null): array {
        $sql = "SELECT l.*, 
                       p.nombre AS producto_nombre, 
                       p.codigo_sku, 
                       p.precio_venta,
                       c.nombre AS categoria_nombre,
                       DATEDIFF(l.fecha_vencimiento, CURDATE()) AS dias_para_vencer
                FROM lotes l
                JOIN productos p ON l.producto_id = p.id
                JOIN categorias c ON p.categoria_id = c.id
                WHERE l.sucursal_id = :sucursal_id";

        $params = [':sucursal_id' => $sucursalId];

        if ($productoId) {
            $sql .= " AND l.producto_id = :producto_id";
            $params[':producto_id'] = $productoId;
        }

        $sql .= " ORDER BY l.fecha_ingreso ASC, l.fecha_vencimiento ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM lotes WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
