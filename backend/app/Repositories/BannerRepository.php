<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;

class BannerRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getActiveBanners(?int $sucursalId = null): array
    {
        // Trae banners globales (sucursal_id IS NULL) mas los especificos de la sucursal seleccionada
        if ($sucursalId) {
            $stmt = $this->db->prepare("
                SELECT b.*, s.nombre AS sucursal_nombre
                FROM banners b
                LEFT JOIN sucursales s ON b.sucursal_id = s.id
                WHERE b.activo = 1 
                  AND (b.sucursal_id IS NULL OR b.sucursal_id = :sucursal_id)
                  AND (b.fecha_inicio IS NULL OR b.fecha_inicio <= CURRENT_DATE())
                  AND (b.fecha_fin IS NULL OR b.fecha_fin >= CURRENT_DATE())
                ORDER BY b.orden ASC, b.id DESC
            ");
            $stmt->execute([':sucursal_id' => $sucursalId]);
        } else {
            $stmt = $this->db->query("
                SELECT b.*, s.nombre AS sucursal_nombre
                FROM banners b
                LEFT JOIN sucursales s ON b.sucursal_id = s.id
                WHERE b.activo = 1
                  AND (b.fecha_inicio IS NULL OR b.fecha_inicio <= CURRENT_DATE())
                  AND (b.fecha_fin IS NULL OR b.fecha_fin >= CURRENT_DATE())
                ORDER BY b.orden ASC, b.id DESC
            ");
        }
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getAllForAdmin(?int $sucursalId = null): array
    {
        if ($sucursalId) {
            $stmt = $this->db->prepare("
                SELECT b.*, s.nombre AS sucursal_nombre
                FROM banners b
                LEFT JOIN sucursales s ON b.sucursal_id = s.id
                WHERE b.sucursal_id = :sucursal_id OR b.sucursal_id IS NULL
                ORDER BY b.orden ASC, b.id DESC
            ");
            $stmt->execute([':sucursal_id' => $sucursalId]);
        } else {
            $stmt = $this->db->query("
                SELECT b.*, s.nombre AS sucursal_nombre
                FROM banners b
                LEFT JOIN sucursales s ON b.sucursal_id = s.id
                ORDER BY b.orden ASC, b.id DESC
            ");
        }
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM banners WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        return $res ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO banners (
                sucursal_id, titulo, subtitulo, tag_promocion, precio_destacado,
                imagen_url, boton_texto, boton_enlace, fecha_inicio, fecha_fin, orden, activo
            ) VALUES (
                :sucursal_id, :titulo, :subtitulo, :tag_promocion, :precio_destacado,
                :imagen_url, :boton_texto, :boton_enlace, :fecha_inicio, :fecha_fin, :orden, :activo
            )
        ");

        $stmt->execute([
            ':sucursal_id'     => !empty($data['sucursal_id']) ? (int)$data['sucursal_id'] : null,
            ':titulo'          => $data['titulo'],
            ':subtitulo'       => $data['subtitulo'] ?? null,
            ':tag_promocion'   => $data['tag_promocion'] ?? 'OFERTAS BOMBA',
            ':precio_destacado'=> $data['precio_destacado'] ?? null,
            ':imagen_url'      => $data['imagen_url'],
            ':boton_texto'     => $data['boton_texto'] ?? 'Comprar Ahora',
            ':boton_enlace'    => $data['boton_enlace'] ?? '#catalogo',
            ':fecha_inicio'    => !empty($data['fecha_inicio']) ? $data['fecha_inicio'] : null,
            ':fecha_fin'       => !empty($data['fecha_fin']) ? $data['fecha_fin'] : null,
            ':orden'           => isset($data['orden']) ? (int)$data['orden'] : 1,
            ':activo'          => isset($data['activo']) ? (int)$data['activo'] : 1
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $stmt = $this->db->prepare("
            UPDATE banners SET
                sucursal_id = :sucursal_id,
                titulo = :titulo,
                subtitulo = :subtitulo,
                tag_promocion = :tag_promocion,
                precio_destacado = :precio_destacado,
                imagen_url = :imagen_url,
                boton_texto = :boton_texto,
                boton_enlace = :boton_enlace,
                fecha_inicio = :fecha_inicio,
                fecha_fin = :fecha_fin,
                orden = :orden,
                activo = :activo
            WHERE id = :id
        ");

        return $stmt->execute([
            ':id'              => $id,
            ':sucursal_id'     => !empty($data['sucursal_id']) ? (int)$data['sucursal_id'] : null,
            ':titulo'          => $data['titulo'],
            ':subtitulo'       => $data['subtitulo'] ?? null,
            ':tag_promocion'   => $data['tag_promocion'] ?? 'OFERTAS BOMBA',
            ':precio_destacado'=> $data['precio_destacado'] ?? null,
            ':imagen_url'      => $data['imagen_url'],
            ':boton_texto'     => $data['boton_texto'] ?? 'Comprar Ahora',
            ':boton_enlace'    => $data['boton_enlace'] ?? '#catalogo',
            ':fecha_inicio'    => !empty($data['fecha_inicio']) ? $data['fecha_inicio'] : null,
            ':fecha_fin'       => !empty($data['fecha_fin']) ? $data['fecha_fin'] : null,
            ':orden'           => isset($data['orden']) ? (int)$data['orden'] : 1,
            ':activo'          => isset($data['activo']) ? (int)$data['activo'] : 1
        ]);
    }

    public function toggleActivo(int $id, int $activo): bool
    {
        $stmt = $this->db->prepare("UPDATE banners SET activo = :activo WHERE id = :id");
        return $stmt->execute([':id' => $id, ':activo' => $activo]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM banners WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}
