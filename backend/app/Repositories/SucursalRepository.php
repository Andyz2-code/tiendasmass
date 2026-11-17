<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;

class SucursalRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getAll(bool $onlyActive = true): array {
        $sql = "SELECT id, codigo_tienda, nombre, direccion, ciudad, latitud, longitud, 
                       radio_cobertura_km, costo_envio_base, costo_km_adicional, telefono, estado 
                FROM sucursales";
        if ($onlyActive) {
            $sql .= " WHERE estado = 1";
        }
        $sql .= " ORDER BY id ASC";
        return $this->db->query($sql)->fetchAll();
    }

    public function getById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM sucursales WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int {
        $sql = "INSERT INTO sucursales 
                (codigo_tienda, nombre, direccion, ciudad, latitud, longitud, radio_cobertura_km, costo_envio_base, costo_km_adicional, telefono, estado)
                VALUES 
                (:codigo, :nombre, :direccion, :ciudad, :lat, :lng, :radio, :base, :km, :tel, :estado)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':codigo'    => $data['codigo_tienda'],
            ':nombre'    => $data['nombre'],
            ':direccion' => $data['direccion'],
            ':ciudad'    => $data['ciudad'] ?? 'Huancayo',
            ':lat'       => $data['latitud'],
            ':lng'       => $data['longitud'],
            ':radio'     => $data['radio_cobertura_km'] ?? 5.0,
            ':base'      => $data['costo_envio_base'] ?? 4.0,
            ':km'        => $data['costo_km_adicional'] ?? 1.5,
            ':tel'       => $data['telefono'] ?? null,
            ':estado'    => $data['estado'] ?? 1
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool {
        $sql = "UPDATE sucursales 
                SET nombre = :nombre, direccion = :direccion, latitud = :lat, longitud = :lng,
                    radio_cobertura_km = :radio, costo_envio_base = :base, costo_km_adicional = :km,
                    telefono = :tel, estado = :estado, updated_at = NOW()
                WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            ':nombre'    => $data['nombre'],
            ':direccion' => $data['direccion'],
            ':lat'       => $data['latitud'],
            ':lng'       => $data['longitud'],
            ':radio'     => $data['radio_cobertura_km'],
            ':base'      => $data['costo_envio_base'],
            ':km'        => $data['costo_km_adicional'],
            ':tel'       => $data['telefono'] ?? null,
            ':estado'    => $data['estado'] ?? 1,
            ':id'        => $id
        ]);
    }
}
