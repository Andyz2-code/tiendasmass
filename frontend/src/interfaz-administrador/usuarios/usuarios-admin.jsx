/**
 * TIENDAS MASS - Gestión de Usuarios y Roles
 * Ubicación: frontend/src/interfaz-administrador/usuarios/usuarios-admin.jsx
 */
import React, { useState } from 'react';

export const UsuariosAdminView = () => {
  const [usuarios] = useState([
    { id: 1, nombre: 'Admin General Mass', email: 'admin@tiendasmass.pe', rol: 'ADMINISTRADOR', sucursal: 'Todas (Global)', estado: 'ACTIVO' },
    { id: 2, nombre: 'Supervisor Huancayo', email: 'supervisor.hyo@tiendasmass.pe', rol: 'SUPERVISOR', sucursal: 'Mass - Huancayo Centro', estado: 'ACTIVO' },
    { id: 3, nombre: 'Supervisor El Tambo', email: 'supervisor.tambo@tiendasmass.pe', rol: 'SUPERVISOR', sucursal: 'Mass - El Tambo', estado: 'ACTIVO' },
    { id: 4, nombre: 'Cajero Principal', email: 'cajero1@tiendasmass.pe', rol: 'CAJERO', sucursal: 'Mass - Huancayo Centro', estado: 'ACTIVO' }
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
            <span>👥 Control de Usuarios y Permisos RBAC</span>
          </h2>
          <p className="text-xs text-stone-500">Gestión de cuentas para administradores, supervisores y personal de tienda</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-extrabold uppercase text-[10px]">
              <th className="py-3 px-4">Usuario</th>
              <th className="py-3 px-4">Email Corporativo</th>
              <th className="py-3 px-4">Rol Asignado</th>
              <th className="py-3 px-4">Sucursal Autorizada</th>
              <th className="py-3 px-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-stone-50 transition">
                <td className="py-3 px-4 font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs">👤</span>
                  <span>{u.nombre}</span>
                </td>
                <td className="py-3 px-4 text-stone-600">{u.email}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    u.rol === 'ADMINISTRADOR'
                      ? 'bg-red-100 text-red-800'
                      : u.rol === 'SUPERVISOR'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {u.rol}
                  </span>
                </td>
                <td className="py-3 px-4 text-stone-700 font-medium">{u.sucursal}</td>
                <td className="py-3 px-4 text-center">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    {u.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsuariosAdminView;
