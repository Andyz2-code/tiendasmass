/**
 * TIENDAS MASS - Grid de Productos Destacados
 * Ubicación: frontend/src/interfaz-cliente/productos/productos-destacados.jsx
 */
import React from 'react';

export const ProductosDestacados = ({
  productos = [],
  onAddToCart = () => {},
  onSelectProduct = () => {}
}) => {
  if (!productos || productos.length === 0) return null;

  return (
    <section className="my-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 flex items-center gap-2">
            <span>⭐ Productos Destacados</span>
            <span className="bg-mass-red text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Top Ahorro</span>
          </h2>
          <p className="text-xs text-stone-500">Los favoritos de las familias con precios congelados</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {productos.map((prod) => (
          <div
            key={prod.id || prod.codigo}
            className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group"
          >
            <button
              type="button"
              className="w-full text-left p-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-mass-yellow rounded-xl"
              onClick={() => onSelectProduct(prod)}
            >
              <div className="h-32 w-full flex items-center justify-center bg-stone-50 rounded-xl mb-2 overflow-hidden relative">
                <img
                  src={prod.imagen_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300'}
                  alt={prod.nombre}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition"
                  loading="lazy"
                />
                {prod.descuento_porcentaje > 0 && (
                  <span className="absolute top-1 right-1 bg-mass-red text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                    -{prod.descuento_porcentaje}%
                  </span>
                )}
              </div>

              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{prod.categoria || 'Abarrotes'}</p>
              <h3 className="font-extrabold text-stone-900 text-xs line-clamp-2 leading-snug mb-1 group-hover:text-mass-red transition">
                {prod.nombre}
              </h3>
              <p className="text-stone-900 font-black text-sm">
                S/ {Number(prod.precio_venta || prod.precio || 0).toFixed(2)}
              </p>
            </button>

            <div className="p-3 pt-0">
              <button
                onClick={() => onAddToCart(prod)}
                className="w-full py-1.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1 active:scale-95"
              >
                <span>🛒</span>
                <span>Agregar</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProductosDestacados;
