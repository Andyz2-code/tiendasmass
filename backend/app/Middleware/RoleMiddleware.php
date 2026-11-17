<?php
namespace App\Middleware;

use App\Helpers\Response;

class RoleMiddleware {
    public static function requireRole(array|string $allowedRoles): bool {
        $user = JwtAuthMiddleware::getUser() ?? $GLOBALS['auth_user'] ?? null;

        if (!$user) {
            Response::error('Usuario no autenticado. Token requerido.', 401);
            return false;
        }

        $roles = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
        $userRole = $user['rol_nombre'] ?? $user['rol'] ?? '';

        if (!in_array($userRole, $roles, true)) {
            Response::error('Acceso denegado: No posee los permisos requeridos para esta operación.', 403, [
                'rol_actual' => $userRole,
                'roles_requeridos' => $roles
            ]);
            return false;
        }

        return true;
    }

    /**
     * Valida que el supervisor solo pueda consultar o alterar datos de su propia sucursal asignada.
     * Si es Administrador, tiene acceso irrestricto a cualquier sucursal.
     * Si es Cliente u otro rol, deniega el acceso con 403.
     */
    public static function validateBranchAccess(int $targetBranchId): bool {
        $user = JwtAuthMiddleware::getUser() ?? $GLOBALS['auth_user'] ?? null;
        if (!$user) {
            Response::error('Usuario no autenticado. Inicie sesión para continuar.', 401);
            return false;
        }

        $userRole = $user['rol_nombre'] ?? $user['rol'] ?? '';
        if ($userRole === 'Administrador') {
            return true;
        }

        if ($userRole === 'Supervisor') {
            $userBranchId = (int)($user['sucursal_id'] ?? 0);
            if ($userBranchId !== $targetBranchId) {
                Response::error("Acceso restringido: El supervisor solo está autorizado para operar en su sucursal asignada (ID {$userBranchId}).", 403);
                return false;
            }
            return true;
        }

        // Cualquier otro rol (como Cliente) queda estrictamente bloqueado
        Response::error("Acceso denegado: El rol '{$userRole}' no tiene autorización para operar o consultar inventarios de sucursales.", 403);
        return false;
    }
}
