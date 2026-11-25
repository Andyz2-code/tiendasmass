/**
 * ARKENYA - Cliente HTTP Axios Unificado
 * Ubicación: frontend/src/shared/services/api.service.js
 */
import axios from 'axios';
import { API_CONFIG } from '../config/api.config.js';

export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 15000
});

// Interceptor para inyectar token JWT
apiClient.interceptors.request.use(
  (config) => {
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para respuesta
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && typeof localStorage !== 'undefined') {
      localStorage.removeItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(API_CONFIG.STORAGE_KEYS.AUTH_USER);
    }
    const message = error.response?.data?.message || error.message || 'Error de conexión con el servidor PHP.';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
