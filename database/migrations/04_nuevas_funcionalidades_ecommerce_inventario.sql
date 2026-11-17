-- =============================================================================
-- MIGRACIÓN 04: NUEVAS FUNCIONALIDADES DE E-COMMERCE E INVENTARIO - TIENDAS MASS
-- 1. Recojo en Tienda con validación de stock y fecha de recojo
-- 2. Flujo Post-Pago (Guest Checkout vs Login), Boleta Electrónica y Seguimiento
-- 3. Trigger y Tabla de Alertas de Stock Bajo (<= 5 unidades)
-- 4. Módulo de Desmedro / Merma con auditoría de usuario y actualización de stock
-- 5. Gestión de Usuarios (Registro de Supervisores con Sucursal obligatoria)
-- =============================================================================

USE `tiendas_mass_db`;

-- -----------------------------------------------------------------------------
-- 1 y 2. ALTER TABLE `pedidos`: Campos para Recojo en Tienda y Flujo Post-Pago
-- -----------------------------------------------------------------------------
ALTER TABLE `pedidos`
  ADD COLUMN IF NOT EXISTS `fecha_recojo` DATE NULL AFTER `tipo_entrega`,
  ADD COLUMN IF NOT EXISTS `requiere_traslado` TINYINT(1) NOT NULL DEFAULT 0 AFTER `fecha_recojo`,
  ADD COLUMN IF NOT EXISTS `es_invitado` TINYINT(1) NOT NULL DEFAULT 0 AFTER `cliente_id`,
  ADD COLUMN IF NOT EXISTS `contacto_email` VARCHAR(150) NULL AFTER `es_invitado`,
  ADD COLUMN IF NOT EXISTS `contacto_telefono` VARCHAR(20) NULL AFTER `contacto_email`,
  ADD COLUMN IF NOT EXISTS `numero_boleta` VARCHAR(30) NULL AFTER `codigo_pedido`,
  ADD COLUMN IF NOT EXISTS `token_seguimiento` VARCHAR(64) NULL AFTER `numero_boleta`;

