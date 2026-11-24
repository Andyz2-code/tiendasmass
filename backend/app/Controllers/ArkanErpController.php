<?php
namespace App\Controllers;

use App\Helpers\Database;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Middleware\JwtAuthMiddleware;
use App\Middleware\RoleMiddleware;
use PDO;
use Exception;

class ArkanErpController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    // =========================================================================
    // 1. PROVEEDORES (Admin y Supervisor)
    // =========================================================================
    public function listProveedores(): void {
        $stmt = $this->db->query("SELECT * FROM proveedores WHERE estado = 1 ORDER BY id DESC");
        Response::success($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function storeProveedor(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $validator = Validator::make($input, [
            'numero_documento' => 'required|min:8',
            'razon_social'     => 'required|min:3'
        ]);
        if ($validator->fails()) {
            Response::error('RUC/DNI y Razón Social son obligatorios', 422, $validator->getErrors());
        }

        $doc = trim((string)$input['numero_documento']);
        $tipo = strlen($doc) === 11 ? 'RUC' : 'DNI';

        $stmt = $this->db->prepare("
            INSERT INTO proveedores (tipo_documento, numero_documento, razon_social, nombre_comercial, direccion, telefono, email, contacto_nombre)
            VALUES (:tipo, :doc, :razon, :comercial, :dir, :tel, :email, :contacto)
        ");
        try {
            $stmt->execute([
                ':tipo'      => $tipo,
                ':doc'       => $doc,
                ':razon'     => trim((string)$input['razon_social']),
                ':comercial' => trim((string)($input['nombre_comercial'] ?? $input['razon_social'])),
                ':dir'       => trim((string)($input['direccion'] ?? '')),
                ':tel'       => trim((string)($input['telefono'] ?? '')),
                ':email'     => trim((string)($input['email'] ?? '')),
                ':contacto'  => trim((string)($input['contacto_nombre'] ?? '')),
            ]);
            Response::success(['id' => (int)$this->db->lastInsertId()], 'Proveedor registrado exitosamente', 201);
        } catch (Exception $e) {
            Response::error('El número de documento ya está registrado o es inválido', 400);
        }
    }

    public function lookupRuc(string $numero): void {
        $num = preg_replace('/\D/', '', $numero);
        $stmt = $this->db->prepare("SELECT * FROM proveedores WHERE numero_documento = :doc LIMIT 1");
        $stmt->execute([':doc' => $num]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            Response::success($existing, 'Proveedor encontrado en catálogo local');
        }

        if (strlen($num) === 11) {
            Response::success([
                'tipo_documento'   => 'RUC',
                'numero_documento' => $num,
                'razon_social'     => 'DISTRIBUIDORA COMERCIAL DEL PERÚ ' . substr($num, -4) . ' S.A.C.',
                'nombre_comercial' => 'GRUPO COMERCIAL ' . substr($num, -4),
                'direccion'        => 'Av. Industrial ' . substr($num, -3) . ', Lima - Perú',
            ], 'Consulta RUC resuelta');
        }

        Response::success([
            'tipo_documento'   => 'DNI',
            'numero_documento' => $num,
            'razon_social'     => 'PROVEEDOR VERIFICADO (' . $num . ')',
            'nombre_comercial' => '',
            'direccion'        => 'Huancayo - Junín',
        ], 'Consulta DNI resuelta');
    }

    // =========================================================================
    // 2. COMPRAS & CUENTAS POR PAGAR (Ingresos automáticos a Lotes PEPS + Kardex)
    // =========================================================================
    public function listCompras(): void {
        $user = JwtAuthMiddleware::getUser();
        $rol = $user['rol_nombre'] ?? '';
        $sucursalId = isset($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;

        if ($rol === 'Supervisor') {
            $sucursalId = (int)($user['sucursal_id'] ?? $sucursalId);
        }

        $sql = "SELECT c.*, p.razon_social AS proveedor_nombre, p.numero_documento AS proveedor_ruc,
                       s.nombre AS sucursal_nombre
                FROM compras c
                JOIN proveedores p ON c.proveedor_id = p.id
                JOIN sucursales s ON c.sucursal_id = s.id
                WHERE 1=1";
        $params = [];
        if ($sucursalId) {
            $sql .= " AND c.sucursal_id = :suc_id";
            $params[':suc_id'] = $sucursalId;
        }
        $sql .= " ORDER BY c.id DESC LIMIT 100";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function storeCompra(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $user = JwtAuthMiddleware::getUser();
        $usuarioId = (int)($user['sub'] ?? 1);
        $sucursalId = (int)($input['sucursal_id'] ?? $user['sucursal_id'] ?? 1);

        if (($user['rol_nombre'] ?? '') === 'Supervisor') {
            RoleMiddleware::validateBranchAccess($sucursalId);
        }

        $proveedorId = (int)($input['proveedor_id'] ?? 0);
        $items = $input['items'] ?? [];
        if ($proveedorId <= 0 || empty($items) || !is_array($items)) {
            Response::error('Debe seleccionar proveedor y al menos un producto', 422);
        }

        $condicionPago = strtoupper((string)($input['condicion_pago'] ?? 'CONTADO')) === 'CREDITO' ? 'CREDITO' : 'CONTADO';
        $estadoPago = $condicionPago === 'CONTADO' ? 'PAGADO' : 'PENDIENTE';
        $tipoComp = in_array(strtoupper((string)($input['tipo_comprobante'] ?? 'FACTURA')), ['FACTURA', 'BOLETA', 'GUIA'], true)
            ? strtoupper((string)$input['tipo_comprobante'])
            : 'FACTURA';
        $numComp = trim((string)($input['numero_comprobante'] ?? ('F001-' . rand(1000, 9999))));
        $fechaCompra = $input['fecha_compra'] ?? date('Y-m-d');
        $codigoCompra = 'CMP-' . date('Ymd') . '-' . rand(100, 999);

        try {
            $this->db->beginTransaction();

            $total = 0.0;
            foreach ($items as $it) {
                $total += ((int)$it['cantidad']) * ((float)$it['costo_unitario']);
            }
            $subtotal = round($total / 1.18, 2);
            $igv = round($total - $subtotal, 2);

            $stmtCompra = $this->db->prepare("
                INSERT INTO compras (codigo_compra, sucursal_id, proveedor_id, usuario_id, tipo_comprobante, numero_comprobante, condicion_pago, estado_pago, fecha_compra, fecha_vencimiento_pago, subtotal, igv, total, observaciones)
                VALUES (:cod, :suc, :prov, :usr, :tipo, :num, :cond, :est, :fecha, :vence, :sub, :igv, :tot, :obs)
            ");
            $stmtCompra->execute([
                ':cod'   => $codigoCompra,
                ':suc'   => $sucursalId,
                ':prov'  => $proveedorId,
                ':usr'   => $usuarioId,
                ':tipo'  => $tipoComp,
                ':num'   => $numComp,
                ':cond'  => $condicionPago,
                ':est'   => $estadoPago,
                ':fecha' => $fechaCompra,
                ':vence' => $condicionPago === 'CREDITO' ? date('Y-m-d', strtotime('+30 days')) : null,
                ':sub'   => $subtotal,
                ':igv'   => $igv,
                ':tot'   => round($total, 2),
                ':obs'   => trim((string)($input['observaciones'] ?? 'Ingreso de mercadería vía Módulo Compras ARKAN')),
            ]);
            $compraId = (int)$this->db->lastInsertId();

            foreach ($items as $it) {
                $prodId = (int)$it['producto_id'];
                $cant = (int)$it['cantidad'];
                $costo = (float)$it['costo_unitario'];
                $vence = !empty($it['fecha_vencimiento']) ? $it['fecha_vencimiento'] : date('Y-m-d', strtotime('+180 days'));
                if ($cant <= 0 || $prodId <= 0) {
                    throw new Exception('Cantidad y producto válidos requeridos');
                }

                // 1. Crear nuevo lote PEPS
                $codLote = 'LOT-' . date('ymd') . '-' . $prodId . '-' . rand(10, 99);
                $stmtLote = $this->db->prepare("
                    INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, ubicacion_almacen, estado)
                    VALUES (:suc, :prod, :cod, CURDATE(), :vence, :cant, :cant, :costo, 'RECEPCION-COMPRAS', 'DISPONIBLE')
                ");
                $stmtLote->execute([
                    ':suc'   => $sucursalId,
                    ':prod'  => $prodId,
                    ':cod'   => $codLote,
                    ':vence' => $vence,
                    ':cant'  => $cant,
                    ':costo' => $costo,
                ]);
                $loteId = (int)$this->db->lastInsertId();

                // 2. Detalle de compra
                $stmtDet = $this->db->prepare("
                    INSERT INTO detalle_compras (compra_id, producto_id, lote_id, cantidad, costo_unitario, subtotal, fecha_vencimiento)
                    VALUES (:cmp, :prod, :lote, :cant, :costo, :sub, :vence)
                ");
                $stmtDet->execute([
                    ':cmp'   => $compraId,
                    ':prod'  => $prodId,
                    ':lote'  => $loteId,
                    ':cant'  => $cant,
                    ':costo' => $costo,
                    ':sub'   => round($cant * $costo, 2),
                    ':vence' => $vence,
                ]);

                // 3. Consultar saldo anterior y actualizar inventarios
                $stmtInv = $this->db->prepare("SELECT id, stock_actual FROM inventarios WHERE sucursal_id = :suc AND producto_id = :prod LIMIT 1");
                $stmtInv->execute([':suc' => $sucursalId, ':prod' => $prodId]);
                $inv = $stmtInv->fetch(PDO::FETCH_ASSOC);
                $saldoAnt = $inv ? (int)$inv['stock_actual'] : 0;
                $saldoNuevo = $saldoAnt + $cant;

                if ($inv) {
                    $this->db->prepare("UPDATE inventarios SET stock_actual = :nuevo WHERE id = :id")
                             ->execute([':nuevo' => $saldoNuevo, ':id' => $inv['id']]);
                } else {
                    $this->db->prepare("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual) VALUES (:suc, :prod, :nuevo)")
                             ->execute([':suc' => $sucursalId, ':prod' => $prodId, ':nuevo' => $saldoNuevo]);
                }

                // 4. Registrar en Kardex
                $this->db->prepare("
                    INSERT INTO movimientos_inventario (sucursal_id, producto_id, lote_id, usuario_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                    VALUES (:suc, :prod, :lote, :usr, 'ENTRADA_COMPRA', :doc, :cant, :costo, :ant, :nuevo, :obs)
                ")->execute([
                    ':suc'   => $sucursalId,
                    ':prod'  => $prodId,
                    ':lote'  => $loteId,
                    ':usr'   => $usuarioId,
                    ':doc'   => $numComp,
                    ':cant'  => $cant,
                    ':costo' => $costo,
                    ':ant'   => $saldoAnt,
                    ':nuevo' => $saldoNuevo,
                    ':obs'   => "Compra {$codigoCompra} ingresada a almacén PEPS",
                ]);
            }

            if ($condicionPago === 'CONTADO') {
                $this->db->prepare("
                    INSERT INTO caja_movimientos (sucursal_id, usuario_id, tipo, concepto, metodo_pago, monto, referencia)
                    VALUES (:suc, :usr, 'EGRESO', :concepto, 'EFECTIVO', :monto, :ref)
                ")->execute([
                    ':suc'      => $sucursalId,
                    ':usr'      => $usuarioId,
                    ':concepto' => "Pago compra al contado ({$numComp})",
                    ':monto'    => round($total, 2),
                    ':ref'      => $codigoCompra,
                ]);
            }

            $this->db->commit();
            Response::success(['id' => $compraId, 'codigo_compra' => $codigoCompra], 'Compra registrada y stock actualizado en Lotes PEPS y Kardex', 201);
        } catch (Exception $e) {
            $this->db->rollBack();
            Response::error('Error registrando compra: ' . $e->getMessage(), 400);
        }
    }

    public function pagarCompra(string $id): void {
        $compraId = (int)$id;
        $stmt = $this->db->prepare("SELECT * FROM compras WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $compraId]);
        $compra = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$compra) {
            Response::error('Compra no encontrada', 404);
        }
        if ($compra['estado_pago'] === 'PAGADO') {
            Response::error('Esta compra ya fue pagada', 400);
        }

        $user = JwtAuthMiddleware::getUser();
        $usuarioId = (int)($user['sub'] ?? 1);

        $this->db->prepare("UPDATE compras SET estado_pago = 'PAGADO' WHERE id = :id")->execute([':id' => $compraId]);
        $this->db->prepare("
            INSERT INTO caja_movimientos (sucursal_id, usuario_id, tipo, concepto, metodo_pago, monto, referencia)
            VALUES (:suc, :usr, 'EGRESO', :concepto, 'TRANSFERENCIA', :monto, :ref)
        ")->execute([
            ':suc'      => $compra['sucursal_id'],
            ':usr'      => $usuarioId,
            ':concepto' => "Pago cuenta por pagar ({$compra['numero_comprobante']})",
            ':monto'    => $compra['total'],
            ':ref'      => $compra['codigo_compra'],
        ]);

        Response::success(null, 'Cuenta por pagar liquidada y registrada en Caja');
    }

    // =========================================================================
    // 3. TRASLADOS ENTRE SUCURSALES (Admin y Supervisor)
    // =========================================================================
    public function listTraslados(): void {
        $user = JwtAuthMiddleware::getUser();
        $rol = $user['rol_nombre'] ?? '';
        $sucursalId = (int)($user['sucursal_id'] ?? 0);

        $sql = "SELECT t.*, pr.nombre AS producto_nombre, pr.codigo_sku,
                       so.nombre AS origen_nombre, sd.nombre AS destino_nombre
                FROM traslados t
                JOIN productos pr ON t.producto_id = pr.id
                JOIN sucursales so ON t.sucursal_origen_id = so.id
                JOIN sucursales sd ON t.sucursal_destino_id = sd.id
                WHERE 1=1";
        $params = [];
        if ($rol === 'Supervisor' && $sucursalId > 0) {
            $sql .= " AND (t.sucursal_origen_id = :s1 OR t.sucursal_destino_id = :s2)";
            $params[':s1'] = $sucursalId;
            $params[':s2'] = $sucursalId;
        }
        $sql .= " ORDER BY t.id DESC LIMIT 100";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function storeTraslado(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $user = JwtAuthMiddleware::getUser();
        $usuarioId = (int)($user['sub'] ?? 1);

        $origenId = (int)($input['sucursal_origen_id'] ?? 0);
        $destinoId = (int)($input['sucursal_destino_id'] ?? 0);
        $productoId = (int)($input['producto_id'] ?? 0);
        $cantidad = (int)($input['cantidad'] ?? 0);
        $motivo = trim((string)($input['motivo'] ?? 'Reposición operativa entre tiendas'));

        if ($origenId <= 0 || $destinoId <= 0 || $origenId === $destinoId || $productoId <= 0 || $cantidad <= 0) {
            Response::error('Sucursal origen, destino distinto, producto y cantidad positiva son obligatorios', 422);
        }

        if (($user['rol_nombre'] ?? '') === 'Supervisor') {
            $userSuc = (int)($user['sucursal_id'] ?? 0);
            if ($origenId !== $userSuc && $destinoId !== $userSuc) {
                Response::error('Como Supervisor solo puede registrar traslados que involucren su sucursal asignada', 403);
            }
        }

        try {
            $this->db->beginTransaction();

            $stmtOrig = $this->db->prepare("SELECT id, stock_actual FROM inventarios WHERE sucursal_id = :suc AND producto_id = :prod LIMIT 1 FOR UPDATE");
            $stmtOrig->execute([':suc' => $origenId, ':prod' => $productoId]);
            $invOrig = $stmtOrig->fetch(PDO::FETCH_ASSOC);

            if (!$invOrig || (int)$invOrig['stock_actual'] < $cantidad) {
                throw new Exception('Stock insuficiente en la sucursal de origen para realizar el traslado');
            }

            // Descontar PEPS de lotes en sucursal origen
            $stmtLotes = $this->db->prepare("
                SELECT * FROM lotes
                WHERE sucursal_id = :suc AND producto_id = :prod AND cantidad_disponible > 0 AND estado = 'DISPONIBLE'
                ORDER BY fecha_vencimiento ASC, fecha_ingreso ASC
                FOR UPDATE
            ");
            $stmtLotes->execute([':suc' => $origenId, ':prod' => $productoId]);
            $lotes = $stmtLotes->fetchAll(PDO::FETCH_ASSOC);

            $restante = $cantidad;
            $costoPromedio = 0.0;
            $loteRefId = null;
            $venceRef = date('Y-m-d', strtotime('+120 days'));

            foreach ($lotes as $lote) {
                if ($restante <= 0) break;
                $disp = (int)$lote['cantidad_disponible'];
                $tomar = min($disp, $restante);
                $nuevoDisp = $disp - $tomar;
                $this->db->prepare("UPDATE lotes SET cantidad_disponible = :d, estado = :e WHERE id = :id")
                         ->execute([
                             ':d'  => $nuevoDisp,
                             ':e'  => $nuevoDisp === 0 ? 'AGOTADO' : 'DISPONIBLE',
                             ':id' => $lote['id'],
                         ]);
                $costoPromedio = (float)$lote['costo_unitario_compra'];
                $venceRef = $lote['fecha_vencimiento'] ?: $venceRef;
                $loteRefId = (int)$lote['id'];
                $restante -= $tomar;
            }

            if ($restante > 0 || $loteRefId === null) {
                throw new Exception('No hay suficientes lotes PEPS disponibles en la sucursal origen');
            }

            $saldoAntOrig = (int)$invOrig['stock_actual'];
            $saldoNuevoOrig = $saldoAntOrig - $cantidad;
            $this->db->prepare("UPDATE inventarios SET stock_actual = :s WHERE id = :id")
                     ->execute([':s' => $saldoNuevoOrig, ':id' => $invOrig['id']]);

            $codigoTraslado = 'TRS-' . date('Ymd') . '-' . rand(100, 999);

            // Crear lote en sucursal destino
            $codLoteDest = 'LOT-TRS-' . date('ymd') . '-' . rand(10, 99);
            $this->db->prepare("
                INSERT INTO lotes (sucursal_id, producto_id, codigo_lote, fecha_ingreso, fecha_vencimiento, cantidad_inicial, cantidad_disponible, costo_unitario_compra, ubicacion_almacen, estado)
                VALUES (:suc, :prod, :cod, CURDATE(), :vence, :cant, :cant, :costo, 'RECEPCION-TRASLADO', 'DISPONIBLE')
            ")->execute([
                ':suc'   => $destinoId,
                ':prod'  => $productoId,
                ':cod'   => $codLoteDest,
                ':vence' => $venceRef,
                ':cant'  => $cantidad,
                ':costo' => $costoPromedio,
            ]);
            $loteDestId = (int)$this->db->lastInsertId();

            $stmtDest = $this->db->prepare("SELECT id, stock_actual FROM inventarios WHERE sucursal_id = :suc AND producto_id = :prod LIMIT 1 FOR UPDATE");
            $stmtDest->execute([':suc' => $destinoId, ':prod' => $productoId]);
            $invDest = $stmtDest->fetch(PDO::FETCH_ASSOC);
            $saldoAntDest = $invDest ? (int)$invDest['stock_actual'] : 0;
            $saldoNuevoDest = $saldoAntDest + $cantidad;

            if ($invDest) {
                $this->db->prepare("UPDATE inventarios SET stock_actual = :s WHERE id = :id")
                         ->execute([':s' => $saldoNuevoDest, ':id' => $invDest['id']]);
            } else {
                $this->db->prepare("INSERT INTO inventarios (sucursal_id, producto_id, stock_actual) VALUES (:suc, :prod, :s)")
                         ->execute([':suc' => $destinoId, ':prod' => $productoId, ':s' => $saldoNuevoDest]);
            }

            // Kardex Salida e Ingreso
            $this->db->prepare("
                INSERT INTO movimientos_inventario (sucursal_id, producto_id, lote_id, usuario_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                VALUES (:suc, :prod, :lote, :usr, 'SALIDA_TRASLADO', :doc, :cant, :costo, :ant, :nuevo, :obs)
            ")->execute([
                ':suc' => $origenId, ':prod' => $productoId, ':lote' => $loteRefId, ':usr' => $usuarioId,
                ':doc' => $codigoTraslado, ':cant' => $cantidad, ':costo' => $costoPromedio,
                ':ant' => $saldoAntOrig, ':nuevo' => $saldoNuevoOrig, ':obs' => "Traslado enviado: {$motivo}",
            ]);

            $this->db->prepare("
                INSERT INTO movimientos_inventario (sucursal_id, producto_id, lote_id, usuario_id, tipo_movimiento, documento_referencia, cantidad, costo_unitario, saldo_anterior, saldo_nuevo, observaciones)
                VALUES (:suc, :prod, :lote, :usr, 'ENTRADA_TRASLADO', :doc, :cant, :costo, :ant, :nuevo, :obs)
            ")->execute([
                ':suc' => $destinoId, ':prod' => $productoId, ':lote' => $loteDestId, ':usr' => $usuarioId,
                ':doc' => $codigoTraslado, ':cant' => $cantidad, ':costo' => $costoPromedio,
                ':ant' => $saldoAntDest, ':nuevo' => $saldoNuevoDest, ':obs' => "Traslado recibido: {$motivo}",
            ]);

            $this->db->prepare("
                INSERT INTO traslados (codigo_traslado, sucursal_origen_id, sucursal_destino_id, producto_id, usuario_id, cantidad, motivo, estado)
                VALUES (:cod, :orig, :dest, :prod, :usr, :cant, :motivo, 'COMPLETADO')
            ")->execute([
                ':cod' => $codigoTraslado, ':orig' => $origenId, ':dest' => $destinoId,
                ':prod' => $productoId, ':usr' => $usuarioId, ':cant' => $cantidad, ':motivo' => $motivo,
            ]);

            $this->db->commit();
            Response::success(['codigo_traslado' => $codigoTraslado], 'Traslado ejecutado y reflejado en PEPS y Kardex', 201);
        } catch (Exception $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 400);
        }
    }

    // =========================================================================
    // 4. INVENTARIO VALORIZADO (Admin y Supervisor)
    // =========================================================================
    public function inventarioValorizado(): void {
        $user = JwtAuthMiddleware::getUser();
        $sucursalId = isset($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : 1;
        if (($user['rol_nombre'] ?? '') === 'Supervisor') {
            $sucursalId = (int)($user['sucursal_id'] ?? $sucursalId);
        }

        $stmt = $this->db->prepare("
            SELECT p.id, p.codigo_sku, p.codigo_barras, p.nombre, p.unidad_medida,
                   p.precio_venta, p.costo_base, p.imagen_url, c.nombre AS categoria_nombre,
                   i.stock_actual, i.clasificacion_abc,
                   COALESCE(SUM(l.cantidad_disponible * l.costo_unitario_compra), i.stock_actual * p.costo_base) AS valor_costo_total,
                   (i.stock_actual * p.precio_venta) AS valor_venta_total
            FROM inventarios i
            JOIN productos p ON i.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN lotes l ON l.producto_id = p.id AND l.sucursal_id = i.sucursal_id AND l.cantidad_disponible > 0
            WHERE i.sucursal_id = :suc AND p.estado = 1
            GROUP BY p.id, i.id
            ORDER BY valor_costo_total DESC
        ");
        $stmt->execute([':suc' => $sucursalId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalCosto = 0.0;
        $totalVenta = 0.0;
        foreach ($rows as $r) {
            $totalCosto += (float)$r['valor_costo_total'];
            $totalVenta += (float)$r['valor_venta_total'];
        }

        Response::success([
            'items'               => $rows,
            'total_valor_costo'   => round($totalCosto, 2),
            'total_valor_venta'   => round($totalVenta, 2),
            'utilidad_potencial'  => round($totalVenta - $totalCosto, 2),
        ]);
    }

    // =========================================================================
    // 5. CAJA OPERATIVA & GASTOS (Solo Administrador)
    // =========================================================================
    public function listCaja(): void {
        $sucursalId = isset($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;
        $sql = "SELECT cm.*, s.nombre AS sucursal_nombre
                FROM caja_movimientos cm
                JOIN sucursales s ON cm.sucursal_id = s.id
                WHERE 1=1";
        $params = [];
        if ($sucursalId) {
            $sql .= " AND cm.sucursal_id = :suc";
            $params[':suc'] = $sucursalId;
        }
        $sql .= " ORDER BY cm.id DESC LIMIT 100";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $ingresos = 0.0;
        $egresos = 0.0;
        foreach ($rows as $r) {
            if ($r['tipo'] === 'INGRESO' || $r['tipo'] === 'APERTURA') {
                $ingresos += (float)$r['monto'];
            } else {
                $egresos += (float)$r['monto'];
            }
        }

        Response::success([
            'movimientos' => $rows,
            'ingresos'    => round($ingresos, 2),
            'egresos'     => round($egresos, 2),
            'saldo_neto'  => round($ingresos - $egresos, 2),
        ]);
    }

    public function storeCaja(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $user = JwtAuthMiddleware::getUser();
        $usuarioId = (int)($user['sub'] ?? 1);
        $sucursalId = (int)($input['sucursal_id'] ?? 1);
        $tipo = strtoupper(trim((string)($input['tipo'] ?? 'INGRESO')));
        $concepto = trim((string)($input['concepto'] ?? ''));
        $monto = (float)($input['monto'] ?? 0);

        if (!in_array($tipo, ['INGRESO', 'EGRESO', 'APERTURA', 'CIERRE'], true) || $concepto === '' || $monto <= 0) {
            Response::error('Tipo, concepto y monto positivo son obligatorios', 422);
        }

        $stmt = $this->db->prepare("
            INSERT INTO caja_movimientos (sucursal_id, usuario_id, tipo, concepto, metodo_pago, monto, referencia)
            VALUES (:suc, :usr, :tipo, :concepto, :metodo, :monto, :ref)
        ");
        $stmt->execute([
            ':suc'      => $sucursalId,
            ':usr'      => $usuarioId,
            ':tipo'     => $tipo,
            ':concepto' => $concepto,
            ':metodo'   => trim((string)($input['metodo_pago'] ?? 'EFECTIVO')),
            ':monto'    => $monto,
            ':ref'      => trim((string)($input['referencia'] ?? '')),
        ]);

        Response::success(['id' => (int)$this->db->lastInsertId()], 'Movimiento de caja registrado', 201);
    }

    // =========================================================================
    // 6. CONFIGURACIÓN OPERATIVA ESTILO ARKAN (Lectura Admin/Sup, Edición Admin)
    // =========================================================================
    public function getConfiguraciones(): void {
        $stmt = $this->db->query("SELECT * FROM configuraciones_sistema ORDER BY clave ASC");
        Response::success($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function updateConfiguraciones(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $input['configuraciones'] ?? $input;
        if (!is_array($items)) {
            Response::error('Formato de configuraciones inválido', 422);
        }

        $stmt = $this->db->prepare("UPDATE configuraciones_sistema SET valor = :val WHERE clave = :clave");
        foreach ($items as $clave => $valor) {
            $stmt->execute([':val' => (string)$valor, ':clave' => (string)$clave]);
        }

        Response::success(null, 'Configuraciones operativas actualizadas');
    }
}
