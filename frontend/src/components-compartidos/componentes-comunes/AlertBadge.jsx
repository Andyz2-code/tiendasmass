import React from 'react';

export const AbcBadge = ({ clase }) => {
  const styles = {
    A: 'bg-amber-100 text-amber-800 border-amber-300',
    B: 'bg-blue-100 text-blue-800 border-blue-300',
    C: 'bg-stone-100 text-stone-700 border-stone-300'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${styles[clase] || styles.C}`}>
      Clase {clase}
    </span>
  );
};

export const StockStatusBadge = ({ estado, stock, por }) => {
  if (estado === 'CRITICO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
        Crítico ({stock} un.)
      </span>
    );
  }

  if (estado === 'EN_REORDEN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        Punto Reorden ({stock} ≤ {por})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
      Óptimo ({stock} un.)
    </span>
  );
};

export const ExpiryAlertBadge = ({ dias }) => {
  if (dias < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-black text-white">
        Vencido (hace {Math.abs(dias)} d)
      </span>
    );
  }
  if (dias <= 7) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white animate-pulse">
        ¡Vence en {dias} días! (NIC 2)
      </span>
    );
  }
  if (dias <= 15) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
        Vence en {dias} días (Promoción)
      </span>
    );
  }
  if (dias <= 30) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
        Vence en {dias} días (PEPS)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-600">
      Vigente ({dias} días)
    </span>
  );
};
