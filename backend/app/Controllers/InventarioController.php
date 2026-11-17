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
use App\Helpers\Database;
use App\Helpers\Response;
use App\Helpers\Validator;
use PDO;
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

            $inv = $this->invRepo->getOne($sucursalId, (int)$input['producto_id']);
            $saldoAnt = $inv ? (int)$inv['stock_actual'] : 0;
            $saldoNuevo = $saldoAnt + (int)$input['cantidad'];

            $db = Database::getConnection();
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

            Response::success(['lote_id' => $loteId, 'stock_final' => $saldoNuevo], 'Lote y compra registrados exitosamente en almacén y Kardex.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * POST /api/inventarios/mermas
     * REQUERIMIENTO 4: Módulo de Desmedro o Merma.
     * Registra la merma, pérdida o desmedro de productos:
     * - Selecciona producto, cantidad a dar de baja, sucursal, motivo del desmedro
     * - Registra el usuario autenticado que realiza la acción
     * - Actualiza el stock final (en lotes PEPS e inventario consolidado)
     * - Dispara alerta automática si el stock resultante llega a <= 5 unidades
     */
    public function registrarMerma(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($input, [
            'sucursal_id' => 'required|numeric',
            'producto_id' => 'required|numeric',
            'cantidad'    => 'required|positive',
            'motivo'      => 'required'
        ]);

        if ($validator->fails()) {
            Response::error('Debe seleccionar producto, sucursal, cantidad a dar de baja y motivo del desmedro.', 422, $validator->getErrors());
        }

        $user = JwtAuthMiddleware::getUser() ?? $GLOBALS['auth_user'] ?? null;
        if (!$user) {
            Response::error('Usuario no autenticado.', 401);
        }

        $usuarioId = (int)($user['sub'] ?? $user['id'] ?? 1);
        $sucursalId = (int)$input['sucursal_id'];

        // Si es Supervisor, obligar su propia sucursal asignada
        if (($user['rol_nombre'] ?? '') === 'Supervisor') {
            $sucursalId = (int)$user['sucursal_id'];
        }
        RoleMiddleware::validateBranchAccess($sucursalId);

        $productoId = (int)$input['producto_id'];
        $cantidadBaja = (int)$input['cantidad'];
        $motivo = trim($input['motivo']);
        $observacionesExtra = trim($input['observaciones'] ?? '');

        if ($cantidadBaja <= 0) {
            Response::error('La cantidad a dar de baja debe ser mayor a 0.', 422);
        }

        $db = Database::getConnection();

        // Garantizar tabla desmedros_mermas por seguridad
        try {
            $db->exec("
                CREATE TABLE IF NOT EXISTS `desmedros_mermas` (
                  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                  `sucursal_id` INT UNSIGNED NOT NULL,
                  `producto_id` INT UNSIGNED NOT NULL,
                  `lote_id` INT UNSIGNED NULL,
                  `usuario_id` INT UNSIGNED NOT NULL,
                  `cantidad` INT NOT NULL,
                  `costo_unitario` DECIMAL(10, 2) NOT NULL,
                  `perdida_total` DECIMAL(10, 2) GENERATED ALWAYS AS (`cantidad` * `costo_unitario`) STORED,
                  `motivo` VARCHAR(60) NOT NULL DEFAULT 'DETERIORO_ALMACEN',
                  `observaciones` TEXT NULL,
                  `stock_anterior` INT NOT NULL,
                  `stock_final` INT NOT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
        } catch (Exception $e) {}

        $db->beginTransaction();

        try {
            // 1. Bloquear y consultar inventario actual del producto en la sucursal
            $stmtInv = $db->prepare("
                SELECT i.id, i.stock_actual, p.nombre AS producto_nombre, p.codigo_sku, p.costo_base, s.nombre AS sucursal_nombre
                FROM inventarios i
                JOIN productos p ON i.producto_id = p.id
                JOIN sucursales s ON i.sucursal_id = s.id
                WHERE i.sucursal_id = :suc AND i.producto_id = :prod
                FOR UPDATE
            ");
            $stmtInv->execute([':suc' => $sucursalId, ':prod' => $productoId]);
            $invRow = $stmtInv->fetch(PDO::FETCH_ASSOC);

            if (!$invRow) {
                throw new Exception("El producto seleccionado no posee registro de inventario en esta sucursal.");
            }

            $stockAnterior = (int)$invRow['stock_actual'];
            if ($stockAnterior < $cantidadBaja) {
                throw new Exception("Stock insuficiente para dar de baja. Stock actual en sucursal: {$stockAnterior} unidades, Cantidad solicitada: {$cantidadBaja} unidades.");
            }

            // 2. Descontar de los lotes activos aplicando PEPS (o lote específico si aplica)
            $loteIdPrincipal = !empty($input['lote_id']) ? (int)$input['lote_id'] : null;
            $costoUnitario = (float)$invRow['costo_base'];

            try {
                $lotesDescontados = $this->fifoService->allocateFifoLots($sucursalId, $productoId, $cantidadBaja);
                if (!empty($lotesDescontados)) {
                    $loteIdPrincipal = (int)$lotesDescontados[0]['lote_id'];
                    $costoUnitario = (float)$lotesDescontados[0]['costo_unitario'];
                }
            } catch (Exception $loteEx) {
                // Si el stock consolidado era mayor que la suma en lotes, ajustar lotes disponibles a 0
                $stmtZeroLotes = $db->prepare("UPDATE lotes SET cantidad_disponible = 0, estado = 'AGOTADO' WHERE sucursal_id = :suc AND producto_id = :prod AND estado = 'DISPONIBLE'");
                $stmtZeroLotes->execute([':suc' => $sucursalId, ':prod' => $productoId]);
            }

            // 3. Actualizar el stock final en la tabla inventarios
            $stockFinal = $stockAnterior - $cantidadBaja;
            $stmtUpdStock = $db->prepare("
                UPDATE inventarios
                SET stock_actual = :nuevo_stock, updated_at = NOW()
                WHERE sucursal_id = :suc AND producto_id = :prod
            ");
            $stmtUpdStock->execute([
                ':nuevo_stock' => $stockFinal,
                ':suc'         => $sucursalId,
                ':prod'        => $productoId
            ]);

            // 4. Registrar en Kardex (movimientos_inventario) con el usuario que realiza la acción
            $docRef = 'MERMA-' . date('Ym') . '-' . strtoupper(bin2hex(random_bytes(2)));
            $obsCompleta = "Motivo: {$motivo}" . ($observacionesExtra ? " | Detalle: {$observacionesExtra}" : "") . " | Registrado por: {$user['nombres']} {$user['apellidos']} ({$user['rol_nombre']})";

            $kardexId = $this->kardexRepo->registerManualAdjustment([
                'sucursal_id'          => $sucursalId,
                'producto_id'          => $productoId,
                'lote_id'              => $loteIdPrincipal,
                'usuario_id'           => $usuarioId,
                'tipo_movimiento'      => 'AJUSTE_MERMA',
                'documento_referencia' => $docRef,
                'cantidad'             => $cantidadBaja,
                'costo_unitario'       => $costoUnitario,
                'saldo_anterior'       => $stockAnterior,
                'saldo_nuevo'          => $stockFinal,
                'observaciones'        => $obsCompleta
            ]);

            // 5. Registrar en la tabla de auditoría desmedros_mermas
            $stmtMerma = $db->prepare("
                INSERT INTO desmedros_mermas
                (sucursal_id, producto_id, lote_id, usuario_id, cantidad, costo_unitario, motivo, observaciones, stock_anterior, stock_final)
                VALUES (:suc, :prod, :lote, :usr, :cant, :costo, :motivo, :obs, :ant, :fin)
            ");
            $stmtMerma->execute([
                ':suc'    => $sucursalId,
                ':prod'   => $productoId,
                ':lote'   => $loteIdPrincipal,
                ':usr'    => $usuarioId,
                ':cant'   => $cantidadBaja,
                ':costo'  => $costoUnitario,
                ':motivo' => $motivo,
                ':obs'    => $observacionesExtra ?: $obsCompleta,
                ':ant'    => $stockAnterior,
                ':fin'    => $stockFinal
            ]);
            $mermaId = (int)$db->lastInsertId();

            // 6. Verificar si el stock final llegó a <= 5 unidades para disparar la Alerta de Stock Bajo (Requerimiento 3)
            $alertaStockBajo = null;
            if ($stockFinal <= 5) {
                $alertaData = $this->reorderService->getLowStockAlerts($sucursalId, 5);
                $alertaStockBajo = [
                    'disparada'    => true,
                    'stock_actual' => $stockFinal,
                    'mensaje'      => "¡ALERTA DE STOCK BAJO! El producto '{$invRow['producto_nombre']}' quedó con {$stockFinal} unidades en {$invRow['sucursal_nombre']} (Umbral <= 5)."
                ];
            }

            $db->commit();

            Response::success([
                'merma_id'             => $mermaId,
                'kardex_id'            => $kardexId,
                'documento_referencia' => $docRef,
                'sucursal_id'          => $sucursalId,
                'sucursal_nombre'      => $invRow['sucursal_nombre'],
                'producto_id'          => $productoId,
                'producto_nombre'      => $invRow['producto_nombre'],
                'codigo_sku'           => $invRow['codigo_sku'],
                'cantidad_baja'        => $cantidadBaja,
                'costo_unitario'       => $costoUnitario,
                'perdida_total_soles'  => round($cantidadBaja * $costoUnitario, 2),
                'motivo'               => $motivo,
                'observaciones'        => $obsCompleta,
                'usuario_id'           => $usuarioId,
                'usuario_nombre'       => ($user['nombres'] ?? '') . ' ' . ($user['apellidos'] ?? ''),
                'usuario_rol'          => $user['rol_nombre'] ?? '',
                'stock_anterior'       => $stockAnterior,
                'stock_final'          => $stockFinal,
                'alerta_stock_bajo'    => $alertaStockBajo
            ], "Desmedro/Merma registrado correctamente. Stock actualizado de {$stockAnterior} a {$stockFinal} unidades.", 201);

        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * GET /api/inventarios/low-stock-alerts?sucursal_id=1
     * REQUERIMIENTO 3: Obtiene las alertas de productos cuyo stock es <= 5 unidades
     */
    public function lowStockAlerts(): void {
        $user = JwtAuthMiddleware::getUser() ?? $GLOBALS['auth_user'] ?? null;
        $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;

        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            $sucursalId = (int)$user['sucursal_id'];
        }

        if ($sucursalId) {
            RoleMiddleware::validateBranchAccess($sucursalId);
        }

        $data = $this->reorderService->getLowStockAlerts($sucursalId, 5);
        Response::success($data);
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
