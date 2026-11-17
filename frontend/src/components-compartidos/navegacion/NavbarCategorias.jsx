/**
 * TIENDAS MASS - Barra de Navegación de Categorías
 * Ubicación: frontend/src/components-compartidos/navegacion/NavbarCategorias.jsx
 */
import React from 'react';

const CATEGORIAS_DEFAULT = [
  'TODOS',
  'Abarrotes y Despensa',
  'Lácteos y Huevos',
  'Bebidas y Licores',
  'Snacks y Golosinas',
  'Limpieza y Cuidado',
  'Congelados y Embutidos',
  'Cuidado Personal'
];

export const NavbarCategorias = ({
  categories = CATEGORIAS_DEFAULT,
  selectedCategory = 'TODOS',
  onSelectCategory = () => {}
}) => {
  return (
    <nav className="bg-white border-b border-stone-200 shadow-xs overflow-x-auto py-2.5 px-4 scrollbar-none" aria-label="Categorías de Productos">
      <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-bold whitespace-nowrap">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full transition ${
                isSelected
                  ? 'bg-mass-red text-white shadow-xs font-black'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default NavbarCategorias;
