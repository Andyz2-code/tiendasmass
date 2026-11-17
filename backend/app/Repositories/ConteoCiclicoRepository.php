<?php
namespace App\Repositories;

use App\Helpers\Database;
use App\Services\ConteoWhatsAppNotificationService;
use PDO;
use Exception;

class ConteoCiclicoRepository {
    private PDO $db;
    private ConteoWhatsAppNotificationService $waService;

    public function __construct() {
        $this->db = Database::getConnection();
        $this->waService = new ConteoWhatsAppNotificationService();
    }

    /**
     * Obtener listado de conteos programados con sucursal, encargado y métricas
     */
    public function getAll(?int $sucursalId = null): array {
        $where = $sucursalId ? "WHERE c.sucursal_id = :sucursal_id" : "";
        $sql = "SELECT c.*, 
                       s.nombre AS sucursal_nombre,
                       u_creador.nombres AS creador_nombres,
                       u_creador.apellidos AS creador_apellidos,
                       u_enc.id AS encargado_id,
                       u_enc.nombres AS encargado_nombres,
                       u_enc.apellidos AS encargado_apellidos,
                       u_enc.telefono AS encargado_telefono,
                       COUNT(d.id) AS total_items,
                       SUM(CASE WHEN d.stock_fisico IS NOT NULL THEN 1 ELSE 0 END) AS items_contados,
                       SUM(CASE WHEN d.diferencia != 0 THEN 1 ELSE 0 END) AS items_con_discrepancia
                FROM conteos_ciclicos c
                JOIN sucursales s ON c.sucursal_id = s.id
                JOIN usuarios u_creador ON c.usuario_id = u_creador.id
                LEFT JOIN usuarios u_enc ON c.encargado_id = u_enc.id
                LEFT JOIN detalle_conteo_ciclico d ON d.conteo_id = c.id
                {$where}
                GROUP BY c.id
                ORDER BY c.fecha_programada DESC, c.hora_programada DESC, c.id DESC";
        $stmt = $this->db->prepare($sql);
        if ($sucursalId) {
            $stmt->execute([':sucursal_id' => $sucursalId]);
        } else {
            $stmt->execute();
        }
        $conteos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Adjuntar trabajadores asignados a cada conteo
        foreach ($conteos as &$c) {
            $c['asignaciones'] = $this->waService->getAsignadosPorConteo((int)$c['id']);
        }

        return $conteos;
    }

    /**
     * Obtener detalle completo de un conteo, productos y asignaciones
     */
    public function getById(int $id): ?array {
        $sql = "SELECT c.*, 
                       s.nombre AS sucursal_nombre,
                       u_creador.nombres AS creador_nombres,
                       u_creador.apellidos AS creador_apellidos,
                       u_enc.id AS encargado_id,
                       u_enc.nombres AS encargado_nombres,
                       u_enc.apellidos AS encargado_apellidos,
                       u_enc.telefono AS encargado_telefono
                FROM conteos_ciclicos c
                JOIN sucursales s ON c.sucursal_id = s.id
                JOIN usuarios u_creador ON c.usuario_id = u_creador.id
                LEFT JOIN usuarios u_enc ON c.encargado_id = u_enc.id
                WHERE c.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $conteo = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conteo) {
            return null;
        }

        // Obtener trabajadores asignados
        $conteo['asignaciones'] = $this->waService->getAsignadosPorConteo($id);

        // Obtener productos de la muestra
        $detSql = "SELECT d.*, 
                          p.nombre AS producto_nombre, 
                          p.codigo_sku, 
                          p.codigo_barras, 
                          p.costo_base,
                          p.imagen_url,
                          i.clasificacion_abc
                   FROM detalle_conteo_ciclico d
                   JOIN productos p ON d.producto_id = p.id
                   JOIN inventarios i ON i.producto_id = p.id AND i.sucursal_id = :sucursal_id
                   WHERE d.conteo_id = :id
                   ORDER BY i.clasificacion_abc ASC, p.nombre ASC";
        $detStmt = $this->db->prepare($detSql);
        $detStmt->execute([':id' => $id, ':sucursal_id' => $conteo['sucursal_id']]);
        $conteo['detalles'] = $detStmt->fetchAll(PDO::FETCH_ASSOC);

