/**
 * Handler de seguimiento de entregas y geolocalización en tiempo real
 */

module.exports = function registerDeliveryTracking(io, socket) {
  // Cliente o Repartidor se une a la sala de un pedido específico
  socket.on('join_delivery_room', ({ pedido_id, rol, nombre }) => {
    const room = `delivery_${pedido_id}`;
    socket.join(room);
    console.log(`[Socket] ${rol || 'Usuario'} (${nombre || socket.id}) se unió a la sala ${room}`);
    
    // Notificar a los integrantes de la sala
    socket.to(room).emit('user_joined_delivery', {
      mensaje: `${nombre || 'Un participante'} se ha conectado al rastreo en vivo.`,
      timestamp: new Date().toISOString()
    });
  });

  // Repartidor transmite coordenadas GPS en vivo
  socket.on('delivery_location_update', (data) => {
    const { pedido_id, latitud, longitud, repartidor_nombre, velocidad_kmh } = data;
    const room = `delivery_${pedido_id}`;

    // Reenviar coordenadas a todos los que escuchan en la sala (cliente y supervisor)
    io.to(room).emit('delivery_location_broadcast', {
      pedido_id,
      latitud: parseFloat(latitud),
      longitud: parseFloat(longitud),
      repartidor_nombre,
      velocidad_kmh: velocidad_kmh || 0,
      timestamp: new Date().toISOString()
    });

    console.log(`[GPS] Pedido ${pedido_id} -> Coordenadas: (${latitud}, ${longitud})`);
  });

  // Notificación de cambio de estado de despacho/entrega
  socket.on('order_status_update', (data) => {
    const { pedido_id, nuevo_estado, detalle } = data;
    const room = `delivery_${pedido_id}`;

    io.to(room).emit('order_status_broadcast', {
      pedido_id,
      nuevo_estado,
      detalle: detalle || `El estado del pedido ahora es ${nuevo_estado}`,
      timestamp: new Date().toISOString()
    });

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
};
