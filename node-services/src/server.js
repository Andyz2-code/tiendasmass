/**
 * Servidor WebSocket Express + Socket.io - Tiendas Mass
 */

require('dotenv').config({ path: '../../.env' });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const registerDeliveryTracking = require('./handlers/deliveryTrackingHandler');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Endpoint de verificación de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Tiendas Mass WebSocket & Tracking Microservice',
    timestamp: new Date().toISOString()
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Nuevo cliente conectado: ${socket.id}`);

  registerDeliveryTracking(io, socket);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` [TIENDAS MASS] Microservicio de Tracking en tiempo real`);
  console.log(` Escuchando en: http://localhost:${PORT}`);
  console.log(` Endpoint Socket.io: ws://localhost:${PORT}`);
  console.log(`=======================================================`);
});
