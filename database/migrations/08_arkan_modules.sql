-- =============================================================================
-- Migración 08: Módulos ERP de ARKAN integrados en Tiendas Mass
-- (Proveedores, Compras, Traslados, Caja Operativa y Configuraciones)
-- Nota: Sin módulos de POS ni Ventas en caja, adaptado a Backoffice Mass.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `proveedores` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `tipo_documento` ENUM('RUC', 'DNI') NOT NULL DEFAULT 'RUC',
  `numero_documento` VARCHAR(20) NOT NULL UNIQUE,
  `razon_social` VARCHAR(150) NOT NULL,
  `nombre_comercial` VARCHAR(150) NULL,
  `direccion` VARCHAR(255) NULL,
  `telefono` VARCHAR(30) NULL,
  `email` VARCHAR(120) NULL,
  `contacto_nombre` VARCHAR(100) NULL,
  `estado` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `compras` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `codigo_compra` VARCHAR(30) NOT NULL UNIQUE,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `proveedor_id` INT UNSIGNED NOT NULL,
  `usuario_id` INT UNSIGNED NOT NULL,
  `tipo_comprobante` ENUM('FACTURA', 'BOLETA', 'GUIA') NOT NULL DEFAULT 'FACTURA',
  `numero_comprobante` VARCHAR(40) NOT NULL,
  `condicion_pago` ENUM('CONTADO', 'CREDITO') NOT NULL DEFAULT 'CONTADO',
  `estado_pago` ENUM('PAGADO', 'PENDIENTE') NOT NULL DEFAULT 'PAGADO',
  `fecha_compra` DATE NOT NULL,
  `fecha_vencimiento_pago` DATE NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `igv` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `observaciones` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_compras_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_compras_proveedor` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detalle_compras` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `compra_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `lote_id` INT UNSIGNED NULL,
  `cantidad` INT NOT NULL,
  `costo_unitario` DECIMAL(10, 2) NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `fecha_vencimiento` DATE NULL,
  CONSTRAINT `fk_det_compra` FOREIGN KEY (`compra_id`) REFERENCES `compras` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_det_compra_prod` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `traslados` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `codigo_traslado` VARCHAR(30) NOT NULL UNIQUE,
  `sucursal_origen_id` INT UNSIGNED NOT NULL,
  `sucursal_destino_id` INT UNSIGNED NOT NULL,
  `producto_id` INT UNSIGNED NOT NULL,
  `usuario_id` INT UNSIGNED NOT NULL,
  `cantidad` INT NOT NULL,
  `motivo` VARCHAR(255) NOT NULL DEFAULT 'Reposición de stock entre sucursales',
  `estado` ENUM('COMPLETADO', 'PENDIENTE', 'ANULADO') NOT NULL DEFAULT 'COMPLETADO',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_traslado_orig` FOREIGN KEY (`sucursal_origen_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_traslado_dest` FOREIGN KEY (`sucursal_destino_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_traslado_prod` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `caja_movimientos` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `usuario_id` INT UNSIGNED NOT NULL,
  `tipo` ENUM('INGRESO', 'EGRESO', 'APERTURA', 'CIERRE') NOT NULL,
  `concepto` VARCHAR(120) NOT NULL,
  `metodo_pago` VARCHAR(40) NOT NULL DEFAULT 'EFECTIVO',
  `monto` DECIMAL(10, 2) NOT NULL,
  `referencia` VARCHAR(80) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_caja_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `configuraciones_sistema` (
  `clave` VARCHAR(80) PRIMARY KEY,
  `valor` VARCHAR(255) NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos iniciales de Proveedores peruanos
INSERT IGNORE INTO `proveedores` (`id`, `tipo_documento`, `numero_documento`, `razon_social`, `nombre_comercial`, `direccion`, `telefono`, `email`, `contacto_nombre`) VALUES
(1, 'RUC', '20100055237', 'ALICORP S.A.A.', 'Alicorp Perú', 'Av. Argentina 4793, Carmen de la Legua, Callao', '01-3150800', 'ventas.b2b@alicorp.com.pe', 'Luis Paredes'),
(2, 'RUC', '20100190797', 'LECHE GLORIA S.A.', 'Gloria S.A.', 'Av. República de Panamá 2461, La Victoria, Lima', '01-4707170', 'distribucion@gloria.com.pe', 'María Fernández'),
(3, 'RUC', '20100027021', 'ARCA CONTINENTAL LINDLEY S.A.', 'Corporación Lindley (Inka Kola / Coca-Cola)', 'Jr. Cajamarca 371, Rímac, Lima', '01-3194000', 'pedidos@lindley.pe', 'Jorge Quispe'),
(4, 'RUC', '20100128056', 'COSTEÑO ALIMENTOS S.A.C.', 'Costeño Alimentos', 'Carretera Central Km 4.5, Santa Anita, Lima', '01-3621100', 'comercial@costeno.com.pe', 'Ana Torres');

-- Configuraciones operativas estilo ARKAN
INSERT IGNORE INTO `configuraciones_sistema` (`clave`, `valor`, `descripcion`) VALUES
('peps_estricto', '1', 'Aplicar despacho estricto PEPS (Primero en Entrar, Primero en Salir)'),
('alerta_stock_bajo', '1', 'Activar alertas automáticas cuando el stock sea menor o igual a 5 unidades'),
('alerta_vencimiento_dias', '15', 'Días de anticipación para alertar lotes próximos a vencer (NIC 2)'),
('permitir_contraentrega', '1', 'Habilitar pago efectivo contra entrega para pedidos Delivery'),
('igv_porcentaje', '18', 'Tasa de IGV vigente (%) para compras y valorización'),
('costo_delivery_base', '4.00', 'Tarifa base de envío Delivery en soles (S/)'),
('radio_cobertura_default_km', '5.00', 'Radio máximo de cobertura Delivery por sucursal (km)'),
('nombre_empresa', 'TIENDAS MASS PERÚ S.A.C.', 'Razón social corporativa para reportes y etiquetas');