-- Tabla para registrar las notificaciones post-pago y envío de boletas electrónicas
CREATE TABLE IF NOT EXISTS `notificaciones_pedido` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `pedido_id` INT UNSIGNED NOT NULL,
  `tipo_cliente` ENUM('REGISTRADO', 'INVITADO') NOT NULL DEFAULT 'INVITADO',
  `email_destino` VARCHAR(150) NOT NULL,
  `telefono_destino` VARCHAR(20) NOT NULL,
  `numero_boleta` VARCHAR(30) NOT NULL,
  `enlace_seguimiento` VARCHAR(255) NOT NULL,
  `estado_envio` ENUM('ENVIADO', 'ERROR') NOT NULL DEFAULT 'ENVIADO',
  `payload_boleta` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notif_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. SISTEMA DE ALERTAS DE STOCK BAJO (<= 5 UNIDADES) + TRIGGERS AUTOMÁTICOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `alertas_stock_bajo` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `stock_actual` INT NOT NULL,
  `umbral_alerta` INT NOT NULL DEFAULT 5,
  `nivel` ENUM('CRITICO', 'AGOTADO') NOT NULL DEFAULT 'CRITICO',
  `mensaje` VARCHAR(255) NOT NULL,
  `resuelta` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_alerta_stock_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_alerta_stock_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY `uk_alerta_sucursal_producto` (`sucursal_id`, `producto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS `trg_alerta_stock_bajo_update`;
DELIMITER $$
CREATE TRIGGER `trg_alerta_stock_bajo_update`
AFTER UPDATE ON `inventarios`
FOR EACH ROW
BEGIN
  IF NEW.stock_actual <= 5 THEN
    INSERT INTO `alertas_stock_bajo` (`sucursal_id`, `producto_id`, `stock_actual`, `umbral_alerta`, `nivel`, `mensaje`, `resuelta`)
    VALUES (
      NEW.sucursal_id,
      NEW.producto_id,
      NEW.stock_actual,
      5,
      IF(NEW.stock_actual = 0, 'AGOTADO', 'CRITICO'),
      CONCAT('¡Alerta de Stock Bajo! El producto ID ', NEW.producto_id, ' tiene ', NEW.stock_actual, ' unidades en la sucursal ID ', NEW.sucursal_id, ' (Umbral <= 5).'),
      0
    )
    ON DUPLICATE KEY UPDATE
      `stock_actual` = NEW.stock_actual,
      `nivel` = IF(NEW.stock_actual = 0, 'AGOTADO', 'CRITICO'),
      `mensaje` = CONCAT('¡Alerta de Stock Bajo! El producto ID ', NEW.producto_id, ' tiene ', NEW.stock_actual, ' unidades en la sucursal ID ', NEW.sucursal_id, ' (Umbral <= 5).'),
      `resuelta` = 0,
      `updated_at` = CURRENT_TIMESTAMP;
  ELSE
    UPDATE `alertas_stock_bajo`
    SET `stock_actual` = NEW.stock_actual,
        `resuelta` = 1,
        `updated_at` = CURRENT_TIMESTAMP
    WHERE `sucursal_id` = NEW.sucursal_id AND `producto_id` = NEW.producto_id;
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_alerta_stock_bajo_insert`;
DELIMITER $$
CREATE TRIGGER `trg_alerta_stock_bajo_insert`
AFTER INSERT ON `inventarios`
FOR EACH ROW
BEGIN
  IF NEW.stock_actual <= 5 THEN
    INSERT INTO `alertas_stock_bajo` (`sucursal_id`, `producto_id`, `stock_actual`, `umbral_alerta`, `nivel`, `mensaje`, `resuelta`)
    VALUES (
      NEW.sucursal_id,
      NEW.producto_id,
      NEW.stock_actual,
      5,
      IF(NEW.stock_actual = 0, 'AGOTADO', 'CRITICO'),
      CONCAT('¡Alerta de Stock Bajo! El producto ID ', NEW.producto_id, ' inició con ', NEW.stock_actual, ' unidades en la sucursal ID ', NEW.sucursal_id, ' (Umbral <= 5).'),
      0
    )
    ON DUPLICATE KEY UPDATE
      `stock_actual` = NEW.stock_actual,
      `resuelta` = 0,
      `updated_at` = CURRENT_TIMESTAMP;
  END IF;
END$$
DELIMITER ;

-- -----------------------------------------------------------------------------
-- 4. MÓDULO DE DESMEDRO O MERMA (TABLA DE AUDITORÍA DETALLADA)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `desmedros_mermas` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `lote_id` INT UNSIGNED NULL,
  `usuario_id` INT UNSIGNED NOT NULL,
  `cantidad` INT NOT NULL,
  `costo_unitario` DECIMAL(10, 2) NOT NULL,
  `perdida_total` DECIMAL(10, 2) GENERATED ALWAYS AS (`cantidad` * `costo_unitario`) STORED,
  `motivo` ENUM('VENCIMIENTO_CADUCIDAD', 'DANO_FISICO_ROTURA', 'DETERIORO_ALMACEN', 'FALLA_CADENA_FRIO', 'ROBO_EXTRAVIO', 'OTRO') NOT NULL DEFAULT 'DETERIORO_ALMACEN',
  `observaciones` TEXT NULL,
  `stock_anterior` INT NOT NULL,
  `stock_final` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_merma_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_merma_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_merma_lote` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_merma_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `chk_merma_cantidad_positiva` CHECK (`cantidad` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. GESTIÓN DE USUARIOS: TRIGGER PARA GARANTIZAR SUCURSAL OBLIGATORIA EN SUPERVISOR
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_validar_supervisor_sucursal_ins`;
DELIMITER $$
CREATE TRIGGER `trg_validar_supervisor_sucursal_ins`
BEFORE INSERT ON `usuarios`
FOR EACH ROW
BEGIN
  IF NEW.rol_id = 2 AND (NEW.sucursal_id IS NULL OR NEW.sucursal_id = 0) THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Error de negocio: Todo usuario con rol de Supervisor debe tener asignada obligatoriamente una Sucursal.';
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_validar_supervisor_sucursal_upd`;
DELIMITER $$
CREATE TRIGGER `trg_validar_supervisor_sucursal_upd`
BEFORE UPDATE ON `usuarios`
FOR EACH ROW
BEGIN
  IF NEW.rol_id = 2 AND (NEW.sucursal_id IS NULL OR NEW.sucursal_id = 0) THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Error de negocio: Todo usuario con rol de Supervisor debe tener asignada obligatoriamente una Sucursal.';
  END IF;
END$$
DELIMITER ;
