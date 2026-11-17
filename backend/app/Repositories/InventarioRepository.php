<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;

class InventarioRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getBySucursal(int $sucursalId): array {
        $sql = "SELECT i.*, 
                       p.nombre AS producto_nombre, 
                       p.codigo_sku, 
                       p.codigo_barras, 
                       p.precio_venta, 
                       p.costo_base,
                       p.es_perecedero,
                       c.nombre AS categoria_nombre
                FROM inventarios i
                JOIN productos p ON i.producto_id = p.id
                JOIN categorias c ON p.categoria_id = c.id
                WHERE i.sucursal_id = :sucursal_id
                ORDER BY p.nombre ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        return $stmt->fetchAll();
    }

    public function getOne(int $sucursalId, int $productoId): ?array {
        $sql = "SELECT i.*, p.nombre AS producto_nombre, p.costo_base, p.precio_venta 
                FROM inventarios i
                JOIN productos p ON i.producto_id = p.id
                WHERE i.sucursal_id = :sucursal_id AND i.producto_id = :producto_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId, ':producto_id' => $productoId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function updateParameters(int $inventarioId, array $data): bool {
        $sql = "UPDATE inventarios 
                SET stock_minimo = :min,
                    stock_maximo = :max,
                    punto_reorden = :por,
                    stock_seguridad = :ss,
                    demanda_diaria_promedio = :d,
                    lead_time_dias = :l
                WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            ':min' => $data['stock_minimo'],
            ':max' => $data['stock_maximo'],
            ':por' => $data['punto_reorden'],
            ':ss'  => $data['stock_seguridad'],
            ':d'   => $data['demanda_diaria_promedio'],
            ':l'   => $data['lead_time_dias'],
            ':id'  => $inventarioId
        ]);
    }
}
