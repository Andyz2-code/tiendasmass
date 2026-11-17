/**
 * TIENDAS MASS - Componente Oficial de Identidad Visual y Logotipo Transparente
 * Ubicación: frontend/src/components-compartidos/componentes-comunes/LogoMass.jsx
 * 
 * Renderiza el logo con transparencia real (canal alfa), sin cajas, fondos ni rectángulos.
 * Proporcional, nítido y responsivo para dispositivos móviles, tablets y escritorio.
 */
import React from 'react';

export const LogoMass = ({
  variant = 'full',      // 'full' | 'iso'
  size = 'md',           // 'sm' | 'md' | 'lg' | 'xl'
  alt = 'Tiendas Mass - Precios bajos, ¡cerca de ti!',
  className = '',
  href = null,
  onClick = null
}) => {
  // Selección del recurso oficial con fondo transparente real
  const imageSrc = variant === 'full'
    ? 'assets/images/logo-mass-oficial.png'
    : 'assets/images/logo-mass-isotipo.png';

  // Dimensiones equilibradas, proporcionales y responsivas
  const sizeClasses = {
    sm: variant === 'full' ? 'h-7 sm:h-8 max-w-[190px]' : 'h-7 sm:h-8 w-auto',
    md: variant === 'full' ? 'h-9 sm:h-11 md:h-12 max-w-[220px] sm:max-w-[270px] md:max-w-[320px]' : 'h-8 sm:h-9 md:h-10 w-auto',
    lg: variant === 'full' ? 'h-11 sm:h-13 max-w-[340px]' : 'h-11 sm:h-13 w-auto',
    xl: variant === 'full' ? 'h-14 sm:h-16 max-w-[420px]' : 'h-16 w-auto'
  }[size] || 'h-10 w-auto';

  const imgElement = (
    <img
      src={imageSrc}
      alt={alt}
      className={`object-contain transition-transform duration-200 select-none ${sizeClasses} ${className}`}
      loading="eager"
      onError={(e) => {
        // Fallback a ruta absoluta si se ejecuta en subcarpetas de Apache
        if (!e.target.src.includes('/tiendasmass/frontend/assets/')) {
          e.target.src = `/tiendasmass/frontend/assets/images/${variant === 'full' ? 'logo-mass-oficial.png' : 'logo-mass-isotipo.png'}`;
        }
      }}
    />
  );

  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        className="inline-flex items-center focus:outline-none focus:ring-2 focus:ring-mass-red rounded-xl group"
        title={alt}
      >
        <div className="transform group-hover:scale-[1.02] active:scale-95 transition-transform">
          {imgElement}
        </div>
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center focus:outline-none focus:ring-2 focus:ring-mass-red rounded-xl group bg-transparent border-0 p-0 cursor-pointer"
        title={alt}
      >
        <div className="transform group-hover:scale-[1.02] active:scale-95 transition-transform">
          {imgElement}
        </div>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center select-none">
      {imgElement}
    </div>
  );
};

export default LogoMass;
