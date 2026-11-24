-- =============================================================================
-- MIGRACIÓN 05: REGULARIZACIÓN DE STOCK, LOTES Y SINCRONIZACIÓN DE CATÁLOGO
-- TIENDAS MASS - AUDITORÍA Y CORRECCIÓN DE INCONSISTENCIAS DE INVENTARIO PEPS
-- =============================================================================

USE `tiendas_mass_db`;

-- 1. Regularización de Lotes Iniciales Faltantes para Productos 13 al 19
-- Se generan los lotes de apertura física basados en los stocks declarados en catálogo maestro
-- con fechas válidas, estanterías asignadas y kardex de ingreso inicial.

-- Producto 13: Huevos Rosados La Calera Granja x 15 un. (Perecedero: vence en 6 meses)
INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 1, 13, 'LOT-HUEV-261115', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 90 DAY), 35, 35, 9.20, 'ZONA-FRESCOS-1', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 13 AND `sucursal_id` = 1);

INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 2, 13, 'LOT-HUEV-SC01', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 90 DAY), 35, 35, 9.20, 'RACK-FRESCOS', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 13 AND `sucursal_id` = 2);

-- Producto 14: Mantequilla con Sal Laive Barra 200 g (Perecedero: vence en 6 meses)
INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 1, 14, 'LOT-MANT-261115', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 120 DAY), 35, 35, 5.80, 'CAMARA-FRIO-3', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 14 AND `sucursal_id` = 1);

INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 2, 14, 'LOT-MANT-SC01', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 120 DAY), 35, 35, 5.80, 'RACK-FRIO', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 14 AND `sucursal_id` = 2);

-- Producto 15: Café Tostado y Molido Altomayo Gourmet 250 g (No perecedero)
INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 1, 15, 'LOT-CAFE-261115', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 35, 35, 11.50, 'ESTANTE-A4', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 15 AND `sucursal_id` = 1);

INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 2, 15, 'LOT-CAFE-SC01', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 35, 35, 11.50, 'RACK-04', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 15 AND `sucursal_id` = 2);

-- Producto 16: Arroz Extra Grano Largo Mass Bolsa 5 kg (No perecedero)
INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 1, 16, 'LOT-MASS-261115', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 35, 35, 18.20, 'ESTANTE-A1', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 16 AND `sucursal_id` = 1);

INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 2, 16, 'LOT-MASS-SC01', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 35, 35, 18.20, 'RACK-01', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 16 AND `sucursal_id` = 2);

-- Producto 17: Lenteja Serrana Campo Mass 500 g (No perecedero)
INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 1, 17, 'LOT-LENT-261115', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 35, 35, 2.70, 'ESTANTE-A2', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 17 AND `sucursal_id` = 1);

INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 2, 17, 'LOT-LENT-SC01', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 35, 35, 2.70, 'RACK-02', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 17 AND `sucursal_id` = 2);

-- Producto 18: Gaseosa Coca Cola Sabor Original 1.5 L (No perecedero)
INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 1, 18, 'LOT-COCA-261115', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 180 DAY), 40, 40, 5.50, 'ESTANTE-D2', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 18 AND `sucursal_id` = 1);

INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 2, 18, 'LOT-COCA-SC01', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 180 DAY), 40, 40, 5.50, 'RACK-05', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 18 AND `sucursal_id` = 2);

-- Producto 19: Lavavajillas en Pasta Sapolio Limón 450 g (No perecedero)
INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 1, 19, 'LOT-SAPO-261115', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 40, 40, 2.80, 'ESTANTE-E2', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 19 AND `sucursal_id` = 1);

INSERT INTO `lotes` (`sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`)
SELECT 2, 19, 'LOT-SAPO-SC01', '2026-11-15', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 40, 40, 2.80, 'RACK-06', 'DISPONIBLE'
WHERE NOT EXISTS (SELECT 1 FROM `lotes` WHERE `producto_id` = 19 AND `sucursal_id` = 2);

-- 2. Asentar en Kardex Movimientos de Entrada de Regularización
INSERT INTO `movimientos_inventario` (`sucursal_id`, `producto_id`, `lote_id`, `tipo_movimiento`, `documento_referencia`, `cantidad`, `costo_unitario`, `saldo_anterior`, `saldo_nuevo`, `observaciones`)
SELECT l.sucursal_id, l.producto_id, l.id, 'ENTRADA_COMPRA', 'ALTA-INICIAL-REGULARIZACION', l.cantidad_disponible, l.costo_unitario_compra, 0, l.cantidad_disponible, 'Regularización de lote inicial para consistencia con catálogo'
FROM `lotes` l
WHERE l.producto_id BETWEEN 13 AND 19
  AND NOT EXISTS (
      SELECT 1 FROM `movimientos_inventario` m 
      WHERE m.lote_id = l.id AND m.documento_referencia = 'ALTA-INICIAL-REGULARIZACION'
  );

-- 3. Sincronización Estricta de inventarios.stock_actual con la Suma de Lotes Activos
UPDATE `inventarios` i
JOIN (
    SELECT producto_id, sucursal_id, SUM(cantidad_disponible) AS total_lotes
    FROM `lotes`
    WHERE `estado` = 'DISPONIBLE'
    GROUP BY producto_id, sucursal_id
) l ON l.producto_id = i.producto_id AND l.sucursal_id = i.sucursal_id
SET i.stock_actual = l.total_lotes;
