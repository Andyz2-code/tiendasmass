/**
 * TIENDAS MASS - Módulo de Rastreo Delivery Satelital en Tiempo Real
 * Ubicación: frontend/src/interfaz-cliente/pedidos/RastreoDeliveryCliente.jsx
 * Soporte integral para Clientes Invitados y Clientes Registrados
 */
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export const RastreoDeliveryCliente = ({ order, branch, onDeliveryCompleted, onBackToOrders, onBackToStore }) => {
  const isAlreadyDelivered = order?.estado_pedido === 'ENTREGADO';
  const storeLat = parseFloat(order?.sucursal_lat || branch?.latitud || -12.0684);
  const storeLng = parseFloat(order?.sucursal_lng || branch?.longitud || -75.2100);
  const destLat = parseFloat(order?.latitud_destino || order?.delivery?.latitud_destino || -12.0691);
  const destLng = parseFloat(order?.longitud_destino || order?.delivery?.longitud_destino || -75.2092);

  const [driverLat, setDriverLat] = useState(() =>
    order?.latitud_actual_repartidor ? parseFloat(order.latitud_actual_repartidor) : storeLat
  );
  const [driverLng, setDriverLng] = useState(() =>
    order?.longitud_actual_repartidor ? parseFloat(order.longitud_actual_repartidor) : storeLng
  );
  const [hasLiveGps, setHasLiveGps] = useState(() =>
    Boolean(order?.latitud_actual_repartidor && order?.longitud_actual_repartidor && !order?.posicion_origen_sucursal)
  );
  const [riderName, setRiderName] = useState(() => order?.repartidor_nombre || 'Motorizado Mass Express');
  const [riderPhone, setRiderPhone] = useState(() => order?.repartidor_telefono || '');
  const [speedKmh, setSpeedKmh] = useState(0);
  const [lastGpsTime, setLastGpsTime] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(() => isAlreadyDelivered ? 100 : 30);
  const [orderStatus, setOrderStatus] = useState(() => order?.estado_pedido || 'DESPACHADO');
  const [gpsDiagnosticMsg, setGpsDiagnosticMsg] = useState('Iniciando enlace con satélite GPS...');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  const destAddress = order?.direccion_destino || order?.delivery?.direccion_destino || 'Jr. Puno 345, Huancayo';
  const storeName = order?.sucursal_nombre || branch?.nombre || 'Tienda Mass - Huancayo Centro';
  const orderCode = order?.codigo_pedido || 'PED-MASS-001';
  const pedidoId = order?.id || order?.pedido_id;
  const trackingToken = order?.token_seguimiento;
  const esInvitado = Boolean(order?.es_invitado);

  const calcDistanceKm = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // 1. Polling de respaldo (5s)
  const fetchTrackingSnapshot = async () => {
    const queryParam = pedidoId || orderCode || trackingToken;
    if (!queryParam || orderStatus === 'ENTREGADO') return;

    try {
      const endpoint = pedidoId 
        ? `http://localhost/tiendasmass/backend/public/api/delivery/track/${pedidoId}`
        : `http://localhost/tiendasmass/backend/public/api/pedidos/seguimiento/${encodeURIComponent(queryParam)}`;
      const res = await axios.get(endpoint);
      const d = res?.data?.data || res?.data;
      if (!d) return;

      if (d.estado_pedido) {
        setOrderStatus(d.estado_pedido);
        if (d.estado_pedido === 'ENTREGADO') {
          setProgressPercent(100);
          if (onDeliveryCompleted) {
            onDeliveryCompleted({ ...order, ...d, estado_pedido: 'ENTREGADO' });
          }
          return;
        } else if (d.estado_pedido === 'DESPACHADO' || d.estado_delivery === 'EN_RUTA') {
          setProgressPercent((prev) => Math.max(prev, 65));
        }
      }

      if (d.repartidor_nombre) setRiderName(d.repartidor_nombre);
      if (d.repartidor_telefono) setRiderPhone(d.repartidor_telefono);

      if (d.latitud_actual_repartidor && d.longitud_actual_repartidor) {
        const lat = parseFloat(d.latitud_actual_repartidor);
        const lng = parseFloat(d.longitud_actual_repartidor);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          setDriverLat(lat);
          setDriverLng(lng);
          setHasLiveGps(true);
          setLastGpsTime(d.updated_at || d.delivery_updated_at || new Date().toISOString());
        }
      }
    } catch (err) {
      console.warn('Consulta de tracking:', err?.message || err);
    }
  };

  // 2. Conexión WebSocket y Polling
  useEffect(() => {
    if (orderStatus === 'ENTREGADO') return;

    fetchTrackingSnapshot();
    const pollTimer = setInterval(fetchTrackingSnapshot, 5000);

    let socket = null;
    if (window.io && (pedidoId || orderCode)) {
      const nodeHost = window.location.hostname || 'localhost';
      socket = window.io(`http://${nodeHost}:4000`, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setSocketConnected(true);
        socket.emit('join_delivery_room', {
          pedido_id: pedidoId || orderCode,
          rol: esInvitado ? 'Cliente Invitado' : 'Cliente Registrado',
          nombre: order?.cliente_nombres || (esInvitado ? 'Invitado Mass' : 'Cliente Mass')
        });
      });

      socket.on('disconnect', () => setSocketConnected(false));

      socket.on('delivery_location_broadcast', (data) => {
        if (!data || orderStatus === 'ENTREGADO') return;
        const targetId = pedidoId || orderCode;
        if (String(data.pedido_id) !== String(targetId) && String(data.codigo_pedido) !== String(targetId)) return;

        const lat = parseFloat(data.latitud);
        const lng = parseFloat(data.longitud);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          setDriverLat(lat);
          setDriverLng(lng);
          setHasLiveGps(true);
          setSimulating(false);
          if (data.repartidor_nombre) setRiderName(data.repartidor_nombre);
          if (data.velocidad_kmh !== undefined) setSpeedKmh(Number(data.velocidad_kmh) || 0);
          setLastGpsTime(data.timestamp || new Date().toISOString());
          setProgressPercent((prev) => Math.max(prev, 65));
        }
      });

      socket.on('order_status_broadcast', (data) => {
        if (!data) return;
        const targetId = pedidoId || orderCode;
        if (String(data.pedido_id) !== String(targetId) && String(data.codigo_pedido) !== String(targetId)) return;

        if (data.nuevo_estado) {
          setOrderStatus(data.nuevo_estado);
          if (data.nuevo_estado === 'ENTREGADO') {
            setProgressPercent(100);
            if (onDeliveryCompleted) {
              onDeliveryCompleted({ ...order, estado_pedido: 'ENTREGADO' });
            }
          }
        }
      });
    }

    return () => {
      clearInterval(pollTimer);
      if (socket) socket.disconnect();
    };
  }, [pedidoId, orderCode, orderStatus]);

  // 3. Geolocalización del Dispositivo
  useEffect(() => {
    if (orderStatus === 'ENTREGADO') return;

    if (!('geolocation' in navigator)) {
      setGpsDiagnosticMsg('Navegador sin API de geolocalización (usando coordenadas de sucursal)');
      return;
    }

    const handleSuccess = (position) => {
      if (orderStatus === 'ENTREGADO') return;
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        setDriverLat(lat);
        setDriverLng(lng);
        setHasLiveGps(true);
        setLastGpsTime(new Date().toISOString());
        if (position.coords.speed !== null && position.coords.speed > 0) {
          setSpeedKmh(Math.round(position.coords.speed * 3.6));
        }

        const queryTarget = pedidoId || orderCode;
        if (queryTarget) {
          axios.post('http://localhost/tiendasmass/backend/public/api/delivery/update-location', {
            pedido_id: queryTarget,
            latitud: lat,
            longitud: lng,
            repartidor_nombre: riderName
          }).catch(() => {});
        }
      }
    };

    const handleError = (error) => {
      let msg = 'Esperando señal satelital GPS...';
      switch (error.code) {
        case 1:
          msg = 'Permiso GPS denegado por el navegador (usando ruta planificada)';
          break;
        case 2:
          msg = 'Señal satelital GPS no disponible en este dispositivo';
          break;
        case 3:
          msg = 'Tiempo de espera GPS agotado (reintentando conexión)';
          break;
        default:
          msg = 'Buscando satélites GPS en el área...';
      }
      setGpsDiagnosticMsg(msg);
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10000
    });

    try {
      const wId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      });
      watchIdRef.current = wId;
    } catch (e) {
      console.warn('Error en watchPosition:', e);
    }

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [orderStatus, pedidoId, orderCode]);

  // 4. Mapa interactivo Leaflet
  useEffect(() => {
    if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = window.L.map(mapContainerRef.current, {
      center: [driverLat || storeLat, driverLng || storeLng],
      zoom: 15
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const storeIcon = window.L.divIcon({
      className: '',
      html: '<div style="background:#FDCB02;color:#1C1917;border:2px solid #fff;border-radius:999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 10px rgba(0,0,0,.3)">🏪</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const destIcon = window.L.divIcon({
      className: '',
      html: '<div style="background:#E30613;color:#fff;border:2px solid #fff;border-radius:999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 10px rgba(0,0,0,.3)">📍</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const riderIcon = window.L.divIcon({
      className: '',
      html: '<div style="background:#10B981;color:#fff;border:3px solid #fff;border-radius:999px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 6px 14px rgba(0,0,0,.4)">🛵</div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    window.L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map).bindPopup(`<strong>${storeName}</strong>`);
    window.L.marker([destLat, destLng], { icon: destIcon }).addTo(map).bindPopup(`<strong>Tu Domicilio</strong><br/>${destAddress}`);

    const rMarker = window.L.marker([driverLat, driverLng], { icon: riderIcon }).addTo(map).bindPopup(`<strong>${riderName}</strong>`);
    const line = window.L.polyline([[storeLat, storeLng], [driverLat, driverLng], [destLat, destLng]], {
      color: '#E30613',
      weight: 4,
      dashArray: '8, 8'
    }).addTo(map);

    map.fitBounds(line.getBounds(), { padding: [40, 40] });

    mapInstanceRef.current = map;
    riderMarkerRef.current = rMarker;
    routeLineRef.current = line;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      riderMarkerRef.current = null;
      routeLineRef.current = null;
    };
  }, []);

  // 5. Actualizar posición del repartidor en el mapa
  useEffect(() => {
    if (riderMarkerRef.current && mapInstanceRef.current) {
      riderMarkerRef.current.setLatLng([driverLat, driverLng]);
      riderMarkerRef.current.setPopupContent(`<strong>${riderName}</strong><br/>${driverLat.toFixed(5)}, ${driverLng.toFixed(5)}`);
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs([[storeLat, storeLng], [driverLat, driverLng], [destLat, destLng]]);
      }
      mapInstanceRef.current.panTo([driverLat, driverLng], { animate: true });
    }
  }, [driverLat, driverLng, riderName]);

  const remainingKm = calcDistanceKm(driverLat, driverLng, destLat, destLng);
  const etaMinutes = remainingKm > 0 ? Math.max(1, Math.round((remainingKm / 0.35))) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-extrabold">{orderCode}</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-extrabold">{orderStatus}</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              hasLiveGps ? 'bg-emerald-600 text-white' : socketConnected ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-900'
            }`}>
              {hasLiveGps ? '🟢 GPS Real en Vivo' : socketConnected ? '🔵 WebSocket Enlazado' : '⏳ Conectando GPS...'}
            </span>
            {esInvitado && (
              <span className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-bold border">
                Cliente Invitado (Token Seguro)
              </span>
            )}
          </div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight mt-1">
            Seguimiento Satelital de tu Pedido en Tiempo Real
          </h1>
          <p className="text-xs text-stone-500">
            Repartidor: <strong className="text-stone-800">{riderName}</strong>
            {riderPhone ? ` (${riderPhone})` : ''} • Coordenadas: {driverLat.toFixed(5)}, {driverLng.toFixed(5)}
            {speedKmh > 0 ? ` • ${speedKmh} km/h` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchTrackingSnapshot}
            className="px-3.5 py-2 bg-stone-900 hover:bg-black text-mass-yellow font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
          >
            <span>🔄 Consultar Ubicación</span>
          </button>
          <button onClick={onBackToOrders} className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-xl">
            Mis Compras
          </button>
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm space-y-4">
        <div className="relative w-full h-96 rounded-2xl overflow-hidden border border-stone-300 shadow-inner isolate z-0">
          <div ref={mapContainerRef} className="w-full h-full z-0"></div>
          {orderStatus !== 'ENTREGADO' ? (
            <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 bg-stone-950/90 backdrop-blur text-white px-4 py-2.5 rounded-xl border border-stone-700 text-xs shadow-lg">
              <div>
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span>🛵 {riderName}</span>
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                    hasLiveGps ? 'bg-emerald-600 text-white' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {hasLiveGps ? '● GPS ACTIVO' : 'EN ESPERA'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-300">Destino: {destAddress}</div>
              </div>
              <div className="text-right">
                {remainingKm > 0.05 ? (
                  <div className="text-amber-400 font-extrabold text-sm">~{etaMinutes} min ({remainingKm.toFixed(2)} km)</div>
                ) : hasLiveGps ? (
                  <div className="text-emerald-400 font-extrabold text-sm">Llegando a destino</div>
                ) : (
                  <div className="text-stone-300 font-bold text-xs">{order?.distancia_km ? `Distancia total: ${order.distancia_km} km` : 'Calculando ruta...'}</div>
                )}
                <div className="text-[10px] text-stone-400">
                  {lastGpsTime ? `Actualizado: ${new Date(lastGpsTime).toLocaleTimeString()}` : gpsDiagnosticMsg}
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 bg-emerald-950/90 backdrop-blur text-white px-4 py-2.5 rounded-xl border border-emerald-600 text-xs shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-base">✅</span>
                <div>
                  <div className="font-bold text-emerald-300">¡Pedido Entregado con Éxito!</div>
                  <div className="text-[11px] text-emerald-100/80">Destino: {destAddress}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="bg-emerald-600 text-white font-black px-2.5 py-1 rounded-lg text-[10px]">
                  ENTREGA FINALIZADA
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
          <div className="p-3 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold">
            <div className="text-base mb-1">✓</div>
            <div>1. Pedido Recibido</div>
          </div>
          <div className="p-3 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold">
            <div className="text-base mb-1">📦</div>
            <div>2. Picking PEPS</div>
          </div>
          <div className={`p-3 rounded-2xl border font-bold ${
            orderStatus === 'ENTREGADO' || progressPercent > 40 ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900 animate-pulse'
          }`}>
            <div className="text-base mb-1">🛵</div>
            <div>3. En Camino (Moto)</div>
          </div>
          <div className={`p-3 rounded-2xl border font-bold ${
            orderStatus === 'ENTREGADO' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-400'
          }`}>
            <div className="text-base mb-1">🏠</div>
            <div>4. Entregado</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RastreoDeliveryCliente;
