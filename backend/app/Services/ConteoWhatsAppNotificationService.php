<?php
namespace App\Services;

use App\Helpers\Database;
use PDO;
use Exception;

/**
 * ConteoWhatsAppNotificationService
 * =========================================================================
 * Servicio desacoplado para la preparación e integración futura de notificaciones
 * de asignación de conteos físicos vía WhatsApp mediante Chatbot / WhatsApp Cloud API.
 * 
 * GUÍA DE INTEGRACIÓN FUTURA (CHATBOT / META WHATSAPP BUSINESS API):
 * -------------------------------------------------------------------------
 * 1. Configuración de Credenciales:
 *    - En `backend/config/config.php` agregar:
 *      'whatsapp' => [
 *          'api_url'     => 'https://graph.facebook.com/v19.0/PHONE_NUMBER_ID/messages',
 *          'access_token'=> 'WHATSAPP_PERMANENT_ACCESS_TOKEN',
 *          'template'    => 'conteo_inventario_asignacion_v1'
 *      ]
 * 
 * 2. Punto de Disparo (Trigger):
 *    - Al programar o actualizar un conteo en `ConteoCiclicoController@store`,
 *      este servicio registra cada trabajador en `conteo_asignaciones` con estado
 *      `PENDIENTE_INTEGRACION`.
 *    - Cuando el webhook/daemon del chatbot se conecte, procesará las asignaciones
 *      con estado `PENDIENTE_INTEGRACION` llamando a `enviarNotificacionWhatsApp($payload)`.
 * 
 * 3. Formato del Payload Normalizado:
 *    - Definido en el método `buildNotificationPayload()`.
 * =========================================================================
 */
class ConteoWhatsAppNotificationService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Construye la estructura estandarizada de datos para la futura notificación
     * sin ejecutar llamadas externas ni simular envíos exitosos.
     */
    public static function buildNotificationPayload(array $conteo, array $trabajador, string $rolEnConteo): array {
        return [
            'evento'            => 'ASIGNACION_CONTEO_FISICO',
            'estado_integracion'=> 'PENDIENTE_INTEGRACION', // No enviada
            'canal'             => 'WHATSAPP_CHATBOT',
            'destinatario'      => [
                'usuario_id' => $trabajador['id'],
                'nombre'     => $trabajador['nombres'] . ' ' . $trabajador['apellidos'],
                'telefono'   => $trabajador['telefono'] ?? '',
                'rol_conteo' => $rolEnConteo // 'ENCARGADO_PRINCIPAL' o 'APOYO'
            ],
            'conteo'            => [
                'conteo_id'        => $conteo['id'] ?? null,
                'codigo_conteo'    => $conteo['codigo_conteo'] ?? '',
                'estrato_abc'      => $conteo['estrato_abc'] ?? 'A',
                'fecha_programada' => $conteo['fecha_programada'] ?? date('Y-m-d'),
                'hora_programada'  => $conteo['hora_programada'] ?? '08:00:00',
                'sucursal_nombre'  => $conteo['sucursal_nombre'] ?? 'Tiendas Mass',
                'instrucciones'    => $conteo['observaciones'] ?? 'Sin instrucciones adicionales'
            ],
            'plantilla_mensaje' => sprintf(
                "¡Hola %s! Has sido designado como %s para el Conteo Físico (%s) en %s el día %s a las %s. Por favor confirma tu disponibilidad.",
                $trabajador['nombres'],
                $rolEnConteo === 'ENCARGADO_PRINCIPAL' ? 'Encargado Responsable' : 'Personal de Apoyo',
                $conteo['codigo_conteo'] ?? 'S/C',
                $conteo['sucursal_nombre'] ?? 'Tiendas Mass',
                $conteo['fecha_programada'] ?? date('Y-m-d'),
                $conteo['hora_programada'] ?? '08:00'
            ),
            'creado_en'         => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Registra la asignación con el estado pendiente de integración
     */
    public function registrarAsignacion(int $conteoId, int $usuarioId, string $rolEnConteo): int {
        $stmt = $this->db->prepare("
            INSERT INTO conteo_asignaciones (conteo_id, usuario_id, tipo_asignacion, estado_notificacion_whatsapp, fecha_asignacion)
            VALUES (:conteo, :user, :tipo, 'PENDIENTE_INTEGRACION', NOW())
        ");
        $stmt->execute([
            ':conteo' => $conteoId,
            ':user'   => $usuarioId,
            ':tipo'   => $rolEnConteo
        ]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Obtiene los trabajadores asignados a un conteo específico con sus números telefónicos y roles
     */
    public function getAsignadosPorConteo(int $conteoId): array {
        $stmt = $this->db->prepare("
            SELECT ca.id AS asignacion_id,
                   ca.tipo_asignacion,
                   ca.estado_notificacion_whatsapp,
                   ca.fecha_asignacion,
                   u.id AS usuario_id,
                   u.nombres,
                   u.apellidos,
                   u.email,
                   u.telefono,
                   r.nombre AS rol_puesto,
                   u.sucursal_id
            FROM conteo_asignaciones ca
            JOIN usuarios u ON ca.usuario_id = u.id
            JOIN roles r ON u.rol_id = r.id
            WHERE ca.conteo_id = :conteo_id
            ORDER BY (ca.tipo_asignacion = 'ENCARGADO_PRINCIPAL') DESC, u.nombres ASC
        ");
        $stmt->execute([':conteo_id' => $conteoId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
