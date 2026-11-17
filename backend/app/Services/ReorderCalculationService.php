<?php
namespace App\Services;

use App\Helpers\Database;
use PDO;
use Exception;

class ReorderCalculationService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * REQUERIMIENTO 3: Sistema de Alertas de Stock Bajo (<= 5 unidades).
     * Obtiene y sincroniza todas las alertas de productos cuyo inventario en una sucursal
     * haya llegado exactamente o sea menor a 5 unidades.
     */
    public function getLowStockAlerts(?int $sucursalId = null, int $umbral = 5): array {
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS `alertas_stock_bajo` (
                  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                  `sucursal_id` INT UNSIGNED NOT NULL,
                  `producto_id` INT UNSIGNED NOT NULL,
                  `stock_actual` INT NOT NULL,
                  `umbral_alerta` INT NOT NULL DEFAULT 5,
                  `nivel` ENUM('CRITICO', 'AGOTADO') NOT NULL DEFAULT 'CRITICO',
                  `mensaje` VARCHAR(255) NOT NULL,
                  `resuelta` TINYINT(1) NOT NULL DEFAULT 0,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  UNIQUE KEY `uk_alerta_sucursal_producto` (`sucursal_id`, `producto_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
        } catch (Exception $e) {}

        $where = "WHERE i.stock_actual <= :umbral AND p.estado = 1";
        $params = [':umbral' => $umbral];

        if ($sucursalId !== null && $sucursalId > 0) {
            $where .= " AND i.sucursal_id = :sucursal_id";
            $params[':sucursal_id'] = $sucursalId;
        }

        $sql = "SELECT i.id AS inventario_id,
                       i.sucursal_id,
                       s.nombre AS sucursal_nombre,
                       s.codigo_tienda,
                       i.producto_id,
                       p.nombre AS producto_nombre,
                       p.codigo_sku,
                       p.codigo_barras,
                       p.unidad_medida,
                       p.precio_venta,
                       p.costo_base,
                       c.nombre AS categoria_nombre,
                       i.stock_actual,
                       i.stock_minimo,
                       i.punto_reorden,
                       i.updated_at
                FROM inventarios i
                JOIN productos p ON i.producto_id = p.id
                JOIN categorias c ON p.categoria_id = c.id
                JOIN sucursales s ON i.sucursal_id = s.id
                {$where}
                ORDER BY i.stock_actual ASC, p.nombre ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Sincronizar con la tabla de alertas disparadas
        foreach ($items as &$item) {
            $stock = (int)$item['stock_actual'];
            $nivel = ($stock <= 0) ? 'AGOTADO' : 'CRITICO';
            $mensaje = $stock <= 0
                ? "¡PRODUCTO AGOTADO! '{$item['producto_nombre']}' tiene 0 unidades en {$item['sucursal_nombre']}."
                : "¡ALERTA DE STOCK BAJO (<= 5)! '{$item['producto_nombre']}' tiene solo {$stock} unidades en {$item['sucursal_nombre']}.";

            $item['nivel_alerta'] = $nivel;
            $item['umbral_alerta'] = $umbral;
            $item['mensaje_alerta'] = $mensaje;

            try {
                $syncStmt = $this->db->prepare("
                    INSERT INTO alertas_stock_bajo (sucursal_id, producto_id, stock_actual, umbral_alerta, nivel, mensaje, resuelta)
                    VALUES (:suc, :prod, :stock, :umbral, :nivel, :msg, 0)
                    ON DUPLICATE KEY UPDATE
                        stock_actual = :stock_u,
                        nivel = :nivel_u,
                        mensaje = :msg_u,
                        resuelta = 0
                ");
                $syncStmt->execute([
                    ':suc'     => $item['sucursal_id'],
                    ':prod'    => $item['producto_id'],
                    ':stock'   => $stock,
                    ':umbral'  => $umbral,
                    ':nivel'   => $nivel,
                    ':msg'     => $mensaje,
                    ':stock_u' => $stock,
                    ':nivel_u' => $nivel,
                    ':msg_u'   => $mensaje
                ]);
            } catch (Exception $e) {}
        }
        unset($item);

        return [
            'umbral_configurado' => $umbral,
            'total_alertas'      => count($items),
            'agotados_count'     => count(array_filter($items, fn($r) => (int)$r['stock_actual'] <= 0)),
            'criticos_5_count'   => count(array_filter($items, fn($r) => (int)$r['stock_actual'] > 0 && (int)$r['stock_actual'] <= $umbral)),
            'alertas'            => $items
        ];
    }

    /**
     * Calcula y evalúa el Punto de Reorden (POR) y las Alertas de Stock Bajo (<= 5 unidades)
     * para todos los productos de una sucursal.
     * POR = (d * L) + SS
     */
    public function getReorderAlerts(int $sucursalId): array {
        $sql = "SELECT i.id AS inventario_id,
                       i.sucursal_id,
                       s.nombre AS sucursal_nombre,
                       i.producto_id,
                       p.nombre AS producto_nombre,
                       p.codigo_sku,
                       p.codigo_barras,
                       p.precio_venta,
                       c.nombre AS categoria_nombre,
                       i.stock_actual,
                       i.stock_minimo,
                       i.stock_maximo,
                       i.stock_seguridad,
                       i.demanda_diaria_promedio,
                       i.lead_time_dias,
                       i.punto_reorden,
                       i.clasificacion_abc
                FROM inventarios i
                JOIN productos p ON i.producto_id = p.id
                JOIN categorias c ON p.categoria_id = c.id
                JOIN sucursales s ON i.sucursal_id = s.id
                WHERE i.sucursal_id = :sucursal_id
                ORDER BY i.stock_actual ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        $items = $stmt->fetchAll();

        $alertas = [];
        $alertasStockBajo5 = [];
        $resumen = [
            'total_productos'      => count($items),
            'stock_bajo_5'         => 0, // Stock <= 5 unidades (Requerimiento 3)
            'criticos'             => 0, // Stock <= SS
            'en_reorden'           => 0, // SS < Stock <= POR
            'optimos'              => 0  // Stock > POR
        ];

        foreach ($items as &$item) {
            $d = (float)$item['demanda_diaria_promedio'];
            $L = (int)$item['lead_time_dias'];
            $ss = (int)$item['stock_seguridad'];
            $stockActual = (int)$item['stock_actual'];

            // Cálculo dinámico del POR
            $porCalculado = (int)ceil(($d * $L) + $ss);
            $item['por_calculado'] = $porCalculado;
            $item['alerta_stock_bajo_5'] = ($stockActual <= 5);

            if ($stockActual <= 5) {
                $resumen['stock_bajo_5']++;
                $alertasStockBajo5[] = $item;
            }

            if ($stockActual <= 5 || $stockActual <= $ss) {
                $item['estado_stock'] = $stockActual <= 5 ? 'STOCK_BAJO_CRITICO_5' : 'CRITICO';
                $item['color_badge']  = 'danger';
                $resumen['criticos']++;
                $alertas[] = $item;
            } elseif ($stockActual <= $porCalculado) {
                $item['estado_stock'] = 'EN_REORDEN';
                $item['color_badge']  = 'warning';
                $resumen['en_reorden']++;
                $alertas[] = $item;
            } else {
                $item['estado_stock'] = 'OPTIMO';
                $item['color_badge']  = 'success';
                $resumen['optimos']++;
            }

            // Sugerencia de cantidad de compra
            $stockMax = (int)$item['stock_maximo'];
            $item['sugerencia_compra'] = max(0, $stockMax - $stockActual);
        }
        unset($item);

        return [
            'resumen'              => $resumen,
            'alertas_stock_bajo_5' => $alertasStockBajo5,
            'alertas_activas'      => $alertas,
            'inventario_total'     => $items
        ];
    }

    /**
     * Módulo de Consumo Responsable:
     * Calcula el Índice de Obsolescencia de Inventario (IOI) y alerta sobre lotes próximos a vencer.
     */
    public function getObsolescenceAndExpiryReport(int $sucursalId): array {
        $sql = "SELECT l.id AS lote_id,
                       l.codigo_lote,
                       l.producto_id,
                       p.nombre AS producto_nombre,
                       p.codigo_sku,
                       p.precio_venta,
                       p.costo_base,
                       c.nombre AS categoria_nombre,
                       l.fecha_ingreso,
                       l.fecha_vencimiento,
                       l.cantidad_disponible,
                       l.ubicacion_almacen,
                       DATEDIFF(l.fecha_vencimiento, CURDATE()) AS dias_para_vencer
                FROM lotes l
                JOIN productos p ON l.producto_id = p.id
                JOIN categorias c ON p.categoria_id = c.id
                WHERE l.sucursal_id = :sucursal_id
                  AND l.estado = 'DISPONIBLE'
                  AND l.cantidad_disponible > 0
                  AND l.fecha_vencimiento IS NOT NULL
                ORDER BY l.fecha_vencimiento ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        $lotes = $stmt->fetchAll();

        $stmtTot = $this->db->prepare("SELECT COALESCE(SUM(cantidad_disponible), 0) FROM lotes WHERE sucursal_id = :sucursal_id AND estado = 'DISPONIBLE'");
        $stmtTot->execute([':sucursal_id' => $sucursalId]);
        $stockTotalSucursal = (int)$stmtTot->fetchColumn();

        $unidadesEnRiesgo = 0;
        $lotesRiesgo7Dias  = [];
        $lotesRiesgo15Dias = [];
        $lotesRiesgo30Dias = [];

        foreach ($lotes as &$lote) {
            $dias = (int)$lote['dias_para_vencer'];
            $cantidad = (int)$lote['cantidad_disponible'];

            if ($dias < 0) {
                $lote['nivel_alerta'] = 'CADUCADO';
                $lote['color_alerta'] = 'dark';
                $lote['sugerencia_accion'] = 'Retiro inmediato del almacén / Registro de Merma contable';
                $unidadesEnRiesgo += $cantidad;
                $lotesRiesgo7Dias[] = $lote;
            } elseif ($dias <= 7) {
                $lote['nivel_alerta'] = 'CRITICO_7_DIAS';
                $lote['color_alerta'] = 'danger';
                $lote['sugerencia_accion'] = 'Descuento agresivo 40% - 50% (Aceleración de rotación VNR - NIC 2)';
                $unidadesEnRiesgo += $cantidad;
                $lotesRiesgo7Dias[] = $lote;
            } elseif ($dias <= 15) {
                $lote['nivel_alerta'] = 'ALERTA_15_DIAS';
                $lote['color_alerta'] = 'warning';
                $lote['sugerencia_accion'] = 'Promoción especial 20% - 30% en tienda virtual / Exhibición prioritaria';
                $unidadesEnRiesgo += $cantidad;
                $lotesRiesgo15Dias[] = $lote;
            } elseif ($dias <= 30) {
                $lote['nivel_alerta'] = 'PREVENTIVO_30_DIAS';
                $lote['color_alerta'] = 'info';
                $lote['sugerencia_accion'] = 'Monitoreo diario de ventas y despacho PEPS obligatorio';
                $unidadesEnRiesgo += $cantidad;
                $lotesRiesgo30Dias[] = $lote;
            }
        }
        unset($lote);

        $ioi = ($stockTotalSucursal > 0) ? round(($unidadesEnRiesgo / $stockTotalSucursal) * 100, 2) : 0.0;

        return [
            'resumen' => [
                'stock_total_sucursal' => $stockTotalSucursal,
                'unidades_en_riesgo'   => $unidadesEnRiesgo,
                'indice_obsolescencia' => $ioi,
                'total_lotes_7_dias'   => count($lotesRiesgo7Dias),
                'total_lotes_15_dias'  => count($lotesRiesgo15Dias),
                'total_lotes_30_dias'  => count($lotesRiesgo30Dias)
            ],
            'lotes_criticos_7_dias'    => $lotesRiesgo7Dias,
            'lotes_alerta_15_dias'     => $lotesRiesgo15Dias,
            'lotes_preventivo_30_dias' => $lotesRiesgo30Dias
        ];
    }
}
