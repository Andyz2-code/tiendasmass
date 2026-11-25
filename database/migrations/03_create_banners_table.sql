-- ==============================================================
-- MIGRACIÓN 03: TABLA DE BANNERS DINÁMICOS - TIENDAS MASS
-- ==============================================================

USE `tiendas_mass_db`;

CREATE TABLE IF NOT EXISTS `banners` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `sucursal_id` INT UNSIGNED NULL COMMENT 'NULL = Banner Global de Administrador, o ID de sucursal para Supervisor',
    `titulo` VARCHAR(150) NOT NULL,
    `subtitulo` VARCHAR(255) NULL,
    `tag_promocion` VARCHAR(50) DEFAULT 'OFERTAS BOMBA',
    `precio_destacado` VARCHAR(50) NULL,
    `imagen_url` VARCHAR(500) NOT NULL,
    `boton_texto` VARCHAR(50) DEFAULT 'Comprar Ahora',
    `boton_enlace` VARCHAR(255) DEFAULT '#catalogo',
    `fecha_inicio` DATE NULL,
    `fecha_fin` DATE NULL,
    `orden` INT DEFAULT 1,
    `activo` TINYINT(1) DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Banners iniciales con fotos de alta calidad de supermercado y ofertas Mass
INSERT INTO `banners` (`sucursal_id`, `titulo`, `subtitulo`, `tag_promocion`, `precio_destacado`, `imagen_url`, `boton_texto`, `boton_enlace`, `orden`, `activo`) VALUES
(NULL, '¡Ahorro Imbatible para tu Hogar!', 'Abarrotes, lácteos y productos de primera necesidad con precios bajos garantizados todos los días.', '💥 PRECIOS IMBATIBLES', 'Desde S/ 1.80', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80', 'Ver Catálogo', '#catalogo', 1, 1),
(NULL, 'Festival de Lácteos y Desayuno', 'Leche Gloria, quesos frescos y avenas con frescura garantizada en Huancayo y El Tambo.', '🥛 100% FRESCURA', 'Hasta 25% DSCTO', 'https://images.unsplash.com/photo-1528732263440-4dd1a18a4cc2?w=1200&auto=format&fit=crop&q=80', 'Aprovechar Ofertas', '#catalogo', 2, 1),
(NULL, 'Cuidado y Limpieza del Hogar', 'Detergentes Bolívar, lejías Clorox y suavizantes en mega packs de ahorro familiar.', '✨ MEGA AHORRO', 'Pack Familiar', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=1200&auto=format&fit=crop&q=80', 'Comprar Limpieza', '#catalogo', 3, 1),
(1, 'Especial Sede Huancayo Centro', 'Entrega express en menos de 45 minutos en todo el centro histórico y alrededores.', '🛵 ZONA CENTRO', 'Envío Gratis > S/ 50', 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200&auto=format&fit=crop&q=80', 'Pedir en Centro', '#catalogo', 4, 1);
