<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;

class ProductoRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getAll(bool $onlyActive = true, ?int $categoriaId = null, ?string $search = null): array {
        $sql = "SELECT p.*, c.nombre AS categoria_nombre 
                FROM productos p 
                JOIN categorias c ON p.categoria_id = c.id";
        $where = [];
        $params = [];

        if ($onlyActive) {
            $where[] = "p.estado = 1";
        }
        if ($categoriaId) {
            $where[] = "p.categoria_id = :cat_id";
            $params[':cat_id'] = $categoriaId;
        }
        if ($search !== null && trim($search) !== '') {
            $clean = preg_replace('/\s+/', ' ', trim($search));
            $term = "%" . $clean . "%";
            $where[] = "(p.nombre LIKE :s_nom OR p.descripcion LIKE :s_desc OR p.codigo_sku LIKE :s_sku OR p.codigo_barras LIKE :s_bar OR c.nombre LIKE :s_cat)";
            $params[':s_nom'] = $term;
            $params[':s_desc'] = $term;
            $params[':s_sku'] = $term;
            $params[':s_bar'] = $term;
            $params[':s_cat'] = $term;
        }

        if (!empty($where)) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }

        if ($search !== null && trim($search) !== '') {
            $clean = preg_replace('/\s+/', ' ', trim($search));
            $sql .= " ORDER BY 
                CASE 
                    WHEN LOWER(p.nombre) = LOWER(:s_exact1) THEN 1 
                    WHEN LOWER(p.codigo_sku) = LOWER(:s_exact2) THEN 2 
                    WHEN p.nombre LIKE :s_prefix THEN 3 
                    ELSE 4 
                END ASC, p.nombre ASC";
            $params[':s_exact1'] = $clean;
            $params[':s_exact2'] = $clean;
            $params[':s_prefix'] = $clean . "%";
        } else {
            $sql .= " ORDER BY p.id ASC";
        }

        if (!empty($params)) {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        }
        return $this->db->query($sql)->fetchAll();
    }

    public function getBySucursal(int $sucursalId, ?int $categoriaId = null, ?string $search = null): array {
        // Obtenemos los productos activos y calculamos el stock vendible real basado en lotes activos y vigentes
        $sql = "SELECT p.id, p.categoria_id, c.nombre AS categoria_nombre, p.codigo_sku, p.codigo_barras,
                       p.nombre, p.descripcion, p.unidad_medida, p.precio_venta, p.costo_base,
                       p.es_perecedero, p.imagen_url, p.estado,
                       COALESCE(l.stock_lotes_disponible, 0) AS stock_actual,
                       COALESCE(i.stock_actual, 0) AS stock_inventario,
                       COALESCE(l.stock_lotes_disponible, 0) AS stock_lotes_disponible,
                       COALESCE(i.stock_minimo, 10) AS stock_minimo,
                       COALESCE(i.punto_reorden, 20) AS punto_reorden,
                       COALESCE(i.clasificacion_abc, 'B') AS clasificacion_abc
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN inventarios i ON i.producto_id = p.id AND i.sucursal_id = :sucursal_id
                LEFT JOIN (
                    SELECT producto_id, sucursal_id, SUM(cantidad_disponible) AS stock_lotes_disponible
                    FROM lotes
                    WHERE sucursal_id = :sucursal_id_lote
                      AND estado = 'DISPONIBLE'
                      AND cantidad_disponible > 0
                      AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURDATE())
                    GROUP BY producto_id, sucursal_id
                ) l ON l.producto_id = p.id AND l.sucursal_id = :sucursal_id_join
                WHERE p.estado = 1";

        $params = [
            ':sucursal_id'      => $sucursalId,
            ':sucursal_id_lote' => $sucursalId,
            ':sucursal_id_join' => $sucursalId
        ];

        if ($categoriaId) {
            $sql .= " AND p.categoria_id = :cat_id";
            $params[':cat_id'] = $categoriaId;
        }

        if ($search !== null && trim($search) !== '') {
            $clean = preg_replace('/\s+/', ' ', trim($search));
            $term = "%" . $clean . "%";
            $sql .= " AND (p.nombre LIKE :s_nom OR p.descripcion LIKE :s_desc OR p.codigo_sku LIKE :s_sku OR p.codigo_barras LIKE :s_bar OR c.nombre LIKE :s_cat)";
            $params[':s_nom'] = $term;
            $params[':s_desc'] = $term;
            $params[':s_sku'] = $term;
            $params[':s_bar'] = $term;
            $params[':s_cat'] = $term;

            $sql .= " ORDER BY 
                CASE 
                    WHEN LOWER(p.nombre) = LOWER(:s_exact1) THEN 1 
                    WHEN LOWER(p.codigo_sku) = LOWER(:s_exact2) THEN 2 
                    WHEN p.nombre LIKE :s_prefix THEN 3 
                    ELSE 4 
                END ASC, p.nombre ASC";
            $params[':s_exact1'] = $clean;
            $params[':s_exact2'] = $clean;
            $params[':s_prefix'] = $clean . "%";
        } else {
            $sql .= " ORDER BY p.nombre ASC";
        }

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

    public function getBySku(string $sku): ?array {
        $stmt = $this->db->prepare("SELECT * FROM productos WHERE codigo_sku = :sku LIMIT 1");
        $stmt->execute([':sku' => trim($sku)]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function getByBarcode(string $barcode): ?array {
        $trimmed = trim($barcode);
        if ($trimmed === '') {
            return null;
        }
        $stmt = $this->db->prepare("SELECT * FROM productos WHERE codigo_barras = :barras LIMIT 1");
        $stmt->execute([':barras' => $trimmed]);
        $row = $stmt->fetch();
        return $row ?: null;
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
