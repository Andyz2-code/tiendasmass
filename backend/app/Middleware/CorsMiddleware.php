<?php
namespace App\Middleware;

class CorsMiddleware {
    public static function handle(): void {
        $allowedOrigins = [
            'http://localhost',
            'http://127.0.0.1',
            'http://localhost:5173',
            'http://localhost:8000',
            'http://localhost:3000'
        ];

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (in_array($origin, $allowedOrigins, true)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header("Access-Control-Allow-Credentials: true");
        } else {
            header("Access-Control-Allow-Origin: http://localhost");
        }

        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
        header("Access-Control-Max-Age: 86400");

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
}
