<?php
namespace App\Controllers;

use App\Repositories\ConteoCiclicoRepository;
use App\Middleware\JwtAuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Helpers\Response;
use App\Helpers\Validator;
use Exception;

class ConteoCiclicoController {
    private ConteoCiclicoRepository $repo;

    public function __construct() {
        $this->repo = new ConteoCiclicoRepository();
    }

    /**
     * GET /api/conteos?sucursal_id=1
     * Listar conteos según rol (Admin ve todos o filtra por sucursal, Supervisor solo su sede)
     */
    public function index(): void {
        $user = JwtAuthMiddleware::getUser();
        $isSupervisor = ($user && ($user['rol_nombre'] ?? '') === 'Supervisor');

        if ($isSupervisor) {
            $sucursalId = (int)$user['sucursal_id'];
        } else {
            RoleMiddleware::requireRole(['Administrador', 'Supervisor']);
            $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;
        }

        $conteos = $this->repo->getAll($sucursalId);
        Response::success($conteos);
    }

    /**
     * GET /api/conteos/trabajadores?sucursal_id=1
     * Listar trabajadores registrados y habilitados para asignar al conteo
     */
    public function trabajadores(): void {
        $user = JwtAuthMiddleware::getUser();
        $isSupervisor = ($user && ($user['rol_nombre'] ?? '') === 'Supervisor');

        if ($isSupervisor) {
            $sucursalId = (int)$user['sucursal_id'];
        } else {
            RoleMiddleware::requireRole(['Administrador', 'Supervisor']);
            $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : 1;
        }

        $trabajadores = $this->repo->getTrabajadores($sucursalId);
        Response::success($trabajadores);
    }

    /**
     * GET /api/conteos/{id}
     * Detalle completo del conteo, asignaciones y productos
     */
    public function show(string $id): void {
        $conteo = $this->repo->getById((int)$id);
        if (!$conteo) {
            Response::error('Conteo físico no encontrado', 404);
        }

        RoleMiddleware::validateBranchAccess((int)$conteo['sucursal_id']);
        Response::success($conteo);
    }

    /**
     * POST /api/conteos
     * Programar nuevo conteo con asignación de encargado y trabajadores de apoyo
     */
    public function store(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'sucursal_id'      => 'required|numeric',
            'encargado_id'     => 'required|numeric',
            'fecha_programada' => 'required',
            'hora_programada'  => 'required',
            'estrato_abc'      => 'required|in:A,B,C,TODOS'
        ]);

        if ($validator->fails()) {
            Response::error('Datos inválidos para programar el conteo', 422, $validator->getErrors());
        }

        $sucursalId = (int)$input['sucursal_id'];
        RoleMiddleware::validateBranchAccess($sucursalId);

        $encargadoId = (int)$input['encargado_id'];
        if ($encargadoId <= 0) {
            Response::error('Debe seleccionar obligatoriamente un encargado responsable para el conteo.', 422);
        }

        // Validación de fecha y hora
        $fecha = trim($input['fecha_programada']);
        $hora = trim($input['hora_programada']);
        $fechaHoraStr = "{$fecha} {$hora}";
        $timestamp = strtotime($fechaHoraStr);
        if (!$timestamp) {
            Response::error('El formato de fecha u hora no es válido.', 422);
        }

        $user = JwtAuthMiddleware::getUser();
        $usuarioCreadorId = (int)($user['sub'] ?? 1);
        $apoyoIds = isset($input['trabajadores_apoyo']) && is_array($input['trabajadores_apoyo']) 
            ? array_map('intval', $input['trabajadores_apoyo']) 
            : [];

        try {
            $conteoId = $this->repo->createProgrammedCount(
                $sucursalId,
                $usuarioCreadorId,
                $encargadoId,
                $fecha,
                $hora,
                $input['estrato_abc'],
                $input['observaciones'] ?? '',
                $apoyoIds
            );

            Response::success([
                'id' => $conteoId,
                'notificacion_whatsapp' => 'PENDIENTE_INTEGRACION'
            ], 'Conteo de inventario programado y asignaciones registradas exitosamente.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * PUT /api/conteos/{id}
     * Modificar la programación y asignación de trabajadores
     */
    public function update(string $id): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $conteo = $this->repo->getById((int)$id);
        if (!$conteo) {
            Response::error('Conteo físico no encontrado', 404);
        }

        RoleMiddleware::validateBranchAccess((int)$conteo['sucursal_id']);

        if (!in_array($conteo['estado'], ['PROGRAMADO', 'PENDIENTE'])) {
            Response::error('Solo se pueden modificar conteos en estado Programado o Pendiente.', 422);
        }

        $encargadoId = (int)($input['encargado_id'] ?? $conteo['encargado_id']);
        $fecha = trim($input['fecha_programada'] ?? $conteo['fecha_programada']);
        $hora = trim($input['hora_programada'] ?? $conteo['hora_programada']);
        $obs = trim($input['observaciones'] ?? $conteo['observaciones']);
        $apoyoIds = isset($input['trabajadores_apoyo']) && is_array($input['trabajadores_apoyo'])
            ? array_map('intval', $input['trabajadores_apoyo'])
            : [];

        try {
            $this->repo->updateProgramacion((int)$id, $encargadoId, $fecha, $hora, $obs, $apoyoIds);
            Response::success(null, 'Programación de conteo actualizada exitosamente.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * PATCH /api/conteos/{id}/cancelar
     * Cancelar programación de conteo
     */
    public function cancel(string $id): void {
        $conteo = $this->repo->getById((int)$id);
        if (!$conteo) {
            Response::error('Conteo físico no encontrado', 404);
        }

        RoleMiddleware::validateBranchAccess((int)$conteo['sucursal_id']);

        if ($conteo['estado'] === 'FINALIZADO' || $conteo['estado'] === 'CONCILIADO') {
            Response::error('No se puede cancelar un conteo que ya ha sido finalizado o conciliado.', 422);
        }

        $this->repo->cancelarConteo((int)$id);
        Response::success(null, 'Conteo de inventario cancelado correctamente.');
    }

    /**
     * POST /api/conteos/{id}/guardar
     */
    public function saveCounts(string $id): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $input['items'] ?? [];

        if (empty($items)) {
            Response::error('No se enviaron datos de conteo físico', 422);
        }

        $this->repo->savePhysicalCounts((int)$id, $items);
        Response::success(null, 'Tomas físicas guardadas exitosamente.');
    }

    /**
     * POST /api/conteos/{id}/conciliar
     */
    public function reconcile(string $id): void {
        $user = JwtAuthMiddleware::getUser();
        $usuarioId = (int)($user['sub'] ?? 1);

        try {
            $this->repo->applyReconciliation((int)$id, $usuarioId);
            Response::success(null, 'Conciliación física y contable completada. Se generaron los asientos de ajuste en el Kardex.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
