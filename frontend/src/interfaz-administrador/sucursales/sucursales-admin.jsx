/**
 * TIENDAS MASS - Gestión de Sucursales
 * Ubicación: frontend/src/interfaz-administrador/sucursales/sucursales-admin.jsx
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export const SucursalesAdminView = () => {
  const [sucursales, setSucursales] = useState([
    { id: 1, nombre: 'Mass - Huancayo Centro', direccion: 'Calle Real 450, Huancayo', telefono: '064-234567', estado: 'ACTIVO', tipo: 'Tienda & Almacén Principal' },
    { id: 2, nombre: 'Mass - El Tambo', direccion: 'Av. Mariscal Castilla 1230, El Tambo', telefono: '064-245678', estado: 'ACTIVO', tipo: 'Tienda Express' },
    { id: 3, nombre: 'Mass - Chilca', direccion: 'Av. 9 de Diciembre 780, Chilca', telefono: '064-256789', estado: 'ACTIVO', tipo: 'Tienda & Delivery Hub' }
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
            <span>📍 Red de Sucursales y Almacenes</span>
          </h2>
          <p className="text-xs text-stone-500">Supervisión territorial y control de puntos de despacho</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sucursales.map((suc) => (
          <div key={suc.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">🏬</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                {suc.estado}
              </span>
            </div>
            <h3 className="font-extrabold text-stone-900 text-sm mb-1">{suc.nombre}</h3>
            <p className="text-xs text-stone-500 mb-3">{suc.tipo}</p>
            <div className="space-y-1.5 text-xs text-stone-600 border-t border-stone-100 pt-3">
              <p>📍 {suc.direccion}</p>
              <p>📞 {suc.telefono}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SucursalesAdminView;
