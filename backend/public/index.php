<?php
/**
 * FRONT CONTROLLER - SISTEMA DE GESTIÓN COMERCIAL TIENDAS MASS
 * public/index.php
 */

declare(strict_types=1);

// Cargar configuración de errores
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Autoloader PSR-4 para el namespace App\
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../app/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

// Manejo de CORS
\App\Middleware\CorsMiddleware::handle();

// Carga de configuración
$config = require __DIR__ . '/../config/config.php';
date_default_timezone_set($config['app']['timezone'] ?? 'America/Lima');

// Manejador global de excepciones
set_exception_handler(function (Throwable $e) use ($config) {
    \App\Helpers\Response::error(
        'Error interno en el servidor: ' . $e->getMessage(),
        500,
        $config['app']['debug'] ? [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => explode("\n", $e->getTraceAsString())
        ] : null
    );
});

// Inicialización del Enrutador
$router = new \App\Routes\Router();

// Cargar definición de rutas API
require __DIR__ . '/../app/Routes/api.php';

// Despachar la petición HTTP actual
$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'];

$router->dispatch($requestMethod, $requestUri);
