import { useState, useEffect, useRef, useCallback } from 'react';
import useDebounce from '../../shared/utils/useDebounce';
import api from '../../services/api';

/**
 * useProductSearch Hook
 * Motor de búsqueda optimizado para Tiendas Mass:
 * - Debounce de 500ms tras la última pulsación de tecla
 * - AbortController para cancelar solicitudes anteriores en vuelo y evitar condiciones de carrera
 * - Caché en memoria para evitar consultas idénticas repetidas
 * - Restauración instantánea del catálogo al vaciar la búsqueda
 * - Notificaciones accesibles para lectores de pantalla (ARIA Live)
 */
export function useProductSearch({ branchId, categoryId = null, onResultsChange }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [a11yMessage, setA11yMessage] = useState('');
  const [resultCount, setResultCount] = useState(null);

  // Debounce de 500ms obligatorio
  const debouncedQuery = useDebounce(query, 500);

  // Referencias para control de concurrencia y caché
  const abortControllerRef = useRef(null);
  const lastExecutedQueryRef = useRef(null);
  const queryCacheRef = useRef(new Map());

  // Ejecución de la búsqueda optimizada
  const executeSearch = useCallback(async (searchTerm) => {
    const cleanTerm = (searchTerm || '').trim();

    // Cancelar cualquier solicitud HTTP previa que continúe en vuelo
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Crear un nuevo AbortController para esta solicitud específica
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Si la búsqueda queda vacía, restaurar catálogo inicial
    if (!cleanTerm) {
      lastExecutedQueryRef.current = '';
      setIsSearching(false);
      setSearchError(null);
      setA11yMessage('Búsqueda restablecida. Mostrando catálogo completo.');
      setResultCount(null);
      if (onResultsChange) onResultsChange(null);
      return;
    }

    // Comprobar si es exactamente la misma consulta que ya se ejecutó
    const cacheKey = `${branchId || 'global'}_${categoryId || 'all'}_${cleanTerm.toLowerCase()}`;
    if (queryCacheRef.current.has(cacheKey)) {
      const cachedData = queryCacheRef.current.get(cacheKey);
      lastExecutedQueryRef.current = cleanTerm;
      setIsSearching(false);
      setResultCount(cachedData.length);
      setA11yMessage(
        cachedData.length > 0
          ? `Se encontraron ${cachedData.length} productos para "${cleanTerm}".`
          : `No se encontraron productos para "${cleanTerm}".`
      );
      if (onResultsChange) onResultsChange(cachedData);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setA11yMessage(`Buscando productos para "${cleanTerm}"...`);

    try {
      const params = new URLSearchParams();
      if (branchId) params.append('sucursal_id', branchId);
      if (categoryId) params.append('categoria_id', categoryId);
      params.append('search', cleanTerm);

      const response = await api.get(`/productos?${params.toString()}`, {
        signal: controller.signal
      });

      const items = response.data?.data || response.data || [];

      // Guardar en caché en memoria
      queryCacheRef.current.set(cacheKey, items);
      lastExecutedQueryRef.current = cleanTerm;

      setResultCount(items.length);
      setA11yMessage(
        items.length > 0
          ? `Búsqueda completada. Se encontraron ${items.length} productos para "${cleanTerm}".`
          : `No se encontraron productos coincidentes para "${cleanTerm}".`
      );

      if (onResultsChange) onResultsChange(items);
    } catch (err) {
      // Ignorar errores provocados por cancelaciones intencionales (abort)
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Error en búsqueda de productos:', err);
      setSearchError('No se pudo completar la búsqueda. Intente nuevamente.');
      setA11yMessage('Error al realizar la búsqueda.');
    } finally {
      // Solo desactivar estado de carga si esta solicitud sigue siendo la actual
      if (abortControllerRef.current === controller) {
        setIsSearching(false);
      }
    }
  }, [branchId, categoryId, onResultsChange]);

  // Efecto que reacciona a la consulta con debounce
  useEffect(() => {
    executeSearch(debouncedQuery);

    return () => {
      // Limpieza al desmontar
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery, executeSearch]);

  // Limpiar búsqueda y reiniciar
  const clearSearch = useCallback(() => {
    setQuery('');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    isSearching,
    searchError,
    a11yMessage,
    resultCount,
    clearSearch
  };
}

export default useProductSearch;
