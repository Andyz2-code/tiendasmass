import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { useCart } from '../context/CartContext';
import { LoginModal } from '../modules/auth/LoginModal';
import { AccessibilityPanel } from '../components/AccessibilityPanel';
import { ChatbotCartAssistant } from '../components/ChatbotCartAssistant';
import {
  ShoppingBag,
  Store,
  MapPin,
  User,
  LogOut,
  ShieldAlert,
  ArrowRight,
  Trash2,
  Plus,
  Minus,
  X
} from 'lucide-react';

export const StoreLayout = () => {
  const { user, isLoggedIn, isInternal, logout } = useAuth();
  const { sucursales, selectedBranch, selectBranch } = useBranch();
  const { cart, itemsCount, totalMercaderia, removeFromCart, updateQuantity } = useCart();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Barra de anuncio superior */}
      <div className="bg-mass-red text-white text-[11px] font-bold py-1.5 px-4 text-center tracking-wide flex items-center justify-center gap-2">
        <span>¡TIENDAS MASS HUANCAYO! Precios bajos todos los días y entregas express con control PEPS.</span>
      </div>

      {/* Header Principal */}
      <header className="bg-mass-yellow sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo Oficial Mass */}
          <NavLink to="/" className="flex items-center shrink-0 group py-1" title="Ir al inicio de Tiendas Mass">
            <img
              src="/tiendasmass/frontend/assets/images/logo-mass-oficial.png"
              alt="Tiendas Mass - Precios bajos, ¡cerca de ti!"
              className="h-9 sm:h-11 md:h-12 w-auto max-w-[200px] sm:max-w-[270px] md:max-w-[320px] object-contain select-none group-hover:scale-102 transition-transform"
              onError={(e) => { e.target.src = '/tiendasmass/frontend/assets/logo-mass-oficial.png'; }}
            />
          </NavLink>

          {/* Selector de Sucursal Simplificado en el Header */}
          <div className="hidden md:flex items-center gap-2 bg-white/90 backdrop-blur px-3.5 py-2 rounded-xl border border-stone-200 shadow-sm text-xs">
            <MapPin className="w-4 h-4 text-mass-red shrink-0" />
            <select
              value={selectedBranch?.id || ''}
              onChange={(e) => selectBranch(e.target.value)}
              className="font-bold text-stone-900 bg-transparent focus:outline-none cursor-pointer pr-1"
              aria-label="Seleccionar sucursal de Tiendas Mass"
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Botones de Usuario y Carrito */}
          <div className="flex items-center gap-3">

            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 bg-white hover:bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200 text-xs shadow-sm transition"
                >
                  <div className="w-7 h-7 rounded-full bg-mass-yellow flex items-center justify-center font-black text-stone-950 border border-amber-300 text-xs">
                    {user?.nombres ? user.nombres.charAt(0).toUpperCase() : '👤'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="font-extrabold text-stone-900 leading-tight flex items-center gap-1">
                      <span>{user?.nombres}</span>
                      <span className="text-[10px] text-stone-400">▼</span>
                    </div>
                    <div className="text-[9px] text-stone-500 font-medium truncate max-w-[120px]">
                      {user?.direccion_completa || 'Huancayo'}
                    </div>
                  </div>
                </button>

                {isProfileMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Cerrar menú"
                      className="fixed inset-0 z-40 w-full h-full bg-transparent cursor-default border-none p-0"
                      onClick={() => setIsProfileMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-stone-200 z-50 overflow-hidden py-1">
                      <div className="p-3 bg-stone-50 border-b border-stone-100">
                        <div className="font-extrabold text-xs text-stone-900 truncate">
                          {user?.nombres} {user?.apellidos}
                        </div>
                        <div className="text-[10px] text-stone-500 font-medium truncate">
                          {user?.email}
                        </div>
                      </div>

                      <div className="p-1.5 space-y-1 text-xs">
                        {/* 1. EDITAR PERFIL */}
                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            alert(`Dirección actual: ${user?.direccion_completa || 'Jr. Puno 345, Huancayo'}`);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-stone-800 hover:bg-amber-50 rounded-xl font-bold transition text-left"
                        >
                          <span>✏️</span>
                          <span>Editar Perfil & Dirección</span>
                        </button>

                        {/* 2. MIS COMPRAS */}
                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate('/checkout');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-stone-800 hover:bg-amber-50 rounded-xl font-bold transition text-left"
                        >
                          <span>📋</span>
                          <span>Mis Compras & Reporte</span>
                        </button>

                        <div className="border-t border-stone-100 my-1"></div>

                        {/* 3. CERRAR SESIÓN */}
                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-bold transition text-left"
                        >
                          <span>🚪</span>
                          <span>Cerrar Sesión</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-900 font-bold rounded-xl text-xs border border-stone-300 shadow-sm transition"
              >
                Ingresar / Registro
              </button>
            )}

            {/* Carrito de Compras */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-mass-red hover:bg-red-700 text-white rounded-xl shadow-md transition flex items-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="hidden sm:inline font-bold text-xs">S/. {totalMercaderia.toFixed(2)}</span>
              {itemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-stone-950 text-amber-300 text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow">
                  {itemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Selector móvil de sucursal simplificado */}
      <div className="md:hidden bg-stone-100 border-b border-stone-200 px-4 py-2 flex items-center gap-2 text-xs">
        <MapPin className="w-4 h-4 text-mass-red" />
        <select
          value={selectedBranch?.id || ''}
          onChange={(e) => selectBranch(e.target.value)}
          className="font-bold text-stone-900 bg-transparent flex-1 focus:outline-none cursor-pointer"
          aria-label="Seleccionar sucursal de Tiendas Mass"
        >
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Contenido Dinámico */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Drawer lateral del Carrito */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900">
                <ShoppingBag className="w-5 h-5 text-mass-red" />
                <span>Canasta de Compras ({itemsCount})</span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-200 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de productos en la canasta */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.producto.id} className="flex gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <img
                      src={item.producto.imagen_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100'}
                      alt={item.producto.nombre}
                      className="w-16 h-16 object-cover rounded-lg bg-white border border-stone-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-stone-900 truncate">{item.producto.nombre}</div>
                      <div className="text-[11px] text-stone-500 font-mono">SKU: {item.producto.codigo_sku}</div>
                      <div className="text-xs font-bold text-red-600 mt-1">
                        S/. {Number.parseFloat(item.producto.precio_venta).toFixed(2)}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 bg-white border border-stone-300 rounded-lg px-2 py-0.5">
                          <button
                            onClick={() => updateQuantity(item.producto.id, item.cantidad - 1)}
                            className="p-0.5 text-stone-500 hover:text-stone-900"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{item.cantidad}</span>
                          <button
                            onClick={() => updateQuantity(item.producto.id, item.cantidad + 1)}
                            className="p-0.5 text-stone-500 hover:text-stone-900"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.producto.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-400 hover:text-red-600 bg-stone-100/80 hover:bg-red-50 border border-stone-200/60 hover:border-red-200 transition-all duration-200 active:scale-90 group shadow-2xs"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4 text-stone-500 group-hover:text-red-600 transition-transform group-hover:scale-110" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-stone-400 text-center">
                  <ShoppingBag className="w-12 h-12 mb-2 stroke-1" />
                  <p className="text-xs font-medium">Tu canasta está vacía.</p>
                </div>
              )}
            </div>

            {/* Footer con subtotal e IGV 18% */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-stone-200 bg-stone-50 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal sin IGV:</span>
                    <span>S/. {(totalMercaderia / 1.18).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>IGV (18%):</span>
                    <span>S/. {(totalMercaderia - (totalMercaderia / 1.18)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-900 font-extrabold text-sm pt-1 border-t border-stone-200">
                    <span>Total Productos:</span>
                    <span className="text-red-600">S/. {totalMercaderia.toFixed(2)}</span>
                  </div>
                </div>

                {/* Asistente Inteligente de Recomendaciones IA Massi */}
                <ChatbotCartAssistant />

                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('/checkout');
                  }}
                  className="w-full py-3 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
                >
                  <span>Continuar con el Delivery</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Inicio de Sesión / Registro */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p className="font-bold text-white">Tiendas Mass © 2026 – Sistema de Gestión Comercial y Control PEPS</p>
          <p className="text-[11px] text-stone-500">
            Diseñado para optimización de inventarios, consumo responsable y entregas georreferenciadas bajo estándares NIC 2.
          </p>
        </div>
      </footer>

      {/* Widget de Accesibilidad Web (WCAG 2.1 AA) */}
      <AccessibilityPanel />
    </div>
  );
};
