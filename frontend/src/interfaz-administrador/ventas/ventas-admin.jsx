/**
 * TIENDAS MASS - Gestión de Ventas y Comprobantes
 * Ubicación: frontend/src/interfaz-administrador/ventas/ventas-admin.jsx
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export const VentasAdminView = () => {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    fetchVentas();
  }, []);

  const fetchVentas = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost/tiendasmass/backend/public/api/ventas');
      setVentas(res.data?.data || []);
    } catch {
      setVentas([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredVentas = ventas.filter((v) => {
    if (filterStatus === 'ALL') return true;
    return String(v.estado).toUpperCase() === filterStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
            <span>🛒 Registro y Gestión de Ventas</span>
          </h2>
          <p className="text-xs text-stone-500">Historial de tickets, boletas y pedidos despachados</p>
        </div>
        <div className="flex items-center gap-2">
          {['ALL', 'COMPLETADO', 'PENDIENTE', 'CANCELADO'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filterStatus === st
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {st === 'ALL' ? 'Todos' : st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-extrabold uppercase text-[10px]">
                <th className="py-3 px-4"># Venta</th>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Sucursal</th>
                <th className="py-3 px-4">Método Pago</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-stone-400">Cargando transacciones...</td>
                </tr>
              ) : filteredVentas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-stone-400">No se encontraron ventas para el filtro seleccionado.</td>
                </tr>
              ) : (
                filteredVentas.map((v) => (
                  <tr key={v.id || v.codigo} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 font-black text-stone-900">#{v.id || v.codigo}</td>
                    <td className="py-3 px-4 text-stone-600">{v.fecha || 'Reciente'}</td>
                    <td className="py-3 px-4 font-bold text-stone-800">{v.cliente_nombre || v.usuario?.nombre || 'Público General'}</td>
                    <td className="py-3 px-4 text-stone-600">{v.sucursal_nombre || 'Huancayo Centro'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-stone-100 px-2 py-0.5 rounded font-bold text-[11px] text-stone-700">
                        {v.tipo_pago || 'Efectivo / Yape'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-stone-900">
                      S/ {Number(v.total || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        String(v.estado).toLowerCase() === 'completado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : String(v.estado).toLowerCase() === 'cancelado'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {v.estado || 'Completado'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VentasAdminView;
