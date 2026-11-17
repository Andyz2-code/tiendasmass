import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useCart } from '../../context/CartContext';
import { GoogleMapPicker } from '../../components/GoogleMapPicker';
import { ChatbotCartAssistant } from '../../components/ChatbotCartAssistant';
import api from '../../services/api';
import {
  ShoppingBag,
  MapPin,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Truck,
  Calendar,
  UserCheck,
  Mail,
  Phone,
  FileText,
  Printer,
  Lock
} from 'lucide-react';

export const CheckoutView = () => {
  const { user, loginClient } = useAuth();
  const { selectedBranch } = useBranch();
  const { cart, totalMercaderia, subtotalSinIgv, igv, clearCart } = useCart();
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  // Estados de Checkout
  const [tipoEntrega, setTipoEntrega] = useState('DELIVERY'); // 'DELIVERY' | 'RETIRO_TIENDA'
  const [metodoPago, setMetodoPago] = useState('YAPE');
  const [notas, setNotas] = useState('');
  const [deliveryData, setDeliveryData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Requerimiento 1: Estado de Recojo en Tienda y Validación de Stock por Sucursal
  const [pickupValidation, setPickupValidation] = useState({
    loading: false,
    mismo_dia_disponible: true,
    bloqueo_mismo_dia: false,
    fecha_minima_recojo: todayStr,
    productos_sin_stock: [],
    mensaje: ''
  });
  const [fechaRecojo, setFechaRecojo] = useState(todayStr);

  // Requerimiento 2: Estados del Flujo Post-Pago (Guest Checkout vs Login) y Notificación de Boleta
  const [validatedOrder, setValidatedOrder] = useState(null); // Paso intermedio tras validar pago
  const [postPayTab, setPostPayTab] = useState(user ? 'LOGIN' : 'INVITADO'); // 'LOGIN' | 'INVITADO'
  const [guestPhone, setGuestPhone] = useState(user?.telefono || '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [loginEmail, setLoginEmail] = useState('juan.perez@gmail.com');
  const [loginPassword, setLoginPassword] = useState('123456');
  const [postPaySubmitting, setPostPaySubmitting] = useState(false);
  const [postPayError, setPostPayError] = useState('');
  const [notificationResult, setNotificationResult] = useState(null); // Boleta Electrónica + Seguimiento

  // Validar stock de todos los productos del carrito en la sucursal seleccionada cuando elige RETIRO_TIENDA
  useEffect(() => {
    if (cart.length === 0 || !selectedBranch?.id) return;

    const checkPickupStock = async () => {
      setPickupValidation((prev) => ({ ...prev, loading: true }));
      try {
        const res = await api.post('/pedidos/validar-stock-recojo', {
          sucursal_id: selectedBranch.id,
          items: cart.map((i) => ({
            producto_id: i.producto.id,
            cantidad: i.cantidad
          }))
        });
        const data = res.data;
        setPickupValidation({
          loading: false,
          mismo_dia_disponible: data.mismo_dia_disponible,
          bloqueo_mismo_dia: data.bloqueo_mismo_dia,
          fecha_minima_recojo: data.fecha_minima_recojo,
          productos_sin_stock: data.productos_sin_stock || [],
          mensaje: data.mensaje
        });
        // Si se bloquea el mismo día, forzar automáticamente la fecha mínima (día siguiente)
        if (data.bloqueo_mismo_dia) {
          setFechaRecojo((prevDate) => (prevDate <= todayStr ? data.fecha_minima_recojo : prevDate));
        } else {
          setFechaRecojo((prevDate) => (prevDate < todayStr ? todayStr : prevDate));
        }
      } catch (err) {
        // Fallback local si el endpoint no responde
        const faltantes = cart.filter((i) => Number(i.producto.stock_actual ?? 99) < Number(i.cantidad));
        const todosConStock = faltantes.length === 0;
        const minDate = todosConStock ? todayStr : tomorrowStr;
        setPickupValidation({
          loading: false,
          mismo_dia_disponible: todosConStock,
          bloqueo_mismo_dia: !todosConStock,
          fecha_minima_recojo: minDate,
          productos_sin_stock: faltantes.map((f) => ({
            producto_id: f.producto.id,
            nombre: f.producto.nombre,
            cantidad_solicitada: f.cantidad,
            stock_sucursal: Number(f.producto.stock_actual ?? 0)
          })),
          mensaje: todosConStock
            ? '¡Stock completo en esta sucursal! Puede recoger su pedido hoy mismo.'
            : `Falta stock inmediato en esta sucursal. Recojo disponible a partir del día siguiente (${tomorrowStr}).`
        });
        if (!todosConStock) {
          setFechaRecojo((prevDate) => (prevDate <= todayStr ? tomorrowStr : prevDate));
        }
      }
    };

    void checkPickupStock();
  }, [cart, selectedBranch?.id, tipoEntrega]);

  const costoEnvio =
    tipoEntrega === 'DELIVERY' && deliveryData?.isWithinCoverage
      ? Number.parseFloat((4.0 + Math.max(0, deliveryData.distanceKm - 1) * 1.5).toFixed(2))
      : 0.0;

  const totalFinal = Number.parseFloat((totalMercaderia + costoEnvio).toFixed(2));

  // Paso 1: Validar Pago y Registrar Orden
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('Tu canasta de compras está vacía.');
      return;
    }

    if (tipoEntrega === 'DELIVERY') {
      if (!deliveryData || !deliveryData.isWithinCoverage) {
        setErrorMessage('La dirección seleccionada está fuera del radio de entrega de esta sucursal.');
        return;
      }
    }

    if (tipoEntrega === 'RETIRO_TIENDA') {
      if (!fechaRecojo) {
        setErrorMessage('Por favor selecciona una fecha de recojo en tienda.');
        return;
      }
      if (pickupValidation.bloqueo_mismo_dia && fechaRecojo <= todayStr) {
        setErrorMessage(
          `El día de hoy (${todayStr}) está bloqueado por falta de stock en la sucursal. Selecciona a partir del ${pickupValidation.fecha_minima_recojo}.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sucursal_id: selectedBranch?.id || 1,
        cliente_id: user?.id || 1,
        tipo_entrega: tipoEntrega,
        fecha_recojo: tipoEntrega === 'RETIRO_TIENDA' ? fechaRecojo : null,
        metodo_pago: metodoPago,
        notas: notas,
        items: cart.map((item) => ({
          producto_id: item.producto.id,
          cantidad: item.cantidad
        })),
        delivery_info:
          tipoEntrega === 'DELIVERY'
            ? {
                direccion_completa: deliveryData.address,
                referencia: deliveryData.reference || '',
                latitud: deliveryData.lat,
                longitud: deliveryData.lng
              }
            : null
      };

      const res = await api.post('/pedidos', payload);
      setValidatedOrder(res.data);
      clearCart();
    } catch (err) {
      setErrorMessage(err.message || 'No se pudo procesar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paso 2 (Requerimiento 2): Flujo Post-Pago (Iniciar sesión vs Continuar como Invitado) y disparo automático de Boleta + Seguimiento
  const handleCompletePostPayment = async (e) => {
    e.preventDefault();
    setPostPayError('');
    setPostPaySubmitting(true);

    try {
      let targetClientId = user?.id || null;
      let targetEmail = guestEmail;
      let targetPhone = guestPhone;

      if (postPayTab === 'LOGIN' && !user) {
        // Autenticar cliente existente
        const authRes = await loginClient(loginEmail, loginPassword);
        targetClientId = authRes.id;
        targetEmail = authRes.email;
        targetPhone = authRes.telefono;
      } else if (postPayTab === 'LOGIN' && user) {
        targetClientId = user.id;
        targetEmail = user.email;
        targetPhone = user.telefono || guestPhone;
      }

      const orderId = validatedOrder.id || validatedOrder.pedido_id;
      const notifRes = await api.post(`/pedidos/${orderId}/notificar-boleta`, {
        modo: postPayTab,
        cliente_id: targetClientId,
        email: targetEmail,
        telefono: targetPhone
      });

      setNotificationResult(notifRes.data);
    } catch (err) {
      setPostPayError(err.message || 'Error al procesar los datos y enviar la boleta electrónica.');
    } finally {
      setPostPaySubmitting(false);
    }
  };

  // VISTA FINAL: Boleta Electrónica Emitida y Seguimiento de Estados de Compra
  if (validatedOrder && notificationResult) {
    const boleta = notificationResult.boleta_electronica;
    const seg = notificationResult.seguimiento;

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-emerald-300 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  ✓ Evento Post-Pago Ejecutado Automáticamente
                </span>
                <h2 className="text-xl font-black text-stone-900 mt-1">
                  ¡Boleta Electrónica y Seguimiento Enviados!
                </h2>
                <p className="text-xs text-stone-600">{notificationResult.mensaje_confirmacion}</p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold self-start"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Boleta</span>
            </button>
          </div>

          {/* Comprobante: Boleta de Venta Electrónica */}
          <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row justify-between gap-3 pb-3 border-b border-stone-200">
              <div>
                <div className="font-black text-sm text-stone-900">{boleta?.emisor?.razon_social}</div>
                <div className="text-stone-500">RUC: {boleta?.emisor?.ruc} • {boleta?.emisor?.sucursal}</div>
                <div className="text-stone-500">{boleta?.emisor?.direccion}</div>
              </div>
              <div className="border-2 border-stone-900 rounded-xl px-4 py-2 text-center bg-white self-start">
                <div className="font-black text-[10px] uppercase text-stone-600">BOLETA DE VENTA ELECTRÓNICA</div>
                <div className="font-mono font-black text-sm text-mass-red">{boleta?.comprobante?.serie_numero}</div>
                <div className="text-[10px] text-stone-400">Pedido: {boleta?.comprobante?.codigo_pedido}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-stone-400 font-bold">Cliente / Modalidad: </span>
                <strong className="text-stone-900">{boleta?.receptor?.nombre} ({boleta?.receptor?.modalidad})</strong>
              </div>
              <div>
                <span className="text-stone-400 font-bold">Correo Destino: </span>
                <strong className="text-stone-900">{boleta?.receptor?.email}</strong>
              </div>
              <div>
                <span className="text-stone-400 font-bold">Teléfono Notificado: </span>
                <strong className="text-stone-900">{boleta?.receptor?.telefono}</strong>
              </div>
              <div>
                <span className="text-stone-400 font-bold">Entrega: </span>
                <strong className="text-stone-900">
                  {boleta?.comprobante?.tipo_entrega}
                  {boleta?.comprobante?.fecha_recojo ? ` (Fecha Recojo: ${boleta.comprobante.fecha_recojo})` : ''}
                </strong>
              </div>
            </div>

            <div className="border-t border-stone-200 pt-3 flex justify-end">
              <div className="w-full sm:w-64 space-y-1">
                <div className="flex justify-between text-stone-500">
                  <span>Op. Gravadas (Sin IGV):</span>
                  <span>S/. {Number.parseFloat(boleta?.totales?.op_gravadas || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>IGV (18%):</span>
                  <span>S/. {Number.parseFloat(boleta?.totales?.igv_18 || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Costo Envío:</span>
                  <span>S/. {Number.parseFloat(boleta?.totales?.costo_envio || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-stone-950 pt-1 border-t">
                  <span>Importe Total:</span>
                  <span className="text-mass-red">S/. {Number.parseFloat(boleta?.totales?.importe_total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enlace y Estados de Seguimiento de Compra */}
          <div className="p-5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-extrabold text-stone-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-mass-red" />
                <span>Seguimiento en Tiempo Real de tu Compra</span>
              </div>
              <span className="font-mono text-[11px] bg-white px-2.5 py-1 rounded-lg border border-amber-300 font-bold text-stone-800">
                Código: {seg?.codigo_pedido}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-[11px] font-mono text-stone-600 break-all">
              🔗 Enlace directo enviado: <strong>{seg?.enlace_seguimiento}</strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
              {seg?.etapas?.map((et, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-center font-bold ${
                    et.completado
                      ? 'bg-emerald-100/80 border-emerald-300 text-emerald-900'
                      : 'bg-white border-stone-200 text-stone-400'
                  }`}
                >
                  <div className="text-xs mb-1">{et.completado ? '✓' : '⏳'}</div>
                  <div className="text-[11px] leading-snug">{et.titulo}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl text-xs shadow"
            >
              Volver al Catálogo de la Tienda
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PASO INTERMEDIO (Requerimiento 2): Flujo Post-Pago (Opciones: Iniciar Sesión o Continuar como Invitado)
  if (validatedOrder && !notificationResult) {
    return (
      <div className="max-w-lg mx-auto bg-white p-6 sm:p-8 rounded-3xl border-2 border-amber-300 shadow-2xl space-y-5 animate-fadeIn text-xs">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-3 py-0.5 rounded-full">
            ¡Pago Validado con Éxito! ({validatedOrder.codigo_pedido})
          </span>
          <h2 className="text-lg sm:text-xl font-black text-stone-900 pt-1">
            ¿Cómo deseas recibir tu Boleta Electrónica y el Seguimiento de tu Compra?
          </h2>
          <p className="text-stone-500">
            Elige una opción para finalizar y disparar el envío automático de tu comprobante y link de rastreo.
          </p>
        </div>

        {/* Selector de las 2 Opciones requeridas: Iniciar Sesión vs Continuar como Invitado */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-2xl font-extrabold">
          <button
            type="button"
            onClick={() => setPostPayTab('INVITADO')}
            className={`py-2.5 px-3 rounded-xl transition ${
              postPayTab === 'INVITADO' ? 'bg-mass-yellow text-stone-950 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            ⚡ Continuar como Invitado
          </button>
          <button
            type="button"
            onClick={() => setPostPayTab('LOGIN')}
            className={`py-2.5 px-3 rounded-xl transition ${
              postPayTab === 'LOGIN' ? 'bg-mass-yellow text-stone-950 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            🔐 Iniciar Sesión
          </button>
        </div>

        {postPayError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{postPayError}</span>
          </div>
        )}

        <form onSubmit={handleCompletePostPayment} className="space-y-4">
          {postPayTab === 'INVITADO' ? (
            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="font-bold text-stone-800">
                Ingresa únicamente tu teléfono y correo para enviarte tu boleta electrónica:
              </div>
              <div>
                <label htmlFor="drawer_guest_phone" className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-mass-red" /> Número Telefónico (SMS / WhatsApp) *
                </label>
                <input
                  id="drawer_guest_phone"
                  type="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="Ej: 987654321"
                  className="w-full p-2.5 border border-stone-300 rounded-xl font-bold bg-white"
                />
              </div>
              <div>
                <label htmlFor="drawer_guest_email" className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-mass-red" /> Correo Electrónico (Boleta Electrónica) *
                </label>
                <input
                  id="drawer_guest_email"
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full p-2.5 border border-stone-300 rounded-xl font-bold bg-white"
                />
              </div>
            </div>
          ) : user ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="font-extrabold text-emerald-950 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Sesión activa: {user.nombres} {user.apellidos}</span>
              </div>
              <div className="text-[11px] text-emerald-800">
                Se enviará tu boleta electrónica y enlace de seguimiento a <strong>{user.email}</strong> y al teléfono <strong>{user.telefono || 'registrado'}</strong>.
              </div>
            </div>
          ) : (
            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="font-bold text-stone-800">
                Ingresa con tu cuenta de Tiendas Mass para vincular tu compra:
              </div>
              <div>
                <label htmlFor="drawer_login_email" className="block font-bold text-stone-700 mb-1">Correo Electrónico *</label>
                <input
                  id="drawer_login_email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full p-2.5 border border-stone-300 rounded-xl font-bold bg-white"
                />
              </div>
              <div>
                <label htmlFor="drawer_login_pass" className="block font-bold text-stone-700 mb-1">Contraseña *</label>
                <input
                  id="drawer_login_pass"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full p-2.5 border border-stone-300 rounded-xl font-bold bg-white"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={postPaySubmitting}
            className="w-full py-3.5 bg-mass-red hover:bg-red-700 text-white font-extrabold rounded-2xl shadow-lg transition uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>
              {postPaySubmitting
                ? 'Emitiendo Boleta Electrónica...'
                : 'Emitir Boleta Electrónica y Ver Seguimiento'}
            </span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NavLink to="/" className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-stone-900">
        <ArrowLeft className="w-4 h-4" />
        <span>Seguir comprando</span>
      </NavLink>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Formulario de Checkout */}
        <div className="lg:col-span-7 space-y-6">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2 font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Modalidad de Entrega */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-mass-red" />
              <span>1. Modalidad de Entrega</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setTipoEntrega('DELIVERY')}
                className={`p-3 rounded-xl border font-bold text-left transition flex items-center justify-between ${
                  tipoEntrega === 'DELIVERY'
                    ? 'border-amber-400 bg-amber-50 text-amber-950 shadow-sm'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <div>
                  <div className="font-extrabold">Delivery Express</div>
                  <div className="text-[10px] text-stone-500 font-normal">Entrega a domicilio</div>
                </div>
                <Truck className="w-5 h-5 text-mass-red" />
              </button>

              <button
                type="button"
                onClick={() => setTipoEntrega('RETIRO_TIENDA')}
                className={`p-3 rounded-xl border font-bold text-left transition flex items-center justify-between ${
                  tipoEntrega === 'RETIRO_TIENDA'
                    ? 'border-amber-400 bg-amber-50 text-amber-950 shadow-sm'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <div>
                  <div className="font-extrabold">Recojo en Tienda</div>
                  <div className="text-[10px] text-stone-500 font-normal">Con validación de stock</div>
                </div>
                <MapPin className="w-5 h-5 text-stone-500" />
              </button>
            </div>
          </div>

          {/* REQUERIMIENTO 1: Selector de Fecha de Recojo en Tienda con Validación de Stock Mismo Día vs Día Siguiente */}
          {tipoEntrega === 'RETIRO_TIENDA' && (
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-mass-red" />
                  <span>2. Programación de Fecha de Recojo en Tienda</span>
                </h3>
                <span className="text-[11px] font-bold text-stone-600">
                  📍 {selectedBranch?.nombre}
                </span>
              </div>

              {pickupValidation.mismo_dia_disponible ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-extrabold">¡Recojo Disponible Hoy Mismo ({todayStr})!</div>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      La sucursal <strong>{selectedBranch?.nombre}</strong> cuenta con stock suficiente de TODOS los productos de tu carrito.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 space-y-2">
                  <div className="flex items-start gap-2">
                    <Lock className="w-5 h-5 text-mass-red shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black text-mass-red uppercase text-[11px]">
                        Día Actual ({todayStr}) Bloqueado por Falta de Stock en Sucursal
                      </div>
                      <p className="text-[11px] text-stone-700 mt-0.5">
                        Falta stock inmediato de al menos un producto en <strong>{selectedBranch?.nombre}</strong>. Solo se permite seleccionar a partir de mañana (<strong>{pickupValidation.fecha_minima_recojo}</strong>) para realizar el traslado de inventario.
                      </p>
                    </div>
                  </div>
                  {pickupValidation.productos_sin_stock.length > 0 && (
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200 space-y-1 text-[11px]">
                      <div className="font-bold text-stone-700">Productos que requieren traslado a esta tienda:</div>
                      {pickupValidation.productos_sin_stock.map((prod) => (
                        <div key={prod.producto_id} className="flex justify-between text-stone-600">
                          <span>• {prod.nombre}</span>
                          <span className="font-bold text-red-600">
                            Solicitado: {prod.cantidad_solicitada} | Stock en tienda: {prod.stock_sucursal}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="drawer_fecha_recojo" className="block font-bold text-stone-700 mb-1.5">
                  Selecciona la Fecha de Recojo {pickupValidation.bloqueo_mismo_dia ? `(Mínimo: ${pickupValidation.fecha_minima_recojo})` : `(Desde hoy: ${todayStr})`} *
                </label>
                <input
                  id="drawer_fecha_recojo"
                  type="date"
                  required
                  min={pickupValidation.fecha_minima_recojo}
                  value={fechaRecojo}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (pickupValidation.bloqueo_mismo_dia && val <= todayStr) {
                      setFechaRecojo(pickupValidation.fecha_minima_recojo);
                    } else {
                      setFechaRecojo(val);
                    }
                  }}
                  className="w-full p-3 border-2 border-stone-300 rounded-xl font-extrabold text-stone-900 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Geolocalización en Mapa si es Delivery */}
          {tipoEntrega === 'DELIVERY' && (
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-mass-red" />
                <span>2. Ubicación de Entrega (Google Maps API)</span>
              </h3>
              <GoogleMapPicker
                branchLocation={{
                  lat: Number.parseFloat(selectedBranch?.latitud || -12.0684),
                  lng: Number.parseFloat(selectedBranch?.longitud || -75.21),
                  name: selectedBranch?.nombre || 'Tienda Mass Centro',
                  radio: Number.parseFloat(selectedBranch?.radio_cobertura_km || 5.0)
                }}
                onLocationSelect={(data) => setDeliveryData(data)}
              />
            </div>
          )}

          {/* Métodos de Pago */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-mass-red" />
              <span>3. Método de Pago</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { id: 'YAPE', label: 'Yape', icon: QrCode },
                { id: 'PLIN', label: 'Plin', icon: QrCode },
                { id: 'TARJETA', label: 'Tarjeta Déb./Créd.', icon: CreditCard },
                { id: 'EFECTIVO_CONTRA_ENTREGA', label: 'Contra Entrega', icon: Banknote }
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMetodoPago(p.id)}
                    className={`p-3 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1.5 ${
                      metodoPago === p.id
                        ? 'border-mass-red bg-red-50 text-red-900 shadow-sm'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-mass-red" />
                    <span className="text-[11px]">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Resumen de Orden */}
        <div className="lg:col-span-5">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm sticky top-24 space-y-4">
            <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2 pb-3 border-b border-stone-200">
              <ShoppingBag className="w-5 h-5 text-mass-red" />
              <span>Resumen de tu Pedido</span>
            </h3>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {cart.map((item) => (
                <div key={item.producto.id} className="flex justify-between items-center text-xs">
                  <div className="truncate mr-2">
                    <span className="font-bold text-stone-900">{item.cantidad}x</span>{' '}
                    <span className="text-stone-700">{item.producto.nombre}</span>
                  </div>
                  <div className="font-semibold text-stone-900 shrink-0">
                    S/. {(Number.parseFloat(item.producto.precio_venta) * item.cantidad).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal (sin IGV):</span>
                <span>S/. {subtotalSinIgv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>IGV (18% Perú):</span>
                <span>S/. {igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Costo de Envío / Flete:</span>
                <span>{costoEnvio > 0 ? `S/. ${costoEnvio.toFixed(2)}` : 'Gratis'}</span>
              </div>
              {tipoEntrega === 'RETIRO_TIENDA' && (
                <div className="flex justify-between text-amber-800 font-bold">
                  <span>Fecha de Recojo:</span>
                  <span>{fechaRecojo}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-950 font-extrabold text-base pt-2 border-t border-stone-200">
                <span>Total a Pagar:</span>
                <span className="text-mass-red">S/. {totalFinal.toFixed(2)}</span>
              </div>
            </div>

            {/* Asistente Inteligente de Ahorro Massi */}
            <ChatbotCartAssistant />

            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || (tipoEntrega === 'DELIVERY' && !deliveryData?.isWithinCoverage)}
              className="w-full py-3.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-extrabold rounded-2xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? 'Validando Pago y Stock...' : 'Validar Pago y Continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CheckoutView;
