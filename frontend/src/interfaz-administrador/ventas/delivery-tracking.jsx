import React, { useState, useEffect } from 'react';
import { useBranch } from '../../context/BranchContext';
import { getSocket, connectSocket } from '../../services/socket';
import api from '../../services/api';
import {
  Truck,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  Navigation,
  Radio,
  Play,
  RotateCcw
} from 'lucide-react';

export const DeliveryTrackingView = () => {
  const { selectedBranch } = useBranch();
  const [pedidosDelivery, setPedidosDelivery] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [driverLoc, setDriverLoc] = useState({ lat: -12.0684, lng: -75.2100 });
  const [isSimulating, setIsSimulating] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const fetchDeliveries = async () => {
    if (!selectedBranch?.id) return;
    try {
      const res = await api.get(`/pedidos?sucursal_id=${selectedBranch.id}`);
      const withDelivery = (res.data || []).filter((p) => p.tipo_entrega === 'DELIVERY');
      setPedidosDelivery(withDelivery);
      if (withDelivery.length > 0 && !selectedPedido) {
        loadPedidoDetail(withDelivery[0].id);
      }
    } catch (err) {
      console.error('Error al cargar deliveries:', err);
    }
  };

  const loadPedidoDetail = async (id) => {
    try {
      const res = await api.get(`/pedidos/${id}`);
      const p = res.data;
      setSelectedPedido(p);
      if (p.latitud_actual_repartidor && p.longitud_actual_repartidor) {
        setDriverLoc({
          lat: parseFloat(p.latitud_actual_repartidor),
          lng: parseFloat(p.longitud_actual_repartidor)
        });
      } else {
        setDriverLoc({
          lat: parseFloat(p.sucursal_lat || -12.0684),
          lng: parseFloat(p.sucursal_lng || -75.2100)
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [selectedBranch]);

  // Conexión a WebSocket Socket.io
  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      setSocketConnected(true);
      if (selectedPedido) {
        socket.emit('join_delivery_room', {
          pedido_id: selectedPedido.id,
          rol: 'Supervisor',
          nombre: 'Panel Central Mass'
        });
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('delivery_location_broadcast', (data) => {
      if (selectedPedido && data.pedido_id === selectedPedido.id) {
        setDriverLoc({ lat: data.latitud, lng: data.longitud });
      }
    });

    return () => {
      socket.off('delivery_location_broadcast');
    };
  }, [selectedPedido]);

  // Simulador de avance de motorizado en tiempo real por WebSocket
  useEffect(() => {
    let interval = null;
    if (isSimulating && selectedPedido) {
      const originLat = parseFloat(selectedPedido.sucursal_lat || -12.0684);
      const originLng = parseFloat(selectedPedido.sucursal_lng || -75.2100);
      const destLat = parseFloat(selectedPedido.latitud_destino || -12.0691);
      const destLng = parseFloat(selectedPedido.longitud_destino || -75.2092);

      let step = 0;
      const totalSteps = 20;

      interval = setInterval(() => {
        step++;
        const currentLat = originLat + (destLat - originLat) * (step / totalSteps);
        const currentLng = originLng + (destLng - originLng) * (step / totalSteps);

        setDriverLoc({ lat: currentLat, lng: currentLng });

        // Emitir posición por WebSocket
        const socket = getSocket();
        if (socket.connected) {
          socket.emit('delivery_location_update', {
            pedido_id: selectedPedido.id,
            latitud: currentLat,
            longitud: currentLng,
            repartidor_nombre: selectedPedido.repartidor_nombre || 'Motorizado Mass',
            velocidad_kmh: 24
          });
        }

        // También persistir en backend
        api.post('/delivery/update-location', {
          pedido_id: selectedPedido.id,
          latitud: currentLat,
          longitud: currentLng
        }).catch(() => {});

        if (step >= totalSteps) {
          setIsSimulating(false);
          clearInterval(interval);
          api.put(`/pedidos/${selectedPedido.id}/estado`, { estado_pedido: 'ENTREGADO' })
            .then(() => fetchDeliveries());
        }
      }, 1500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSimulating, selectedPedido]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Rastreo Satelital y Despachos en Vivo (WebSockets + Node.js)
          </h1>
          <p className="text-xs text-stone-500">
            Sucursal: <span className="font-bold text-stone-800">{selectedBranch?.nombre}</span> – Streaming en tiempo real de geoposición del repartidor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            socketConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
          }`}>
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>{socketConnected ? 'WebSocket Activo' : 'Conectando Socket...'}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Lista de Pedidos en Delivery */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-3">
          <div className="font-bold text-xs text-stone-700 flex justify-between">
            <span>Envíos Activos ({pedidosDelivery.length})</span>
            <button onClick={fetchDeliveries} className="text-amber-600 hover:underline">Refrescar</button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {pedidosDelivery.map((p) => (
              <div
                key={p.id}
                onClick={() => loadPedidoDetail(p.id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition space-y-1.5 ${
                  selectedPedido?.id === p.id
                    ? 'border-mass-red bg-red-50/50 shadow-sm'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-stone-900">{p.codigo_pedido}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    p.estado_pedido === 'ENTREGADO'
                      ? 'bg-emerald-100 text-emerald-800'
                      : p.estado_pedido === 'DESPACHADO'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {p.estado_delivery || p.estado_pedido}
                  </span>
                </div>
                <div className="font-semibold text-stone-800 truncate">
                  {p.cliente_nombres} {p.cliente_apellidos}
                </div>
                <div className="text-[11px] text-stone-500 truncate flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-red-500" />
                  <span>{p.direccion_destino || 'Huancayo'}</span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-600 pt-1 border-t border-stone-200">
                  <span>Distancia: <strong>{p.distancia_km || 1.2} km</strong></span>
                  <span className="font-bold text-mass-red">S/. {parseFloat(p.total).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Derecha: Mapa en Vivo y Simulador GPS */}
        <div className="lg:col-span-8 space-y-4">
          {selectedPedido ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400">Rastreando Pedido</span>
                  <div className="text-base font-extrabold text-stone-900">
                    {selectedPedido.codigo_pedido} – {selectedPedido.cliente_nombres} {selectedPedido.cliente_apellidos}
                  </div>
                </div>

                {/* Botón Simulador GPS */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSimulating(!isSimulating)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition ${
                      isSimulating
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-stone-900 hover:bg-black text-amber-400'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isSimulating ? 'Detener Simulación' : 'Simular Avance GPS'}</span>
                  </button>
                </div>
              </div>

              {/* Mapa GPS Interactivo en Vivo */}
              <div className="relative w-full h-80 bg-stone-900 rounded-2xl overflow-hidden border border-stone-300 shadow-inner flex flex-col justify-between p-4 text-white">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>

                {/* Pin Tienda Mass (Origen) */}
                <div className="relative z-10 flex items-center gap-2 bg-stone-800/90 backdrop-blur px-3 py-1.5 rounded-lg border border-stone-700 w-fit text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="font-bold text-amber-400">Sucursal:</span> {selectedPedido.sucursal_nombre}
                </div>

                {/* Marcador del Motorizado en Tiempo Real */}
                <div className="relative z-10 self-center flex flex-col items-center animate-bounce">
                  <div className="p-2.5 rounded-full bg-mass-yellow text-stone-950 shadow-xl border-2 border-white">
                    <Truck className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-extrabold bg-stone-950/90 text-amber-300 px-2 py-0.5 rounded mt-1 border border-stone-700">
                    {selectedPedido.repartidor_nombre || 'Motorizado Mass'}
                  </span>
                </div>

                {/* Pin Cliente (Destino) */}
                <div className="relative z-10 flex items-center justify-between bg-stone-800/90 backdrop-blur p-3 rounded-xl border border-stone-700 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-mass-red" />
                    <div>
                      <div className="font-bold text-white truncate max-w-xs">{selectedPedido.direccion_destino}</div>
                      <div className="text-[10px] text-stone-400">Ref: {selectedPedido.referencia_destino || 'Huancayo'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-400">{selectedPedido.distancia_km || 1.2} km</div>
                    <div className="text-[10px] text-stone-400">~{selectedPedido.tiempo_estimado_min || 15} min</div>
                  </div>
                </div>
              </div>

              {/* Barra de progreso de hitos de entrega */}
              <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
                {[
                  { label: 'Pedido Confirmado', icon: CheckCircle2, active: true },
                  { label: 'Picking PEPS', icon: Clock, active: selectedPedido.estado_pedido !== 'PENDIENTE' },
                  { label: 'En Ruta GPS', icon: Truck, active: selectedPedido.estado_pedido === 'DESPACHADO' || selectedPedido.estado_pedido === 'ENTREGADO' },
                  { label: 'Entregado', icon: CheckCircle2, active: selectedPedido.estado_pedido === 'ENTREGADO' }
                ].map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                        step.active
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold'
                          : 'border-stone-200 bg-stone-50 text-stone-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px]">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center text-stone-400 text-xs">
              Selecciona un pedido de la lista para ver el rastreo satelital.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
