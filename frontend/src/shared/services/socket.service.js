/**
 * TIENDAS MASS - Cliente de Conexión WebSocket (Node.js Microservice :4000)
 * Ubicación: frontend/src/shared/services/socket.service.js
 */
import { io } from 'socket.io-client';
import { API_CONFIG } from '../config/api.config.js';

let socketInstance = null;

export const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(API_CONFIG.SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('📡 [Node.js WebSocket] Conectado exitosamente al microservicio en puerto 4000');
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('⚠️ [Node.js WebSocket] Conexión pendiente o microservicio offline:', err.message);
    });
  }
  return socketInstance;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socketInstance && socketInstance.connected) {
    socketInstance.disconnect();
  }
};

export default { getSocket, connectSocket, disconnectSocket };
