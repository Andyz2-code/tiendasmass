import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useCart } from '../../context/CartContext';
import { GoogleMapPicker } from '../../components/GoogleMapPicker';
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
  Truck
} from 'lucide-react';

export const CheckoutView = () => {
  const { user, isLoggedIn } = useAuth();
  const { selectedBranch } = useBranch();
  const { cart, totalMercaderia, subtotalSinIgv, igv, clearCart } = useCart();
  const navigate = useNavigate();

  // Estados de Checkout
  const [tipoEntrega, setTipoEntrega] = useState('DELIVERY'); // 'DELIVERY' | 'RETIRO_TIENDA'
  const [metodoPago, setMetodoPago] = useState('YAPE'); // 'YAPE' | 'PLIN' | 'TARJETA' | 'EFECTIVO_CONTRA_ENTREGA'
  const [notas, setNotas] = useState('');
  const [deliveryData, setDeliveryData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Identificación de cliente si compra como invitado
  const [guestData, setGuestData] = useState({
    tipo_documento: 'DNI',
    numero_documento: '72458912',
    nombres: 'Juan Víctor',
    apellidos: 'Pérez Quispe',
    telefono: '987654321',
    email: 'juan.perez@gmail.com'
  });

  const costoEnvio = tipoEntrega === 'DELIVERY' && deliveryData?.isWithinCoverage
    ? parseFloat((4.00 + Math.max(0, deliveryData.distanceKm - 1) * 1.50).toFixed(2))
    : 0.00;

  const totalFinal = parseFloat((totalMercaderia + costoEnvio).toFixed(2));

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('Tu canasta de compras está vacía.');
      return;
    }

    if (tipoEntrega === 'DELIVERY') {
      if (!deliveryData || !deliveryData.isWithinCoverage) {
        setErrorMessage('La dirección seleccionada está fuera del radio de entrega de esta sucursal de Tiendas Mass.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sucursal_id: selectedBranch?.id || 1,
        cliente_id: user?.id || 1, // Si está autenticado usa su ID, o ID 1 por defecto
        tipo_entrega: tipoEntrega,
        metodo_pago: metodoPago,
        notas: notas,
        items: cart.map((item) => ({
          producto_id: item.producto.id,
          cantidad: item.cantidad
        })),
        delivery_info: tipoEntrega === 'DELIVERY' ? {
          direccion_completa: deliveryData.address,
          referencia: deliveryData.reference || '',
          latitud: deliveryData.lat,
          longitud: deliveryData.lng
        } : null
      };

      const res = await api.post('/pedidos', payload);
      setOrderSuccess(res.data);
      clearCart();
    } catch (err) {
      setErrorMessage(err.message || 'No se pudo procesar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl border border-stone-200 shadow-xl text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <span className="text-xs uppercase font-extrabold text-emerald-600 tracking-wider">¡Compra Confirmada!</span>
          <h2 className="text-2xl font-extrabold text-stone-900">Gracias por tu compra en Mass</h2>
          <p className="text-xs text-stone-500">
            Código de Pedido: <span className="font-mono font-bold text-stone-900">{orderSuccess.codigo_pedido}</span>
          </p>
        </div>

        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-stone-500">Total Pagado:</span>
            <span className="font-bold text-stone-900 text-sm">S/. {parseFloat(orderSuccess.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Método de Pago:</span>
            <span className="font-bold text-stone-900">{orderSuccess.metodo_pago}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Modalidad:</span>
            <span className="font-bold text-stone-900">{orderSuccess.tipo_entrega}</span>
          </div>
          <div className="flex justify-between text-[11px] text-amber-700 pt-2 border-t border-stone-200">
            <span>Control de Lotes PEPS:</span>
            <span className="font-semibold">Asignado de almacén según NIC 2</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate(`/admin/delivery`)}
            className="flex-1 py-3 bg-stone-900 hover:bg-black text-amber-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow"
          >
            <Truck className="w-4 h-4" />
            <span>Rastrear Entrega en Vivo</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs"
          >
            Volver a la Tienda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón Volver */}
      <NavLink to="/" className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-stone-900">
        <ArrowLeft className="w-4 h-4" />
        <span>Seguir comprando</span>
      </NavLink>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Formulario de Checkout */}
        <div className="lg:col-span-7 space-y-6">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modalidad de Entrega */}
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
                  <div className="font-extrabold">Retiro en Tienda</div>
                  <div className="text-[10px] text-stone-500 font-normal">Sin costo de flete</div>
                </div>
                <MapPin className="w-5 h-5 text-stone-500" />
              </button>
            </div>
          </div>

          {/* Geolocalización en Mapa si es Delivery */}
          {tipoEntrega === 'DELIVERY' && (
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-mass-red" />
                <span>2. Ubicación de Entrega (Google Maps API)</span>
              </h3>
              <GoogleMapPicker
                branchLocation={{
                  lat: parseFloat(selectedBranch?.latitud || -12.0684),
                  lng: parseFloat(selectedBranch?.longitud || -75.2100),
                  name: selectedBranch?.nombre || 'Tienda Mass Centro',
                  radio: parseFloat(selectedBranch?.radio_cobertura_km || 5.0)
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

        {/* Columna Derecha: Resumen de Orden e Impuestos Peruanos */}
        <div className="lg:col-span-5">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm sticky top-24 space-y-4">
            <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2 pb-3 border-b border-stone-200">
              <ShoppingBag className="w-5 h-5 text-mass-red" />
              <span>Resumen de tu Pedido</span>
            </h3>

            {/* Lista breve de ítems */}
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {cart.map((item) => (
                <div key={item.producto.id} className="flex justify-between items-center text-xs">
                  <div className="truncate mr-2">
                    <span className="font-bold text-stone-900">{item.cantidad}x</span>{' '}
                    <span className="text-stone-700">{item.producto.nombre}</span>
                  </div>
                  <div className="font-semibold text-stone-900 shrink-0">
                    S/. {(parseFloat(item.producto.precio_venta) * item.cantidad).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Desglose Comercial e Impuestos Peruanos */}
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
              <div className="flex justify-between text-stone-950 font-extrabold text-base pt-2 border-t border-stone-200">
                <span>Total a Pagar:</span>
                <span className="text-mass-red">S/. {totalFinal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || (tipoEntrega === 'DELIVERY' && !deliveryData?.isWithinCoverage)}
              className="w-full py-3.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-extrabold rounded-2xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? 'Procesando venta en almacén...' : 'Confirmar Pedido y Pagar'}
            </button>

            {tipoEntrega === 'DELIVERY' && deliveryData && !deliveryData.isWithinCoverage && (
              <div className="text-[11px] text-red-600 font-bold text-center">
                Dirección fuera de cobertura. Ajusta la ubicación en el mapa.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
