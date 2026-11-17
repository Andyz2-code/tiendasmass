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
  `cliente_id` INT UNSIGNED NOT NULL,
  `sucursal_id` INT UNSIGNED NOT NULL,
  `fecha_pedido` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `igv` DECIMAL(10, 2) NOT NULL,
  `costo_envio` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10, 2) NOT NULL,
  `tipo_entrega` ENUM('DELIVERY', 'RETIRO_TIENDA') NOT NULL DEFAULT 'DELIVERY',
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
(1, 1, 'SKU-ARR-001', '7750885001234', 'Arroz Costeño Extra 1 kg', 'Arroz blanco extra seleccionado grano largo, ideal para la canasta familiar.', 'BOLSA', 4.80, 3.70, 0, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', 1),
(2, 1, 'SKU-ACE-002', '7750885005678', 'Aceite Vegetal Primor Clásico 900 ml', 'Aceite comestible 100% puro de soya con antioxidantes naturales.', 'BOTELLA', 8.50, 6.60, 0, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', 1),
(3, 1, 'SKU-AZU-003', '7750885009012', 'Azúcar Rubia Dulfina 1 kg', 'Azúcar rubia doméstica de caña natural de alta pureza.', 'BOLSA', 3.90, 2.90, 0, 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400', 1),
(4, 1, 'SKU-FID-004', '7750885003456', 'Fideos Spaghetti Don Vittorio 500 g', 'Pasta elaborada con trigo durum seleccionado de cocción al dente.', 'PAQUETE', 3.20, 2.30, 0, 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400', 1),
(5, 2, 'SKU-LEC-005', '7751271000120', 'Leche Evaporada Gloria Azul 400 g', 'Leche entera evaporada enriquecida con vitaminas A y D.', 'LATA', 4.30, 3.40, 1, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400', 1),
(6, 2, 'SKU-YOG-006', '7751271000789', 'Yogur Gloria Fresa Parcialmente Descremado 1 L', 'Yogur bebible con probióticos y pulpa de fresa.', 'BOTELLA', 6.80, 5.10, 1, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', 1),
(7, 3, 'SKU-GAS-007', '7750123000456', 'Gaseosa Inka Kola Sin Calorías 1.5 L', 'La bebida de sabor nacional baja en calorías y con gas refrescante.', 'BOTELLA', 6.50, 4.80, 0, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400', 1),
(8, 4, 'SKU-DET-008', '7750234000890', 'Detergente en Polvo Bolívar Floral 800 g', 'Detergente con partículas de fragancia floral y poder removedor.', 'BOLSA', 7.90, 5.80, 0, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400', 1);

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
(1, 8, 45,  10, 120, 22, 'C', 3.0, 4, 10);

-- Sucursal 2 (San Carlos)
INSERT INTO `inventarios` (`sucursal_id`, `producto_id`, `stock_actual`, `stock_minimo`, `stock_maximo`, `punto_reorden`, `clasificacion_abc`, `demanda_diaria_promedio`, `lead_time_dias`, `stock_seguridad`) VALUES
(2, 1, 95,  20, 250, 35, 'A', 7.0, 3, 10),
(2, 2, 60,  15, 180, 25, 'A', 5.0, 3, 10),
(2, 3, 80,  20, 200, 30, 'B', 4.5, 4, 10),
(2, 4, 100, 20, 250, 35, 'B', 6.0, 3, 15),
(2, 5, 85,  20, 200, 32, 'A', 7.5, 2, 15),
(2, 6, 25,  10,  80, 18, 'B', 3.0, 2, 10),
(2, 7, 40,  10, 100, 20, 'C', 2.5, 3, 10),
(2, 8, 30,  10, 100, 20, 'C', 2.0, 4, 10);

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
(21, 2, 8, 'LOT-DET-SC01', '2026-10-10', '2028-10-10', 40, 30, 5.80, 'RACK-06', 'DISPONIBLE');

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
