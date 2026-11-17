<?php
namespace App\Controllers;

use App\Repositories\UsuarioRepository;
use App\Repositories\SucursalRepository;
use App\Middleware\RoleMiddleware;
use App\Helpers\Response;
use App\Helpers\Validator;
use Exception;

class UsuarioController {
    private UsuarioRepository $userRepo;
    private SucursalRepository $sucursalRepo;

    public function __construct() {
        $this->userRepo = new UsuarioRepository();
        $this->sucursalRepo = new SucursalRepository();
    }

    /**
     * GET /api/usuarios
     * Exclusivo para Administrador: lista todos los usuarios internos (Administradores y Supervisores)
     */
    public function index(): void {
        RoleMiddleware::requireRole(['Administrador']);

        $rolId = isset($_GET['rol_id']) && is_numeric($_GET['rol_id']) ? (int)$_GET['rol_id'] : null;
        $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;

        $usuarios = $this->userRepo->getAll($rolId, $sucursalId);
        Response::success($usuarios);
    }

    /**
     * POST /api/usuarios
     * Exclusivo para Administrador: registra un nuevo usuario (especialmente con el rol de Supervisor
     * asignándole obligatoriamente la Sucursal a la que pertenecerá y administrará).
     */
    public function store(): void {
        RoleMiddleware::requireRole(['Administrador']);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        // Permitir enviar rol_id (1=Administrador, 2=Supervisor) o rol_nombre ('Supervisor')
        $rolId = isset($input['rol_id']) ? (int)$input['rol_id'] : 2;
        if (!empty($input['rol_nombre'])) {
            $rolId = (strtolower(trim($input['rol_nombre'])) === 'administrador') ? 1 : 2;
        }
        $input['rol_id'] = $rolId;

        $rules = [
            'nombres'   => 'required|min:2',
            'apellidos' => 'required|min:2',
            'email'     => 'required|email',
            'password'  => 'required|min:6'
        ];

        // REGLA DE NEGOCIO ESTRICTA (Req #5):
        // Si el rol es Supervisor (rol_id === 2), es OBLIGATORIO asignarle una Sucursal válida.
        if ($rolId === 2) {
            $rules['sucursal_id'] = 'required|numeric';
        }

        $validator = Validator::make($input, $rules);
        if ($validator->fails()) {
            Response::error(
                $rolId === 2 && empty($input['sucursal_id'])
                    ? 'Es obligatorio asignar una Sucursal al registrar un usuario con rol de Supervisor.'
                    : 'Datos incompletos o inválidos para el registro de usuario.',
                422,
                $validator->getErrors()
            );
        }

        if ($rolId === 2) {
            $sucursalId = (int)($input['sucursal_id'] ?? 0);
            if ($sucursalId <= 0) {
                Response::error('Debe seleccionar obligatoriamente la Sucursal que administrará el Supervisor.', 422);
            }
            $sucursal = $this->sucursalRepo->getById($sucursalId);
            if (!$sucursal) {
                Response::error('La sucursal seleccionada no existe en el sistema.', 404);
            }
        }

        if ($this->userRepo->existsByEmail($input['email'])) {
            Response::error('Ya existe un usuario registrado con ese correo electrónico institucional.', 409);
        }

        try {
            $newId = $this->userRepo->create($input);
            $created = $this->userRepo->getById($newId);
            Response::success(
                $created,
                $rolId === 2
                    ? "Supervisor registrado exitosamente y asignado a la sede {$created['sucursal_nombre']}."
                    : "Usuario Administrador registrado exitosamente.",
                201
            );
        } catch (Exception $e) {
            Response::error('Error al registrar el usuario: ' . $e->getMessage(), 400);
        }
    }

    /**
     * PUT /api/usuarios/{id}
     * Actualiza los datos y sucursal asignada de un Supervisor o Administrador
     */
    public function update(string $id): void {
        RoleMiddleware::requireRole(['Administrador']);

        $userId = (int)$id;
        $existing = $this->userRepo->getById($userId);
        if (!$existing) {
            Response::error('Usuario no encontrado.', 404);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $rolId = isset($input['rol_id']) ? (int)$input['rol_id'] : (int)$existing['rol_id'];
        $input['rol_id'] = $rolId;

        if ($rolId === 2) {
            $sucursalId = (int)($input['sucursal_id'] ?? 0);
            if ($sucursalId <= 0) {
                Response::error('Todo Supervisor debe tener asignada obligatoriamente una Sucursal.', 422);
            }
            $sucursal = $this->sucursalRepo->getById($sucursalId);
            if (!$sucursal) {
                Response::error('La sucursal seleccionada no existe.', 404);
            }
        }

        $email = $input['email'] ?? $existing['email'];
        if ($this->userRepo->existsByEmail($email, $userId)) {
            Response::error('El correo electrónico ya está en uso por otro usuario.', 409);
        }

        try {
            $this->userRepo->update($userId, array_merge($existing, $input));
            $updated = $this->userRepo->getById($userId);
            Response::success($updated, 'Datos del usuario y asignación de sucursal actualizados.');
        } catch (Exception $e) {
            Response::error('Error al actualizar usuario: ' . $e->getMessage(), 400);
        }
    }

    /**
     * PATCH /api/usuarios/{id}/toggle
     */
    public function toggle(string $id): void {
        RoleMiddleware::requireRole(['Administrador']);
        $userId = (int)$id;
        if ($userId === 1) {
            Response::error('No se puede desactivar al Administrador Principal.', 403);
        }
        $this->userRepo->toggleEstado($userId);
        $updated = $this->userRepo->getById($userId);
        Response::success($updated, 'Estado del usuario actualizado correctamente.');
    }
}
