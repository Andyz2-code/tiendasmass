import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { AccessibilityPanel } from '../components/AccessibilityPanel';
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
  ExternalLink
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
    { to: '/admin/productos', icon: Package, label: 'Catálogo & Edición de Productos', badge: 'Nuevo' },
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard ABC & POR' },
    { to: '/admin/banners', icon: Image, label: 'Banners & Promociones' },
    { to: '/admin/inventario', icon: Boxes, label: 'Inventario & Kardex' },
    { to: '/admin/almacen', icon: PackageCheck, label: 'Almacén & Picking (PEPS)' },
    { to: '/admin/conteos', icon: ClipboardList, label: 'Conteos Cíclicos ABC' },
    { to: '/admin/delivery', icon: Truck, label: 'Tracking & Deliveries' },
    { to: '/admin/reportes', icon: BarChart3, label: 'Mermas & Reportes NIC 2' }
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

      {/* Header Móvil */}
      <div className="md:hidden bg-stone-900 text-white p-4 flex items-center justify-between border-b border-stone-800">
        <div className="flex items-center gap-2">
          <div className="bg-mass-yellow p-1 rounded-lg border border-amber-300 flex items-center justify-center shrink-0">
            <img
              src="/tiendasmass/frontend/assets/logo-mass-isotipo.png"
              alt="Tiendas Mass"
              className="h-6 w-auto object-contain select-none"
              onError={(e) => { e.target.src = '/tiendasmass/frontend/assets/logo-mass.png'; }}
            />
          </div>
          <span className="font-extrabold text-sm">TIENDAS MASS</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-stone-800 text-stone-300"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Contenido Principal */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Panel Flotante de Accesibilidad */}
      <AccessibilityPanel />
    </div>
  );
};
