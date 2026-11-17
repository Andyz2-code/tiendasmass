<?php
namespace App\Repositories;

use App\Helpers\Database;
use PDO;
use Exception;

class ConteoCiclicoRepository {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getAll(int $sucursalId): array {
        $sql = "SELECT c.*, 
                       u.nombres AS supervisor_nombres,
                       u.apellidos AS supervisor_apellidos,
                       COUNT(d.id) AS total_items,
                       SUM(CASE WHEN d.stock_fisico IS NOT NULL THEN 1 ELSE 0 END) AS items_contados,
                       SUM(CASE WHEN d.diferencia != 0 THEN 1 ELSE 0 END) AS items_con_discrepancia
                FROM conteos_ciclicos c
                JOIN usuarios u ON c.usuario_id = u.id
                LEFT JOIN detalle_conteo_ciclico d ON d.conteo_id = c.id
                WHERE c.sucursal_id = :sucursal_id
                GROUP BY c.id
                ORDER BY c.id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array {
        $sql = "SELECT c.*, u.nombres AS supervisor_nombres, u.apellidos AS supervisor_apellidos 
                FROM conteos_ciclicos c
                JOIN usuarios u ON c.usuario_id = u.id
                WHERE c.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $conteo = $stmt->fetch();

        if (!$conteo) {
            return null;
        }

        $detSql = "SELECT d.*, 
                          p.nombre AS producto_nombre, 
                          p.codigo_sku, 
                          p.codigo_barras, 
                          p.costo_base,
                          i.clasificacion_abc
                   FROM detalle_conteo_ciclico d
                   JOIN productos p ON d.producto_id = p.id
                   JOIN inventarios i ON i.producto_id = p.id AND i.sucursal_id = :sucursal_id
                   WHERE d.conteo_id = :id
                   ORDER BY i.clasificacion_abc ASC, p.nombre ASC";
        $detStmt = $this->db->prepare($detSql);
        $detStmt->execute([':id' => $id, ':sucursal_id' => $conteo['sucursal_id']]);
        $conteo['detalles'] = $detStmt->fetchAll();

        return $conteo;
    }

    public function createProgrammedCount(int $sucursalId, int $usuarioId, string $estratoAbc, string $observaciones = ''): int {
        $this->db->beginTransaction();
        try {
            $codigo = 'CNT-' . date('Ym') . '-' . strtoupper(bin2hex(random_bytes(2)));
            $sql = "INSERT INTO conteos_ciclicos (sucursal_id, usuario_id, codigo_conteo, fecha_programada, estrato_abc, estado, observaciones)
                    VALUES (:suc, :user, :cod, CURDATE(), :estrato, 'PROGRAMADO', :obs)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':suc'     => $sucursalId,
                ':user'    => $usuarioId,
                ':cod'     => $codigo,
                ':estrato' => $estratoAbc,
                ':obs'     => $observaciones
            ]);
            $conteoId = (int)$this->db->lastInsertId();

            // Seleccionar los productos que entran en la muestra según el estrato ABC
            $prodSql = "SELECT producto_id, stock_actual 
                        FROM inventarios 
                        WHERE sucursal_id = :suc";
            if ($estratoAbc !== 'TODOS') {
                $prodSql .= " AND clasificacion_abc = :estrato";
            }

            $prodStmt = $this->db->prepare($prodSql);
            $params = [':suc' => $sucursalId];
            if ($estratoAbc !== 'TODOS') {
                $params[':estrato'] = $estratoAbc;
            }
            $prodStmt->execute($params);
            $productos = $prodStmt->fetchAll();

            $detInsert = $this->db->prepare(
                "INSERT INTO detalle_conteo_ciclico (conteo_id, producto_id, stock_sistema) 
                 VALUES (:conteo_id, :producto_id, :stock_sistema)"
            );
            foreach ($productos as $p) {
                $detInsert->execute([
                    ':conteo_id'      => $conteoId,
                    ':producto_id'    => $p['producto_id'],
                    ':stock_sistema'  => $p['stock_actual']
                ]);
            }

            $this->db->commit();
            return $conteoId;
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function savePhysicalCounts(int $conteoId, array $items): bool {
        $stmt = $this->db->prepare(
            "UPDATE detalle_conteo_ciclico 
             SET stock_fisico = :fisico, justificacion = :just 
             WHERE conteo_id = :conteo_id AND producto_id = :producto_id"
        );

        foreach ($items as $item) {
            $stmt->execute([
                ':fisico'      => $item['stock_fisico'],
                ':just'        => $item['justificacion'] ?? null,
                ':conteo_id'   => $conteoId,
                ':producto_id' => $item['producto_id']
            ]);
        }

        $updConteo = $this->db->prepare("UPDATE conteos_ciclicos SET estado = 'EN_PROCESO', fecha_ejecucion = NOW() WHERE id = :id");
        $updConteo->execute([':id' => $conteoId]);

        return true;
    }

    public function applyReconciliation(int $conteoId, int $usuarioId): bool {
        $conteo = $this->getById($conteoId);
        if (!$conteo) {
            throw new Exception("Conteo no encontrado.");
        }

        $this->db->beginTransaction();
        try {
            $sucursalId = (int)$conteo['sucursal_id'];

            foreach ($conteo['detalles'] as $det) {
                if ($det['stock_fisico'] === null) {
                    continue; // No se contó
                }

                $diferencia = (int)$det['diferencia'];
                $prodId = (int)$det['producto_id'];
                $stockFisico = (int)$det['stock_fisico'];
                $stockSistema = (int)$det['stock_sistema'];
                $costoBase = (float)$det['costo_base'];

                if ($diferencia !== 0) {
                    // Actualizar stock en tabla inventarios
                    $updInv = $this->db->prepare("UPDATE inventarios SET stock_actual = :fisico WHERE sucursal_id = :suc AND producto_id = :prod");
                    $updInv->execute([
                        ':fisico' => $stockFisico,
                        ':suc'    => $sucursalId,
                        ':prod'   => $prodId
                    ]);

                    // Registrar asiento de ajuste en Kardex
                    $tipo = ($diferencia > 0) ? 'AJUSTE_CONTEO' : 'AJUSTE_MERMA';
                    $kardex = $this->db->prepare(
                        "INSERT INTO movimientos_inventario 
                         (sucursal_id, producto_id, usuario_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                         VALUES 
                         (:suc, :prod, :user, :tipo, :doc, :cant, :costo, :ant, :nuevo, :obs)"
                    );
                    $kardex->execute([
                        ':suc'   => $sucursalId,
                        ':prod'  => $prodId,
                        ':user'  => $usuarioId,
                        ':tipo'  => $tipo,
                        ':doc'   => $conteo['codigo_conteo'],
                        ':cant'  => abs($diferencia),
                        ':costo' => $costoBase,
                        ':ant'   => $stockSistema,
                        ':nuevo' => $stockFisico,
                        ':obs'   => "Ajuste por conteo cíclico estratificado {$conteo['codigo_conteo']}. Justificación: " . ($det['justificacion'] ?? 'Conciliación física')
                    ]);
                }

                // Marcar ajuste aplicado en el detalle
                $mark = $this->db->prepare("UPDATE detalle_conteo_ciclico SET ajuste_aplicado = 1 WHERE id = :id");
                $mark->execute([':id' => $det['id']]);
            }

            // Marcar conteo como CONCILIADO
            $fin = $this->db->prepare("UPDATE conteos_ciclicos SET estado = 'CONCILIADO', updated_at = NOW() WHERE id = :id");
            $fin->execute([':id' => $conteoId]);

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