        return $conteo;
    }

    /**
     * Obtener listado de trabajadores habilitados para una sucursal
     */
    public function getTrabajadores(int $sucursalId): array {
        $sql = "SELECT u.id, u.nombres, u.apellidos, u.email, u.telefono, u.sucursal_id, u.estado,
                       r.nombre AS rol_nombre, s.nombre AS sucursal_nombre
                FROM usuarios u
                JOIN roles r ON u.rol_id = r.id
                LEFT JOIN sucursales s ON u.sucursal_id = s.id
                WHERE u.estado = 1 
                  AND (u.sucursal_id = :sucursal_id OR u.sucursal_id IS NULL OR r.nombre = 'Administrador')
                ORDER BY u.nombres ASC, u.apellidos ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sucursal_id' => $sucursalId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Programar un nuevo conteo con encargado principal, trabajadores de apoyo y fecha/hora
     */
    public function createProgrammedCount(
        int $sucursalId,
        int $usuarioCreadorId,
        int $encargadoId,
        string $fechaProgramada,
        string $horaProgramada,
        string $estratoAbc,
        string $observaciones = '',
        array $apoyoIds = []
    ): int {
        $this->db->beginTransaction();
        try {
            $codigo = 'CNT-' . date('Ym') . '-' . strtoupper(bin2hex(random_bytes(2)));
            $sql = "INSERT INTO conteos_ciclicos (
                        sucursal_id, usuario_id, encargado_id, codigo_conteo, 
                        fecha_programada, hora_programada, estrato_abc, estado, observaciones
                    ) VALUES (
                        :suc, :user, :enc, :cod, :fecha, :hora, :estrato, 'PROGRAMADO', :obs
                    )";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':suc'     => $sucursalId,
                ':user'    => $usuarioCreadorId,
                ':enc'     => $encargadoId,
                ':cod'     => $codigo,
                ':fecha'   => $fechaProgramada,
                ':hora'    => $horaProgramada,
                ':estrato' => $estratoAbc,
                ':obs'     => $observaciones
            ]);
            $conteoId = (int)$this->db->lastInsertId();

            // 1. Asignar Encargado Principal
            $insAsig = $this->db->prepare("
                INSERT INTO conteo_asignaciones (conteo_id, usuario_id, tipo_asignacion, estado_notificacion_whatsapp, fecha_asignacion)
                VALUES (:conteo, :user, 'ENCARGADO_PRINCIPAL', 'PENDIENTE_INTEGRACION', NOW())
            ");
            $insAsig->execute([':conteo' => $conteoId, ':user' => $encargadoId]);

            // 2. Asignar Trabajadores de Apoyo (evitando duplicados con el encargado)
            $apoyoUnicos = array_unique(array_filter($apoyoIds, fn($id) => (int)$id !== $encargadoId));
            $insApoyo = $this->db->prepare("
                INSERT INTO conteo_asignaciones (conteo_id, usuario_id, tipo_asignacion, estado_notificacion_whatsapp, fecha_asignacion)
                VALUES (:conteo, :user, 'APOYO', 'PENDIENTE_INTEGRACION', NOW())
            ");
            foreach ($apoyoUnicos as $apoyoId) {
                $insApoyo->execute([':conteo' => $conteoId, ':user' => (int)$apoyoId]);
            }

            // 3. Generar la muestra estratificada de productos
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
            $productos = $prodStmt->fetchAll(PDO::FETCH_ASSOC);

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

    /**
     * Modificar la programación de un conteo (fecha, hora, encargado, apoyo, observaciones)
     */
    public function updateProgramacion(
        int $id,
        int $encargadoId,
        string $fechaProgramada,
        string $horaProgramada,
        string $observaciones,
        array $apoyoIds = []
    ): bool {
        $this->db->beginTransaction();
        try {
            $upd = $this->db->prepare("
                UPDATE conteos_ciclicos 
                SET encargado_id = :enc, 
                    fecha_programada = :fecha, 
                    hora_programada = :hora, 
                    observaciones = :obs,
                    updated_at = NOW()
                WHERE id = :id AND estado IN ('PROGRAMADO', 'PENDIENTE')
            ");
            $upd->execute([
                ':enc'   => $encargadoId,
                ':fecha' => $fechaProgramada,
                ':hora'  => $horaProgramada,
                ':obs'   => $observaciones,
                ':id'    => $id
            ]);

            // Re-sincronizar asignaciones
            $this->db->prepare("DELETE FROM conteo_asignaciones WHERE conteo_id = :id")->execute([':id' => $id]);

            $insAsig = $this->db->prepare("
                INSERT INTO conteo_asignaciones (conteo_id, usuario_id, tipo_asignacion, estado_notificacion_whatsapp, fecha_asignacion)
                VALUES (:conteo, :user, 'ENCARGADO_PRINCIPAL', 'PENDIENTE_INTEGRACION', NOW())
            ");
            $insAsig->execute([':conteo' => $id, ':user' => $encargadoId]);

            $apoyoUnicos = array_unique(array_filter($apoyoIds, fn($uid) => (int)$uid !== $encargadoId));
            $insApoyo = $this->db->prepare("
                INSERT INTO conteo_asignaciones (conteo_id, usuario_id, tipo_asignacion, estado_notificacion_whatsapp, fecha_asignacion)
                VALUES (:conteo, :user, 'APOYO', 'PENDIENTE_INTEGRACION', NOW())
            ");
            foreach ($apoyoUnicos as $apoyoId) {
                $insApoyo->execute([':conteo' => $id, ':user' => (int)$apoyoId]);
            }

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Cancelar programación de conteo
     */
    public function cancelarConteo(int $id): bool {
        $stmt = $this->db->prepare("
            UPDATE conteos_ciclicos 
            SET estado = 'CANCELADO', updated_at = NOW() 
            WHERE id = :id AND estado != 'CONCILIADO'
        ");
        return $stmt->execute([':id' => $id]);
    }

    /**
     * Guardar tomas físicas
     */
    public function savePhysicalCounts(int $conteoId, array $items): bool {
        $stmt = $this->db->prepare(
            "UPDATE detalle_conteo_ciclico 
             SET stock_fisico = :fisico, 
                 diferencia = (:fisico - stock_sistema),
                 justificacion = :just 
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

        $updConteo = $this->db->prepare("UPDATE conteos_ciclicos SET estado = 'EN_PROCESO', fecha_ejecucion = NOW() WHERE id = :id AND estado = 'PROGRAMADO'");
        $updConteo->execute([':id' => $conteoId]);

        return true;
    }

    /**
     * Conciliación y generación de ajustes de Kardex
     */
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
                    continue;
                }

                $diferencia = (int)$det['diferencia'];
                $prodId = (int)$det['producto_id'];
                $stockFisico = (int)$det['stock_fisico'];
                $stockSistema = (int)$det['stock_sistema'];
                $costoBase = (float)$det['costo_base'];

                if ($diferencia !== 0) {
                    $updInv = $this->db->prepare("UPDATE inventarios SET stock_actual = :fisico WHERE sucursal_id = :suc AND producto_id = :prod");
                    $updInv->execute([
                        ':fisico' => $stockFisico,
                        ':suc'    => $sucursalId,
                        ':prod'   => $prodId
                    ]);

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

                $mark = $this->db->prepare("UPDATE detalle_conteo_ciclico SET ajuste_aplicado = 1 WHERE id = :id");
                $mark->execute([':id' => $det['id']]);
            }

            $fin = $this->db->prepare("UPDATE conteos_ciclicos SET estado = 'FINALIZADO', updated_at = NOW() WHERE id = :id");
            $fin->execute([':id' => $conteoId]);

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
