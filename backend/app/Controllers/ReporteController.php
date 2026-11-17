<?php
namespace App\Controllers;

use App\Helpers\Database;
use App\Helpers\Response;
use App\Middleware\RoleMiddleware;
use PDO;

class ReporteController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * GET /api/reportes/dashboard-kpi?sucursal_id=1
     */
    public function dashboardKpi(): void {
        $user = $GLOBALS['auth_user'] ?? null;
        $sucursalId = isset($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;

        // Restricción por rol de Supervisor
        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            $sucursalId = (int)$user['sucursal_id'];
        }

        $sucFilterPed = $sucursalId ? "AND sucursal_id = {$sucursalId}" : "";
        $sucFilterInv = $sucursalId ? "WHERE i.sucursal_id = {$sucursalId}" : "";

        // 1. Ventas del Mes
        $ventasMes = (float)$this->db->query(
            "SELECT COALESCE(SUM(total), 0) FROM pedidos 
             WHERE estado_pedido != 'CANCELADO' 
               AND MONTH(fecha_pedido) = MONTH(CURRENT_DATE()) 
               AND YEAR(fecha_pedido) = YEAR(CURRENT_DATE()) {$sucFilterPed}"
        )->fetchColumn();

        // 2. Pedidos Totales
        $totalPedidos = (int)$this->db->query(
            "SELECT COUNT(id) FROM pedidos WHERE estado_pedido != 'CANCELADO' {$sucFilterPed}"
        )->fetchColumn();

        // 3. Valor de Inversión Total en Inventario (S/.)
        $valorInventario = (float)$this->db->query(
            "SELECT COALESCE(SUM(i.stock_actual * p.costo_base), 0) 
             FROM inventarios i 
             JOIN productos p ON i.producto_id = p.id {$sucFilterInv}"
        )->fetchColumn();

        // 4. Conteo de Productos Críticos (Stock <= Punto de Reorden)
        $criticosPor = (int)$this->db->query(
            "SELECT COUNT(i.id) FROM inventarios i 
             WHERE i.stock_actual <= i.punto_reorden " . ($sucursalId ? "AND i.sucursal_id = {$sucursalId}" : "")
        )->fetchColumn();

        // 5. Ventas por Categoría
        $ventasPorCat = $this->db->query(
            "SELECT c.nombre AS categoria, COALESCE(SUM(dp.subtotal), 0) AS total_soles, COUNT(dp.id) AS cantidad_vendida
             FROM detalle_pedidos dp
             JOIN productos p ON dp.producto_id = p.id
             JOIN categorias c ON p.categoria_id = c.id
             JOIN pedidos ped ON dp.pedido_id = ped.id
             WHERE ped.estado_pedido != 'CANCELADO' {$sucFilterPed}
             GROUP BY c.id
             ORDER BY total_soles DESC"
        )->fetchAll(PDO::FETCH_ASSOC);

        // 6. Top 5 Productos Más Vendidos
        $topProductos = $this->db->query(
            "SELECT p.nombre AS producto, COALESCE(SUM(dp.cantidad), 0) AS unidades, COALESCE(SUM(dp.subtotal), 0) AS ingresos_soles
             FROM detalle_pedidos dp
             JOIN productos p ON dp.producto_id = p.id
             JOIN pedidos ped ON dp.pedido_id = ped.id
             WHERE ped.estado_pedido != 'CANCELADO' {$sucFilterPed}
             GROUP BY p.id
             ORDER BY unidades DESC
             LIMIT 5"
        )->fetchAll(PDO::FETCH_ASSOC);

        Response::success([
            'ventas_mes'             => round($ventasMes, 2),
            'total_pedidos'          => $totalPedidos,
            'valor_inventario_soles' => round($valorInventario, 2),
            'alertas_reorden_count'  => $criticosPor,
            'ventas_categoria'       => $ventasPorCat,
            'top_productos'          => $topProductos
        ]);
    }

    /**
     * GET /api/reportes/general-admin
     * Reporte integral ejecutivo para Administrador Corporativo (global) y Supervisor (exclusivo de su sede)
     */
    public function generalAdmin(): void {
        $user = $GLOBALS['auth_user'] ?? \App\Middleware\JwtAuthMiddleware::getUser();
        $isSupervisor = ($user && ($user['rol_nombre'] ?? '') === 'Supervisor');

        if ($isSupervisor) {
            $sucursalId = (int)$user['sucursal_id'];
        } else {
            RoleMiddleware::requireRole(['Administrador', 'Supervisor']);
            $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;
        }

        $fechaInicio = $_GET['fecha_inicio'] ?? date('Y-m-01');
        $fechaFin    = $_GET['fecha_fin'] ?? date('Y-m-d');
        $categoriaId = isset($_GET['categoria_id']) && is_numeric($_GET['categoria_id']) ? (int)$_GET['categoria_id'] : null;

        // Construir condiciones seguras
        $wherePed = "WHERE ped.estado_pedido != 'CANCELADO' AND DATE(ped.fecha_pedido) BETWEEN :f_inicio AND :f_fin";
        $paramsPed = [':f_inicio' => $fechaInicio, ':f_fin' => $fechaFin];

        if ($sucursalId) {
            $wherePed .= " AND ped.sucursal_id = :sucursal_id";
            $paramsPed[':sucursal_id'] = $sucursalId;
        }

        // 1. Resumen Ejecutivo (Ventas, Ingresos, Transacciones, Ticket Promedio)
        $stmtResumen = $this->db->prepare("
            SELECT 
                COALESCE(SUM(ped.total), 0) AS total_ingresos,
                COUNT(ped.id) AS total_transacciones,
                COALESCE(AVG(ped.total), 0) AS ticket_promedio,
                COALESCE(SUM(ped.costo_envio), 0) AS total_fletes
            FROM pedidos ped
            {$wherePed}
        ");
        $stmtResumen->execute($paramsPed);
        $resumen = $stmtResumen->fetch(PDO::FETCH_ASSOC);

        // 2. Rendimiento y Comparación por Sucursal
        $stmtSucursales = $this->db->prepare("
            SELECT 
                s.id AS sucursal_id,
                s.nombre AS sucursal_nombre,
                s.codigo_tienda,
                COUNT(ped.id) AS total_pedidos,
                COALESCE(SUM(ped.total), 0) AS total_ventas,
                COALESCE(AVG(ped.total), 0) AS ticket_promedio
            FROM sucursales s
            LEFT JOIN pedidos ped ON s.id = ped.sucursal_id AND ped.estado_pedido != 'CANCELADO' 
                 AND DATE(ped.fecha_pedido) BETWEEN :f_inicio AND :f_fin
            " . ($sucursalId ? "WHERE s.id = :sucursal_id" : "") . "
            GROUP BY s.id
            ORDER BY total_ventas DESC
        ");
        $stmtSucursales->execute($paramsPed);
        $comparativaSucursales = $isSupervisor ? [] : $stmtSucursales->fetchAll(PDO::FETCH_ASSOC);

        // 3. Top 10 Productos Más Vendidos
        $whereCat = $categoriaId ? "AND p.categoria_id = {$categoriaId}" : "";
        $stmtTop = $this->db->prepare("
            SELECT 
                p.id,
                p.codigo_sku,
                p.nombre AS producto,
                c.nombre AS categoria,
                COALESCE(SUM(dp.cantidad), 0) AS unidades_vendidas,
                COALESCE(SUM(dp.subtotal), 0) AS ingresos_generados
            FROM detalle_pedidos dp
            JOIN pedidos ped ON dp.pedido_id = ped.id
            JOIN productos p ON dp.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            {$wherePed} {$whereCat}
            GROUP BY p.id
            ORDER BY unidades_vendidas DESC
            LIMIT 10
        ");
        $stmtTop->execute($paramsPed);
        $topVendidos = $stmtTop->fetchAll(PDO::FETCH_ASSOC);

        // 4. Productos Agotados (Stock = 0)
        $whereInvSuc = $sucursalId ? "AND i.sucursal_id = {$sucursalId}" : "";
        $stmtAgotados = $this->db->query("
            SELECT 
                p.id, p.codigo_sku, p.nombre, p.precio_venta, c.nombre AS categoria,
                s.nombre AS sucursal_nombre, i.stock_actual, i.punto_reorden
            FROM inventarios i
            JOIN productos p ON i.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            JOIN sucursales s ON i.sucursal_id = s.id
            WHERE i.stock_actual <= 0 {$whereInvSuc}
            ORDER BY s.nombre, p.nombre
        ");
        $agotados = $stmtAgotados->fetchAll(PDO::FETCH_ASSOC);

        // 5. Productos con Bajo Stock (Stock <= Punto de Reorden o <= 10)
        $stmtBajoStock = $this->db->query("
            SELECT 
                p.id, p.codigo_sku, p.nombre, p.precio_venta, c.nombre AS categoria,
                s.nombre AS sucursal_nombre, i.stock_actual, i.punto_reorden,
                (i.punto_reorden - i.stock_actual) AS faltante_sugerido
            FROM inventarios i
            JOIN productos p ON i.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            JOIN sucursales s ON i.sucursal_id = s.id
            WHERE i.stock_actual > 0 AND i.stock_actual <= i.punto_reorden {$whereInvSuc}
            ORDER BY i.stock_actual ASC
            LIMIT 25
        ");
        $bajoStock = $stmtBajoStock->fetchAll(PDO::FETCH_ASSOC);

        // 6. Evolución de Ventas Diarias
        $stmtEvolucion = $this->db->prepare("
            SELECT 
                DATE(ped.fecha_pedido) AS fecha,
                COUNT(ped.id) AS pedidos_dia,
                COALESCE(SUM(ped.total), 0) AS total_dia
            FROM pedidos ped
            {$wherePed}
            GROUP BY DATE(ped.fecha_pedido)
            ORDER BY fecha ASC
        ");
        $stmtEvolucion->execute($paramsPed);
        $evolucion = $stmtEvolucion->fetchAll(PDO::FETCH_ASSOC);

        // 7. Movimientos de Inventario (Kardex Resumen)
        $whereKardex = $sucursalId ? "AND k.sucursal_id = {$sucursalId}" : "";
        $stmtMovimientos = $this->db->prepare("
            SELECT 
                k.tipo_movimiento,
                COUNT(k.id) AS total_operaciones,
                COALESCE(SUM(k.cantidad), 0) AS total_unidades,
                COALESCE(SUM(k.cantidad * k.costo_unitario), 0) AS valor_monetario_soles
            FROM movimientos_inventario k
            WHERE DATE(k.created_at) BETWEEN :f_inicio AND :f_fin {$whereKardex}
            GROUP BY k.tipo_movimiento
        ");
        $stmtMovimientos->execute([':f_inicio' => $fechaInicio, ':f_fin' => $fechaFin]);
        $movimientos = $stmtMovimientos->fetchAll(PDO::FETCH_ASSOC);

        Response::success([
            'filtros' => [
                'sucursal_id'  => $sucursalId,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin,
                'categoria_id' => $categoriaId,
                'es_supervisor'=> ($user && ($user['rol_nombre'] ?? '') === 'Supervisor')
            ],
            'resumen' => [
                'total_ingresos'      => round((float)($resumen['total_ingresos'] ?? 0), 2),
                'total_transacciones' => (int)($resumen['total_transacciones'] ?? 0),
                'ticket_promedio'     => round((float)($resumen['ticket_promedio'] ?? 0), 2),
                'total_fletes'        => round((float)($resumen['total_fletes'] ?? 0), 2)
            ],
            'comparativa_sucursales' => $comparativaSucursales,
            'top_vendidos'           => $topVendidos,
            'productos_agotados'     => $agotados,
            'productos_bajo_stock'   => $bajoStock,
            'evolucion_ventas'       => $evolucion,
            'movimientos_kardex'     => $movimientos
        ]);
    }

    /**
     * GET /api/reportes/mermas?sucursal_id=1
     */
    public function mermas(): void {
        $user = $GLOBALS['auth_user'] ?? null;
        $sucursalId = (int)($_GET['sucursal_id'] ?? 1);

        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            $sucursalId = (int)$user['sucursal_id'];
        }

        RoleMiddleware::validateBranchAccess($sucursalId);

        $sql = "SELECT k.*, 
                       p.nombre AS producto_nombre,
                       p.codigo_sku,
                       (k.cantidad * k.costo_unitario) AS perdida_estimada_soles
                FROM movimientos_inventario k
                JOIN productos p ON k.producto_id = p.id
                WHERE k.sucursal_id = :sucursal_id 
                  AND k.tipo_movimiento = 'AJUSTE_MERMA'
                ORDER BY k.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        $mermas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($mermas);
    }
}
