<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;
use Exception;

class UsuarioRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Obtiene todos los usuarios internos (Administradores y Supervisores) con su rol y sucursal asignada.
     */
    public function getAll(?int $rolId = null, ?int $sucursalId = null): array {
        $sql = "SELECT u.id,
                       u.rol_id,
                       r.nombre AS rol_nombre,
                       u.sucursal_id,
                       s.nombre AS sucursal_nombre,
                       s.codigo_tienda AS sucursal_codigo,
                       u.nombres,
                       u.apellidos,
                       u.email,
                       u.telefono,
                       u.estado,
                       u.created_at,
                       u.updated_at
                FROM usuarios u
                JOIN roles r ON u.rol_id = r.id
                LEFT JOIN sucursales s ON u.sucursal_id = s.id
                WHERE 1=1";

        $params = [];
        if ($rolId !== null) {
            $sql .= " AND u.rol_id = :rol_id";
            $params[':rol_id'] = $rolId;
        }
        if ($sucursalId !== null) {
            $sql .= " AND u.sucursal_id = :sucursal_id";
            $params[':sucursal_id'] = $sucursalId;
        }

        $sql .= " ORDER BY u.rol_id ASC, u.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene un usuario por su ID.
     */
    public function getById(int $id): ?array {
        $sql = "SELECT u.id,
                       u.rol_id,
                       r.nombre AS rol_nombre,
                       u.sucursal_id,
                       s.nombre AS sucursal_nombre,
                       s.codigo_tienda AS sucursal_codigo,
                       u.nombres,
                       u.apellidos,
                       u.email,
                       u.telefono,
                       u.estado,
                       u.created_at
                FROM usuarios u
                JOIN roles r ON u.rol_id = r.id
                LEFT JOIN sucursales s ON u.sucursal_id = s.id
                WHERE u.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Verifica si un correo ya está registrado.
     */
    public function existsByEmail(string $email, ?int $excludeId = null): bool {
        $sql = "SELECT id FROM usuarios WHERE email = :email";
        $params = [':email' => strtolower(trim($email))];
        if ($excludeId !== null) {
            $sql .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeId;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return (bool)$stmt->fetch();
    }

    /**
     * Crea un nuevo usuario interno (Supervisor o Administrador).
     */
    public function create(array $data): int {
        $sql = "INSERT INTO usuarios (rol_id, sucursal_id, nombres, apellidos, email, password, telefono, estado)
                VALUES (:rol_id, :sucursal_id, :nombres, :apellidos, :email, :password, :telefono, :estado)";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':rol_id'      => (int)$data['rol_id'],
            ':sucursal_id' => !empty($data['sucursal_id']) ? (int)$data['sucursal_id'] : null,
            ':nombres'     => trim($data['nombres']),
            ':apellidos'   => trim($data['apellidos']),
            ':email'       => strtolower(trim($data['email'])),
            ':password'    => password_hash($data['password'], PASSWORD_BCRYPT),
            ':telefono'    => !empty($data['telefono']) ? trim($data['telefono']) : null,
            ':estado'      => isset($data['estado']) ? (int)$data['estado'] : 1
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Actualiza datos de un usuario (incluyendo sucursal asignada o estado).
     */
    public function update(int $id, array $data): bool {
        $fields = [
            'nombres = :nombres',
            'apellidos = :apellidos',
            'email = :email',
            'telefono = :telefono',
            'rol_id = :rol_id',
            'sucursal_id = :sucursal_id',
            'estado = :estado'
        ];
        $params = [
            ':nombres'     => trim($data['nombres']),
            ':apellidos'   => trim($data['apellidos']),
            ':email'       => strtolower(trim($data['email'])),
            ':telefono'    => !empty($data['telefono']) ? trim($data['telefono']) : null,
            ':rol_id'      => (int)$data['rol_id'],
            ':sucursal_id' => !empty($data['sucursal_id']) ? (int)$data['sucursal_id'] : null,
            ':estado'      => isset($data['estado']) ? (int)$data['estado'] : 1,
            ':id'          => $id
        ];

        if (!empty($data['password'])) {
            $fields[] = 'password = :password';
            $params[':password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        $sql = "UPDATE usuarios SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }

    public function toggleEstado(int $id): bool {
        $stmt = $this->db->prepare("UPDATE usuarios SET estado = IF(estado = 1, 0, 1) WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}
