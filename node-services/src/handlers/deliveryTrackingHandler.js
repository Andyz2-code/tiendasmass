/**
 * Handler de seguimiento de entregas y geolocalización en tiempo real
 * Conecta la app Flutter (Mass Rider iOS/Android) con la Web (Cliente, Admin, Supervisor)
 */

// Caché en memoria de última posición conocida por pedido_id
const lastKnownLocations = new Map();
// Caché de presencia de repartidores en línea
const activeRiders = new Map();

function buildLocationPayload(data) {
  return {
    pedido_id: Number(data.pedido_id) || data.pedido_id,
    rider_id: data.rider_id || null,
    latitud: parseFloat(data.latitud),
    longitud: parseFloat(data.longitud),
    repartidor_nombre: data.repartidor_nombre || 'Motorizado Mass',
    velocidad_kmh: data.velocidad_kmh !== undefined ? parseFloat(data.velocidad_kmh) : 0,
    heading: data.heading !== undefined ? parseFloat(data.heading) : 0,
    precision_metros: data.precision_metros !== undefined ? parseFloat(data.precision_metros) : 0,
    estado_delivery: data.estado_delivery || 'EN_RUTA',
    timestamp: data.timestamp || new Date().toISOString()
  };
}

function registerDeliveryTracking(io, socket) {
  // Cliente, Supervisor o Repartidor se une a la sala de un pedido específico
  socket.on('join_delivery_room', ({ pedido_id, rol, nombre }) => {
    if (!pedido_id) return;
    const room = `delivery_${pedido_id}`;
    socket.join(room);
    console.log(`[Socket] ${rol || 'Usuario'} (${nombre || socket.id}) se unió a la sala ${room}`);

    // Si ya existe una última posición conocida en caché, enviarla inmediatamente al recién llegado
    const cached = lastKnownLocations.get(String(pedido_id));
    if (cached) {
      socket.emit('delivery_location_broadcast', cached);
    }

    // Solicitar al repartidor (si está conectado) un fix GPS inmediato
    socket.to(room).emit('request_rider_location', {
      pedido_id,
      solicitado_por: rol || 'Cliente',
      timestamp: new Date().toISOString()
    });

    // Notificar a los integrantes de la sala
    socket.to(room).emit('user_joined_delivery', {
      rol: rol || 'Usuario',
      mensaje: `${nombre || 'Un participante'} se ha conectado al rastreo en vivo.`,
      timestamp: new Date().toISOString()
    });
  });

  // Consulta explícita bajo demanda desde la web ("Actualizar ubicación ahora")
  socket.on('request_rider_location', ({ pedido_id, solicitado_por }) => {
    if (!pedido_id) return;
    const room = `delivery_${pedido_id}`;
    const cached = lastKnownLocations.get(String(pedido_id));
    if (cached) {
      socket.emit('delivery_location_broadcast', cached);
    }
    io.to(room).emit('request_rider_location', {
      pedido_id,
      solicitado_por: solicitado_por || 'Cliente',
      timestamp: new Date().toISOString()
    });
  });

  // Repartidor transmite coordenadas GPS en vivo
  socket.on('delivery_location_update', (data) => {
    if (!data || !data.pedido_id || data.latitud === undefined || data.longitud === undefined) {
      return;
    }
    const payload = buildLocationPayload(data);
    const room = `delivery_${payload.pedido_id}`;

    lastKnownLocations.set(String(payload.pedido_id), payload);

    // Reenviar coordenadas a todos los que escuchan en la sala (cliente y supervisor)
    io.to(room).emit('delivery_location_broadcast', payload);

    console.log(`[GPS] Pedido ${payload.pedido_id} -> (${payload.latitud}, ${payload.longitud}) @ ${payload.velocidad_kmh} km/h`);
  });

  // Presencia del repartidor en línea (aún sin pedido o entre despachos)
  socket.on('rider_presence_update', (data) => {
    if (!data || !data.rider_id) return;
    activeRiders.set(String(data.rider_id), {
      ...data,
      timestamp: new Date().toISOString()
    });
    io.emit('rider_presence_broadcast', activeRiders.get(String(data.rider_id)));
  });

  // Notificación de cambio de estado de despacho/entrega
  socket.on('order_status_update', (data) => {
    if (!data || !data.pedido_id) return;
    const { pedido_id, nuevo_estado, detalle } = data;
    const room = `delivery_${pedido_id}`;

    io.to(room).emit('order_status_broadcast', {
      pedido_id: Number(pedido_id) || pedido_id,
      nuevo_estado,
      detalle: detalle || `El estado del pedido ahora es ${nuevo_estado}`,
      timestamp: new Date().toISOString()
    });

    if (nuevo_estado === 'ENTREGADO' || nuevo_estado === 'CANCELADO') {
      lastKnownLocations.delete(String(pedido_id));
    }

    console.log(`[Estado] Pedido ${pedido_id} actualizado a: ${nuevo_estado}`);
  });

  // Sala de alertas de inventario para Administradores y Supervisores
  socket.on('join_inventory_alerts', ({ sucursal_id }) => {
    const room = `inventory_branch_${sucursal_id || 'all'}`;
    socket.join(room);
    console.log(`[Socket] Conectado a la sala de alertas de inventario: ${room}`);
  });

  socket.on('inventory_reorder_alert', (data) => {
    const room = `inventory_branch_${data.sucursal_id || 'all'}`;
    io.to(room).emit('reorder_alert_broadcast', {
      ...data,
      timestamp: new Date().toISOString()
    });
  });
}

registerDeliveryTracking.lastKnownLocations = lastKnownLocations;
registerDeliveryTracking.activeRiders = activeRiders;
registerDeliveryTracking.buildLocationPayload = buildLocationPayload;

module.exports = registerDeliveryTracking;
