import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useBranch } from '../../context/BranchContext';
import { useCart } from '../../context/CartContext';
import api from '../../services/api';
import { ShoppingBag, Heart, ArrowRight, AlertCircle, ShoppingCart, AlertTriangle, Search, Loader2, X } from 'lucide-react';
import { ProductDetailModal } from '../../components/ProductDetailModal';
import { BannerCarousel } from '../../components/BannerCarousel';
import useDebounce from '../../shared/utils/useDebounce';
import { ProductSearchBar } from '../../components-compartidos/componentes-comunes/ProductSearchBar';

const POPULAR_BRANDS = [
  'PRIMOR', 'COSTEÑO', 'GLORIA', 'MASS', 'CAMPO MASS',
  'BOLÍVAR', 'INKA KOLA', 'LA CALERA', 'ALTOMAYO', 'DON VITTORIO', 'LAIVE', 'COSTENITO'
];

function detectBrand(name) {
  const upper = (name || '').toUpperCase();
  for (const b of POPULAR_BRANDS) {
    if (upper.includes(b)) return b;
  }
  return 'MASS';
}

export const CatalogoView = () => {
  const { selectedBranch } = useBranch();
  const { addToCart } = useCart();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados
  const [selectedCat, setSelectedCat] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isOffersOnly, setIsOffersOnly] = useState(false);
  const [isFavoritesOnly, setIsFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mass_client_favorites') || '[]');
    } catch {
      return [];
    }
  });
  const [localQtys, setLocalQtys] = useState({});
  const [selectedProductModal, setSelectedProductModal] = useState(null);

  // Optimización de Búsqueda: Debounce 500ms + AbortController
  const debouncedSearch = useDebounce(catalogSearch, 500);
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortRef = useRef(null);

  // Monitoreo del estado de escritura
  useEffect(() => {
    if (catalogSearch.trim() !== debouncedSearch) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [catalogSearch, debouncedSearch]);

  const fetchData = async (term = debouncedSearch, cat = selectedCat) => {
    if (!selectedBranch?.id) return;

    // Cancelar petición anterior si aún está en vuelo
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('sucursal_id', selectedBranch.id);
      if (cat) params.append('categoria_id', cat);
      if (term && term.trim()) params.append('search', term.trim());

      const [prodRes, catRes] = await Promise.all([
        api.get(`/productos?${params.toString()}`, { signal: controller.signal }),
        api.get('/categorias', { signal: controller.signal })
      ]);
      setProductos(prodRes.data || []);
      setCategorias(catRes.data || []);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      console.error('Error al cargar catálogo:', err);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchData(debouncedSearch, selectedCat);
  }, [selectedBranch, debouncedSearch, selectedCat]);

  // Soporte para abrir modal directo si hay ?producto= en URL
  useEffect(() => {
    const prodParam = new URLSearchParams(window.location.search).get('producto');
    if (prodParam && productos.length > 0) {
      const found = productos.find(
        p => String(p.id) === String(prodParam) || String(p.codigo_sku).toLowerCase() === String(prodParam).toLowerCase()
      );
      if (found) {
        setSelectedProductModal(found);
      }
    }
  }, [productos]);

  const toggleFavorite = (productId) => {
    setFavorites(prev => {
      const next = prev.includes(productId) ? prev.filter(x => x !== productId) : [...prev, productId];
      localStorage.setItem('mass_client_favorites', JSON.stringify(next));
      return next;
    });
  };

  const updateLocalQty = (productId, delta, maxStock) => {
    if (maxStock <= 0) return;
    setLocalQtys(prev => {
      const cur = prev[productId] || 1;
      const next = cur + delta;
      if (next < 1) return { ...prev, [productId]: 1 };
      if (next > maxStock) {
        alert(`Disponibilidad máxima en esta tienda: ${maxStock} unidades.`);
        return { ...prev, [productId]: maxStock };
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleResetAllFilters = () => {
    setSelectedCat(null);
    setCatalogSearch('');
    setIsOffersOnly(false);
    setIsFavoritesOnly(false);
  };

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      const price = parseFloat(p.precio_venta || 0);

      // Categoría
      if (selectedCat && parseInt(p.categoria_id) !== parseInt(selectedCat)) {
        return false;
      }

      // Solo Ofertas
      if (isOffersOnly && !(price <= 6.00 || p.es_perecedero === 1)) {
        return false;
      }

      // Solo Favoritos
      if (isFavoritesOnly && !favorites.includes(p.id)) {
        return false;
      }

      // Búsqueda por texto
      if (catalogSearch && catalogSearch.trim() !== '') {
        const q = catalogSearch.toLowerCase().trim();
        const matchName = (p.nombre || '').toLowerCase().includes(q);
        const matchSku = (p.codigo_sku || '').toLowerCase().includes(q);
        const matchBrand = detectBrand(p.nombre).toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchBrand) return false;
      }

      return true;
    });
  }, [productos, selectedCat, catalogSearch, isOffersOnly, isFavoritesOnly, favorites]);

  const activeCatObj = categorias.find(c => c.id === selectedCat);
  const hasAnyActiveFilter = selectedCat !== null || isOffersOnly || isFavoritesOnly || (catalogSearch && catalogSearch.trim() !== '');
  const showHeroBanner = !selectedCat && !isOffersOnly && !isFavoritesOnly && !catalogSearch;

  return (
    <div className="space-y-6">
      {/* Banner Principal Dinámico de Ofertas (BD + Carrusel) */}
      {showHeroBanner && (
        <BannerCarousel
          sucursalId={selectedBranch?.id}
          onCtaClick={() => {
            const el = document.getElementById('catalogo-grid');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      )}

      {/* Barra de Sub-Navegación / Categorías limpia y ordenada */}
      <div className="bg-white border border-stone-200/90 rounded-2xl px-4 py-3 shadow-2xs flex items-center">
        <div className="w-full flex items-center gap-2.5 overflow-x-auto custom-scroll py-0.5 text-xs sm:text-sm">
          <button
            onClick={() => handleResetAllFilters()}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition shrink-0 ${
              selectedCat === null && !isOffersOnly && !isFavoritesOnly
                ? 'bg-mass-red text-white shadow-xs font-black'
                : 'text-stone-700 hover:bg-stone-100 hover:text-stone-950'
            }`}
          >
            Inicio
          </button>

          <button
            onClick={() => {
              setIsOffersOnly(!isOffersOnly);
              setSelectedCat(null);
              setIsFavoritesOnly(false);
            }}
            className={`px-4 py-1.5 rounded-full font-black text-xs transition shrink-0 flex items-center gap-1.5 ${
              isOffersOnly
                ? 'bg-[#ff7332] text-white shadow-xs'
                : 'text-[#ff7332] hover:bg-orange-50'
            }`}
          >
            <span>💥</span>
            <span>Ofertas Bomba</span>
          </button>

          <button
            onClick={() => {
              setIsFavoritesOnly(!isFavoritesOnly);
              setSelectedCat(null);
              setIsOffersOnly(false);
            }}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition shrink-0 flex items-center gap-1.5 ${
              isFavoritesOnly
                ? 'bg-red-500 text-white shadow-xs'
                : 'text-red-500 hover:bg-red-50'
            }`}
          >
            <span>♡</span>
            <span>Favoritos ({favorites.length})</span>
          </button>

          <span className="text-stone-300 font-bold shrink-0">|</span>

          {categorias.map(cat => {
            const isSelected = selectedCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCat(isSelected ? null : cat.id);
                  setIsOffersOnly(false);
                  setIsFavoritesOnly(false);
                }}
                className={`px-3.5 py-1.5 rounded-full font-semibold text-xs whitespace-nowrap transition shrink-0 ${
                  isSelected
                    ? 'bg-stone-900 text-mass-yellow font-black shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                {cat.nombre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Breadcrumbs de Navegación */}
      <nav className="flex items-center gap-1.5 text-xs text-stone-500 font-semibold">
        <button
          onClick={handleResetAllFilters}
          className="hover:text-mass-red transition"
        >
          Inicio
        </button>
        <span className="text-stone-300">›</span>
        <button
          onClick={() => {
            setSelectedCat(null);
            setIsOffersOnly(false);
            setIsFavoritesOnly(false);
          }}
          className="hover:text-mass-red transition"
        >
          Catálogo de Productos
        </button>
        <span className="text-stone-300">›</span>
        <span className="text-mass-red font-black">
          {activeCatObj ? activeCatObj.nombre : isOffersOnly ? 'Ofertas Bomba' : isFavoritesOnly ? 'Favoritos' : 'Todos los productos'}
        </span>
      </nav>

      {/* Cabecera del Catálogo */}
      <div id="catalogo-grid" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Catálogo General de Productos
            </h1>
            <span className="text-xs font-bold bg-white text-stone-600 px-3 py-1 rounded-full border border-stone-200 shadow-2xs">
              {filteredProducts.length} productos
            </span>
            {hasAnyActiveFilter && (
              <button
                onClick={handleResetAllFilters}
                className="text-xs font-bold text-mass-red hover:underline ml-1"
              >
                ✕ Limpiar filtros
              </button>
            )}
          </div>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Todos los productos disponibles con precios bajos garantizados y control de frescura PEPS
          </p>
        </div>
      </div>

      {/* Catálogo Completo a 4 Columnas */}
      <section className="w-full space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <div key={n} className="bg-white rounded-2xl p-4 h-80 border border-stone-200"></div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredProducts.map((p, idx) => {
              const stock = parseInt(p.stock_actual || 0);
              const isFav = favorites.includes(p.id);
              const brand = detectBrand(p.nombre);
              const cardQty = localQtys[p.id] || 1;
              const priceNum = parseFloat(p.precio_venta || 0);
              const origPrice = (priceNum * 1.25).toFixed(2);
              const isAgotado = stock <= 0;
              const isBajoStock = stock > 0 && stock <= 10;

              // Determinación de Badges con Reglas de Negocio
              let badgeNode = null;
              if (isAgotado) {
                badgeNode = (
                  <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase shadow-xs">
                    AGOTADO
                  </span>
                );
              } else if (isBajoStock) {
                badgeNode = (
                  <span className="bg-amber-500 text-stone-950 text-[9px] font-black px-2 py-0.5 rounded uppercase shadow-xs">
                    ¡ÚLTIMAS {stock}!
                  </span>
                );
              } else if (priceNum <= 6.00) {
                badgeNode = (
                  <span className="bg-[#ff671f] text-white text-[9px] font-black px-2 py-0.5 rounded uppercase shadow-xs">
                    -22% OFERTA
                  </span>
                );
              } else if (stock >= 80) {
                badgeNode = (
                  <span className="bg-stone-900 text-mass-yellow text-[9px] font-black px-2 py-0.5 rounded uppercase shadow-xs">
                    MÁS VENDIDO
                  </span>
                );
              } else if (p.es_perecedero === 1) {
                badgeNode = (
                  <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase shadow-xs">
                    COSECHA HOY
                  </span>
                );
              }

              // Banner publicitario intermedio
              const bannerNode = idx === 4 ? (
                <div key="promo-banner" className="col-span-full bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-amber-200/90 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 my-2 shadow-2xs">
                  <div className="space-y-1 text-center md:text-left">
                    <h4 className="font-black text-base text-stone-900 flex items-center gap-2 justify-center md:justify-start">
                      <span>⚡</span>
                      <span>Aprovecha más con Lotes de Corto Vencimiento</span>
                    </h4>
                    <p className="text-xs text-stone-600 font-medium">
                      Calidad 100% garantizada y hasta 50% de descuento. Productos frescos con consumo responsable.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOffersOnly(true)}
                    className="px-5 py-2.5 bg-mass-red hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2 shrink-0 uppercase tracking-wide"
                  >
                    <span>Ver Productos Aprovecha</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : null;

              return (
                <React.Fragment key={p.id}>
                  {bannerNode}
                  <div
                    onClick={() => setSelectedProductModal(p)}
                    className={`bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between group relative h-full cursor-pointer ${
                      isAgotado ? 'opacity-75 border-dashed border-stone-300' : 'hover:border-amber-400'
                    }`}
                  >
                    {/* Badges y Botón Favoritos */}
                    <div className="flex items-center justify-between absolute top-3.5 left-3.5 right-3.5 z-10 pointer-events-none">
                      <div className="pointer-events-auto">
                        {badgeNode}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(p.id);
                        }}
                        className={`pointer-events-auto w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-xs transition border ${
                          isFav ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white/95 text-stone-400 hover:text-red-500 border-stone-200'
                        }`}
                        title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-red-600 text-red-600' : 'text-stone-400'}`} />
                      </button>
                    </div>

                    {/* Imagen del Producto */}
                    <div className="w-full h-44 rounded-xl overflow-hidden bg-stone-50/80 border border-stone-100 flex items-center justify-center mb-3 p-3 pt-4 relative">
                      <img
                        src={p.imagen_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300'}
                        alt={p.nombre}
                        className={`max-h-full max-w-full object-contain transition-transform duration-300 ${
                          isAgotado ? 'grayscale contrast-75' : 'group-hover:scale-105'
                        }`}
                      />
                      {isAgotado && (
                        <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center">
                          <span className="px-3 py-1 bg-red-600 text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider">
                            Sin Stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Disponibilidad y Detalles con Validación Visual */}
                    <div className="space-y-1.5 flex-1 flex flex-col justify-start">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className={`w-2 h-2 rounded-full inline-block ${
                          isAgotado ? 'bg-red-500' : isBajoStock ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
                        }`}></span>
                        <span className={isAgotado ? 'text-red-600' : isBajoStock ? 'text-amber-700' : 'text-stone-500'}>
                          {isAgotado
                            ? 'Producto agotado en tienda'
                            : isBajoStock
                            ? `¡Solo ${stock} disponibles en ${selectedBranch?.nombre?.replace('Tienda Mass - ', '') || 'sede'}!`
                            : `${stock} unidades disponibles`}
                        </span>
                      </div>

                      <div className="text-[10px] text-stone-400 font-extrabold uppercase tracking-wider">
                        {brand} / {(p.categoria_nombre || 'GENERAL').toUpperCase()}
                      </div>

                      <h3 className="font-bold text-stone-900 text-sm line-clamp-2 leading-snug min-h-[2.5rem] group-hover:text-mass-red transition-colors">
                        {p.nombre}
                      </h3>

                      <div className="text-xs text-stone-500 font-medium">
                        {p.unidad_medida || 'Unidad'}
                      </div>
                    </div>

                    {/* Precios y Botón de Agregar con Validación de Stock */}
                    <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-lg font-black ${isAgotado ? 'text-stone-400' : 'text-mass-red'}`}>
                          S/ {priceNum.toFixed(2)}
                        </span>
                        <span className="text-xs text-stone-400 line-through font-semibold">
                          S/ {origPrice}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center border border-stone-200 rounded-xl bg-stone-50 px-2 py-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            disabled={isAgotado}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLocalQty(p.id, -1, stock);
                            }}
                            className="text-stone-500 hover:text-stone-800 disabled:text-stone-300 font-bold px-1.5 text-xs"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-stone-900 w-5 text-center">
                            {isAgotado ? 0 : cardQty}
                          </span>
                          <button
                            disabled={isAgotado || cardQty >= stock}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLocalQty(p.id, 1, stock);
                            }}
                            className="text-stone-500 hover:text-stone-800 disabled:text-stone-300 font-bold px-1.5 text-xs"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAgotado) {
                              alert('Este producto se encuentra agotado.');
                              return;
                            }
                            if (cardQty > stock) {
                              alert(`Solo quedan ${stock} unidades en existencia.`);
                              return;
                            }
                            addToCart(p, cardQty);
                          }}
                          disabled={isAgotado}
                          className="flex-1 py-2.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 border border-amber-300 disabled:bg-stone-200 disabled:text-stone-400 disabled:border-transparent disabled:cursor-not-allowed active:scale-95"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{isAgotado ? 'Agotado' : 'Agregar'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-3xl border border-stone-200 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-stone-400 mx-auto stroke-1" />
            <h3 className="text-sm font-bold text-stone-900">
              {debouncedSearch ? `No encontramos productos para "${debouncedSearch}"` : 'No encontramos productos en esta sección'}
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              {debouncedSearch
                ? 'Revisa la ortografía o intenta buscar por una categoría o término más general (ej. arroz, leche, café, galletas).'
                : 'Prueba limpiando los filtros seleccionados para ver el catálogo general.'}
            </p>
            <button
              onClick={handleResetAllFilters}
              className="px-5 py-2.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs shadow-xs transition border border-amber-300"
            >
              {debouncedSearch ? 'Limpiar búsqueda y ver catálogo completo' : 'Ver Todos los Productos'}
            </button>
          </div>
        )}
      </section>

      {/* Modal de Detalle de Producto Fiel a la Referencia (sin delivery/retiro) */}
      <ProductDetailModal
        product={selectedProductModal}
        isOpen={!!selectedProductModal}
        onClose={() => setSelectedProductModal(null)}
        branch={selectedBranch}
        onAddToCart={(prod, qty) => addToCart(prod, qty)}
        isFavorite={selectedProductModal ? favorites.includes(selectedProductModal.id) : false}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
};
