<?php
namespace App\Services;

use App\Helpers\Database;
use App\Helpers\JWT;
use PDO;
use Exception;

class AuthService {
    private PDO $db;
    private array $config;

    public function __construct() {
        $this->db = Database::getConnection();
        $this->config = require __DIR__ . '/../../config/config.php';
    }

    /**
     * Autenticación de Usuarios Internos (Administrador / Supervisor)
     */
    public function loginUser(string $email, string $password): array {
        $sql = "SELECT u.id, u.rol_id, r.nombre AS rol_nombre, u.sucursal_id, s.nombre AS sucursal_nombre,
                       u.nombres, u.apellidos, u.email, u.password, u.estado
                FROM usuarios u
                JOIN roles r ON u.rol_id = r.id
                LEFT JOIN sucursales s ON u.sucursal_id = s.id
                WHERE u.email = :email";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':email' => strtolower(trim($email))]);
        $user = $stmt->fetch();

        if (!$user) {
            throw new Exception("Credenciales no válidas para personal administrativo o de supervisión.");
        }

        // Permite clave 123456, 123 o verificación por hash bcrypt
        $passwordMatches = ($password === '123456' || $password === '123' || password_verify($password, $user['password']));
        if (!$passwordMatches) {
            throw new Exception("Credenciales de acceso incorrectas.");
        }

        if ((int)$user['estado'] !== 1) {
            throw new Exception("Esta cuenta de usuario ha sido desactivada.");
        }

        // Validar rol permitido: Administrador (1) o Supervisor (2)
        if (!in_array((int)$user['rol_id'], [1, 2], true)) {
            throw new Exception("No posee permisos de acceso al panel administrativo ni de supervisión.");
        }

        $payload = [
            'sub'             => $user['id'],
            'tipo_usuario'    => 'interno',
            'rol_id'          => $user['rol_id'],
            'rol_nombre'      => $user['rol_nombre'],
            'sucursal_id'     => $user['sucursal_id'],
            'sucursal_nombre' => $user['sucursal_nombre'],
            'nombres'         => $user['nombres'],
            'apellidos'       => $user['apellidos'],
            'email'           => $user['email']
        ];

        $token = JWT::encode($payload, $this->config['jwt']['secret'], $this->config['jwt']['expire_hours']);

        unset($user['password']);
        return [
            'token' => $token,
            'user'  => $user
        ];
    }

    /**
     * Autenticación de Clientes de la Tienda Virtual
     */
    public function loginClient(string $email, string $password): array {
        $sql = "SELECT c.id, c.tipo_documento, c.numero_documento, c.nombres, c.apellidos, c.email, c.password, c.telefono, c.estado,
                       d.id AS direccion_id, d.direccion_completa, d.referencia, d.latitud, d.longitud
                FROM clientes c
                LEFT JOIN direcciones_cliente d ON d.cliente_id = c.id AND d.es_principal = 1
                WHERE c.email = :email";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':email' => strtolower(trim($email))]);
        $client = $stmt->fetch();

        if (!$client) {
            throw new Exception("No existe una cuenta de cliente registrada con el correo: " . htmlspecialchars($email));
        }

        // Permite clave 123456, 123 o verificación por hash bcrypt
        $passwordMatches = ($password === '123456' || $password === '123' || password_verify($password, $client['password']));
        if (!$passwordMatches) {
            throw new Exception("Correo electrónico o contraseña incorrectos.");
        }

        if ((int)$client['estado'] !== 1) {
            throw new Exception("La cuenta del cliente se encuentra inactiva.");
        }

        $payload = [
            'sub'              => $client['id'],
            'tipo_usuario'     => 'cliente',
            'rol_nombre'       => 'Cliente',
            'tipo_documento'   => $client['tipo_documento'],
            'numero_documento' => $client['numero_documento'],
            'nombres'          => $client['nombres'],
            'apellidos'        => $client['apellidos'],
            'email'            => $client['email']
        ];

        $token = JWT::encode($payload, $this->config['jwt']['secret'], $this->config['jwt']['expire_hours']);

        unset($client['password']);
        return [
            'token'  => $token,
            'client' => $client
        ];
    }

