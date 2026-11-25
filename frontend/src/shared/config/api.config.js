/**
 * ARKENYA - Configuración Centralizada de API y Rutas
 * Ubicación: frontend/src/shared/config/api.config.js
 */

export const API_CONFIG = {
  BASE_URL: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost/tiendasmass/backend/public/api'
    : '/backend/public/api',
  SOCKET_URL: 'http://localhost:4000',
  STORAGE_KEYS: {
    AUTH_TOKEN: 'mass_token',
    AUTH_USER: 'mass_user',
    CART: 'mass_cart_items',
    BRANCH_ID: 'mass_branch_id',
    A11Y_FONT: 'mass_a11y_font_size',
    A11Y_CONTRAST: 'mass_a11y_contrast',
    A11Y_FOCUS: 'mass_a11y_high_focus'
  },
  ENDPOINTS: {
    AUTH_LOGIN: '/auth/login',
    AUTH_ME: '/auth/me',
    PRODUCTOS: '/productos',
    PRODUCTOS_EXCEL_IMPORT: '/productos/importar-excel',
    INVENTARIO_PEPS: '/inventario/lotes-peps',
    ALMACEN_ABC: '/inventario/matriz-abc',
    CONTEOS_FISICOS: '/inventario/conteos-fisicos',
    VENTAS: '/ventas',
    DELIVERY_TRACKING: '/ventas/delivery-tracking',
    REPORTES_GENERALES: '/reportes/generales',
    REPORTES_FINANCIEROS: '/reportes/financieros',
    BANNERS: '/banners',
    SUCURSALES: '/sucursales',
    USUARIOS: '/usuarios'
  }
};

export default API_CONFIG;
