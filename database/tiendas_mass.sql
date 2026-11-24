-- =============================================================================
-- SISTEMA DE GESTIÓN COMERCIAL – TIENDAS MASS
-- SCRIPT DDL Y DATOS SEMILLA (MYSQL 8.0 / MARIADB / XAMPP)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `tiendas_mass_db` 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `tiendas_mass_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. TABLA: roles
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nombre` ENUM('Administrador', 'Supervisor') NOT NULL UNIQUE,
  `descripcion` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABLA: sucursales
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sucursales`;
CREATE TABLE `sucursales` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `codigo_tienda` VARCHAR(20) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `direccion` VARCHAR(255) NOT NULL,
  `ciudad` VARCHAR(100) NOT NULL DEFAULT 'Huancayo',
  `latitud` DECIMAL(10, 8) NOT NULL,
  `longitud` DECIMAL(11, 8) NOT NULL,
  `radio_cobertura_km` DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
  `costo_envio_base` DECIMAL(10, 2) NOT NULL DEFAULT 4.00,
  `costo_km_adicional` DECIMAL(10, 2) NOT NULL DEFAULT 1.50,
  `telefono` VARCHAR(20) NULL,
  `estado` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABLA: usuarios
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `rol_id` INT UNSIGNED NOT NULL,
  `sucursal_id` INT UNSIGNED NULL, -- NULL si es Administrador Global
  `nombres` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `telefono` VARCHAR(20) NULL,
  `estado` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_usuarios_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_usuarios_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABLA: clientes
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `clientes`;
CREATE TABLE `clientes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `tipo_documento` ENUM('DNI', 'PASAPORTE') NOT NULL,
  `numero_documento` VARCHAR(20) NOT NULL UNIQUE,
  `nombres` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `telefono` VARCHAR(20) NOT NULL,
  `estado` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clientes_doc` (`tipo_documento`, `numero_documento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABLA: direcciones_cliente
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `direcciones_cliente`;
CREATE TABLE `direcciones_cliente` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `cliente_id` INT UNSIGNED NOT NULL,
  `alias` VARCHAR(50) NOT NULL DEFAULT 'Casa',
  `direccion_completa` VARCHAR(255) NOT NULL,
  `referencia` VARCHAR(255) NULL,
  `latitud` DECIMAL(10, 8) NOT NULL,
  `longitud` DECIMAL(11, 8) NOT NULL,
  `es_principal` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_direcciones_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. TABLA: categorias
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `categorias`;
CREATE TABLE `categorias` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE,
  `descripcion` VARCHAR(255) NULL,
  `icono` VARCHAR(50) NULL,
  `estado` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. TABLA: productos
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `productos`;
CREATE TABLE `productos` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `categoria_id` INT UNSIGNED NOT NULL,
  `codigo_sku` VARCHAR(50) NOT NULL UNIQUE,
  `codigo_barras` VARCHAR(50) NOT NULL UNIQUE,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` TEXT NULL,
  `unidad_medida` VARCHAR(30) NOT NULL DEFAULT 'UNIDAD',
  `precio_venta` DECIMAL(10, 2) NOT NULL,
  `costo_base` DECIMAL(10, 2) NOT NULL,
  `es_perecedero` TINYINT(1) NOT NULL DEFAULT 0,
  `imagen_url` VARCHAR(255) NULL,
  `estado` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. TABLA: inventarios (aislado por sucursal)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `inventarios`;
CREATE TABLE `inventarios` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `stock_actual` INT NOT NULL DEFAULT 0,
  `stock_minimo` INT NOT NULL DEFAULT 10,
  `stock_maximo` INT NOT NULL DEFAULT 200,
  `punto_reorden` INT NOT NULL DEFAULT 25,
  `clasificacion_abc` ENUM('A', 'B', 'C') NOT NULL DEFAULT 'B',
  `demanda_diaria_promedio` DECIMAL(8, 2) NOT NULL DEFAULT 3.50,
  `lead_time_dias` INT NOT NULL DEFAULT 3,
  `stock_seguridad` INT NOT NULL DEFAULT 10,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inventarios_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_inventarios_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `uk_sucursal_producto` UNIQUE (`sucursal_id`, `producto_id`),
  CONSTRAINT `chk_stock_no_negativo` CHECK (`stock_actual` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. TABLA: lotes (control de PEPS y caducidad según NIC 2)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `lotes`;
CREATE TABLE `lotes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `codigo_lote` VARCHAR(50) NOT NULL,
  `fecha_ingreso` DATE NOT NULL,
  `fecha_vencimiento` DATE NULL,
  `cantidad_inicial` INT NOT NULL,
  `cantidad_disponible` INT NOT NULL,
  `costo_unitario_compra` DECIMAL(10, 2) NOT NULL,
  `ubicacion_almacen` VARCHAR(50) NULL DEFAULT 'PASAJE-A-ESTANTE-1',
  `estado` ENUM('DISPONIBLE', 'AGOTADO', 'CADUCADO') NOT NULL DEFAULT 'DISPONIBLE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_lotes_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_lotes_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `chk_lote_cantidad_no_negativa` CHECK (`cantidad_disponible` >= 0),
  INDEX `idx_lotes_peps` (`sucursal_id`, `producto_id`, `estado`, `fecha_ingreso`, `fecha_vencimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. TABLA: pedidos
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pedidos`;
CREATE TABLE `pedidos` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `codigo_pedido` VARCHAR(30) NOT NULL UNIQUE,
  `numero_boleta` VARCHAR(30) NULL,
  `token_seguimiento` VARCHAR(64) NULL,
  `cliente_id` INT UNSIGNED NOT NULL,
  `es_invitado` TINYINT(1) NOT NULL DEFAULT 0,
  `contacto_email` VARCHAR(150) NULL,
  `contacto_telefono` VARCHAR(20) NULL,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `fecha_pedido` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `igv` DECIMAL(10, 2) NOT NULL,
  `costo_envio` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10, 2) NOT NULL,
  `tipo_entrega` ENUM('DELIVERY', 'RETIRO_TIENDA') NOT NULL DEFAULT 'DELIVERY',
  `fecha_recojo` DATE NULL,
  `requiere_traslado` TINYINT(1) NOT NULL DEFAULT 0,
  `metodo_pago` ENUM('TARJETA', 'YAPE', 'PLIN', 'EFECTIVO_CONTRA_ENTREGA') NOT NULL DEFAULT 'YAPE',
  `estado_pedido` ENUM('PENDIENTE', 'EN_PREPARACION', 'LISTO_PARA_DESPACHO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  `notas` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pedidos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_pedidos_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. TABLA: detalle_pedidos (con desglose de lotes asignados por PEPS)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `detalle_pedidos`;
CREATE TABLE `detalle_pedidos` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `pedido_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `lote_id` INT UNSIGNED NOT NULL,
  `cantidad` INT NOT NULL,
  `precio_unitario` DECIMAL(10, 2) NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  CONSTRAINT `fk_detalle_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_detalle_lote` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `chk_detalle_cantidad_positiva` CHECK (`cantidad` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. TABLA: deliveries (seguimiento en vivo y geolocalización)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `deliveries`;
CREATE TABLE `deliveries` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `pedido_id` INT UNSIGNED NOT NULL UNIQUE,
  `direccion_destino` VARCHAR(255) NOT NULL,
  `referencia_destino` VARCHAR(255) NULL,
  `latitud_destino` DECIMAL(10, 8) NOT NULL,
  `longitud_destino` DECIMAL(11, 8) NOT NULL,
  `distancia_km` DECIMAL(6, 2) NOT NULL,
  `tiempo_estimado_min` INT NOT NULL DEFAULT 30,
  `repartidor_nombre` VARCHAR(100) NULL DEFAULT 'Motorizado Mass Express',
  `repartidor_telefono` VARCHAR(20) NULL,
  `latitud_actual_repartidor` DECIMAL(10, 8) NULL,
  `longitud_actual_repartidor` DECIMAL(11, 8) NULL,
  `estado_delivery` ENUM('ASIGNADO', 'EN_RUTA', 'ENTREGADO', 'FALLIDO') NOT NULL DEFAULT 'ASIGNADO',
  `fecha_salida` DATETIME NULL,
  `fecha_entrega` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_deliveries_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. TABLA: movimientos_inventario (KARDEX FÍSICO-VALORADO)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `movimientos_inventario`;
CREATE TABLE `movimientos_inventario` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `lote_id` INT UNSIGNED NULL,
  `usuario_id` INT UNSIGNED NULL,
  `tipo_movimiento` ENUM('ENTRADA_COMPRA', 'SALIDA_VENTA', 'AJUSTE_MERMA', 'AJUSTE_CONTEO') NOT NULL,
  `documento_referencia` VARCHAR(50) NOT NULL,
  `cantidad` INT NOT NULL,
  `costo_unitario` DECIMAL(10, 2) NOT NULL,
  `saldo_anterior` INT NOT NULL,
  `saldo_nuevo` INT NOT NULL,
  `observaciones` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_kardex_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_kardex_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_kardex_lote` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_kardex_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. TABLA: conteos_ciclicos y detalle_conteo_ciclico (Auditorías físicas)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `conteos_ciclicos`;
CREATE TABLE `conteos_ciclicos` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `usuario_id` INT UNSIGNED NOT NULL,
  `codigo_conteo` VARCHAR(30) NOT NULL UNIQUE,
  `fecha_programada` DATE NOT NULL,
  `fecha_ejecucion` DATETIME NULL,
  `estrato_abc` ENUM('A', 'B', 'C', 'TODOS') NOT NULL DEFAULT 'A',
  `estado` ENUM('PROGRAMADO', 'EN_PROCESO', 'CONCILIADO', 'CANCELADO') NOT NULL DEFAULT 'PROGRAMADO',
  `observaciones` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_conteos_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_conteos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `detalle_conteo_ciclico`;
CREATE TABLE `detalle_conteo_ciclico` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `conteo_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `stock_sistema` INT NOT NULL,
  `stock_fisico` INT NULL,
  `diferencia` INT GENERATED ALWAYS AS (`stock_fisico` - `stock_sistema`) VIRTUAL,
  `ajuste_aplicado` TINYINT(1) NOT NULL DEFAULT 0,
  `justificacion` VARCHAR(255) NULL,
  CONSTRAINT `fk_detalle_conteo` FOREIGN KEY (`conteo_id`) REFERENCES `conteos_ciclicos` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_detalle_conteo_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. TABLA: notificaciones_pedido (Flujo Post-Pago, Boleta Electrónica y Tracking)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `notificaciones_pedido`;
CREATE TABLE `notificaciones_pedido` (
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
-- 16. TABLA: alertas_stock_bajo (Disparador automático cuando stock <= 5)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `alertas_stock_bajo`;
CREATE TABLE `alertas_stock_bajo` (
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

-- -----------------------------------------------------------------------------
-- 17. TABLA: desmedros_mermas (Módulo de Desmedro / Merma con Usuario y Motivo)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `desmedros_mermas`;
CREATE TABLE `desmedros_mermas` (
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
-- 18. TRIGGERS DE NEGOCIO (STOCK BAJO <= 5 Y VALIDACIÓN DE SUPERVISOR)
-- -----------------------------------------------------------------------------
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

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- DATOS SEMILLA (SEEDERS) REALISTAS - ENTORNO PERÚ
-- =============================================================================

-- 1. Roles
INSERT INTO `roles` (`id`, `nombre`, `descripcion`) VALUES
(1, 'Administrador', 'Control global corporativo de tiendas, parámetros ABC, reportería y catálogo maestro.'),
(2, 'Supervisor', 'Responsable de sucursal y operaciones de almacén: picking, PEPS, recepción y conteos.');

-- 2. Sucursales en Huancayo, Perú (con coordenadas y radios)
INSERT INTO `sucursales` (`id`, `codigo_tienda`, `nombre`, `direccion`, `ciudad`, `latitud`, `longitud`, `radio_cobertura_km`, `costo_envio_base`, `costo_km_adicional`, `telefono`, `estado`) VALUES
(1, 'MASS-HYO-01', 'Tienda Mass - Huancayo Centro', 'Calle Real 540 (Plaza Huamanmarca)', 'Huancayo', -12.06840000, -75.21000000, 5.00, 4.00, 1.50, '064-231122', 1),
(2, 'MASS-HYO-02', 'Tienda Mass - San Carlos', 'Av. San Carlos 1120 (Cerca a U. Continental)', 'Huancayo', -12.06210000, -75.19850000, 4.50, 4.00, 1.50, '064-245588', 1);

-- 3. Usuarios internos (Contraseñas cifradas con Bcrypt)
-- Admin123! -> $2y$10$V3jd/vUxus2KK.wDsbxivufo.PWmPnI0mHET4OXHN1Z32wAbZp4F.
-- Super123! -> $2y$10$/q3/6qIJpAyj4.vTcgPzReWuzxOtEc0/i70AYy1EJaoH5pLhRm/5q
INSERT INTO `usuarios` (`id`, `rol_id`, `sucursal_id`, `nombres`, `apellidos`, `email`, `password`, `telefono`, `estado`) VALUES
(1, 1, NULL, 'Carlos', 'Mendoza Valdivia', 'admin@tiendasmass.pe', '$2y$10$V3jd/vUxus2KK.wDsbxivufo.PWmPnI0mHET4OXHN1Z32wAbZp4F.', '964112233', 1),
(2, 2, 1, 'Rosa', 'Huamán Poma', 'supervisor.centro@tiendasmass.pe', '$2y$10$/q3/6qIJpAyj4.vTcgPzReWuzxOtEc0/i70AYy1EJaoH5pLhRm/5q', '954778899', 1),
(3, 2, 2, 'Marco', 'García Aliaga', 'supervisor.sancarlos@tiendasmass.pe', '$2y$10$/q3/6qIJpAyj4.vTcgPzReWuzxOtEc0/i70AYy1EJaoH5pLhRm/5q', '954332211', 1);

-- 4. Clientes finales (DNI exacto 8 dígitos o PASAPORTE)
-- Cliente123! -> $2y$10$wEqldyqWPSAr2OyZCW5YBe3UebqPGmFcU77DbM8LBuSoLSCZcWstK
INSERT INTO `clientes` (`id`, `tipo_documento`, `numero_documento`, `nombres`, `apellidos`, `email`, `password`, `telefono`, `estado`) VALUES
(1, 'DNI', '72458912', 'Juan Víctor', 'Pérez Quispe', 'juan.perez@gmail.com', '$2y$10$wEqldyqWPSAr2OyZCW5YBe3UebqPGmFcU77DbM8LBuSoLSCZcWstK', '987654321', 1),
(2, 'PASAPORTE', 'P9842145', 'María Elena', 'Rojas Benítez', 'maria.rojas@outlook.com', '$2y$10$wEqldyqWPSAr2OyZCW5YBe3UebqPGmFcU77DbM8LBuSoLSCZcWstK', '981223344', 1);

-- 5. Direcciones de Clientes
INSERT INTO `direcciones_cliente` (`id`, `cliente_id`, `alias`, `direccion_completa`, `referencia`, `latitud`, `longitud`, `es_principal`) VALUES
(1, 1, 'Casa', 'Jr. Puno 345, Huancayo', 'Frente al parque Huamanmarca', -12.06910000, -75.20920000, 1),
(2, 2, 'Departamento', 'Av. Giráldez 620, Huancayo', 'A dos cuadras del ferrocarril', -12.06550000, -75.20600000, 1);

-- 6. Categorías
INSERT INTO `categorias` (`id`, `nombre`, `descripcion`, `icono`, `estado`) VALUES
(1, 'Abarrotes y Despensa', 'Arroz, azúcar, fideos, aceites y conservas de canasta básica', 'shopping-bag', 1),
(2, 'Lácteos y Refrigerados', 'Leches evaporadas, yogures, quesos y mantequillas', 'coffee', 1),
(3, 'Bebidas y Aguas', 'Gaseosas, jugos, aguas minerales y bebidas rehidratantes', 'droplet', 1),
(4, 'Limpieza y Aseo del Hogar', 'Detergentes, lejías, suavizantes y jabones en barra', 'sparkles', 1);

-- 7. Productos de Canasta Básica (Catálogo Global)
INSERT INTO `productos` (`id`, `categoria_id`, `codigo_sku`, `codigo_barras`, `nombre`, `descripcion`, `unidad_medida`, `precio_venta`, `costo_base`, `es_perecedero`, `imagen_url`, `estado`) VALUES
(1, 1, 'SKU-ARR-001', '7750885001234', 'Arroz Costeño Extra 1 kg', 'Arroz blanco extra seleccionado grano largo, ideal para la canasta familiar.', 'BOLSA', 4.80, 3.70, 0, 'assets/uploads/products/arroz_costeno_1kg.jpg', 1),
(2, 1, 'SKU-ACE-002', '7750885005678', 'Aceite Vegetal Primor Clásico 900 ml', 'Aceite comestible 100% puro de soya con antioxidantes naturales.', 'BOTELLA', 8.50, 6.60, 0, 'assets/uploads/products/aceite_primor_900ml.jpg', 1),
(3, 1, 'SKU-AZU-003', '7750885009012', 'Azúcar Rubia Dulfina 1 kg', 'Azúcar rubia doméstica de caña natural de alta pureza.', 'BOLSA', 3.90, 2.90, 0, 'assets/uploads/products/azucar_dulfina_1kg.jpg', 1),
(4, 1, 'SKU-FID-004', '7750885003456', 'Fideos Spaghetti Don Vittorio 500 g', 'Pasta elaborada con trigo durum seleccionado de cocción al dente.', 'PAQUETE', 3.20, 2.30, 0, 'assets/uploads/products/fideos_don_vittorio_500g.jpg', 1),
(5, 2, 'SKU-LEC-005', '7751271000120', 'Leche Evaporada Gloria Azul 400 g', 'Leche entera evaporada enriquecida con vitaminas A y D.', 'LATA', 4.30, 3.40, 1, 'assets/uploads/products/leche_gloria_azul_400g.jpg', 1),
(6, 2, 'SKU-YOG-006', '7751271000789', 'Yogur Gloria Fresa Parcialmente Descremado 1 L', 'Yogur bebible con probióticos y pulpa de fresa.', 'BOTELLA', 6.80, 5.10, 1, 'assets/uploads/products/yogur_gloria_fresa_1l.jpg', 1),
(7, 3, 'SKU-GAS-007', '7750123000456', 'Gaseosa Inka Kola Sin Calorías 1.5 L', 'La bebida de sabor nacional baja en calorías y con gas refrescante.', 'BOTELLA', 6.50, 4.80, 0, 'assets/uploads/products/inka_kola_sin_azucar_1500ml.jpg', 1),
(8, 4, 'SKU-DET-008', '7750234000890', 'Detergente en Polvo Bolívar Floral 800 g', 'Detergente con partículas de fragancia floral y poder removedor.', 'BOLSA', 7.90, 5.80, 0, 'assets/uploads/products/detergente_bolivar_floral_800g.jpg', 1),
(9,  1, 'SKU-ATU-009', '7750885009101', 'Filete de Atún Florida en Aceite 170 g', 'Sólido de atún seleccionado en aceite vegetal, fuente natural de Omega 3.', 'LATA', 5.90, 4.40, 0, 'assets/uploads/products/atun_florida_170g.jpg', 1),
(10, 1, 'SKU-AVN-010', '7750885009102', 'Avena Quaker Tradicional 200 g', 'Hojuelas de avena 100% integral ideales para desayunos nutritivos.', 'BOLSA', 3.50, 2.50, 0, 'assets/uploads/products/avena_quaker_500g.jpg', 1),
(11, 1, 'SKU-CAF-011', '7750885009103', 'Café Instantáneo Nescafé Tradición 50 g', 'Café soluble 100% puro de tueste medio y aroma intenso.', 'FRASCO', 9.50, 7.10, 0, 'assets/uploads/products/cafe_nescafe_tradicion.jpg', 1),
(12, 1, 'SKU-GAL-012', '7750885009104', 'Galletas Soda Field Paquete 6 und', 'Clásicas galletas saladas crocantes ideales para acompañar tus comidas.', 'PAQUETE', 4.50, 3.30, 0, 'assets/uploads/products/galletas_soda_field.jpg', 1),
(13, 1, 'SKU-SAL-013', '7750885009105', 'Sal Marina Emsal Cocina 1 kg', 'Sal yodada de mesa y cocina refinada de alta pureza.', 'BOLSA', 2.20, 1.50, 0, 'assets/uploads/products/sal_emsal_1kg.jpg', 1),
(14, 2, 'SKU-MAN-014', '7751271009106', 'Mantequilla Gloria con Sal 180 g', 'Mantequilla fresca pasteurizada con el punto exacto de sal.', 'PAQUETE', 8.90, 6.70, 1, 'assets/uploads/products/mantequilla_gloria_200g.jpg', 1),
(15, 2, 'SKU-QUE-015', '7751271009107', 'Queso Edam Laive Tajado 180 g', 'Queso Edam semiduro en láminas listo para sándwiches y loncheras.', 'PAQUETE', 10.50, 7.80, 1, 'assets/uploads/products/queso_edam_laive.jpg', 1),
(16, 2, 'SKU-HUE-016', '7751271009108', 'Huevos Pardos La Calera x15 und', 'Huevos frescos seleccionados de granja en bandeja protectora de 15 unidades.', 'BANDEJA', 9.80, 7.40, 1, 'assets/uploads/products/huevos_la_calera_15.jpg', 1),
(17, 2, 'SKU-LCH-017', '7751271009109', 'Leche Chocolatada Gloria UHT 800 ml', 'Leche sabor a chocolate fortificada con vitaminas y minerales.', 'BOLSA', 5.20, 3.90, 1, 'assets/uploads/products/leche_chocolatada_gloria_1l.jpg', 1),
(18, 3, 'SKU-AGU-018', '7750123009110', 'Agua Mineral San Mateo Sin Gas 2.5 L', 'Agua mineral natural de manantial andino sin gas.', 'BOTELLA', 3.50, 2.40, 0, 'assets/uploads/products/agua_san_mateo_25l.jpg', 1),
(19, 3, 'SKU-COC-019', '7750123009111', 'Gaseosa Coca-Cola Original 1.5 L', 'Bebida gasificada sabor original ideal para compartir en familia.', 'BOTELLA', 6.80, 5.00, 0, 'assets/uploads/products/coca_cola_15l.jpg', 1),
(20, 3, 'SKU-FRU-020', '7750123009112', 'Néctar Frugos del Valle Durazno 1 L', 'Néctar de durazno refrescante con pulpa de fruta.', 'BOTELLA', 4.90, 3.60, 0, 'assets/uploads/products/frugos_durazno_1l.jpg', 1),
(21, 3, 'SKU-SPO-021', '7750123009113', 'Bebida Rehidratante Sporade Tropical 500 ml', 'Bebida isotónica con electrolitos sabor tropical.', 'BOTELLA', 2.80, 1.95, 0, 'assets/uploads/products/sporade_tropical_500ml.jpg', 1),
(22, 4, 'SKU-LEJ-022', '7750234009114', 'Lejía Clorox Tradicional 1 L', 'Desinfectante y blanqueador multiusos que elimina el 99.9% de bacterias.', 'BOTELLA', 4.70, 3.40, 0, 'assets/uploads/products/lejia_clorox_1l.jpg', 1),
(23, 4, 'SKU-PAP-023', '7750234009115', 'Papel Higiénico Elite Doble Hoja x4 und', 'Papel higiénico suave y resistente de doble hoja.', 'PAQUETE', 6.90, 5.10, 0, 'assets/uploads/products/papel_elite_4un.jpg', 1),
(24, 4, 'SKU-LAV-024', '7750234009116', 'Lavavajilla Líquido Sapolio Limón 1.25 L', 'Lavavajilla líquido concentrado arrancagrasa con aroma a limón.', 'BOTELLA', 8.50, 6.20, 0, 'assets/uploads/products/lavavajilla_sapolio_limon.jpg', 1);

-- 8. Inventarios por Sucursal (Stocks independientes y clasificaciones ABC)
-- Sucursal 1 (Huancayo Centro)
INSERT INTO `inventarios` (`sucursal_id`, `producto_id`, `stock_actual`, `stock_minimo`, `stock_maximo`, `punto_reorden`, `clasificacion_abc`, `demanda_diaria_promedio`, `lead_time_dias`, `stock_seguridad`) VALUES
(1, 1, 120, 20, 300, 35, 'A', 8.5, 3, 10),
(1, 2, 75,  15, 200, 28, 'A', 6.0, 3, 10),
(1, 3, 90,  20, 250, 30, 'B', 5.0, 4, 10),
(1, 4, 140, 25, 300, 40, 'B', 7.0, 3, 15),
(1, 5, 110, 25, 250, 38, 'A', 9.0, 2, 20),
(1, 6, 35,  10, 100, 20, 'B', 4.0, 2, 10),
(1, 7, 50,  15, 150, 25, 'C', 3.5, 3, 10),
(1, 8, 45,  10, 120, 22, 'C', 3.0, 4, 10),
(1, 9,  85,  15, 200, 30, 'A', 6.0, 3, 10),
(1, 10, 90,  15, 200, 28, 'B', 5.0, 3, 10),
(1, 11, 55,  10, 150, 22, 'B', 3.5, 4, 8),
(1, 12, 110, 20, 250, 35, 'A', 7.0, 3, 12),
(1, 13, 130, 25, 300, 40, 'C', 6.0, 4, 15),
(1, 14, 48,  10, 120, 20, 'B', 4.0, 2, 10),
(1, 15, 42,  10, 100, 18, 'B', 3.5, 2, 8),
(1, 16, 60,  15, 150, 25, 'A', 6.5, 2, 12),
(1, 17, 50,  10, 120, 20, 'B', 4.0, 2, 10),
(1, 18, 95,  20, 220, 32, 'A', 7.0, 3, 12),
(1, 19, 80,  15, 200, 28, 'A', 6.5, 3, 10),
(1, 20, 65,  15, 160, 24, 'B', 4.5, 3, 10),
(1, 21, 100, 20, 220, 32, 'B', 6.0, 3, 12),
(1, 22, 70,  15, 180, 25, 'B', 4.5, 4, 10),
(1, 23, 88,  20, 200, 30, 'A', 6.0, 3, 12),
(1, 24, 52,  12, 140, 22, 'C', 3.5, 4, 8);

-- Sucursal 2 (San Carlos)
INSERT INTO `inventarios` (`sucursal_id`, `producto_id`, `stock_actual`, `stock_minimo`, `stock_maximo`, `punto_reorden`, `clasificacion_abc`, `demanda_diaria_promedio`, `lead_time_dias`, `stock_seguridad`) VALUES
(2, 1, 95,  20, 250, 35, 'A', 7.0, 3, 10),
(2, 2, 60,  15, 180, 25, 'A', 5.0, 3, 10),
(2, 3, 80,  20, 200, 30, 'B', 4.5, 4, 10),
(2, 4, 100, 20, 250, 35, 'B', 6.0, 3, 15),
(2, 5, 85,  20, 200, 32, 'A', 7.5, 2, 15),
(2, 6, 25,  10,  80, 18, 'B', 3.0, 2, 10),
(2, 7, 40,  10, 100, 20, 'C', 2.5, 3, 10),
(2, 8, 30,  10, 100, 20, 'C', 2.0, 4, 10),
(2, 9,  65,  15, 180, 28, 'A', 5.0, 3, 10),
(2, 10, 70,  15, 180, 25, 'B', 4.5, 3, 10),
(2, 11, 40,  10, 120, 18, 'B', 3.0, 4, 8),
(2, 12, 85,  20, 200, 30, 'A', 6.0, 3, 12),
(2, 13, 100, 20, 250, 35, 'C', 5.0, 4, 15),
(2, 14, 36,  10, 100, 18, 'B', 3.5, 2, 8),
(2, 15, 32,  10, 90,  16, 'B', 3.0, 2, 8),
(2, 16, 48,  12, 120, 22, 'A', 5.5, 2, 10),
(2, 17, 40,  10, 100, 18, 'B', 3.5, 2, 8),
(2, 18, 75,  15, 180, 28, 'A', 6.0, 3, 10),
(2, 19, 60,  15, 160, 24, 'A', 5.5, 3, 10),
(2, 20, 50,  12, 140, 20, 'B', 4.0, 3, 8),
(2, 21, 80,  15, 180, 28, 'B', 5.0, 3, 10),
(2, 22, 55,  12, 150, 22, 'B', 4.0, 4, 8),
(2, 23, 70,  15, 160, 25, 'A', 5.0, 3, 10),
(2, 24, 42,  10, 120, 18, 'C', 3.0, 4, 8);

-- 9. Lotes Estratificados para Demostración PEPS y Consumo Responsable (NIC 2)
-- En Sucursal 1:
-- Producto 5 (Leche Gloria): Lote 1 con vencimiento próximo para probar IOI y descuento PEPS automático
INSERT INTO `lotes` (`id`, `sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`) VALUES
(1, 1, 1, 'LOT-ARR-2601', '2026-09-01', '2027-08-30', 80, 40, 3.65, 'ESTANTE-A1', 'DISPONIBLE'),
(2, 1, 1, 'LOT-ARR-2602', '2026-10-15', '2027-10-10', 80, 80, 3.70, 'ESTANTE-A2', 'DISPONIBLE'),

(3, 1, 2, 'LOT-ACE-2601', '2026-09-10', '2027-09-01', 50, 25, 6.50, 'ESTANTE-B1', 'DISPONIBLE'),
(4, 1, 2, 'LOT-ACE-2602', '2026-10-20', '2027-10-15', 50, 50, 6.60, 'ESTANTE-B2', 'DISPONIBLE'),

(5, 1, 3, 'LOT-AZU-2601', '2026-08-20', '2027-08-20', 100, 90, 2.90, 'ESTANTE-A3', 'DISPONIBLE'),

(6, 1, 4, 'LOT-FID-2601', '2026-09-05', '2027-09-05', 80, 40, 2.25, 'ESTANTE-C1', 'DISPONIBLE'),
(7, 1, 4, 'LOT-FID-2602', '2026-10-10', '2027-10-10', 100, 100, 2.30, 'ESTANTE-C2', 'DISPONIBLE'),

-- Leche Gloria: Lote 8 con vencimiento cercano (18 días) para probar Consumo Responsable e Índice de Obsolescencia
(8, 1, 5, 'LOT-LEC-2601', '2026-08-01', DATE_ADD(CURDATE(), INTERVAL 12 DAY), 60, 30, 3.35, 'CAMARA-FRIO-1', 'DISPONIBLE'),
(9, 1, 5, 'LOT-LEC-2602', '2026-10-01', DATE_ADD(CURDATE(), INTERVAL 90 DAY), 80, 80, 3.40, 'CAMARA-FRIO-1', 'DISPONIBLE'),

-- Yogur Gloria: Lote 10 con vencimiento en 6 días (Alerta Crítica Roja)
(10, 1, 6, 'LOT-YOG-2601', '2026-10-20', DATE_ADD(CURDATE(), INTERVAL 6 DAY), 20, 10, 5.00, 'CAMARA-FRIO-2', 'DISPONIBLE'),
(11, 1, 6, 'LOT-YOG-2602', '2026-11-01', DATE_ADD(CURDATE(), INTERVAL 28 DAY), 25, 25, 5.10, 'CAMARA-FRIO-2', 'DISPONIBLE'),

(12, 1, 7, 'LOT-GAS-2601', '2026-09-15', '2027-03-15', 60, 50, 4.80, 'ESTANTE-D1', 'DISPONIBLE'),
(13, 1, 8, 'LOT-DET-2601', '2026-09-01', '2028-09-01', 50, 45, 5.80, 'ESTANTE-E1', 'DISPONIBLE');

-- Lotes Sucursal 2
INSERT INTO `lotes` (`id`, `sucursal_id`, `producto_id`, `codigo_lote`, `fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `costo_unitario_compra`, `ubicacion_almacen`, `estado`) VALUES
(14, 2, 1, 'LOT-ARR-SC01', '2026-10-01', '2027-09-30', 100, 95, 3.70, 'RACK-01', 'DISPONIBLE'),
(15, 2, 2, 'LOT-ACE-SC01', '2026-10-05', '2027-10-05', 70,  60, 6.60, 'RACK-02', 'DISPONIBLE'),
(16, 2, 3, 'LOT-AZU-SC01', '2026-10-05', '2027-10-05', 90,  80, 2.90, 'RACK-03', 'DISPONIBLE'),
(17, 2, 4, 'LOT-FID-SC01', '2026-10-10', '2027-10-10', 100, 100, 2.30, 'RACK-04', 'DISPONIBLE'),
(18, 2, 5, 'LOT-LEC-SC01', '2026-10-15', DATE_ADD(CURDATE(), INTERVAL 60 DAY), 90, 85, 3.40, 'RACK-FRIO', 'DISPONIBLE'),
(19, 2, 6, 'LOT-YOG-SC01', '2026-10-25', DATE_ADD(CURDATE(), INTERVAL 18 DAY), 30, 25, 5.10, 'RACK-FRIO', 'DISPONIBLE'),
(20, 2, 7, 'LOT-GAS-SC01', '2026-10-15', '2027-04-15', 50, 40, 4.80, 'RACK-05', 'DISPONIBLE'),
(21, 2, 8, 'LOT-DET-SC01', '2026-10-10', '2028-10-10', 40, 30, 5.80, 'RACK-06', 'DISPONIBLE'),
(22, 1, 9,  'LOT-ATU-2601', '2026-10-01', '2028-06-30', 85,  85,  4.40, 'ESTANTE-A4', 'DISPONIBLE'),
(23, 1, 10, 'LOT-AVN-2601', '2026-10-05', '2027-09-15', 90,  90,  2.50, 'ESTANTE-A5', 'DISPONIBLE'),
(24, 1, 11, 'LOT-CAF-2601', '2026-10-05', '2028-03-20', 55,  55,  7.10, 'ESTANTE-A6', 'DISPONIBLE'),
(25, 1, 12, 'LOT-GAL-2601', '2026-10-10', '2027-05-30', 110, 110, 3.30, 'ESTANTE-C3', 'DISPONIBLE'),
(26, 1, 13, 'LOT-SAL-2601', '2026-09-20', '2029-09-20', 130, 130, 1.50, 'ESTANTE-A7', 'DISPONIBLE'),
(27, 1, 14, 'LOT-MAN-2601', '2026-11-01', DATE_ADD(CURDATE(), INTERVAL 45 DAY), 48, 48, 6.70, 'CAMARA-FRIO-1', 'DISPONIBLE'),
(28, 1, 15, 'LOT-QUE-2601', '2026-11-05', DATE_ADD(CURDATE(), INTERVAL 25 DAY), 42, 42, 7.80, 'CAMARA-FRIO-2', 'DISPONIBLE'),
(29, 1, 16, 'LOT-HUE-2601', '2026-11-12', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 60, 60, 7.40, 'CAMARA-FRIO-3', 'DISPONIBLE'),
(30, 1, 17, 'LOT-LCH-2601', '2026-11-01', DATE_ADD(CURDATE(), INTERVAL 60 DAY), 50, 50, 3.90, 'CAMARA-FRIO-1', 'DISPONIBLE'),
(31, 1, 18, 'LOT-AGU-2601', '2026-10-15', '2027-10-15', 95,  95,  2.40, 'ESTANTE-D2', 'DISPONIBLE'),
(32, 1, 19, 'LOT-COC-2601', '2026-10-18', '2027-06-18', 80,  80,  5.00, 'ESTANTE-D3', 'DISPONIBLE'),
(33, 1, 20, 'LOT-FRU-2601', '2026-10-20', '2027-04-20', 65,  65,  3.60, 'ESTANTE-D4', 'DISPONIBLE'),
(34, 1, 21, 'LOT-SPO-2601', '2026-10-20', '2027-05-20', 100, 100, 1.95, 'ESTANTE-D5', 'DISPONIBLE'),
(35, 1, 22, 'LOT-LEJ-2601', '2026-10-01', '2028-10-01', 70,  70,  3.40, 'ESTANTE-E2', 'DISPONIBLE'),
(36, 1, 23, 'LOT-PAP-2601', '2026-10-01', '2029-10-01', 88,  88,  5.10, 'ESTANTE-E3', 'DISPONIBLE'),
(37, 1, 24, 'LOT-LAV-2601', '2026-10-01', '2028-10-01', 52,  52,  6.20, 'ESTANTE-E4', 'DISPONIBLE'),
(38, 2, 9,  'LOT-ATU-SC01', '2026-10-05', '2028-06-30', 65,  65,  4.40, 'RACK-07', 'DISPONIBLE'),
(39, 2, 10, 'LOT-AVN-SC01', '2026-10-05', '2027-09-15', 70,  70,  2.50, 'RACK-08', 'DISPONIBLE'),
(40, 2, 11, 'LOT-CAF-SC01', '2026-10-05', '2028-03-20', 40,  40,  7.10, 'RACK-09', 'DISPONIBLE'),
(41, 2, 12, 'LOT-GAL-SC01', '2026-10-10', '2027-05-30', 85,  85,  3.30, 'RACK-10', 'DISPONIBLE'),
(42, 2, 13, 'LOT-SAL-SC01', '2026-09-20', '2029-09-20', 100, 100, 1.50, 'RACK-11', 'DISPONIBLE'),
(43, 2, 14, 'LOT-MAN-SC01', '2026-11-01', DATE_ADD(CURDATE(), INTERVAL 45 DAY), 36, 36, 6.70, 'RACK-FRIO', 'DISPONIBLE'),
(44, 2, 15, 'LOT-QUE-SC01', '2026-11-05', DATE_ADD(CURDATE(), INTERVAL 25 DAY), 32, 32, 7.80, 'RACK-FRIO', 'DISPONIBLE'),
(45, 2, 16, 'LOT-HUE-SC01', '2026-11-12', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 48, 48, 7.40, 'RACK-FRIO', 'DISPONIBLE'),
(46, 2, 17, 'LOT-LCH-SC01', '2026-11-01', DATE_ADD(CURDATE(), INTERVAL 60 DAY), 40, 40, 3.90, 'RACK-FRIO', 'DISPONIBLE'),
(47, 2, 18, 'LOT-AGU-SC01', '2026-10-15', '2027-10-15', 75,  75,  2.40, 'RACK-12', 'DISPONIBLE'),
(48, 2, 19, 'LOT-COC-SC01', '2026-10-18', '2027-06-18', 60,  60,  5.00, 'RACK-13', 'DISPONIBLE'),
(49, 2, 20, 'LOT-FRU-SC01', '2026-10-20', '2027-04-20', 50,  50,  3.60, 'RACK-14', 'DISPONIBLE'),
(50, 2, 21, 'LOT-SPO-SC01', '2026-10-20', '2027-05-20', 80,  80,  1.95, 'RACK-15', 'DISPONIBLE'),
(51, 2, 22, 'LOT-LEJ-SC01', '2026-10-01', '2028-10-01', 55,  55,  3.40, 'RACK-16', 'DISPONIBLE'),
(52, 2, 23, 'LOT-PAP-SC01', '2026-10-01', '2029-10-01', 70,  70,  5.10, 'RACK-17', 'DISPONIBLE'),
(53, 2, 24, 'LOT-LAV-SC01', '2026-10-01', '2028-10-01', 42,  42,  6.20, 'RACK-18', 'DISPONIBLE');

