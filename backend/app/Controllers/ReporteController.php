<?php
namespace App\Controllers;

use App\Helpers\Database;
use App\Helpers\Response;
use App\Middleware\JwtAuthMiddleware;
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
        $user = $GLOBALS['auth_user'] ?? JwtAuthMiddleware::getUser();
        $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;

        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            $sucursalId = (int)$user['sucursal_id'];
        }

        $paramsSuc = [];
        $sucFilterPed = "";
        $sucFilterInv = "";
        $sucFilterI = "";
        if ($sucursalId !== null) {
            $paramsSuc[':suc_id'] = $sucursalId;
            $sucFilterPed = "AND sucursal_id = :suc_id";
            $sucFilterInv = "WHERE i.sucursal_id = :suc_id";
            $sucFilterI = "AND i.sucursal_id = :suc_id";
        }

        // 1. Ventas del Mes
        $stmtVentasMes = $this->db->prepare(
            "SELECT COALESCE(SUM(total), 0) FROM pedidos 
             WHERE estado_pedido != 'CANCELADO' 
               AND MONTH(fecha_pedido) = MONTH(CURRENT_DATE()) 
               AND YEAR(fecha_pedido) = YEAR(CURRENT_DATE()) {$sucFilterPed}"
        );
        $stmtVentasMes->execute($paramsSuc);
        $ventasMes = (float)$stmtVentasMes->fetchColumn();

        // 2. Pedidos Totales
        $stmtTotalPed = $this->db->prepare(
            "SELECT COUNT(id) FROM pedidos WHERE estado_pedido != 'CANCELADO' {$sucFilterPed}"
        );
        $stmtTotalPed->execute($paramsSuc);
        $totalPedidos = (int)$stmtTotalPed->fetchColumn();

        // 3. Valor de Inversión Total en Inventario (S/.)
        $stmtValInv = $this->db->prepare(
            "SELECT COALESCE(SUM(i.stock_actual * p.costo_base), 0) 
             FROM inventarios i 
             JOIN productos p ON i.producto_id = p.id {$sucFilterInv}"
        );
        $stmtValInv->execute($paramsSuc);
        $valorInventario = (float)$stmtValInv->fetchColumn();

        // 4. Conteo de Productos Críticos (Stock <= Punto de Reorden)
        $stmtCrit = $this->db->prepare(
            "SELECT COUNT(i.id) FROM inventarios i 
             WHERE i.stock_actual <= i.punto_reorden {$sucFilterI}"
        );
        $stmtCrit->execute($paramsSuc);
        $criticosPor = (int)$stmtCrit->fetchColumn();

        // 4.1 REQUERIMIENTO 3: Alertas de Stock Bajo (Exactamente o menor a 5 unidades)
        $stmtAlertas = $this->db->prepare(
            "SELECT i.id, i.sucursal_id, s.nombre AS sucursal_nombre, i.producto_id,
                    p.nombre AS producto_nombre, p.codigo_sku, i.stock_actual, i.punto_reorden
             FROM inventarios i
             JOIN productos p ON i.producto_id = p.id
             JOIN sucursales s ON i.sucursal_id = s.id
             WHERE i.stock_actual <= 5 AND p.estado = 1 {$sucFilterI}
             ORDER BY i.stock_actual ASC"
        );
        $stmtAlertas->execute($paramsSuc);
        $alertasStockBajo5 = $stmtAlertas->fetchAll(PDO::FETCH_ASSOC);

        // 5. Ventas por Categoría
        $stmtCat = $this->db->prepare(
            "SELECT c.nombre AS categoria, COALESCE(SUM(dp.subtotal), 0) AS total_soles, COUNT(dp.id) AS cantidad_vendida
             FROM detalle_pedidos dp
             JOIN productos p ON dp.producto_id = p.id
             JOIN categorias c ON p.categoria_id = c.id
             JOIN pedidos ped ON dp.pedido_id = ped.id
             WHERE ped.estado_pedido != 'CANCELADO' {$sucFilterPed}
             GROUP BY c.id
             ORDER BY total_soles DESC"
        );
        $stmtCat->execute($paramsSuc);
        $ventasPorCat = $stmtCat->fetchAll(PDO::FETCH_ASSOC);

        // 6. Top 5 Productos Más Vendidos
        $stmtTop = $this->db->prepare(
            "SELECT p.nombre AS producto, COALESCE(SUM(dp.cantidad), 0) AS unidades, COALESCE(SUM(dp.subtotal), 0) AS ingresos_soles
             FROM detalle_pedidos dp
             JOIN productos p ON dp.producto_id = p.id
             JOIN pedidos ped ON dp.pedido_id = ped.id
             WHERE ped.estado_pedido != 'CANCELADO' {$sucFilterPed}
             GROUP BY p.id
             ORDER BY unidades DESC
             LIMIT 5"
        );
        $stmtTop->execute($paramsSuc);
        $topProductos = $stmtTop->fetchAll(PDO::FETCH_ASSOC);

        Response::success([
            'ventas_mes'               => round($ventasMes, 2),
            'total_pedidos'            => $totalPedidos,
            'valor_inventario_soles'   => round($valorInventario, 2),
            'alertas_reorden_count'    => $criticosPor,
            'alertas_stock_bajo_count' => count($alertasStockBajo5),
            'alertas_stock_bajo_items' => $alertasStockBajo5,
            'ventas_categoria'         => $ventasPorCat,
            'top_productos'            => $topProductos
        ]);
    }

    /**
     * GET /api/reportes/general-admin
     * Reporte integral ejecutivo con Ventas Día, Ventas Mes, Margen de Utilidad Real,
     * Productos de Alta Rotación, Métodos de Pago independientes, Evolución y Kardex.
     */
    public function generalAdmin(): void {
        $user = $GLOBALS['auth_user'] ?? JwtAuthMiddleware::getUser();
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

        // Filtro de sucursal parametrizado seguro
        $paramsSuc = [];
        $sucFilterPed = "";
        $sucFilterInv = "";
        if ($sucursalId !== null) {
            $paramsSuc[':suc_id'] = $sucursalId;
            $sucFilterPed = "AND ped.sucursal_id = :suc_id";
            $sucFilterInv = "AND i.sucursal_id = :suc_id";
        }

        // Parámetros para el rango seleccionado
        $paramsPeriodo = array_merge($paramsSuc, [':f_inicio' => $fechaInicio, ':f_fin' => $fechaFin]);
        $wherePed = "WHERE ped.estado_pedido != 'CANCELADO' AND DATE(ped.fecha_pedido) BETWEEN :f_inicio AND :f_fin {$sucFilterPed}";

        // ==============================================================
        // 1. VENTAS DEL DÍA (Prompt 3 - Sección 1.A)
        // ==============================================================
        $stmtVentasHoy = $this->db->prepare("
            SELECT 
                COALESCE(SUM(ped.total), 0) AS total_ventas_hoy,
                COUNT(ped.id) AS total_operaciones_hoy
            FROM pedidos ped
            WHERE ped.estado_pedido != 'CANCELADO' 
              AND DATE(ped.fecha_pedido) = CURRENT_DATE() {$sucFilterPed}
        ");
        $stmtVentasHoy->execute($paramsSuc);
        $ventasHoyData = $stmtVentasHoy->fetch(PDO::FETCH_ASSOC);

        $stmtDetalleHoy = $this->db->prepare("
            SELECT 
                ped.id,
                ped.codigo_pedido,
                ped.total,
                ped.metodo_pago,
                ped.tipo_entrega,
                ped.estado_pedido,
                TIME_FORMAT(ped.fecha_pedido, '%H:%i') AS hora_pedido,
                s.nombre AS sucursal_nombre,
                COALESCE(CONCAT(c.nombres, ' ', c.apellidos), 'Cliente Mostrador') AS cliente_nombre
            FROM pedidos ped
            JOIN sucursales s ON ped.sucursal_id = s.id
            LEFT JOIN clientes c ON ped.cliente_id = c.id
            WHERE ped.estado_pedido != 'CANCELADO' 
              AND DATE(ped.fecha_pedido) = CURRENT_DATE() {$sucFilterPed}
            ORDER BY ped.fecha_pedido DESC
            LIMIT 20
        ");
        $stmtDetalleHoy->execute($paramsSuc);
        $ventasDetalleHoy = $stmtDetalleHoy->fetchAll(PDO::FETCH_ASSOC);

        // ==============================================================
        // 2. VENTAS DEL MES (Prompt 3 - Sección 1.B)
        // ==============================================================
        $stmtVentasMes = $this->db->prepare("
            SELECT 
                COALESCE(SUM(ped.total), 0) AS total_ventas_mes,
                COUNT(ped.id) AS total_operaciones_mes
            FROM pedidos ped
            WHERE ped.estado_pedido != 'CANCELADO' 
              AND MONTH(ped.fecha_pedido) = MONTH(CURRENT_DATE())
              AND YEAR(ped.fecha_pedido) = YEAR(CURRENT_DATE()) {$sucFilterPed}
        ");
        $stmtVentasMes->execute($paramsSuc);
        $ventasMesData = $stmtVentasMes->fetch(PDO::FETCH_ASSOC);

        $stmtVentasPorDiaMes = $this->db->prepare("
            SELECT 
                DATE(ped.fecha_pedido) AS fecha,
                COUNT(ped.id) AS operaciones,
                COALESCE(SUM(ped.total), 0) AS importe_total
            FROM pedidos ped
            WHERE ped.estado_pedido != 'CANCELADO' 
              AND MONTH(ped.fecha_pedido) = MONTH(CURRENT_DATE())
              AND YEAR(ped.fecha_pedido) = YEAR(CURRENT_DATE()) {$sucFilterPed}
            GROUP BY DATE(ped.fecha_pedido)
            ORDER BY fecha ASC
        ");
        $stmtVentasPorDiaMes->execute($paramsSuc);
        $ventasPorDiaMes = $stmtVentasPorDiaMes->fetchAll(PDO::FETCH_ASSOC);

        // ==============================================================
        // 3. MARGEN DE UTILIDAD (Prompt 3 - Sección 1.C)
        // Utilidad = Ingresos por ventas - Costo de los productos vendidos
        // Margen (%) = (Utilidad / Ingresos) * 100
        // ==============================================================
        $stmtMargen = $this->db->prepare("
            SELECT 
                COALESCE(SUM(dp.subtotal), 0) AS ingresos_productos,
                COALESCE(SUM(dp.cantidad * COALESCE(l.costo_unitario_compra, p.costo_base, 0)), 0) AS costo_productos_vendidos
            FROM detalle_pedidos dp
            JOIN pedidos ped ON dp.pedido_id = ped.id
            JOIN productos p ON dp.producto_id = p.id
            LEFT JOIN lotes l ON dp.lote_id = l.id
            {$wherePed}
        ");
        $stmtMargen->execute($paramsPeriodo);
        $margenRaw = $stmtMargen->fetch(PDO::FETCH_ASSOC);

        $ingresosMercaderia = (float)($margenRaw['ingresos_productos'] ?? 0);
        $costoMercaderia    = (float)($margenRaw['costo_productos_vendidos'] ?? 0);
        $utilidadBruta      = $ingresosMercaderia - $costoMercaderia;
        $margenPorcentaje   = ($ingresosMercaderia > 0) ? round(($utilidadBruta / $ingresosMercaderia) * 100, 2) : 0.0;

        // ==============================================================
        // 4. RESUMEN GENERAL DEL PERIODO FILTRADO
        // ==============================================================
        $stmtResumen = $this->db->prepare("
            SELECT 
                COALESCE(SUM(ped.total), 0) AS total_ingresos,
                COUNT(ped.id) AS total_transacciones,
                COALESCE(AVG(ped.total), 0) AS ticket_promedio,
                COALESCE(SUM(ped.costo_envio), 0) AS total_fletes
            FROM pedidos ped
            {$wherePed}
        ");
        $stmtResumen->execute($paramsPeriodo);
        $resumen = $stmtResumen->fetch(PDO::FETCH_ASSOC);

        // Comparativa por Sucursales (solo para admin corporativo)
        $comparativaSucursales = [];
        if (!$isSupervisor) {
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
                GROUP BY s.id
                ORDER BY total_ventas DESC
            ");
            $stmtSucursales->execute($paramsPeriodo);
            $comparativaSucursales = $stmtSucursales->fetchAll(PDO::FETCH_ASSOC);
        }

        // ==============================================================
        // 5. PRODUCTOS DE ALTA ROTACIÓN (Prompt 3 - Sección 2)
        // ==============================================================
        $paramsRotacion = $paramsPeriodo;
        $catFilter = "";
        if ($categoriaId !== null) {
            $catFilter = "AND p.categoria_id = :cat_id";
            $paramsRotacion[':cat_id'] = $categoriaId;
        }
        $stmtRotacion = $this->db->prepare("
            SELECT 
                p.id,
                p.codigo_sku,
                p.nombre AS producto,
                c.nombre AS categoria,
                s.nombre AS sucursal_nombre,
                COALESCE(SUM(dp.cantidad), 0) AS unidades_vendidas,
                COALESCE(SUM(dp.subtotal), 0) AS total_soles_generado,
                COUNT(DISTINCT ped.id) AS operaciones_count
            FROM detalle_pedidos dp
            JOIN pedidos ped ON dp.pedido_id = ped.id
            JOIN productos p ON dp.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            JOIN sucursales s ON ped.sucursal_id = s.id
            {$wherePed} {$catFilter}
            GROUP BY p.id, ped.sucursal_id
            ORDER BY unidades_vendidas DESC, total_soles_generado DESC
            LIMIT 25
        ");
        $stmtRotacion->execute($paramsRotacion);
        $altaRotacion = $stmtRotacion->fetchAll(PDO::FETCH_ASSOC);

        // ==============================================================
        // 6. DISTRIBUCIÓN POR MÉTODO DE PAGO (Prompt 3 - Sección 3)
        // Cantidades e importes separados por cada método
        // ==============================================================
        $stmtMetodos = $this->db->prepare("
            SELECT 
                ped.metodo_pago,
                COUNT(ped.id) AS cantidad_operaciones,
                COALESCE(SUM(ped.total), 0) AS importe_total
            FROM pedidos ped
            {$wherePed}
            GROUP BY ped.metodo_pago
            ORDER BY importe_total DESC
        ");
        $stmtMetodos->execute($paramsPeriodo);
        $metodosRaw = $stmtMetodos->fetchAll(PDO::FETCH_ASSOC);

        $totalIngresosPeriodo = (float)($resumen['total_ingresos'] ?? 0);
        $metodosPagoList = [];

        $nombresMetodos = [
            'EFECTIVO_CONTRA_ENTREGA' => 'Efectivo Contra Entrega',
            'YAPE'                    => 'Yape Móvil',
            'PLIN'                    => 'Plin Digital',
            'TARJETA'                 => 'Tarjeta Débito / Crédito'
        ];

        foreach ($metodosRaw as $m) {
            $codigo = $m['metodo_pago'] ?? 'OTROS';
            $importe = (float)$m['importe_total'];
            $ops = (int)$m['cantidad_operaciones'];
            $pct = ($totalIngresosPeriodo > 0) ? round(($importe / $totalIngresosPeriodo) * 100, 2) : 0.0;

            $metodosPagoList[] = [
                'codigo'               => $codigo,
                'nombre'               => $nombresMetodos[$codigo] ?? $codigo,
                'cantidad_operaciones' => $ops,
                'importe_total'        => round($importe, 2),
                'porcentaje'           => $pct
            ];
        }

        // ==============================================================
        // 7. PRODUCTOS AGOTADOS Y CRÍTICOS
        // ==============================================================
        $stmtAgotados = $this->db->prepare("
            SELECT 
                p.id, p.codigo_sku, p.nombre, p.precio_venta, c.nombre AS categoria,
                s.nombre AS sucursal_nombre, i.stock_actual, i.punto_reorden
            FROM inventarios i
            JOIN productos p ON i.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            JOIN sucursales s ON i.sucursal_id = s.id
            WHERE i.stock_actual <= 0 {$sucFilterInv}
            ORDER BY s.nombre, p.nombre
        ");
        $stmtAgotados->execute($paramsSuc);
        $agotados = $stmtAgotados->fetchAll(PDO::FETCH_ASSOC);

        $stmtBajoStock = $this->db->prepare("
            SELECT 
                p.id, p.codigo_sku, p.nombre, p.precio_venta, c.nombre AS categoria,
                s.nombre AS sucursal_nombre, i.stock_actual, i.punto_reorden,
                (i.punto_reorden - i.stock_actual) AS faltante_sugerido,
                IF(i.stock_actual <= 5, 1, 0) AS alerta_critica_5
            FROM inventarios i
            JOIN productos p ON i.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            JOIN sucursales s ON i.sucursal_id = s.id
            WHERE i.stock_actual > 0 AND (i.stock_actual <= 5 OR i.stock_actual <= i.punto_reorden) {$sucFilterInv}
            ORDER BY i.stock_actual ASC
            LIMIT 25
        ");
        $stmtBajoStock->execute($paramsSuc);
        $bajoStock = $stmtBajoStock->fetchAll(PDO::FETCH_ASSOC);

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
        $stmtEvolucion->execute($paramsPeriodo);
        $evolucion = $stmtEvolucion->fetchAll(PDO::FETCH_ASSOC);

        $paramsKardex = [':f_inicio' => $fechaInicio, ':f_fin' => $fechaFin];
        $kardexSuc = "";
        if ($sucursalId !== null) {
            $kardexSuc = "AND k.sucursal_id = :suc_id";
            $paramsKardex[':suc_id'] = $sucursalId;
        }
        $stmtMovimientos = $this->db->prepare("
            SELECT 
                k.tipo_movimiento,
                COUNT(k.id) AS total_operaciones,
                COALESCE(SUM(k.cantidad), 0) AS total_unidades,
                COALESCE(SUM(k.cantidad * k.costo_unitario), 0) AS valor_monetario_soles
            FROM movimientos_inventario k
            WHERE DATE(k.created_at) BETWEEN :f_inicio AND :f_fin {$kardexSuc}
            GROUP BY k.tipo_movimiento
        ");
        $stmtMovimientos->execute($paramsKardex);
        $movimientos = $stmtMovimientos->fetchAll(PDO::FETCH_ASSOC);

        Response::success([
            'filtros' => [
                'sucursal_id'  => $sucursalId,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin,
                'categoria_id' => $categoriaId,
                'es_supervisor'=> $isSupervisor
            ],
            // 1. Indicadores del Día (Prompt 3.1.A)
            'ventas_dia' => [
                'total_ingresos' => round((float)($ventasHoyData['total_ventas_hoy'] ?? 0), 2),
                'operaciones'    => (int)($ventasHoyData['total_operaciones_hoy'] ?? 0),
                'detalle_ventas' => $ventasDetalleHoy
            ],
            // 2. Indicadores del Mes (Prompt 3.1.B)
            'ventas_mes' => [
                'total_ingresos' => round((float)($ventasMesData['total_ventas_mes'] ?? 0), 2),
                'operaciones'    => (int)($ventasMesData['total_operaciones_mes'] ?? 0),
                'ventas_por_dia' => $ventasPorDiaMes
            ],
            // 3. Margen de Utilidad Real (Prompt 3.1.C)
            'margen_utilidad' => [
                'ingresos_ventas'   => round($ingresosMercaderia, 2),
                'costo_ventas'      => round($costoMercaderia, 2),
                'utilidad_bruta'    => round($utilidadBruta, 2),
                'margen_porcentaje' => $margenPorcentaje
            ],
            // 4. Productos de Alta Rotación (Prompt 3.2)
            'alta_rotacion'          => $altaRotacion,
            'top_productos_vendidos' => $altaRotacion,
            // 5. Métodos de Pago Independientes (Prompt 3.3)
            'metodos_pago' => $metodosPagoList,
            // 6. Resumen General del Periodo
            'resumen' => [
                'total_ingresos'      => round($totalIngresosPeriodo, 2),
                'total_transacciones' => (int)($resumen['total_transacciones'] ?? 0),
                'ticket_promedio'     => round((float)($resumen['ticket_promedio'] ?? 0), 2),
                'total_fletes'        => round((float)($resumen['total_fletes'] ?? 0), 2)
            ],
            'comparativa_sucursales' => $comparativaSucursales,
            'productos_agotados'     => $agotados,
            'productos_bajo_stock'   => $bajoStock,
            'evolucion_diaria'       => $evolucion,
            'resumen_kardex'         => $movimientos
        ]);
    }

    /**
     * GET /api/reportes/mermas?sucursal_id=1
     * REQUERIMIENTO 4: Reporte de Mermas / Desmedros con usuario responsable, sucursal, motivo y stock actualizado.
     */
    public function mermas(): void {
        $user = $GLOBALS['auth_user'] ?? JwtAuthMiddleware::getUser();
        $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : 1;

        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            $sucursalId = (int)$user['sucursal_id'];
        }

        RoleMiddleware::validateBranchAccess($sucursalId);

        $sql = "SELECT k.id,
                       k.sucursal_id,
                       s.nombre AS sucursal_nombre,
                       k.producto_id,
                       p.nombre AS producto_nombre,
                       p.codigo_sku,
                       p.unidad_medida,
                       k.lote_id,
                       l.codigo_lote,
                       k.usuario_id,
                       COALESCE(CONCAT(u.nombres, ' ', u.apellidos), 'Sistema / Auditoría') AS usuario_nombre,
                       COALESCE(r.nombre, 'Supervisor') AS usuario_rol,
                       k.documento_referencia,
                       k.cantidad,
                       k.costo_unitario,
                       ROUND(k.cantidad * k.costo_unitario, 2) AS perdida_estimada_soles,
                       k.saldo_anterior,
                       k.saldo_nuevo,
                       k.observaciones,
                       k.created_at
                FROM movimientos_inventario k
                JOIN productos p ON k.producto_id = p.id
                JOIN sucursales s ON k.sucursal_id = s.id
                LEFT JOIN lotes l ON k.lote_id = l.id
                LEFT JOIN usuarios u ON k.usuario_id = u.id
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE k.sucursal_id = :sucursal_id 
                  AND k.tipo_movimiento = 'AJUSTE_MERMA'
                ORDER BY k.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        $detalles = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalPerdida = array_reduce($detalles, fn($acc, $row) => $acc + (float)$row['perdida_estimada_soles'], 0.0);
        $totalUnidades = array_reduce($detalles, fn($acc, $row) => $acc + (int)$row['cantidad'], 0);

        Response::success([
            'sucursal_id'          => $sucursalId,
            'total_perdida_soles'  => round($totalPerdida, 2),
            'total_unidades_baja'  => $totalUnidades,
            'total_incidentes'     => count($detalles),
            'detalles'             => $detalles
        ]);
    }
}
