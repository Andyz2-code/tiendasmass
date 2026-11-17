/**
 * TIENDAS MASS - Footer de Backoffice (Admin / Supervisor)
 * Ubicación: frontend/src/components-compartidos/footer/FooterBackoffice.jsx
 */
import React from 'react';

export const FooterBackoffice = () => {
  return (
    <footer className="bg-stone-950 border-t border-stone-800 text-stone-500 text-[11px] py-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 mt-auto">
      <div>
        <span className="font-bold text-stone-400">Tiendas Mass Backoffice v2.6</span> — Control Operativo, PEPS FIFO & Matriz ABC
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>MySQL & Node.js Sync OK</span>
        </span>
        <span>•</span>
        <span>Soporte TI 24/7</span>
      </div>
    </footer>
  );
};

export default FooterBackoffice;