-- 10. Kardex Inicial
INSERT INTO `movimientos_inventario` (`sucursal_id`, `producto_id`, `lote_id`, `usuario_id`, `tipo_movimiento`, `documento_referencia`, `cantidad`, `costo_unitario`, `saldo_anterior`, `saldo_nuevo`, `observaciones`) VALUES
(1, 1, 1, 2, 'ENTRADA_COMPRA', 'FAC-PROV-00891', 80, 3.65, 0, 80, 'Ingreso inicial de mercadería lote 2601'),
(1, 1, 2, 2, 'ENTRADA_COMPRA', 'FAC-PROV-00915', 80, 3.70, 80, 160, 'Ingreso de reposición lote 2602'),
(1, 5, 8, 2, 'ENTRADA_COMPRA', 'FAC-GLORIA-1044', 60, 3.35, 0, 60, 'Recepción de leche evaporada lote 2601'),
(1, 5, 9, 2, 'ENTRADA_COMPRA', 'FAC-GLORIA-1120', 80, 3.40, 60, 140, 'Recepción de leche evaporada lote 2602');

-- 11. Pedido de Ejemplo con Delivery en Curso
INSERT INTO `pedidos` (`id`, `codigo_pedido`, `cliente_id`, `sucursal_id`, `fecha_pedido`, `subtotal`, `igv`, `costo_envio`, `total`, `tipo_entrega`, `metodo_pago`, `estado_pedido`, `notas`) VALUES
(1, 'PED-202611-0001', 1, 1, NOW() - INTERVAL 25 MINUTE, 26.69, 4.81, 4.50, 36.00, 'DELIVERY', 'YAPE', 'DESPACHADO', 'Por favor tocar el timbre blanco.');

INSERT INTO `detalle_pedidos` (`id`, `pedido_id`, `producto_id`, `lote_id`, `cantidad`, `precio_unitario`, `subtotal`) VALUES
(1, 1, 1, 1, 2, 4.80, 9.60),
(2, 1, 2, 3, 1, 8.50, 8.50),
(3, 1, 5, 8, 3, 4.30, 12.90);

INSERT INTO `deliveries` (`id`, `pedido_id`, `direccion_destino`, `referencia_destino`, `latitud_destino`, `longitud_destino`, `distancia_km`, `tiempo_estimado_min`, `repartidor_nombre`, `repartidor_telefono`, `latitud_actual_repartidor`, `longitud_actual_repartidor`, `estado_delivery`, `fecha_salida`) VALUES
(1, 1, 'Jr. Puno 345, Huancayo', 'Frente al parque Huamanmarca', -12.06910000, -75.20920000, 1.20, 15, 'Raúl Quispe (Mass Moto 04)', '964889900', -12.06870000, -75.20960000, 'EN_RUTA', NOW() - INTERVAL 10 MINUTE);
