/**
 * TIENDAS MASS - Modal de Perfil de Usuario Cliente
 * Ubicación: frontend/src/interfaz-cliente/perfil/PerfilClienteModal.jsx
 */
import React from 'react';

export const PerfilClienteModal = ({ user, onClose, onLogout, onOpenMisCompras }) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-mass-modal">
        <div className="p-5 bg-mass-yellow border-b border-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">👤</span>
            <h3 className="font-black text-stone-900 text-base">Mi Perfil Mass</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-900/10 hover:bg-stone-900/20 font-bold flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center pb-4 border-b border-stone-100">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 text-2xl font-black flex items-center justify-center mx-auto mb-2">
              {user.nombre ? user.nombre.charAt(0).toUpperCase() : 'M'}
            </div>
            <h4 className="font-extrabold text-stone-900 text-base">{user.nombre || 'Cliente'}</h4>
            <p className="text-xs text-stone-500">{user.email || 'Sin correo'}</p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 rounded-xl bg-stone-50">
              <span className="text-stone-500">Documento:</span>
              <span className="font-bold text-stone-900">{user.dni || '72819382'}</span>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-stone-50">
              <span className="text-stone-500">Teléfono:</span>
              <span className="font-bold text-stone-900">{user.telefono || '987654321'}</span>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-stone-50">
              <span className="text-stone-500">Dirección:</span>
              <span className="font-bold text-stone-900">{user.direccion || 'Huancayo, Junín'}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 flex flex-col gap-2">
            <button
              onClick={() => { onClose(); if (onOpenMisCompras) onOpenMisCompras(); }}
              className="w-full py-2.5 bg-stone-900 hover:bg-black text-white font-bold rounded-xl text-xs transition"
            >
              📦 Ver Mis Compras
            </button>
            <button
              onClick={onLogout}
              className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfilClienteModal;
