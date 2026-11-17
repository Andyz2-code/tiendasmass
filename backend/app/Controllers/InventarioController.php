<?php
namespace App\Controllers;

use App\Repositories\InventarioRepository;
use App\Repositories\LoteRepository;
use App\Repositories\KardexRepository;
use App\Services\AbcAnalysisService;
use App\Services\ReorderCalculationService;
use App\Services\FifoInventoryService;
use App\Middleware\JwtAuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Helpers\Response;
use App\Helpers\Validator;
use Exception;

class InventarioController {
    private InventarioRepository $invRepo;
    private LoteRepository $loteRepo;
    private KardexRepository $kardexRepo;
    private AbcAnalysisService $abcService;
    private ReorderCalculationService $reorderService;
    private FifoInventoryService $fifoService;

    public function __construct() {
        $this->invRepo = new InventarioRepository();
        $this->loteRepo = new LoteRepository();
        $this->kardexRepo = new KardexRepository();
        $this->abcService = new AbcAnalysisService();
        $this->reorderService = new ReorderCalculationService();
        $this->fifoService = new FifoInventoryService();
    }

    /**
     * GET /api/inventarios?sucursal_id=1
     */
    public function index(): void {
        $sucursalId = (int)($_GET['sucursal_id'] ?? 1);
        RoleMiddleware::validateBranchAccess($sucursalId);

        $items = $this->invRepo->getBySucursal($sucursalId);
        Response::success($items);
    }

    /**
     * GET /api/lotes?sucursal_id=1&producto_id=X
     */
    public function lotes(): void {
        $sucursalId = (int)($_GET['sucursal_id'] ?? 1);
        $productoId = isset($_GET['producto_id']) ? (int)$_GET['producto_id'] : null;
        RoleMiddleware::validateBranchAccess($sucursalId);

        $lotes = $this->loteRepo->getBySucursal($sucursalId, $productoId);
        Response::success($lotes);
    }

    /**
     * POST /api/lotes/recepcion (Recepción de Compras por Supervisor)
     */
    public function recepcionCompra(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'sucursal_id'    => 'required|numeric',
            'producto_id'    => 'required|numeric',
            'codigo_lote'    => 'required',
            'cantidad'       => 'required|positive',
            'costo_unitario' => 'required|positive'
        ]);

        if ($validator->fails()) {
            Response::error('Datos incompletos para recepción de lote', 422, $validator->getErrors());
        }

        $sucursalId = (int)$input['sucursal_id'];
        RoleMiddleware::validateBranchAccess($sucursalId);

        $user = JwtAuthMiddleware::getUser();

        try {
            $loteId = $this->fifoService->registerBatch($input);

            // Actualizar stock_actual en la tabla inventarios
            $inv = $this->invRepo->getOne($sucursalId, (int)$input['producto_id']);
            $saldoAnt = $inv ? (int)$inv['stock_actual'] : 0;
            $saldoNuevo = $saldoAnt + (int)$input['cantidad'];

            $db = \App\Helpers\Database::getConnection();
            $upd = $db->prepare(
                "INSERT INTO inventarios (sucursal_id, producto_id, stock_actual, stock_minimo, stock_maximo, punto_reorden)
                 VALUES (:suc, :prod, :stock, 10, 200, 25)
                 ON DUPLICATE KEY UPDATE stock_actual = stock_actual + :cant_add"
            );
            $upd->execute([
                ':suc'      => $sucursalId,
                ':prod'     => (int)$input['producto_id'],
                ':stock'    => (int)$input['cantidad'],
                ':cant_add' => (int)$input['cantidad']
            ]);

            // Registrar movimiento en Kardex
            $this->kardexRepo->registerManualAdjustment([
                'sucursal_id'          => $sucursalId,
                'producto_id'          => (int)$input['producto_id'],
                'lote_id'              => $loteId,
                'usuario_id'           => $user['sub'] ?? null,
                'tipo_movimiento'      => 'ENTRADA_COMPRA',
                'documento_referencia' => $input['documento_referencia'] ?? 'GUIA-REM-001',
                'cantidad'             => (int)$input['cantidad'],
                'costo_unitario'       => (float)$input['costo_unitario'],
                'saldo_anterior'       => $saldoAnt,
                'saldo_nuevo'          => $saldoNuevo,
                'observaciones'        => 'Ingreso de mercadería por compra. Lote ' . $input['codigo_lote']
            ]);

            Response::success(['lote_id' => $loteId], 'Lote y compra registrados exitosamente en almacén y Kardex.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * GET /api/inventarios/abc?sucursal_id=1
     */
    public function abcAnalysis(): void {
        $sucursalId = (int)($_GET['sucursal_id'] ?? 1);
        RoleMiddleware::validateBranchAccess($sucursalId);
        $data = $this->abcService->calculateAbc($sucursalId);
        Response::success($data);
    }

    /**
     * POST /api/inventarios/abc-recalculate
     */
    public function abcRecalculate(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $sucursalId = (int)($input['sucursal_id'] ?? 1);
        RoleMiddleware::validateBranchAccess($sucursalId);

        $this->abcService->updateBranchAbc($sucursalId);
        $data = $this->abcService->calculateAbc($sucursalId);
        Response::success($data, 'Clasificación ABC actualizada exitosamente en inventario.');
    }

    /**
     * GET /api/inventarios/reorder-alerts?sucursal_id=1
     */
    public function reorderAlerts(): void {
        $sucursalId = (int)($_GET['sucursal_id'] ?? 1);
        RoleMiddleware::validateBranchAccess($sucursalId);
        $data = $this->reorderService->getReorderAlerts($sucursalId);
        Response::success($data);
    }

    /**
     * GET /api/inventarios/obsolescence?sucursal_id=1 (Consumo Responsable / Semáforo Caducidad)
     */
    public function obsolescence(): void {
        $sucursalId = (int)($_GET['sucursal_id'] ?? 1);
        RoleMiddleware::validateBranchAccess($sucursalId);
        $data = $this->reorderService->getObsolescenceAndExpiryReport($sucursalId);
        Response::success($data);
    }

    /**
     * GET /api/inventarios/kardex?sucursal_id=1
     */
    public function kardex(): void {
        $sucursalId = (int)($_GET['sucursal_id'] ?? 1);
        $productoId = isset($_GET['producto_id']) ? (int)$_GET['producto_id'] : null;
        RoleMiddleware::validateBranchAccess($sucursalId);

        $movs = $this->kardexRepo->getBySucursal($sucursalId, $productoId);
        Response::success($movs);
    }
}
