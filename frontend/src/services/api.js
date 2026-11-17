import axios from 'axios';

// Detectar base URL dinámicamente si corre en localhost o Apache
const getBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost/tiendasmass/backend/public/api';
  }
  return '/backend/public/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000
});

// Interceptor para inyectar token JWT automáticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mass_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejo unificado de respuestas y errores
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Si el token expiró, limpiar almacenamiento local
      localStorage.removeItem('mass_token');
      localStorage.removeItem('mass_user');
    }
    const message = error.response?.data?.message || 'Error en la comunicación con el servidor.';
    return Promise.reject(new Error(message));
  }
);

export default api;
