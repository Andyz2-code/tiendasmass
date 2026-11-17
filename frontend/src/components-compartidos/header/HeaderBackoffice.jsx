/**
 * TIENDAS MASS - Header de Administración y Supervisión
 * Ubicación: frontend/src/components-compartidos/header/HeaderBackoffice.jsx
 */
import React from 'react';

export const HeaderBackoffice = ({
  user = null,
  role = 'Administrador',
  sucursalNombre = 'Todas las Sucursales (Global)',
  onLogout = () => {},
  systemStatus = 'En Línea'
}) => {
  return (
    <header className="bg-stone-900 border-b border-stone-800 text-stone-100 px-4 py-3 sticky top-0 z-30 shadow-md">
      <div className="flex items-center justify-between">
        {/* Marca y Rol */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center shrink-0">
            <img
              src="/tiendasmass/frontend/assets/images/logo-mass-isotipo.png"
              alt="Tiendas Mass"
              className="h-8 sm:h-9 w-auto object-contain select-none"
              onError={(e) => { e.target.src = 'assets/images/logo-mass-isotipo.png'; }}
            />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base leading-tight flex items-center gap-2">
              <span>Backoffice</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                role === 'Supervisor' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
              }`}>
                {role}
              </span>
            </h1>
            <p className="text-[11px] text-stone-400">
              📍 {sucursalNombre}
            </p>
          </div>
        </div>

        {/* Estado y Perfil */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden md:flex items-center gap-1.5 bg-stone-800/80 px-2.5 py-1 rounded-xl border border-stone-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-stone-300 font-semibold">{systemStatus}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="font-bold text-white text-xs">{user?.nombre || 'Usuario Autorizado'}</p>
              <p className="text-[10px] text-stone-400">{user?.email || 'mass@tiendas.pe'}</p>
            </div>
            <button
              onClick={onLogout}
              className="bg-stone-800 hover:bg-red-900/60 text-stone-300 hover:text-red-200 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-stone-700 hover:border-red-600 flex items-center gap-1"
              title="Cerrar Sesión Segura"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderBackoffice;
