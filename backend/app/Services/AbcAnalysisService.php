<?php
namespace App\Services;

use App\Helpers\Database;
use PDO;

class AbcAnalysisService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Calcula la estratificación de Pareto ABC (80/20) para una sucursal específica.
     * 
     * @param int $sucursalId
     * @return array [
     *    'resumen' => ['total_inversion', 'conteo_A', 'conteo_B', 'conteo_C'],
     *    'items'   => [detalles por producto con Vi, % acumulado y clase]
     * ]
     */
    public function calculateAbc(int $sucursalId): array {
        $sql = "SELECT i.id AS inventario_id,
                       i.producto_id,
                       i.stock_actual,
                       p.nombre AS producto_nombre,
                       p.codigo_sku,
                       p.costo_base,
                       p.precio_venta,
                       c.nombre AS categoria_nombre
                FROM inventarios i
                JOIN productos p ON i.producto_id = p.id
                JOIN categorias c ON p.categoria_id = c.id
                WHERE i.sucursal_id = :sucursal_id
                ORDER BY i.id ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        $rows = $stmt->fetchAll();

        if (empty($rows)) {
            return [
                'resumen' => [
                    'total_inversion' => 0,
                    'conteo_A'        => 0,
                    'conteo_B'        => 0,
                    'conteo_C'        => 0
                ],
                'items' => []
            ];
        }

        // 1. Calcular Valor de Inversión Vi = Stock * Costo
        $totalInversion = 0.0;
        foreach ($rows as &$item) {
            $stock = (int)$item['stock_actual'];
            $costo = (float)$item['costo_base'];
            $vi = $stock * $costo;
            $item['valor_inversion'] = round($vi, 2);
            $totalInversion += $vi;
        }
        unset($item);

        // 2. Ordenar descendentemente por Vi
        usort($rows, function ($a, $b) {
            return $b['valor_inversion'] <=> $a['valor_inversion'];
        });

        // 3. Calcular % individual, % acumulado y asignar Clase ABC
        $acumulado = 0.0;
        $conteoA = 0;
        $conteoB = 0;
        $conteoC = 0;

        foreach ($rows as &$item) {
            $porcentajeInd = ($totalInversion > 0) ? ($item['valor_inversion'] / $totalInversion) * 100 : 0;
            $acumulado += $porcentajeInd;

            $item['porcentaje_inversion'] = round($porcentajeInd, 2);
            $item['porcentaje_acumulado'] = round(min(100.0, $acumulado), 2);

            if ($item['porcentaje_acumulado'] <= 80.00 || ($acumulado - $porcentajeInd < 80.00 && $item['porcentaje_acumulado'] > 80.00 && $conteoA === 0)) {
                $item['clasificacion_abc'] = 'A';
                $conteoA++;
            } elseif ($item['porcentaje_acumulado'] <= 95.00) {
                $item['clasificacion_abc'] = 'B';
                $conteoB++;
            } else {
                $item['clasificacion_abc'] = 'C';
                $conteoC++;
            }
        }
        unset($item);

        return [
            'resumen' => [
                'total_inversion' => round($totalInversion, 2),
                'conteo_A'        => $conteoA,
                'conteo_B'        => $conteoB,
                'conteo_C'        => $conteoC,
                'total_productos' => count($rows)
            ],
            'items' => $rows
        ];
    }

    /**
     * Aplica y actualiza la clasificación ABC en la tabla inventarios de la base de datos
     */
    public function updateBranchAbc(int $sucursalId): bool {
        $result = $this->calculateAbc($sucursalId);
        if (empty($result['items'])) {
            return false;
        }

        $stmt = $this->db->prepare("UPDATE inventarios SET clasificacion_abc = :clase WHERE id = :id");

        foreach ($result['items'] as $item) {
            $stmt->execute([
                ':clase' => $item['clasificacion_abc'],
                ':id'    => $item['inventario_id']
            ]);
        }

        return true;
    }
}
