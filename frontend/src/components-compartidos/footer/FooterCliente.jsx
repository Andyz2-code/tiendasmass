/**
 * TIENDAS MASS - Footer del Portal Cliente
 * Ubicación: frontend/src/components-compartidos/footer/FooterCliente.jsx
 */
import React from 'react';

export const FooterCliente = () => {
  return (
    <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800 mt-auto select-none">
      <div className="max-w-7xl mx-auto px-4 text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <img
            src="/tiendasmass/frontend/assets/images/logo-mass-isotipo.png"
            alt="Tiendas Mass"
            className="h-6 w-auto object-contain select-none"
            onError={(e) => { e.target.src = 'assets/images/logo-mass-isotipo.png'; }}
          />
          <span className="font-extrabold text-white text-sm">Tiendas Mass © 2026</span>
        </div>
        <p className="text-stone-400 max-w-xl mx-auto text-[11px] leading-relaxed">
          Portal Omnicanal de Precios Bajos Garantizados. Huancayo, Junín y todo el Perú.
          Precios sujetos a disponibilidad en tienda y almacén.
        </p>
        <div className="flex items-center justify-center gap-4 text-[11px] text-stone-500 pt-2 border-t border-stone-800">
          <span>Libro de Reclamaciones</span>
          <span>•</span>
          <span>Términos y Condiciones</span>
          <span>•</span>
          <span>Política de Privacidad</span>
        </div>
      </div>
    </footer>
  );
};

export default FooterCliente;
