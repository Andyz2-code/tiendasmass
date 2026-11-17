<?php
namespace App\Services;

use App\Helpers\Database;
use PDO;
use Exception;

class FifoInventoryService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Algoritmo PEPS / FIFO (NIC 2):
     * Selecciona y descuenta de forma estricta las unidades de los lotes más antiguos
     * disponibles para una sucursal y producto específicos.
     * 
     * @param int $sucursalId
     * @param int $productoId
     * @param int $cantidadSolicitada
     * @return array Lista de asignaciones por lote [lote_id, codigo_lote, cantidad_descontada, costo_unitario]
     * @throws Exception Si el stock disponible en lotes es insuficiente
     */
    public function allocateFifoLots(int $sucursalId, int $productoId, int $cantidadSolicitada): array {
        if ($cantidadSolicitada <= 0) {
            throw new Exception("La cantidad solicitada debe ser mayor a 0.");
        }

        // Seleccionar lotes con saldo disponible ordenados por PEPS (fecha de ingreso asc, fecha vencimiento asc, id asc)
        $sql = "SELECT id, codigo_lote, cantidad_disponible, costo_unitario_compra, fecha_ingreso, fecha_vencimiento
                FROM lotes
                WHERE sucursal_id = :sucursal_id 
                  AND producto_id = :producto_id 
                  AND estado = 'DISPONIBLE' 
                  AND cantidad_disponible > 0
                ORDER BY fecha_ingreso ASC, fecha_vencimiento ASC, id ASC
                FOR UPDATE"; // Bloqueo de fila para evitar condiciones de carrera

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':sucursal_id' => $sucursalId,
            ':producto_id' => $productoId
        ]);
        $lotes = $stmt->fetchAll();

        // Verificar si la suma de saldos de los lotes cubre la demanda
        $stockTotalLotes = array_sum(array_column($lotes, 'cantidad_disponible'));
        if ($stockTotalLotes < $cantidadSolicitada) {
            throw new Exception("Stock insuficiente en lotes activos para el producto ID {$productoId}. Solicitado: {$cantidadSolicitada}, Disponible en lotes: {$stockTotalLotes}");
        }

        $asignaciones = [];
        $pendiente = $cantidadSolicitada;

        foreach ($lotes as $lote) {
            if ($pendiente <= 0) {
                break;
            }

            $loteId = (int)$lote['id'];
            $disponible = (int)$lote['cantidad_disponible'];
            $descuento = min($disponible, $pendiente);
            $nuevoSaldo = $disponible - $descuento;
            $nuevoEstado = ($nuevoSaldo === 0) ? 'AGOTADO' : 'DISPONIBLE';

            // Actualizar el saldo del lote
            $updateSql = "UPDATE lotes 
                          SET cantidad_disponible = :nuevo_saldo,
                              estado = :nuevo_estado,
                              updated_at = NOW()
                          WHERE id = :id";
            $updateStmt = $this->db->prepare($updateSql);
            $updateStmt->execute([
                ':nuevo_saldo'  => $nuevoSaldo,
                ':nuevo_estado' => $nuevoEstado,
                ':id'           => $loteId
            ]);

            $asignaciones[] = [
                'lote_id'             => $loteId,
                'codigo_lote'         => $lote['codigo_lote'],
                'cantidad_descontada' => $descuento,
                'costo_unitario'      => (float)$lote['costo_unitario_compra'],
                'fecha_ingreso'       => $lote['fecha_ingreso'],
                'fecha_vencimiento'   => $lote['fecha_vencimiento']
            ];

            $pendiente -= $descuento;
        }

        return $asignaciones;
    }

    /**
     * Registra un nuevo lote de mercadería (recepción de compras)
     */
    public function registerBatch(array $data): int {
        $sql = "INSERT INTO lotes 
                (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, ubicacion_almacen, estado)
                VALUES 
                (:sucursal_id, :producto_id, :codigo_lote, :fecha_ingreso, :fecha_vencimiento, :cantidad_inicial, :cantidad_disponible, :costo_unitario_compra, :ubicacion_almacen, 'DISPONIBLE')";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':sucursal_id'           => $data['sucursal_id'],
            ':producto_id'           => $data['producto_id'],
            ':codigo_lote'           => $data['codigo_lote'],
            ':fecha_ingreso'         => $data['fecha_ingreso'] ?? date('Y-m-d'),
            ':fecha_vencimiento'     => !empty($data['fecha_vencimiento']) ? $data['fecha_vencimiento'] : null,
            ':cantidad_inicial'      => $data['cantidad'],
            ':cantidad_disponible'   => $data['cantidad'],
            ':costo_unitario_compra' => $data['costo_unitario'],
            ':ubicacion_almacen'     => $data['ubicacion_almacen'] ?? 'PASAJE-A1'
        ]);

        return (int)$this->db->lastInsertId();
    }
}
