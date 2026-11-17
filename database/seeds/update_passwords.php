<?php
require_once __DIR__ . '/../../backend/app/Helpers/Database.php';
$pdo = \App\Helpers\Database::getConnection();

$hash = password_hash('123456', PASSWORD_BCRYPT);

$pdo->prepare("UPDATE usuarios SET password = :p")->execute([':p' => $hash]);
$pdo->prepare("UPDATE clientes SET password = :p")->execute([':p' => $hash]);

echo "SUCCESS: Todas las contraseñas han sido actualizadas a: 123456\n";

echo "\n--- USUARIOS INTERNOS ---\n";
foreach ($pdo->query("SELECT email, password FROM usuarios") as $u) {
    echo $u['email'] . " => OK\n";
}

echo "\n--- CLIENTES ---\n";
foreach ($pdo->query("SELECT email, password FROM clientes") as $c) {
    echo $c['email'] . " => OK\n";
}
