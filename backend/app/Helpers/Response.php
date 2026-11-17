<?php
namespace App\Helpers;

class Response {
    public static function json($data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success($data = null, string $message = 'Operación exitosa', int $statusCode = 200): void {
        self::json([
            'success' => true,
            'message' => $message,
            'data'    => $data,
            'code'    => $statusCode
        ], $statusCode);
    }

    public static function error(string $message = 'Error en la solicitud', int $statusCode = 400, $errors = null): void {
        self::json([
            'success' => false,
            'message' => $message,
            'errors'  => $errors,
            'code'    => $statusCode
        ], $statusCode);
    }
}
