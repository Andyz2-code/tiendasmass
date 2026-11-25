<?php
namespace App\Controllers;

use App\Services\AuthService;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Middleware\JwtAuthMiddleware;
use Exception;

class AuthController {
    private AuthService $authService;

    public function __construct() {
        $this->authService = new AuthService();
    }

    /**
     * POST /api/auth/login-user (Admin / Supervisor)
     */
    public function loginUser(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'email'    => 'required|email',
            'password' => 'required'
        ]);

        if ($validator->fails()) {
            Response::error('Datos de inicio de sesión incompletos', 422, $validator->getErrors());
        }

        try {
            $result = $this->authService->loginUser($input['email'], $input['password']);
            Response::success($result, 'Sesión iniciada exitosamente.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 401);
        }
    }

    /**
     * POST /api/auth/login-client (Cliente Tienda Web)
     */
    public function loginClient(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'email'    => 'required|email',
            'password' => 'required'
        ]);

        if ($validator->fails()) {
            Response::error('Datos incompletos', 422, $validator->getErrors());
        }

        try {
            $result = $this->authService->loginClient($input['email'], $input['password']);
            Response::success($result, 'Bienvenido a Arkenya Virtual.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 401);
        }
    }

    /**
     * POST /api/auth/register-client (Registro de Cliente con DNI 8 dígitos o PASAPORTE)
     */
    public function registerClient(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'tipo_documento'   => 'required|in:DNI,PASAPORTE',
            'numero_documento' => 'required|documento_cliente',
            'nombres'          => 'required|min:2',
            'apellidos'        => 'required|min:2',
            'email'            => 'required|email',
            'password'         => 'required|min:6',
            'telefono'         => 'required|numeric|min:8'
        ]);

        if ($validator->fails()) {
            Response::error('Errores en los datos de registro', 422, $validator->getErrors());
        }

        try {
            $result = $this->authService->registerClient($input);
            Response::success($result, 'Cuenta creada exitosamente. Bienvenido a Arkenya.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * GET /api/auth/me (Perfil del usuario autenticado)
     */
    public function me(): void {
        $user = JwtAuthMiddleware::getUser();
        if (!$user) {
            Response::error('No autenticado', 401);
        }
        Response::success($user);
    }

    /**
     * PUT /api/clientes/perfil (Actualizar perfil y dirección del cliente)
     */
    public function updateProfile(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $user = JwtAuthMiddleware::getUser();

        $clientId = $user ? (int)$user['sub'] : (int)($input['cliente_id'] ?? 1);

        $validator = Validator::make($input, [
            'nombres'   => 'required|min:2',
            'apellidos' => 'required|min:2'
        ]);

        if ($validator->fails()) {
            Response::error('Datos de perfil inválidos', 422, $validator->getErrors());
        }

        try {
            $updated = $this->authService->updateClientProfile($clientId, $input);
            Response::success($updated, 'Perfil y dirección de entrega actualizados correctamente.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
