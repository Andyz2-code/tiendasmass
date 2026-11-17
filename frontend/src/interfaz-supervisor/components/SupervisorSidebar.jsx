/**
 * TIENDAS MASS - Sidebar de Navegación del Supervisor
 * Ubicación: frontend/src/interfaz-supervisor/components/SupervisorSidebar.jsx
 */
import React from 'react';

const SUPERVISOR_MENU = [
  { id: 'reportes-generales', label: 'Reportes de Sucursal', icon: '📊' },
  { id: 'productos', label: 'Catálogo y Precios', icon: '📦' },
  { id: 'inventario', label: 'Inventario PEPS Local', icon: '🔄' },
  { id: 'almacen', label: 'Matriz ABC Local', icon: '🏷️' },
  { id: 'conteos', label: 'Conteos Físicos de Tienda', icon: '📋' },
  { id: 'delivery', label: 'Despacho & Delivery', icon: '🛵' },
  { id: 'banners', label: 'Banners Informativos', icon: '🖼️' }
];

export const SupervisorSidebar = ({ activeTab, onSelectTab, sucursalNombre = 'Huancayo Centro' }) => {
  return (
    <aside className="w-64 bg-stone-900 border-r border-stone-800 flex flex-col shrink-0 min-h-screen text-stone-300">
      <div className="p-4 border-b border-stone-800 flex items-center gap-3">
        <div className="bg-mass-yellow p-1.5 rounded-xl border border-amber-400 shadow-md flex items-center justify-center shrink-0">
          <img
            src="/tiendasmass/frontend/assets/logo-mass-isotipo.png"
            alt="Tiendas Mass"
            className="h-8 w-auto object-contain select-none"
            onError={(e) => { e.target.src = 'assets/logo-mass-isotipo.png'; }}
          />
        </div>
        <div>
          <h2 className="font-extrabold text-white text-sm">Supervisión</h2>
          <p className="text-[10px] text-amber-300 font-bold truncate max-w-[120px]">📍 {sucursalNombre}</p>
        </div>
      </div>

      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {SUPERVISOR_MENU.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left ${
                isActive
                  ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                  : 'hover:bg-stone-800 text-stone-300'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-stone-800 text-[10px] text-stone-500 text-center">
        Restricción de Seguridad: Sucursal Asignada
      </div>
    </aside>
  );
};

export default SupervisorSidebar;
