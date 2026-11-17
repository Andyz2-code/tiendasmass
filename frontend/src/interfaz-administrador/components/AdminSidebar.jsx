/**
 * TIENDAS MASS - Sidebar de Navegación del Administrador
 * Ubicación: frontend/src/interfaz-administrador/components/AdminSidebar.jsx
 */
import React from 'react';

const MENU_ITEMS = [
  { id: 'reportes-generales', label: 'Reportes Generales', icon: '📊' },
  { id: 'productos', label: 'Gestión de Productos', icon: '📦' },
  { id: 'inventario', label: 'Inventario PEPS (FIFO)', icon: '🔄' },
  { id: 'almacen', label: 'Matriz ABC & Almacén', icon: '🏷️' },
  { id: 'conteos', label: 'Conteos Físicos', icon: '📋' },
  { id: 'ventas', label: 'Ventas y Comprobantes', icon: '🧾' },
  { id: 'delivery', label: 'Monitoreo Delivery', icon: '🛵' },
  { id: 'banners', label: 'Banners Comerciales', icon: '🖼️' },
  { id: 'sucursales', label: 'Red de Sucursales', icon: '🏬' },
  { id: 'usuarios', label: 'Control de Usuarios', icon: '👥' }
];

export const AdminSidebar = ({ activeTab, onSelectTab }) => {
  return (
    <aside className="w-64 bg-stone-900 border-r border-stone-800 flex flex-col shrink-0 min-h-screen text-stone-300">
      <div className="p-4 border-b border-stone-800 flex items-center gap-3">
        <div className="flex items-center justify-center shrink-0">
          <img
            src="/tiendasmass/frontend/assets/images/logo-mass-isotipo.png"
            alt="Tiendas Mass"
            className="h-8 sm:h-9 w-auto object-contain select-none"
            onError={(e) => { e.target.src = 'assets/images/logo-mass-isotipo.png'; }}
          />
        </div>
        <div>
          <h2 className="font-extrabold text-white text-sm">Administración</h2>
          <p className="text-[10px] text-stone-400">Control Global Centralizado</p>
        </div>
      </div>

      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left ${
                isActive
                  ? 'bg-mass-red text-white shadow-xs font-black'
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
        Tiendas Mass © 2026 • Panel Admin
      </div>
    </aside>
  );
};

export default AdminSidebar;
