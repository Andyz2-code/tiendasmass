/**
 * TIENDAS MASS - Módulo de Ofertas y Promociones Especiales
 * Ubicación: frontend/src/interfaz-cliente/banners/ofertas.jsx
 */
import React from 'react';

export const OfertasPromociones = ({ onSelectOferta = () => {} }) => {
  const ofertas = [
    { id: 1, titulo: 'Ahorro Imbatible Mass', desc: 'Hasta 30% en Abarrotes de primera necesidad', tag: 'Ahorro Top', color: 'from-amber-400 to-yellow-500' },
    { id: 2, titulo: 'Marcas Exclusivas Mass', desc: 'Calidad comprobada al precio más bajo del mercado', tag: 'Exclusivo Mass', color: 'from-red-600 to-red-700 text-white' },
    { id: 3, titulo: 'Delivery Express Huancayo', desc: 'Recibe en tu domicilio en menos de 45 minutos', tag: 'Envío Rápido', color: 'from-stone-900 to-stone-800 text-white' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
      {ofertas.map((of) => (
        <button
          type="button"
          key={of.id}
          onClick={() => onSelectOferta(of)}
          className={`w-full text-left bg-gradient-to-r ${of.color} p-4 rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer transform hover:-translate-y-0.5 border border-amber-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400`}
        >
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-xs mb-2">
            {of.tag}
          </span>
          <h4 className="font-extrabold text-base leading-tight mb-1">{of.titulo}</h4>
          <p className="text-xs opacity-90">{of.desc}</p>
        </button>
      ))}
    </div>
  );
};

export default OfertasPromociones;
