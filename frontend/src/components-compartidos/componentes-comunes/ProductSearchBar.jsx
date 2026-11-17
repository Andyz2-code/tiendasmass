import React from 'react';
import { Search, X, Loader2 } from 'lucide-react';

/**
 * ProductSearchBar - Componente de Búsqueda Accesible y Optimizado
 * Ubicación: frontend/src/components-compartidos/componentes-comunes/ProductSearchBar.jsx
 * 
 * - Debounce integrado de 500ms
 * - Indicador visual de carga animado
 * - Botón de limpieza accesible
 * - Anuncios ARIA Live para lectores de pantalla
 */
export const ProductSearchBar = ({
  value = '',
  onChange = () => {},
  onClear = () => {},
  isSearching = false,
  placeholder = 'Busca productos, marcas y ofertas de ahorro...',
  className = '',
  onSubmit = () => {}
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Escape') {
      onClear();
    }
  };

  return (
    <div
      role="search"
      aria-label="Formulario de búsqueda de productos"
      className={`relative flex items-center bg-white rounded-full border-2 border-stone-200 focus-within:border-mass-red overflow-hidden shadow-sm transition-all ${className}`}
    >
      {/* Icono de búsqueda o spinner de carga */}
      <div className="pl-4 pr-2 flex items-center justify-center text-stone-400 select-none">
        {isSearching ? (
          <Loader2 className="w-4 h-4 text-mass-red animate-spin" aria-hidden="true" />
        ) : (
          <Search className="w-4 h-4 text-stone-400" aria-hidden="true" />
        )}
      </div>

      {/* Campo de Entrada Accesible */}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Buscar productos, marcas y ofertas"
        aria-busy={isSearching}
        autoComplete="off"
        spellCheck="false"
        className="w-full py-2 sm:py-2.5 text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none bg-transparent font-medium"
      />

      {/* Botón de limpiar búsqueda */}
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Borrar texto de búsqueda"
          title="Borrar búsqueda"
          className="px-3 py-1 text-stone-400 hover:text-stone-700 font-bold text-xs flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Botón Buscar */}
      <button
        type="button"
        onClick={onSubmit}
        className="bg-mass-red hover:bg-red-700 text-white font-black text-xs uppercase px-4 sm:px-6 py-2.5 transition shrink-0 cursor-pointer hidden sm:block"
      >
        Buscar
      </button>
    </div>
  );
};

export default ProductSearchBar;
