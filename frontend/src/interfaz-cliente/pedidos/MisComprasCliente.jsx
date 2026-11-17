/**
 * TIENDAS MASS - Módulo de Mis Compras del Cliente
 * Ubicación: frontend/src/interfaz-cliente/pedidos/MisComprasCliente.jsx
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export const MisComprasCliente = ({ user, onClose, onTrackOrder }) => {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      axios.get(`http://localhost/tiendasmass/backend/public/api/ventas?usuario_id=${user.id}`)
        .then(res => setCompras(res.data?.data || []))
        .catch(() => setCompras([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-mass-yellow border-b border-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <h3 className="font-black text-stone-900 text-base">Mis Compras y Pedidos</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-900/10 hover:bg-stone-900/20 font-bold flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 text-center text-stone-400">Cargando tus compras...</div>
          ) : compras.length === 0 ? (
            <div className="py-12 text-center text-stone-400">No registras compras previas.</div>
          ) : (
            compras.map(c => (
              <div key={c.id || c.codigo} className="border border-stone-200 rounded-2xl p-4 flex items-center justify-between hover:border-amber-400 transition">
                <div>
                  <p className="font-extrabold text-stone-900 text-sm">Pedido #{c.id || c.codigo}</p>
                  <p className="text-xs text-stone-500">{c.fecha} • {c.tipo_pago}</p>
                  <p className="text-xs font-bold text-emerald-600 mt-1">{c.estado || 'Entregado'}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-stone-900 text-base">S/ {Number(c.total || 0).toFixed(2)}</p>
                  {onTrackOrder && (
                    <button
                      onClick={() => onTrackOrder(c)}
                      className="mt-2 text-xs font-bold text-mass-red hover:underline"
                    >
                      Ver Rastreo
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MisComprasCliente;
