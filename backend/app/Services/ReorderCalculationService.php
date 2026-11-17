<?php
namespace App\Services;

use App\Helpers\Database;
use PDO;

class ReorderCalculationService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Calcula y evalúa el Punto de Reorden (POR) para todos los productos de una sucursal.
     * POR = (d * L) + SS
     * 
     * @param int $sucursalId
     * @return array Lista de alertas y estado de inventario
     */
    public function getReorderAlerts(int $sucursalId): array {
        $sql = "SELECT i.id AS inventario_id,
                       i.sucursal_id,
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
                WHERE i.sucursal_id = :sucursal_id
                ORDER BY i.stock_actual ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        $items = $stmt->fetchAll();

        $alertas = [];
        $resumen = [
            'total_productos' => count($items),
            'criticos'        => 0, // Stock <= SS
            'en_reorden'      => 0, // SS < Stock <= POR
            'optimos'         => 0  // Stock > POR
        ];

        foreach ($items as &$item) {
            $d = (float)$item['demanda_diaria_promedio'];
            $L = (int)$item['lead_time_dias'];
            $ss = (int)$item['stock_seguridad'];
            $stockActual = (int)$item['stock_actual'];

            // Cálculo dinámico del POR
            $porCalculado = (int)ceil(($d * $L) + $ss);
            $item['por_calculado'] = $porCalculado;

            if ($stockActual <= $ss) {
                $item['estado_stock'] = 'CRITICO';
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
            'resumen'          => $resumen,
            'alertas_activas'  => $alertas,
            'inventario_total' => $items
        ];
    }

    /**
     * Módulo de Consumo Responsable:
     * Calcula el Índice de Obsolescencia de Inventario (IOI) y alerta sobre lotes próximos a vencer.
     * IOI = (Unidades en Riesgo de Caducidad / Stock Total) * 100
     * 
     * @param int $sucursalId
     * @return array Lotes en riesgo a 30, 15 y 7 días con sugerencia de descuento VNR (NIC 2)
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

        $stockTotalSucursal = (int)$this->db->query("SELECT COALESCE(SUM(cantidad_disponible), 0) FROM lotes WHERE sucursal_id = {$sucursalId} AND estado = 'DISPONIBLE'")->fetchColumn();

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
                'indice_obsolescencia' => $ioi, // IOI %
                'total_lotes_7_dias'   => count($lotesRiesgo7Dias),
                'total_lotes_15_dias'  => count($lotesRiesgo15Dias),
                'total_lotes_30_dias'  => count($lotesRiesgo30Dias)
            ],
            'lotes_criticos_7_dias'   => $lotesRiesgo7Dias,
            'lotes_alerta_15_dias'    => $lotesRiesgo15Dias,
            'lotes_preventivo_30_dias'=> $lotesRiesgo30Dias
        ];
    }
}
