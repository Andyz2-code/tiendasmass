-- =============================================================================
-- Migración 06: Imágenes reales de productos (Plaza Vea / Metro)
-- =============================================================================

UPDATE `productos` SET `imagen_url` = 'assets/uploads/products/arroz_costeno_1kg.jpg' WHERE `codigo_sku` = 'SKU-ARR-001' OR `id` = 1;
UPDATE `productos` SET `imagen_url` = 'assets/uploads/products/aceite_primor_900ml.jpg' WHERE `codigo_sku` = 'SKU-ACE-002' OR `id` = 2;
UPDATE `productos` SET `imagen_url` = 'assets/uploads/products/azucar_dulfina_1kg.jpg' WHERE `codigo_sku` = 'SKU-AZU-003' OR `id` = 3;
UPDATE `productos` SET `imagen_url` = 'assets/uploads/products/fideos_don_vittorio_500g.jpg' WHERE `codigo_sku` = 'SKU-FID-004' OR `id` = 4;
UPDATE `productos` SET `imagen_url` = 'assets/uploads/products/leche_gloria_azul_400g.jpg' WHERE `codigo_sku` = 'SKU-LEC-005' OR `id` = 5;
UPDATE `productos` SET `imagen_url` = 'assets/uploads/products/yogur_gloria_fresa_1l.jpg' WHERE `codigo_sku` = 'SKU-YOG-006' OR `id` = 6;
UPDATE `productos` SET `imagen_url` = 'assets/uploads/products/inka_kola_sin_azucar_1500ml.jpg' WHERE `codigo_sku` = 'SKU-GAS-007' OR `id` = 7;
UPDATE `productos` SET `imagen_url` = 'assets/uploads/products/detergente_bolivar_floral_800g.jpg' WHERE `codigo_sku` = 'SKU-DET-008' OR `id` = 8;
