<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;

class KardexRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getBySucursal(int $sucursalId, ?int $productoId = null, int $limit = 100): array {
        $sql = "SELECT k.*, 
                       p.nombre AS producto_nombre, 
                       p.codigo_sku, 
                       l.codigo_lote,
                       u.nombres AS usuario_nombres,
                       u.apellidos AS usuario_apellidos
                FROM movimientos_inventario k
                JOIN productos p ON k.producto_id = p.id
                LEFT JOIN lotes l ON k.lote_id = l.id
                LEFT JOIN usuarios u ON k.usuario_id = u.id
                WHERE k.sucursal_id = :sucursal_id";

        $params = [':sucursal_id' => $sucursalId];

        if ($productoId) {
            $sql .= " AND k.producto_id = :producto_id";
            $params[':producto_id'] = $productoId;
        }

        $sql .= " ORDER BY k.id DESC LIMIT " . (int)$limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function registerManualAdjustment(array $data): int {
        $sql = "INSERT INTO movimientos_inventario 
                (sucursal_id, producto_id, lote_id, usuario_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                VALUES 
                (:suc, :prod, :lote, :user, :tipo, :doc, :cant, :costo, :ant, :nuevo, :obs)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':suc'   => $data['sucursal_id'],
            ':prod'  => $data['producto_id'],
            ':lote'  => $data['lote_id'] ?? null,
            ':user'  => $data['usuario_id'] ?? null,
            ':tipo'  => $data['tipo_movimiento'],
            ':doc'   => $data['documento_referencia'] ?? 'AJUSTE-MANUAL',
            ':cant'  => $data['cantidad'],
            ':costo' => $data['costo_unitario'],
            ':ant'   => $data['saldo_anterior'],
            ':nuevo' => $data['saldo_nuevo'],
            ':obs'   => $data['observaciones'] ?? null
        ]);
        return (int)$this->db->lastInsertId();
    }
}
