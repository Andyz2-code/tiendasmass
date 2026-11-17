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

    public function index(): void {
        $sucursalId = (int)($_GET['sucursal_id'] ?? 1);
        RoleMiddleware::validateBranchAccess($sucursalId);

        $conteos = $this->repo->getAll($sucursalId);
        Response::success($conteos);
    }

    public function show(string $id): void {
        $conteo = $this->repo->getById((int)$id);
        if (!$conteo) {
            Response::error('Conteo cíclico no encontrado', 404);
        }

        RoleMiddleware::validateBranchAccess((int)$conteo['sucursal_id']);
        Response::success($conteo);
    }

    public function store(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'sucursal_id' => 'required|numeric',
            'estrato_abc' => 'required|in:A,B,C,TODOS'
        ]);

        if ($validator->fails()) {
            Response::error('Datos inválidos para programar conteo cíclico', 422, $validator->getErrors());
        }

        $sucursalId = (int)$input['sucursal_id'];
        RoleMiddleware::validateBranchAccess($sucursalId);

        $user = JwtAuthMiddleware::getUser();
        $usuarioId = (int)($user['sub'] ?? 1);

        try {
            $conteoId = $this->repo->createProgrammedCount(
                $sucursalId,
                $usuarioId,
                $input['estrato_abc'],
                $input['observaciones'] ?? ''
            );
            Response::success(['id' => $conteoId], 'Conteo cíclico programado y muestra generada exitosamente.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function saveCounts(string $id): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $input['items'] ?? [];

        if (empty($items)) {
            Response::error('No se enviaron datos de conteo físico', 422);
        }

        $this->repo->savePhysicalCounts((int)$id, $items);
        Response::success(null, 'Tomas físicas guardadas exitosamente.');
    }

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
