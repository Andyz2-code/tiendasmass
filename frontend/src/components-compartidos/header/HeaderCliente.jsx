/**
 * TIENDAS MASS - Header de la Interfaz Cliente
 * Ubicación: frontend/src/components-compartidos/header/HeaderCliente.jsx
 */
import React from 'react';

export const HeaderCliente = ({
  searchQuery = '',
  setSearchQuery = () => {},
  selectedCategory = 'TODOS',
  onSelectCategory = () => {},
  cartCount = 0,
  onOpenCart = () => {},
  user = null,
  onOpenAuth = () => {},
  onOpenPerfil = () => {},
  activeSucursal = 'Mass - Huancayo Centro'
}) => {
  return (
    <header className="sticky top-0 z-30 bg-mass-yellow shadow-md border-b-2 border-amber-400">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center">
          <a href="/tiendasmass/" className="flex items-center hover:opacity-95 transition group" title="Ir al inicio de Tiendas Mass">
            <img
              src="/tiendasmass/frontend/assets/images/logo-mass-oficial.png"
              alt="Tiendas Mass - Precios bajos, ¡cerca de ti!"
              className="h-9 sm:h-11 md:h-12 w-auto max-w-[200px] sm:max-w-[270px] md:max-w-[320px] object-contain select-none group-hover:scale-102 transition-transform"
              onError={(e) => { e.target.src = 'assets/images/logo-mass-oficial.png'; }}
            />
          </a>
        </div>

        {/* Barra de Búsqueda */}
        <div className="flex-1 max-w-md mx-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos por nombre, marca o categoría..."
              className="w-full pl-9 pr-4 py-2 bg-white rounded-2xl text-xs sm:text-sm font-medium border border-amber-300 focus:outline-none focus:ring-2 focus:ring-mass-red text-stone-900 shadow-sm"
              aria-label="Buscar productos"
            />
            <span className="absolute left-3 top-2.5 text-stone-400 text-sm">🔍</span>
          </div>
        </div>

        {/* Acciones: Carrito y Usuario */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Carrito */}
          <button
            onClick={onOpenCart}
            className="relative bg-stone-900 hover:bg-black text-white p-2.5 rounded-2xl shadow-md transition transform active:scale-95 flex items-center gap-2"
            aria-label="Ver Carrito de Compras"
          >
            <span className="text-base">🛒</span>
            <span className="hidden md:inline font-bold text-xs">Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-mass-red text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>

          {/* Login / Perfil */}
          {user ? (
            <button
              onClick={onOpenPerfil}
              className="bg-white/80 hover:bg-white text-stone-900 font-bold px-3 py-2 rounded-2xl text-xs border border-amber-300 shadow-sm transition flex items-center gap-1.5"
            >
              <span>👤</span>
              <span className="hidden lg:inline">{user.nombre ? user.nombre.split(' ')[0] : 'Mi Cuenta'}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="bg-mass-red hover:bg-red-700 text-white font-extrabold px-3 py-2 rounded-2xl text-xs shadow-md transition flex items-center gap-1.5"
            >
              <span>🔑</span>
              <span>Ingresar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderCliente;
