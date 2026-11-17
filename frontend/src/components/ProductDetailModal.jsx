import React, { useState, useEffect } from 'react';
import { X, Heart, Check, RotateCcw, Recycle, Star, ShoppingCart } from 'lucide-react';

export const ProductDetailModal = ({
  product,
  isOpen,
  onClose,
  branch,
  onAddToCart,
  isFavorite,
  onToggleFavorite
}) => {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
  }, [product]);

  if (!isOpen || !product) return null;

  const stock = Number.parseInt(product.stock_actual || 0, 10);
  const priceNum = Number.parseFloat(product.precio_venta || 0);
  const origPrice = (priceNum * 1.25).toFixed(2);
  const subtotal = (priceNum * qty).toFixed(2);

  // Badge tipo el de la imagen
  let badgeLabel = 'MÁS VENDIDO';
  let badgeClass = 'bg-[#1b4d3e] text-white';
  if (priceNum <= 6.00) {
    badgeLabel = '-22% OFERTA';
    badgeClass = 'bg-[#ff671f] text-white';
  } else if ((product.nombre || '').toLowerCase().includes('pack') || (product.nombre || '').toLowerCase().includes('5 kg')) {
    badgeLabel = 'AHORRO PACK';
    badgeClass = 'bg-amber-500 text-stone-950';
  }

  const brand = (product.nombre || '').toUpperCase().includes('PRIMOR') ? 'PRIMOR' :
    (product.nombre || '').toUpperCase().includes('COSTEÑO') ? 'COSTEÑO' :
    (product.nombre || '').toUpperCase().includes('GLORIA') ? 'GLORIA' :
    (product.nombre || '').toUpperCase().includes('CLOROX') ? 'CLOROX' : 'MASS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="fixed inset-0 w-full h-full bg-transparent cursor-default border-none p-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col z-10 animate-in zoom-in-95 duration-200">
        
        {/* Cabecera / Breadcrumb */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3 bg-stone-50/70">
          <nav className="flex items-center gap-1.5 text-xs text-stone-500 font-semibold truncate">
            <span className="hover:text-stone-800">Inicio</span>
            <span>›</span>
            <span className="hover:text-stone-800">Catálogo</span>
            <span>›</span>
            <span className="hover:text-stone-800">{product.categoria_nombre || 'General'}</span>
            <span>›</span>
            <span className="text-stone-900 font-bold truncate">{product.nombre}</span>
          </nav>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center font-black text-stone-500 hover:text-stone-800 text-sm transition shrink-0"
            title="Cerrar detalle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido Principal del Detalle */}
        <div className="p-5 sm:p-8 overflow-y-auto space-y-6 custom-scroll">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
            
            {/* Columna Izquierda: Galería y Foto Principal */}
            <div className="md:col-span-7 space-y-4">
              <div className="flex gap-3 items-start">
                
                {/* Miniaturas Laterales como en la imagen */}
                <div className="flex flex-col gap-2 shrink-0">
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-stone-50 p-1 flex items-center justify-center border-2 transition cursor-pointer ${
                        idx === 0 ? 'border-emerald-700 shadow-xs' : 'border-stone-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={product.imagen_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300'}
                        alt={product.nombre}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ))}
                </div>

                {/* Imagen Principal Hero */}
                <div className="flex-1 h-72 sm:h-96 rounded-3xl overflow-hidden bg-stone-50/90 border border-stone-200/80 p-4 sm:p-6 flex items-center justify-center relative group shadow-2xs">
                  {/* Badge en la foto */}
                  <span className={`absolute top-4 left-4 ${badgeClass} text-[10px] sm:text-xs font-black px-3 py-1 rounded-full uppercase shadow-xs tracking-wider`}>
                    {badgeLabel}
                  </span>

                  {/* Botón Favorito en la foto */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleFavorite) onToggleFavorite(product.id);
                    }}
                    className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-sm shadow-md transition border ${
                      isFavorite ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white/95 text-stone-400 hover:text-red-500 border-stone-200'
                    }`}
                    title={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                  >
                    <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-600 text-red-600' : 'text-stone-400'}`} />
                  </button>

                  <img
                    src={product.imagen_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600'}
                    alt={product.nombre}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>

              {/* 3 Badges de Confianza debajo de la imagen (Como en la foto) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-2">
                <div className="bg-stone-50/90 border border-stone-200/80 rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center font-black text-xs shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-[11px] text-stone-900 leading-tight">100% Original</div>
                    <div className="text-[10px] text-stone-500 font-medium">Producto auténtico</div>
                  </div>
                </div>

                <div className="bg-stone-50/90 border border-stone-200/80 rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center font-black text-xs shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-[11px] text-stone-900 leading-tight">Garantía Mass</div>
                    <div className="text-[10px] text-stone-500 font-medium">Devolución fácil</div>
                  </div>
                </div>

                <div className="bg-stone-50/90 border border-stone-200/80 rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center font-black text-xs shrink-0">
                    <Recycle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-[11px] text-stone-900 leading-tight">Empaque Seguro</div>
                    <div className="text-[10px] text-stone-500 font-medium">Reciclable</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Información del Producto, Presentación y Compra */}
            <div className="md:col-span-5 space-y-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs">
              
              {/* Marca y SKU */}
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">
                {brand} • SKU {product.codigo_sku || 'SKU-000' + product.id}
              </div>

              {/* Título */}
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 leading-snug">
                {product.nombre}
              </h2>

              {/* Calificación y opiniones */}
              <div className="flex items-center gap-2 text-xs font-bold text-stone-600">
                <span className="flex text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  ))}
                </span>
                <span className="text-stone-900 font-black">4.8</span>
                <span className="text-stone-400 font-medium">(48 opiniones)</span>
              </div>

              {/* Precios (Verde esmeralda y tachado) */}
              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-800">
                  S/ {priceNum.toFixed(2)}
                </span>
                <span className="text-sm font-semibold text-stone-400 line-through">
                  S/ {origPrice}
                </span>
              </div>

              {/* Presentación seleccionable */}
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                  PRESENTACIÓN
                </div>
                <div className="border-2 border-emerald-800 bg-emerald-50/50 rounded-2xl p-3 text-center cursor-pointer shadow-2xs">
                  <div className="font-bold text-xs text-stone-900">
                    {product.unidad_medida || 'Presentación Estándar'}
                  </div>
                  <div className="font-black text-xs text-emerald-900 mt-0.5">
                    S/ {priceNum.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Descripción breve del producto */}
              <div className="text-xs text-stone-600 font-medium leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">
                {product.descripcion || `${product.nombre} con calidad y frescura garantizada bajo estándares Mass PEPS. Ahorro insuperable para tu canasta familiar.`}
              </div>

              {/* Barra de Stock en Tienda */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-stone-600">
                    Stock en {branch?.nombre?.replace('Tienda Mass - ', '') || 'Huancayo'}
                  </span>
                  <span className={stock <= 0 ? 'text-red-600 font-black' : stock <= 10 ? 'text-amber-600 font-black' : 'text-emerald-800 font-black'}>
                    {stock <= 0 ? 'Producto agotado' : stock <= 10 ? `¡Solo ${stock} disponibles!` : `${stock} disponibles`}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      stock <= 0 ? 'bg-red-500' : stock <= 10 ? 'bg-amber-500' : 'bg-emerald-800'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(stock <= 0 ? 0 : 15, (stock / 80) * 100))}%` }}
                  ></div>
                </div>
              </div>

              {/* Selector de Cantidad y Botón de Agregar al Carrito con Validación Estricta */}
              <div className="flex items-center gap-3 pt-3">
                <div className="flex items-center border border-stone-200 rounded-2xl bg-stone-50 px-3 py-2 shrink-0">
                  <button
                    disabled={stock <= 0 || qty <= 1}
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="text-stone-500 hover:text-stone-900 disabled:text-stone-300 font-black px-2 text-sm"
                  >
                    -
                  </button>
                  <span className="text-sm font-black text-stone-900 w-7 text-center">
                    {stock <= 0 ? 0 : qty}
                  </span>
                  <button
                    disabled={stock <= 0 || qty >= stock}
                    onClick={() => {
                      if (qty < stock) setQty(qty + 1);
                      else alert(`Disponibilidad máxima en tienda: ${stock} unidades.`);
                    }}
                    className="text-stone-500 hover:text-stone-900 disabled:text-stone-300 font-black px-2 text-sm"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (stock <= 0) {
                      alert('Este producto no tiene stock disponible.');
                      return;
                    }
                    if (onAddToCart) onAddToCart(product, qty);
                    onClose();
                  }}
                  disabled={stock <= 0}
                  className="flex-1 py-3 bg-[#ff7332] hover:bg-[#ea5d1e] text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 active:scale-95 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{stock <= 0 ? 'Producto Agotado' : `Agregar al Carrito • S/ ${subtotal}`}</span>
                </button>
              </div>

              {/* NOTA: Envío Express y Retiro Gratis Magdalena omitidos estrictamente */}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