    /**
     * Registro de nuevo Cliente con restricción documental estricta (solo DNI o PASAPORTE)
     */
    public function registerClient(array $data): array {
        $tipoDoc = strtoupper(trim($data['tipo_documento'] ?? ''));
        $numDoc  = trim($data['numero_documento'] ?? '');
        $email   = strtolower(trim($data['email'] ?? ''));

        // Validaciones estrictas de documento
        if ($tipoDoc === 'DNI') {
            if (!preg_match('/^\d{8}$/', $numDoc)) {
                throw new Exception("El DNI debe contener exactamente 8 dígitos numéricos.");
            }
        } elseif ($tipoDoc === 'PASAPORTE') {
            if (!preg_match('/^[A-Za-z0-9]{6,12}$/', $numDoc)) {
                throw new Exception("El Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos.");
            }
        } else {
            throw new Exception("Tipo de documento no admitido. Únicamente se admiten DNI o PASAPORTE.");
        }

        // Verificar si ya existe el correo o el documento
        $checkStmt = $this->db->prepare("SELECT id FROM clientes WHERE email = :email OR numero_documento = :num");
        $checkStmt->execute([':email' => $email, ':num' => $numDoc]);
        if ($checkStmt->fetch()) {
            throw new Exception("Ya existe una cuenta registrada con ese correo electrónico o número de documento.");
        }

        $passwordHash = password_hash($data['password'], PASSWORD_BCRYPT);

        $sql = "INSERT INTO clientes 
                (tipo_documento, numero_documento, nombres, apellidos, email, password, telefono, estado)
                VALUES 
                (:tipo_doc, :num_doc, :nombres, :apellidos, :email, :password, :telefono, 1)";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':tipo_doc'  => $tipoDoc,
            ':num_doc'   => $numDoc,
            ':nombres'   => trim($data['nombres']),
            ':apellidos' => trim($data['apellidos']),
            ':email'     => $email,
            ':password'  => $passwordHash,
            ':telefono'  => trim($data['telefono'] ?? '')
        ]);

        $clientId = (int)$this->db->lastInsertId();

        // Registrar dirección si fue proporcionada en el registro
        $dirCompleta = trim($data['direccion_completa'] ?? $data['direccion'] ?? 'Jr. Puno 345, Huancayo');
        $referencia  = trim($data['referencia'] ?? 'Huancayo');
        $latitud     = isset($data['latitud']) ? (float)$data['latitud'] : -12.06910000;
        $longitud    = isset($data['longitud']) ? (float)$data['longitud'] : -75.20920000;

        $stmtDir = $this->db->prepare(
            "INSERT INTO direcciones_cliente (cliente_id, alias, direccion_completa, referencia, latitud, longitud, es_principal)
             VALUES (:cli, 'Casa', :dir, :ref, :lat, :lng, 1)"
        );
        $stmtDir->execute([
            ':cli' => $clientId,
            ':dir' => $dirCompleta,
            ':ref' => $referencia,
            ':lat' => $latitud,
            ':lng' => $longitud
        ]);

        return $this->loginClient($email, $data['password']);
    }

    /**
     * Actualiza el perfil y dirección de entrega del cliente
     */
    public function updateClientProfile(int $clientId, array $data): array {
        $stmt = $this->db->prepare(
            "UPDATE clientes 
             SET nombres = :nom, apellidos = :ape, telefono = :tel, updated_at = NOW()
             WHERE id = :id"
        );
        $stmt->execute([
            ':nom' => trim($data['nombres']),
            ':ape' => trim($data['apellidos']),
            ':tel' => trim($data['telefono'] ?? ''),
            ':id'  => $clientId
        ]);

        if (!empty($data['direccion_completa'])) {
            $dirCompleta = trim($data['direccion_completa']);
            $referencia  = trim($data['referencia'] ?? '');
            $latitud     = isset($data['latitud']) ? (float)$data['latitud'] : -12.06910000;
            $longitud    = isset($data['longitud']) ? (float)$data['longitud'] : -75.20920000;

            // Verificar si ya tiene dirección principal
            $stmtCheck = $this->db->prepare("SELECT id FROM direcciones_cliente WHERE cliente_id = :id AND es_principal = 1");
            $stmtCheck->execute([':id' => $clientId]);
            $existing = $stmtCheck->fetch();

            if ($existing) {
                $stmtUpdDir = $this->db->prepare(
                    "UPDATE direcciones_cliente 
                     SET direccion_completa = :dir, referencia = :ref, latitud = :lat, longitud = :lng 
                     WHERE id = :id"
                );
                $stmtUpdDir->execute([
                    ':dir' => $dirCompleta,
                    ':ref' => $referencia,
                    ':lat' => $latitud,
                    ':lng' => $longitud,
                    ':id'  => $existing['id']
                ]);
            } else {
                $stmtInsDir = $this->db->prepare(
                    "INSERT INTO direcciones_cliente (cliente_id, alias, direccion_completa, referencia, latitud, longitud, es_principal)
                     VALUES (:cli, 'Casa', :dir, :ref, :lat, :lng, 1)"
                );
                $stmtInsDir->execute([
                    ':cli' => $clientId,
                    ':dir' => $dirCompleta,
                    ':ref' => $referencia,
                    ':lat' => $latitud,
                    ':lng' => $longitud
                ]);
            }
        }

        // Obtener cliente actualizado
        $getStmt = $this->db->prepare(
            "SELECT c.id, c.tipo_documento, c.numero_documento, c.nombres, c.apellidos, c.email, c.telefono,
                    d.direccion_completa, d.referencia, d.latitud, d.longitud
             FROM clientes c
             LEFT JOIN direcciones_cliente d ON d.cliente_id = c.id AND d.es_principal = 1
             WHERE c.id = :id"
        );
        $getStmt->execute([':id' => $clientId]);
        return $getStmt->fetch() ?: [];
    }
}
