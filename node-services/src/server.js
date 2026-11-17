/**
 * Servidor WebSocket Express + Socket.io - Tiendas Mass
 * Puente en tiempo real entre la App Mass Rider (iOS/Android) y la Web (Cliente/Admin/Supervisor)
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
  methods: ['GET', 'POST', 'PUT', 'OPTIONS']
}));

app.use(express.json());

// Endpoint de verificación de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Tiendas Mass WebSocket & Tracking Microservice',
    active_orders_tracked: registerDeliveryTracking.lastKnownLocations.size,
    active_riders: registerDeliveryTracking.activeRiders.size,
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

// Puente HTTP -> Socket.io: permite a la app Flutter (incluso desde Isolate en segundo plano)
// y al backend PHP emitir coordenadas GPS instantáneamente a la web.
app.post('/api/tracking/location', (req, res) => {
  const data = req.body || {};
  if (!data.pedido_id || data.latitud === undefined || data.longitud === undefined) {
    return res.status(422).json({
      success: false,
      message: 'pedido_id, latitud y longitud son obligatorios'
    });
  }

  const payload = registerDeliveryTracking.buildLocationPayload(data);
  const room = `delivery_${payload.pedido_id}`;
  registerDeliveryTracking.lastKnownLocations.set(String(payload.pedido_id), payload);
  io.to(room).emit('delivery_location_broadcast', payload);

  console.log(`[HTTP->GPS] Pedido ${payload.pedido_id} -> (${payload.latitud}, ${payload.longitud})`);
  return res.json({ success: true, data: payload });
});

// Consulta HTTP directa de la última ubicación conocida en tiempo real
app.get('/api/tracking/location/:pedido_id', (req, res) => {
  const pedidoId = String(req.params.pedido_id);
  const cached = registerDeliveryTracking.lastKnownLocations.get(pedidoId);
  if (!cached) {
    return res.json({ success: true, available: false, data: null });
  }
  return res.json({ success: true, available: true, data: cached });
});

// Puente HTTP -> Socket.io para cambios de estado de pedido
app.post('/api/tracking/status', (req, res) => {
  const { pedido_id, nuevo_estado, detalle } = req.body || {};
  if (!pedido_id || !nuevo_estado) {
    return res.status(422).json({
      success: false,
      message: 'pedido_id y nuevo_estado son obligatorios'
    });
  }
  const room = `delivery_${pedido_id}`;
  const payload = {
    pedido_id: Number(pedido_id) || pedido_id,
    nuevo_estado,
    detalle: detalle || `El estado del pedido ahora es ${nuevo_estado}`,
    timestamp: new Date().toISOString()
  };
  io.to(room).emit('order_status_broadcast', payload);

  if (nuevo_estado === 'ENTREGADO' || nuevo_estado === 'CANCELADO') {
    registerDeliveryTracking.lastKnownLocations.delete(String(pedido_id));
  }
  return res.json({ success: true, data: payload });
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Nuevo cliente conectado: ${socket.id}`);

  registerDeliveryTracking(io, socket);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` [TIENDAS MASS] Microservicio de Tracking en tiempo real`);
  console.log(` Escuchando en: http://0.0.0.0:${PORT}`);
  console.log(` Endpoint Socket.io: ws://localhost:${PORT}`);
  console.log(`=======================================================`);
});
