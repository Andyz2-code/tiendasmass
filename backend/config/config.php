<?php
/**
 * Configuración Global del Backend - Tiendas Mass
 */

// Carga simple de variables desde .env si existe
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            if (!array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $value;
                putenv("$key=$value");
            }
        }
    }
}

return [
    'app' => [
        'name' => 'Tiendas Mass - API Backend',
        'env' => getenv('APP_ENV') ?: 'development',
        'debug' => (getenv('APP_DEBUG') === 'true'),
        'url' => getenv('APP_URL') ?: 'http://localhost/tiendasmass/backend/public',
        'timezone' => getenv('APP_TIMEZONE') ?: 'America/Lima',
    ],
    'db' => [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DB_PORT') ?: '3306',
        'database' => getenv('DB_DATABASE') ?: 'tiendas_mass_db',
        'username' => getenv('DB_USERNAME') ?: 'root',
        'password' => getenv('DB_PASSWORD') ?: '',
        'charset' => 'utf8mb4',
    ],
    'jwt' => [
        'secret' => getenv('JWT_SECRET') ?: 'TiendasMass_DefaultSecureKey_Huancayo_2026',
        'expire_hours' => (int)(getenv('JWT_EXPIRE_HOURS') ?: 24),
    ],
    'commerce' => [
        'currency' => getenv('COMMERCE_CURRENCY') ?: 'PEN',
        'igv_rate' => (float)(getenv('COMMERCE_IGV_RATE') ?: 0.18),
        'delivery_base_cost' => (float)(getenv('DELIVERY_BASE_COST') ?: 4.00),
        'delivery_km_cost' => (float)(getenv('DELIVERY_KM_COST') ?: 1.50),
    ],
    'google' => [
        'maps_api_key' => getenv('GOOGLE_MAPS_API_KEY') ?: '',
    ],
    'node' => [
        'socket_url' => getenv('NODE_SOCKET_URL') ?: 'http://localhost:4000',
    ]
];
