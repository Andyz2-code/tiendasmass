import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { AccessibilityPanel } from '../components/AccessibilityPanel';
import api from '../services/api';
import {
  LayoutDashboard,
  Boxes,
  Package,
  PackageCheck,
  ClipboardList,
  Truck,
  BarChart3,
  TrendingUp,
  Image,
  LogOut,
  Building2,
  Menu,
  X,
  ExternalLink,
  Users,
  Bell,
  AlertTriangle
} from 'lucide-react';

export const AdminLayout = () => {
  const { user, token, loginUser, logout, isAdmin, isSupervisor, isClient } = useAuth();
  const { sucursales, selectedBranch, selectBranch } = useBranch();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loginEmail, setLoginEmail] = useState('admin@tiendasmass.pe');
  const [loginPass, setLoginPass] = useState('123456');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Requerimiento 3: Estado de Alertas de Stock Bajo (<= 5 unidades)
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  // 1. RESTRICCIÓN OBLIGATORIA: Si el usuario es un Cliente, denegar acceso y redirigir a la tienda
  if (user && (isClient || user.rol_nombre === 'Cliente' || user.tipo_usuario === 'cliente')) {
    return <Navigate to="/" replace />;
  }

  // Si es supervisor, bloquear automáticamente su sucursal a la asignada
  useEffect(() => {
    if (isSupervisor && user?.sucursal_id && sucursales.length > 0) {
      const myBranch = sucursales.find((s) => s.id === Number(user.sucursal_id));
      if (myBranch && selectedBranch?.id !== myBranch.id) {
        selectBranch(myBranch.id);
      }
    }
  }, [isSupervisor, user, sucursales]);

  // Consultar alertas de stock bajo (<= 5 unidades) en la sucursal
  useEffect(() => {
    if (!user || !token || !selectedBranch?.id) return;
    const fetchLowStock = () => {
      api
        .get(`/inventarios/low-stock-alerts?sucursal_id=${selectedBranch.id}`)
        .then((res) => {
          setLowStockAlerts(res.data?.alertas || []);
        })
        .catch(() => {});
    };
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 15000);
    return () => clearInterval(interval);
  }, [user, token, selectedBranch?.id]);

  // 2. Si no hay sesión o no es personal autorizado, mostrar login exclusivo interno
  if (!user || !token || (!isAdmin && !isSupervisor)) {
    const handleLoginSubmit = async (e) => {
      e.preventDefault();
      setLoginError('');
      setLoginLoading(true);
      try {
        const u = await loginUser(loginEmail, loginPass);
        if (u.rol_nombre !== 'Administrador' && u.rol_nombre !== 'Supervisor') {
          throw new Error('Acceso no autorizado: Solo personal con rol Administrador o Supervisor puede acceder.');
        }
      } catch (err) {
        setLoginError(err.message || 'Credenciales inválidas');
      } finally {
        setLoginLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-block mx-auto mb-2">
              <img
                src="/tiendasmass/frontend/assets/images/logo-mass-oficial.png"
                alt="Tiendas Mass - Precios bajos, ¡cerca de ti!"
                className="h-11 sm:h-13 w-auto max-w-[280px] object-contain select-none"
                onError={(e) => { e.target.src = '/tiendasmass/frontend/assets/logo-mass-oficial.png'; }}
              />
            </div>
            <h1 className="text-xl font-extrabold text-stone-950">Acceso Personal Mass</h1>
            <p className="text-xs text-stone-500 font-medium">Exclusivo para Administradores Corporativos y Supervisores de Almacén</p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-stone-700 mb-1">Correo Institucional:</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@tiendasmass.pe"
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Contraseña de Seguridad:</label>
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-stone-950 hover:bg-black text-amber-300 font-extrabold rounded-xl shadow-lg transition text-xs uppercase tracking-wider"
            >
              {loginLoading ? 'Validando Credenciales...' : 'Ingresar al Backoffice'}
            </button>

            <div className="pt-3 border-t text-[11px] text-stone-500 space-y-2">
              <div className="font-bold text-stone-700">Acceso Rápido de Prueba (Clave: 123456):</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setLoginEmail('admin@tiendasmass.pe'); setLoginPass('123456'); }}
                  className="p-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-left font-bold text-stone-800 truncate border"
                >
                  👑 Administrador
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginEmail('supervisor.centro@tiendasmass.pe'); setLoginPass('123456'); }}
                  className="p-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-left font-bold text-stone-800 truncate border"
                >
                  📦 Supervisor Centro
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    if (window.confirm('¿Desea cerrar la sesión del portal administrativo?')) {
      logout();
      navigate('/');
    }
  };

  const navItems = [
    { to: '/admin/reportes-generales', icon: TrendingUp, label: 'Reportes Generales', badge: 'Principal' },
    { to: '/admin/productos', icon: Package, label: 'Catálogo & Edición de Productos' },
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard ABC & POR', badge: lowStockAlerts.length > 0 ? `⚠️ ${lowStockAlerts.length}` : null },
    { to: '/admin/banners', icon: Image, label: 'Banners & Promociones' },
    { to: '/admin/inventario', icon: Boxes, label: 'Inventario & Kardex' },
    { to: '/admin/almacen', icon: PackageCheck, label: 'Almacén & Picking (PEPS)' },
    { to: '/admin/conteos', icon: ClipboardList, label: 'Conteos Cíclicos ABC' },
    { to: '/admin/delivery', icon: Truck, label: 'Tracking & Deliveries' },
    { to: '/admin/reportes', icon: BarChart3, label: 'Mermas & Desmedros NIC 2', badge: 'Bajas' },
    ...(isAdmin ? [{ to: '/admin/usuarios', icon: Users, label: 'Usuarios & Supervisores', badge: 'Admin' }] : [])
  ];

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-stone-900 text-stone-200 border-r border-stone-800 shrink-0">
        {/* Logo / Header */}
        <div className="p-4 border-b border-stone-800 flex items-center gap-3">
          <div className="flex items-center justify-center shrink-0">
            <img
              src="/tiendasmass/frontend/assets/images/logo-mass-isotipo.png"
              alt="Tiendas Mass"
              className="h-8 sm:h-9 w-auto object-contain select-none"
              onError={(e) => { e.target.src = '/tiendasmass/frontend/assets/logo-mass-isotipo.png'; }}
            />
          </div>
          <div>
            <div className="font-extrabold text-white text-base tracking-tight leading-tight">TIENDAS MASS</div>
            <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider">
              {isAdmin ? 'Backoffice Global' : 'Panel de Sucursal'}
            </div>
          </div>
        </div>

        {/* Selector de Sucursal */}
        <div className="p-4 border-b border-stone-800 bg-stone-950/40">
          <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1.5 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-amber-400" /> Sucursal Operativa
          </label>
          {isAdmin ? (
            <select
              value={selectedBranch?.id || ''}
              onChange={(e) => selectBranch(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({s.codigo_tienda})
                </option>
              ))}
            </select>
          ) : (
            <div className="px-2.5 py-1.5 bg-stone-800 rounded-lg text-xs font-bold text-amber-300 border border-stone-700 flex items-center justify-between">
              <span>{user?.sucursal_nombre || selectedBranch?.nombre || 'Sucursal Asignada'}</span>
              <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-black">EXCLUSIVO</span>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scroll">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-mass-yellow text-stone-950 shadow-sm font-black'
                      : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Ver Tienda Online */}
        <div className="p-3 border-t border-stone-800">
          <NavLink
            to="/"
            target="_blank"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver Tienda Online</span>
          </NavLink>
        </div>

        {/* Footer del usuario & Cerrar Sesión Funcional */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 border border-amber-400/40 flex items-center justify-center font-black text-xs shrink-0">
              {user?.nombres?.charAt(0) || (isAdmin ? 'A' : 'S')}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-white truncate">{user?.nombres || 'Usuario'} {user?.apellidos}</div>
              <div className="text-[10px] text-amber-400 font-semibold">{user?.rol_nombre || (isAdmin ? 'Administrador' : 'Supervisor')}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Cerrar sesión de personal"
            className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Área de Trabajo y Topbar con Alerta de Stock Bajo <= 5 unidades */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-6 z-20">
          <div className="font-bold text-stone-800 text-xs sm:text-sm flex items-center gap-2">
            <span>🏢 {selectedBranch?.nombre || 'Huancayo'}</span>
            <span className="text-stone-300">•</span>
            <span className="text-stone-500">{user?.rol_nombre}</span>
          </div>

          {/* Campana / Disparador de Alertas de Stock Bajo (<= 5 unidades) - Req #3 */}
          <div className="relative">
            <button
              onClick={() => setIsAlertOpen(!isAlertOpen)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition ${
                lowStockAlerts.length > 0
                  ? 'bg-red-600 text-white border-red-700 animate-pulse shadow-md'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Alertas Stock ≤ 5</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                lowStockAlerts.length > 0 ? 'bg-white text-red-700' : 'bg-stone-200 text-stone-700'
              }`}>
                {lowStockAlerts.length}
              </span>
            </button>

            {isAlertOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-stone-200 z-50 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="font-extrabold text-stone-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Disparador de Stock Bajo (≤ 5 un.)</span>
                  </span>
                  <button onClick={() => setIsAlertOpen(false)} className="font-bold text-stone-400">✕</button>
                </div>

                {lowStockAlerts.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll">
                    {lowStockAlerts.map((al) => (
                      <div key={`${al.sucursal_id}-${al.producto_id}`} className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex justify-between items-center">
                        <div>
                          <div className="font-extrabold text-red-950">{al.producto_nombre}</div>
                          <div className="text-[10px] text-red-700 font-mono">{al.codigo_sku} • {al.sucursal_nombre}</div>
                        </div>
                        <span className="px-2 py-1 bg-red-600 text-white font-black rounded-lg text-[10px] shrink-0">
                          {al.stock_actual} unid.
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-stone-400 font-medium">
                    ✓ Ningún producto tiene 5 o menos unidades en esta sucursal.
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Panel Flotante de Accesibilidad */}
      <AccessibilityPanel />
    </div>
  );
};
