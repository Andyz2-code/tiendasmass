import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:4000';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log(' Conectado al microservicio WebSocket de Tiendas Mass');
    });

    socket.on('connect_error', (err) => {
      console.warn(' Advertencia de conexión WebSocket (¿Está corriendo node-services?):', err.message);
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};
