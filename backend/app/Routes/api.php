<?php
/**
 * DEFINICIÓN DE RUTAS API REST - TIENDAS MASS
 * Arquitectura Controladores con Mapeos GetMapping / PostMapping
 * @var \App\Routes\Router $router
 */

// Prefijo global /api
$router->group(['prefix' => 'api'], function ($api) {

    // 1. Mapeo de Autenticación y Control de Sesión
    $api->postMapping('/auth/login-user', 'AuthController@loginUser');
    $api->postMapping('/auth/login-client', 'AuthController@loginClient');
    $api->postMapping('/auth/login', 'AuthController@loginUser'); // Alias unificado
    $api->postMapping('/auth/register-client', 'AuthController@registerClient');
    $api->getMapping('/auth/me', 'AuthController@me', ['jwt']);
    $api->putMapping('/clientes/perfil', 'AuthController@updateProfile');

    // 1.1 Mapeo de Gestión de Usuarios (Rol Administrador y Supervisor con Sucursal Obligatoria - Req #5)
    $api->getMapping('/usuarios', 'UsuarioController@index', ['jwt', 'role:Administrador']);
    $api->postMapping('/usuarios', 'UsuarioController@store', ['jwt', 'role:Administrador']);
    $api->putMapping('/usuarios/{id}', 'UsuarioController@update', ['jwt', 'role:Administrador']);
    $api->patchMapping('/usuarios/{id}/toggle', 'UsuarioController@toggle', ['jwt', 'role:Administrador']);

    // 2. Mapeo de Sucursales y Almacenes
    $api->getMapping('/sucursales', 'SucursalController@index');
    $api->getMapping('/sucursales/{id}', 'SucursalController@show');
    $api->postMapping('/sucursales', 'SucursalController@store', ['jwt', 'role:Administrador']);
    $api->putMapping('/sucursales/{id}', 'SucursalController@update', ['jwt', 'role:Administrador']);

    // 3. Mapeo de Categorías y Catálogo de Productos
    $api->getMapping('/categorias', 'CategoriaController@index');
    $api->getMapping('/productos', 'ProductoController@index');
    $api->getMapping('/productos/template-excel', 'ProductoController@templateExcel');
    $api->getMapping('/productos/{id}', 'ProductoController@show');
    $api->postMapping('/productos', 'ProductoController@store', ['jwt', 'role:Administrador']);
    $api->putMapping('/productos/{id}', 'ProductoController@update', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/productos/import-excel', 'ProductoController@importExcel', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/upload/image', 'UploadController@uploadImage', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/upload/banner', 'UploadController@uploadBanner', ['jwt', 'role:Administrador,Supervisor']);

    // 4. Mapeo de Inventarios, Lotes, Mermas y Alertas de Stock Bajo (<= 5 unidades - Req #3 y #4)
    $api->getMapping('/inventarios', 'InventarioController@index', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/lotes', 'InventarioController@lotes', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/lotes/recepcion', 'InventarioController@recepcionCompra', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/inventarios/mermas', 'InventarioController@registrarMerma', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/inventarios/low-stock-alerts', 'InventarioController@lowStockAlerts', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/inventarios/abc', 'InventarioController@abcAnalysis', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/inventarios/abc-recalculate', 'InventarioController@abcRecalculate', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/inventarios/reorder-alerts', 'InventarioController@reorderAlerts', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/inventarios/obsolescence', 'InventarioController@obsolescence', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/inventarios/kardex', 'InventarioController@kardex', ['jwt', 'role:Administrador,Supervisor']);

    // 5. Mapeo de Pedidos, Recojo en Tienda, Flujo Post-Pago y Seguimiento (Req #1 y #2)
    $api->postMapping('/pedidos/validar-stock-recojo', 'PedidoController@validarStockRecojo');
    $api->getMapping('/pedidos/seguimiento/{codigo}', 'PedidoController@seguimientoPublico');
    $api->postMapping('/pedidos/{id}/notificar-boleta', 'PedidoController@notificarBoleta');
    $api->getMapping('/pedidos', 'PedidoController@index');
    $api->getMapping('/ventas', 'PedidoController@index'); // Alias para compatibilidad
    $api->getMapping('/pedidos/{id}', 'PedidoController@show');
    $api->getMapping('/ventas/{id}', 'PedidoController@show');
    $api->postMapping('/pedidos', 'PedidoController@store');
    $api->postMapping('/ventas', 'PedidoController@store');
    $api->putMapping('/pedidos/{id}/estado', 'PedidoController@updateStatus');

    // 6. Mapeo de Delivery, Google Maps y App Mass Rider
    $api->postMapping('/delivery/quote', 'DeliveryController@quote');
    $api->getMapping('/delivery/track/{pedido_id}', 'DeliveryController@track');
    $api->postMapping('/delivery/update-location', 'DeliveryController@updateLocation');
    $api->postMapping('/riders/login', 'DeliveryController@riderLogin');
    $api->postMapping('/riders/register', 'DeliveryController@riderRegister');
    $api->getMapping('/riders/orders', 'DeliveryController@riderOrders');
    $api->postMapping('/riders/orders/{id}/status', 'DeliveryController@riderUpdateOrderStatus');
    $api->getMapping('/riders/settlement', 'DeliveryController@riderSettlement');

    // 7. Mapeo de Auditorías y Conteos Físicos Cíclicos
    $api->getMapping('/conteos', 'ConteoCiclicoController@index', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/conteos/trabajadores', 'ConteoCiclicoController@trabajadores', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/conteos/{id}', 'ConteoCiclicoController@show', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/conteos', 'ConteoCiclicoController@store', ['jwt', 'role:Administrador,Supervisor']);
    $api->putMapping('/conteos/{id}', 'ConteoCiclicoController@update', ['jwt', 'role:Administrador,Supervisor']);
    $api->patchMapping('/conteos/{id}/cancelar', 'ConteoCiclicoController@cancel', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/conteos/{id}/guardar', 'ConteoCiclicoController@saveCounts', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/conteos/{id}/conciliar', 'ConteoCiclicoController@reconcile', ['jwt', 'role:Administrador,Supervisor']);

    // 8. Mapeo de Reportes Ejecutivos, KPIs y Mermas NIC 2
    $api->getMapping('/reportes/dashboard-kpi', 'ReporteController@dashboardKpi', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/reportes/general-admin', 'ReporteController@generalAdmin', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/reportes/mermas', 'ReporteController@mermas', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/reportes/mermas', 'InventarioController@registrarMerma', ['jwt', 'role:Administrador,Supervisor']);

    // 9. Mapeo de Banners Publicitarios y Promociones
    $api->getMapping('/banners', 'BannerController@index');
    $api->getMapping('/banners/admin', 'BannerController@adminList', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/banners', 'BannerController@store', ['jwt', 'role:Administrador,Supervisor']);
    $api->putMapping('/banners/{id}', 'BannerController@update', ['jwt', 'role:Administrador,Supervisor']);
    $api->patchMapping('/banners/{id}/toggle', 'BannerController@toggle', ['jwt', 'role:Administrador,Supervisor']);
    $api->deleteMapping('/banners/{id}', 'BannerController@destroy', ['jwt', 'role:Administrador,Supervisor']);

    // 10. Módulos ERP ARKAN (Proveedores, Compras, Traslados, Valorizado, Caja y Configuraciones)
    $api->getMapping('/proveedores', 'ArkanErpController@listProveedores', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/proveedores', 'ArkanErpController@storeProveedor', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/proveedores/lookup/{numero}', 'ArkanErpController@lookupRuc', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/compras', 'ArkanErpController@listCompras', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/compras', 'ArkanErpController@storeCompra', ['jwt', 'role:Administrador,Supervisor']);
    $api->patchMapping('/compras/{id}/pagar', 'ArkanErpController@pagarCompra', ['jwt', 'role:Administrador']);
    $api->getMapping('/traslados', 'ArkanErpController@listTraslados', ['jwt', 'role:Administrador,Supervisor']);
    $api->postMapping('/traslados', 'ArkanErpController@storeTraslado', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/inventarios/valorizado', 'ArkanErpController@inventarioValorizado', ['jwt', 'role:Administrador,Supervisor']);
    $api->getMapping('/caja/movimientos', 'ArkanErpController@listCaja', ['jwt', 'role:Administrador']);
    $api->postMapping('/caja/movimientos', 'ArkanErpController@storeCaja', ['jwt', 'role:Administrador']);
    $api->getMapping('/configuraciones', 'ArkanErpController@getConfiguraciones', ['jwt', 'role:Administrador,Supervisor']);
    $api->putMapping('/configuraciones', 'ArkanErpController@updateConfiguraciones', ['jwt', 'role:Administrador']);

    // 10. Mapeo de Chatbot Inteligente de Recomendaciones IA Massi (Google Gemini)
    $api->postMapping('/chat/recommendations', 'ChatbotController@getRecommendations');
    $api->postMapping('/chatbot/recommendations', 'ChatbotController@getRecommendations');
});
