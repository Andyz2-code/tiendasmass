/**
 * ARKENYA - Motor de Accesibilidad Web (WCAG 2.1 / 2.2 Nivel AA & AAA)
 * Archivo: /frontend/js/accessibility.js
 */
(function (window, document) {
  'use strict';

  const STORAGE_KEYS = {
    FONT_SIZE: 'mass_a11y_font_size',
    CONTRAST: 'mass_a11y_contrast',
    HIGH_FOCUS: 'mass_a11y_high_focus'
  };

  const listeners = new Set();

  function notify(state) {
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error('Error in a11y listener:', err);
      }
    });
  }

  const MassA11y = {
    getState() {
      return {
        fontSize: localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || 'normal',
        contrast: localStorage.getItem(STORAGE_KEYS.CONTRAST) || 'normal',
        highFocus: localStorage.getItem(STORAGE_KEYS.HIGH_FOCUS) === 'true'
      };
    },

    setFontSize(size) {
      const valid = ['normal', 'large', 'xlarge'].includes(size) ? size : 'normal';
      localStorage.setItem(STORAGE_KEYS.FONT_SIZE, valid);
      this.applyFontSize(valid);
      notify(this.getState());
    },

    setContrast(mode) {
      const valid = ['normal', 'high', 'grayscale'].includes(mode) ? mode : 'normal';
      localStorage.setItem(STORAGE_KEYS.CONTRAST, valid);
      this.applyContrast(valid);
      notify(this.getState());
    },

    setHighFocus(enabled) {
      const isEnabled = Boolean(enabled);
      localStorage.setItem(STORAGE_KEYS.HIGH_FOCUS, isEnabled ? 'true' : 'false');
      this.applyHighFocus(isEnabled);
      notify(this.getState());
    },

    applyFontSize(size) {
      const root = document.documentElement;
      const body = document.body;
      root.classList.remove('a11y-font-large', 'a11y-font-xlarge');

      if (size === 'large') {
        root.classList.add('a11y-font-large');
        root.style.fontSize = '18.4px';
        if (body) body.style.fontSize = '18.4px';
      } else if (size === 'xlarge') {
        root.classList.add('a11y-font-xlarge');
        root.style.fontSize = '20px';
        if (body) body.style.fontSize = '20px';
      } else {
        root.style.fontSize = '16px';
        if (body) body.style.fontSize = '16px';
      }
    },

    applyContrast(contrast) {
      const body = document.body;
      if (!body) return;
      body.classList.remove('a11y-high-contrast', 'a11y-grayscale');
      if (contrast === 'high') {
        body.classList.add('a11y-high-contrast');
      } else if (contrast === 'grayscale') {
        body.classList.add('a11y-grayscale');
      }
    },

    applyHighFocus(highFocus) {
      const body = document.body;
      if (!body) return;
      if (highFocus) {
        body.classList.add('a11y-high-focus');
      } else {
        body.classList.remove('a11y-high-focus');
      }
    },

    reset() {
      localStorage.removeItem(STORAGE_KEYS.FONT_SIZE);
      localStorage.removeItem(STORAGE_KEYS.CONTRAST);
      localStorage.removeItem(STORAGE_KEYS.HIGH_FOCUS);
      this.applyFontSize('normal');
      this.applyContrast('normal');
      this.applyHighFocus(false);
      notify(this.getState());
    },

    subscribe(fn) {
      listeners.add(fn);
      fn(this.getState());
      return () => listeners.delete(fn);
    },

    init() {
      const state = this.getState();
      this.applyFontSize(state.fontSize);
      if (document.body) {
        this.applyContrast(state.contrast);
        this.applyHighFocus(state.highFocus);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          this.applyContrast(state.contrast);
          this.applyHighFocus(state.highFocus);
        });
      }
    }
  };

  // Auto-inicializar
  MassA11y.init();

  // Exponer globalmente
  window.MassA11y = MassA11y;

})(window, document);
