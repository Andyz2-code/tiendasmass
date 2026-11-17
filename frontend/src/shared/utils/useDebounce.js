import { useState, useEffect } from 'react';

/**
 * useDebounce Hook
 * Retrasa la actualización del valor hasta que el usuario deje de escribir por 'delay' ms.
 * Evita múltiples solicitudes innecesarias durante la escritura continua.
 * 
 * @param {any} value - Valor de entrada (ej: texto de búsqueda)
 * @param {number} delay - Tiempo en milisegundos (por defecto 500ms)
 * @returns {any} debouncedValue
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Iniciar temporizador de 500ms tras el último carácter
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancelar el temporizador anterior si el usuario vuelve a escribir antes de que transcurran los 500ms
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
