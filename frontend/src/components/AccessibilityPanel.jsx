import React, { useState, useEffect } from 'react';
import { Eye, Sliders, X } from 'lucide-react';

export const AccessibilityPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [a11yState, setA11yState] = useState(() => {
    return window.MassA11y ? window.MassA11y.getState() : {
      fontSize: 'normal',
      contrast: 'normal',
      highFocus: false
    };
  });

  useEffect(() => {
    if (window.MassA11y) {
      return window.MassA11y.subscribe(setA11yState);
    }
  }, []);

  const handleFontSize = (size) => {
    if (window.MassA11y) window.MassA11y.setFontSize(size);
  };

  const handleContrast = (mode) => {
    if (window.MassA11y) window.MassA11y.setContrast(mode);
  };

  const handleHighFocus = (checked) => {
    if (window.MassA11y) window.MassA11y.setHighFocus(checked);
  };

  const handleReset = () => {
    if (window.MassA11y) window.MassA11y.reset();
  };

  return (
    <>
      {/* Botón Flotante Accesible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir panel de accesibilidad"
        aria-expanded={isOpen}
        data-a11y-keep="true"
        className="fixed bottom-5 left-5 z-40 bg-stone-900 hover:bg-black text-mass-yellow p-3 rounded-full shadow-2xl border-2 border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-300 transition transform hover:scale-110 active:scale-95 flex items-center justify-center font-extrabold text-sm"
        title="Herramientas de Accesibilidad (WCAG 2.1 AA)"
      >
        👁️
      </button>

      {/* Modal / Panel Flotante */}
      {isOpen && (
        <div
          id="a11y-widget-panel"
          className="fixed bottom-20 left-5 z-50 w-80 sm:w-96 rounded-3xl shadow-2xl p-5 space-y-4 text-xs animate-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Herramientas de Accesibilidad Web"
        >
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">♿</span>
              <div>
                <h3 className="font-extrabold text-stone-900 text-sm">Accesibilidad Web</h3>
                <p className="text-[10px] text-stone-500 font-medium">Estándar WCAG 2.1 Nivel AA</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar panel de accesibilidad"
              data-a11y-keep="true"
              className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 font-bold flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          {/* 1. Tamaño del Texto */}
          <div className="space-y-1.5">
            <label className="font-bold text-stone-800 flex items-center gap-1.5">
              <span>🔤 Tamaño del Texto</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: 'Normal' },
                { id: 'large', label: '115% +' },
                { id: 'xlarge', label: '125% ++' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleFontSize(item.id)}
                  data-a11y-keep="true"
                  className={`py-2 px-1 rounded-xl text-center font-bold border transition ${
                    a11yState.fontSize === item.id
                      ? 'bg-mass-yellow text-stone-950 border-2 border-stone-900 font-black shadow-sm ring-2 ring-amber-300'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {a11yState.fontSize === item.id ? '✓ ' : ''}{item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Contraste Visual */}
          <div className="space-y-1.5">
            <label className="font-bold text-stone-800 flex items-center gap-1.5">
              <span>🎨 Contraste Visual</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: 'Estándar' },
                { id: 'high', label: 'Alto Contraste' },
                { id: 'grayscale', label: 'Gris' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleContrast(item.id)}
                  data-a11y-keep="true"
                  className={`py-2 px-1 rounded-xl text-center font-bold border transition ${
                    a11yState.contrast === item.id
                      ? 'bg-mass-yellow text-stone-950 border-2 border-stone-900 font-black shadow-sm ring-2 ring-amber-300'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {a11yState.contrast === item.id ? '✓ ' : ''}{item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Resaltar Foco Teclado */}
          <div className="pt-1">
            <label className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer hover:bg-stone-100 select-none">
              <div>
                <span className="font-bold text-stone-900 block">Resaltar Foco Teclado</span>
                <span className="text-[10px] text-stone-500">Bordes visibles con Tab</span>
              </div>
              <input
                type="checkbox"
                checked={a11yState.highFocus}
                onChange={(e) => handleHighFocus(e.target.checked)}
                className="w-4 h-4 text-mass-red accent-mass-red rounded cursor-pointer"
              />
            </label>
          </div>

          {/* 4. Restablecer y Cerrar */}
          <div className="pt-2 border-t border-stone-100 flex justify-between items-center">
            <button
              type="button"
              onClick={handleReset}
              data-a11y-keep="true"
              className="text-stone-500 hover:text-mass-red font-bold text-[11px]"
            >
              Restablecer
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              data-a11y-keep="true"
              className="px-4 py-1.5 bg-mass-yellow text-stone-950 font-black rounded-xl text-xs hover:bg-amber-400 transition"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AccessibilityPanel;
