<?php
namespace App\Helpers;

use PDO;
use PDOException;

class Database {
    private static ?Database $instance = null;
    private ?PDO $pdo = null;

    private function __construct() {
        $config = require __DIR__ . '/../../config/config.php';
        $db = $config['db'];

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $db['host'],
            $db['port'],
            $db['database'],
            $db['charset']
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$db['charset']} COLLATE utf8mb4_unicode_ci"
        ];

        try {
            $this->pdo = new PDO($dsn, $db['username'], $db['password'], $options);
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'message' => 'Error de conexión a la base de datos MySQL en XAMPP.',
                'error'   => $config['app']['debug'] ? $e->getMessage() : 'Error interno de base de datos'
            ]);
            exit;
        }
    }

    public static function getInstance(): Database {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public static function getConnection(): PDO {
        return self::getInstance()->pdo;
    }

    public static function beginTransaction(): bool {
        return self::getConnection()->beginTransaction();
    }

    public static function commit(): bool {
        if (self::getConnection()->inTransaction()) {
            return self::getConnection()->commit();
        }
        return false;
    }

    public static function rollBack(): bool {
        if (self::getConnection()->inTransaction()) {
            return self::getConnection()->rollBack();
        }
        return false;
    }
}
