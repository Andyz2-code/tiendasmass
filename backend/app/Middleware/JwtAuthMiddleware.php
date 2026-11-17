<?php
namespace App\Middleware;

use App\Helpers\JWT;
use App\Helpers\Response;

class JwtAuthMiddleware {
    private static ?array $authenticatedUser = null;

    public static function handle(): bool {
        $headers = self::getRequestHeaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (!$authHeader || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            Response::error('Acceso no autorizado: Token JWT no proporcionado o formato inválido.', 401);
            return false;
        }

        $token = $matches[1];
        $config = require __DIR__ . '/../../config/config.php';
        $payload = JWT::decode($token, $config['jwt']['secret']);

        if (!$payload) {
            Response::error('Token JWT expirado o inválido. Por favor inicie sesión nuevamente.', 401);
            return false;
        }

        self::$authenticatedUser = $payload;
        $GLOBALS['auth_user'] = $payload;
        return true;
    }

    public static function getUser(): ?array {
        return self::$authenticatedUser;
    }

    public static function setUser(?array $user): void {
        self::$authenticatedUser = $user;
    }

    private static function getRequestHeaders(): array {
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if ($headers !== false) {
                return $headers;
            }
        }
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
                $headers[$header] = $value;
            }
        }
        return $headers;
    }
}
