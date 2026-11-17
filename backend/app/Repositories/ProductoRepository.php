<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;

class ProductoRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getAll(bool $onlyActive = true): array {
        $sql = "SELECT p.*, c.nombre AS categoria_nombre 
                FROM productos p 
                JOIN categorias c ON p.categoria_id = c.id";
        if ($onlyActive) {
            $sql .= " WHERE p.estado = 1";
        }
        $sql .= " ORDER BY p.id ASC";
        return $this->db->query($sql)->fetchAll();
    }

    public function getBySucursal(int $sucursalId, ?int $categoriaId = null, ?string $search = null): array {
        $sql = "SELECT p.id, p.categoria_id, c.nombre AS categoria_nombre, p.codigo_sku, p.codigo_barras,
                       p.nombre, p.descripcion, p.unidad_medida, p.precio_venta, p.costo_base,
                       p.es_perecedero, p.imagen_url, p.estado,
                       i.stock_actual, i.stock_minimo, i.punto_reorden, i.clasificacion_abc
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                JOIN inventarios i ON i.producto_id = p.id
                WHERE i.sucursal_id = :sucursal_id AND p.estado = 1";

        $params = [':sucursal_id' => $sucursalId];

        if ($categoriaId) {
            $sql .= " AND p.categoria_id = :cat_id";
            $params[':cat_id'] = $categoriaId;
        }

        if ($search) {
            $sql .= " AND (p.nombre LIKE :search OR p.codigo_sku LIKE :search OR p.codigo_barras LIKE :search)";
            $params[':search'] = "%{$search}%";
        }

        $sql .= " ORDER BY p.nombre ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array {
        $stmt = $this->db->prepare(
            "SELECT p.*, c.nombre AS categoria_nombre 
             FROM productos p 
             JOIN categorias c ON p.categoria_id = c.id 
             WHERE p.id = :id"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int {
        $sql = "INSERT INTO productos 
                (categoria_id, codigo_sku, codigo_barras, nombre, descripcion, unidad_medida, precio_venta, costo_base, es_perecedero, imagen_url, estado)
                VALUES 
                (:cat, :sku, :barras, :nom, :desc, :um, :precio, :costo, :perecedero, :img, :estado)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':cat'        => $data['categoria_id'],
            ':sku'        => $data['codigo_sku'],
            ':barras'     => $data['codigo_barras'],
            ':nom'        => $data['nombre'],
            ':desc'       => $data['descripcion'] ?? null,
            ':um'         => $data['unidad_medida'] ?? 'UNIDAD',
            ':precio'     => $data['precio_venta'],
            ':costo'      => $data['costo_base'],
            ':perecedero' => $data['es_perecedero'] ?? 0,
            ':img'        => $data['imagen_url'] ?? null,
            ':estado'     => $data['estado'] ?? 1
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool {
        $fields = [];
        $params = [':id' => $id];

        $allowed = [
            'categoria_id'  => ':cat',
            'codigo_sku'    => ':sku',
            'codigo_barras' => ':barras',
            'nombre'        => ':nom',
            'descripcion'   => ':desc',
            'unidad_medida' => ':um',
            'precio_venta'  => ':precio',
            'costo_base'    => ':costo',
            'es_perecedero' => ':perecedero',
            'imagen_url'    => ':img',
            'estado'        => ':estado'
        ];

        foreach ($allowed as $col => $placeholder) {
            if (array_key_exists($col, $data)) {
                $fields[] = "{$col} = {$placeholder}";
                $params[$placeholder] = $data[$col];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = "UPDATE productos SET " . implode(', ', $fields) . ", updated_at = CURRENT_TIMESTAMP WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }

    public function existsBySku(string $sku, ?int $excludeId = null): bool {
        $sql = "SELECT COUNT(*) FROM productos WHERE codigo_sku = :sku";
        $params = [':sku' => trim($sku)];
        if ($excludeId) {
            $sql .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeId;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return ((int)$stmt->fetchColumn()) > 0;
    }

    public function existsByBarcode(string $barcode, ?int $excludeId = null): bool {
        $trimmed = trim($barcode);
        if ($trimmed === '') {
            return false;
        }
        $sql = "SELECT COUNT(*) FROM productos WHERE codigo_barras = :barras";
        $params = [':barras' => $trimmed];
        if ($excludeId) {
            $sql .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeId;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return ((int)$stmt->fetchColumn()) > 0;
    }
}
