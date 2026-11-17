/**
 * TIENDAS MASS - Utilidades y Formateadores Globales
 * Ubicación: frontend/src/shared/utils/formatters.js
 */

export const formatMoney = (amount) => {
  const val = Number(amount) || 0;
  return `S/ ${val.toFixed(2)}`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

export const getOrderStatusBadge = (status) => {
  const s = String(status).toLowerCase();
  switch (s) {
    case 'completado':
    case 'entregado':
      return { label: 'Entregado', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'en camino':
    case 'en_camino':
      return { label: 'En Camino', className: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'preparando':
      return { label: 'En Preparación', className: 'bg-blue-100 text-blue-800 border-blue-300' };
    case 'cancelado':
      return { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-300' };
    default:
      return { label: status || 'Pendiente', className: 'bg-stone-100 text-stone-800 border-stone-300' };
  }
};

export const getAbcBadge = (clase) => {
  switch (String(clase).toUpperCase()) {
    case 'A':
      return { label: 'Clase A (80% Valor)', className: 'bg-emerald-500 text-white font-extrabold' };
    case 'B':
      return { label: 'Clase B (15% Valor)', className: 'bg-amber-500 text-stone-900 font-bold' };
    case 'C':
      return { label: 'Clase C (5% Valor)', className: 'bg-stone-400 text-white font-medium' };
    default:
      return { label: clase || 'S/C', className: 'bg-stone-200 text-stone-700' };
  }
};
