import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Tag, ArrowRight } from 'lucide-react';
import api from '../services/api';

/**
 * Carrusel Dinámico de Banners Comerciales - Tiendas Mass
 * - Rotación automática cada 5 segundos
 * - Sincronización estricta de timer al interactuar manualmente (flechas o indicadores)
 * - Navegación circular completa (loop infinito)
 * - Accesibilidad WCAG 2.1 AA y navegación por teclado (ArrowLeft, ArrowRight)
 * - Soporte para pausa al colocar el cursor encima (hover)
 */
export const BannerCarousel = ({ sucursalId, onCtaClick }) => {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchBanners = async () => {
      setLoading(true);
      try {
        const query = sucursalId ? `?sucursal_id=${sucursalId}` : '';
        const res = await api.get(`/banners${query}`);
        if (isMounted) {
          const list = res.data?.data || res.data || [];
          setBanners(list);
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error('Error al cargar banners:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchBanners();
    return () => { isMounted = false; };
  }, [sucursalId]);

  // Rotación automática cada 5 segundos sincronizada
  // Cada vez que cambia currentIndex o se pausa/reanuda, el intervalo se reinicia limpiamente
  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners.length, isPaused, currentIndex]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  if (loading) {
    return (
      <div className="w-full h-64 sm:h-72 md:h-84 rounded-3xl md:rounded-[2rem] bg-stone-200 animate-pulse border border-stone-200 mb-6"></div>
    );
  }

  if (banners.length === 0) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl md:rounded-[2rem] shadow-md border border-stone-200/80 bg-stone-900 select-none group mb-6 focus:outline-none focus:ring-2 focus:ring-mass-yellow/60"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Carrusel de promociones y ofertas destacadas"
    >
      {/* Contenedor de Diapositivas con Cross-Fade */}
      <div className="relative w-full h-64 sm:h-72 md:h-84">
        {banners.map((item, idx) => (
          <div
            key={item.id || idx}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              idx === currentIndex ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
            }`}
            aria-hidden={idx !== currentIndex}
          >
            {/* Imagen de Fondo con Overlay Degradado Oficial Mass */}
            <img
              src={item.imagen_url}
              alt={item.titulo}
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 transform scale-100 group-hover:scale-102"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/60 to-transparent"></div>

            {/* Contenido Comercial del Banner */}
            <div className="relative h-full max-w-7xl mx-auto px-6 sm:px-12 flex flex-col justify-center items-start text-white space-y-2 sm:space-y-3 z-10 max-w-2xl">
              {/* Badge de Promoción */}
              {item.tag_promocion && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider bg-mass-red text-white shadow-md">
                  <Tag className="w-3.5 h-3.5 text-white" />
                  <span>{item.tag_promocion}</span>
                </span>
              )}

              {/* Título Principal */}
              <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-sm">
                {item.titulo}
              </h2>

              {/* Subtítulo / Descripción */}
              {item.subtitulo && (
                <p className="text-xs sm:text-sm text-stone-200 line-clamp-2 max-w-xl font-medium leading-relaxed drop-shadow">
                  {item.subtitulo}
                </p>
              )}

              {/* Precio Destacado y Botón CTA */}
              <div className="pt-2 flex items-center gap-3 flex-wrap">
                {item.precio_destacado && (
                  <span className="text-xs sm:text-sm font-black text-mass-yellow drop-shadow-sm bg-black/50 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-amber-400/40 uppercase tracking-wide">
                    {item.precio_destacado}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onCtaClick ? onCtaClick(item) : window.location.assign(item.boton_enlace || '#catalogo')}
                  className="px-5 py-2.5 sm:px-6 sm:py-3 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition transform active:scale-95 flex items-center gap-2 uppercase tracking-wide border border-amber-300 cursor-pointer"
                >
                  <span>{item.boton_texto || 'Aprovechar Ofertas'}</span>
                  <ArrowRight className="w-4 h-4 font-bold" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Flechas de Navegación Anterior / Siguiente Circulares */}
      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Banner anterior"
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white text-stone-900 flex items-center justify-center shadow-lg backdrop-blur-xs transition transform hover:scale-105 active:scale-95 z-20 cursor-pointer border border-stone-200/40 focus:outline-none focus:ring-2 focus:ring-mass-yellow"
          >
            <ChevronLeft className="w-6 h-6 text-stone-900 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Siguiente banner"
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white text-stone-900 flex items-center justify-center shadow-lg backdrop-blur-xs transition transform hover:scale-105 active:scale-95 z-20 cursor-pointer border border-stone-200/40 focus:outline-none focus:ring-2 focus:ring-mass-yellow"
          >
            <ChevronRight className="w-6 h-6 text-stone-900 stroke-[2.5]" />
          </button>

          {/* Cápsula de Indicadores Inferiores */}
          <div
            role="tablist"
            aria-label="Diapositivas del carrusel"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 bg-stone-950/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg"
          >
            {banners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={currentIndex === idx}
                aria-label={`Ir al banner ${idx + 1}`}
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-mass-yellow ${
                  currentIndex === idx
                    ? 'w-7 h-2 bg-mass-yellow shadow'
                    : 'w-2 h-2 bg-white/40 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;
