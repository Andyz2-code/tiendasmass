import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/Modal';
import { Lock, Mail, User, Phone, AlertCircle } from 'lucide-react';

export const LoginModal = ({ isOpen, onClose, defaultTab = 'login' }) => {
  const [tab, setTab] = useState(defaultTab === 'register' ? 'register' : 'login');
  const { loginClient, registerClient, loading } = useAuth();
  const [error, setError] = useState('');

  // Estados de formularios
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regData, setRegData] = useState({
    tipo_documento: 'DNI',
    numero_documento: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    password: ''
  });

  const handleClientLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await loginClient(loginEmail, loginPass);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // Validación estricta previa en frontend
    if (regData.tipo_documento === 'DNI' && !/^\d{8}$/.test(regData.numero_documento)) {
      setError('El DNI debe contener exactamente 8 dígitos numéricos.');
      return;
    }
    if (regData.tipo_documento === 'PASAPORTE' && !/^[A-Za-z0-9]{6,12}$/.test(regData.numero_documento)) {
      setError('El Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos.');
      return;
    }

    try {
      await registerClient(regData);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Acceso a Tiendas Mass" maxWidth="max-w-md">
      {/* Selector de Tabs */}
      <div className="flex border-b border-stone-200 mb-5">
        <button
          onClick={() => { setTab('login'); setError(''); }}
          className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition ${
            tab === 'login' ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          Iniciar Sesión
        </button>
        <button
          onClick={() => { setTab('register'); setError(''); }}
          className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition ${
            tab === 'register' ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          Crear Cuenta
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab: Login Cliente */}
      {tab === 'login' && (
        <form onSubmit={handleClientLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Correo Electrónico:</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="juan.perez@gmail.com"
                className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Contraseña:</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Entrar a Comprar'}
          </button>
          <div className="text-[11px] text-center text-stone-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
            Contraseña para todos: <strong className="text-mass-red font-mono">123456</strong> (o <strong>123</strong>)
            <div className="text-[10px] text-stone-500 mt-0.5">Cliente: <span className="font-semibold text-stone-800">juan.perez@gmail.com</span></div>
          </div>
        </form>
      )}

      {/* Tab: Registro Cliente con Regla de Documento Estricta */}
      {tab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Tipo Doc.:</label>
              <select
                value={regData.tipo_documento}
                onChange={(e) => setRegData({ ...regData, tipo_documento: e.target.value })}
                className="w-full px-2 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none font-bold"
              >
                <option value="DNI">DNI</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">
                {regData.tipo_documento === 'DNI' ? 'N° DNI (8 dígitos):' : 'N° Pasaporte (6-12 car.):'}
              </label>
              <input
                type="text"
                required
                maxLength={regData.tipo_documento === 'DNI' ? 8 : 12}
                value={regData.numero_documento}
                onChange={(e) => setRegData({ ...regData, numero_documento: e.target.value.trim() })}
                placeholder={regData.tipo_documento === 'DNI' ? '72458912' : 'P9842145'}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Nombres:</label>
              <input
                type="text"
                required
                value={regData.nombres}
                onChange={(e) => setRegData({ ...regData, nombres: e.target.value })}
                placeholder="Juan"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Apellidos:</label>
              <input
                type="text"
                required
                value={regData.apellidos}
                onChange={(e) => setRegData({ ...regData, apellidos: e.target.value })}
                placeholder="Pérez"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Correo Electrónico:</label>
            <input
              type="email"
              required
              value={regData.email}
              onChange={(e) => setRegData({ ...regData, email: e.target.value })}
              placeholder="juan.perez@ejemplo.pe"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Teléfono:</label>
              <input
                type="tel"
                required
                value={regData.telefono}
                onChange={(e) => setRegData({ ...regData, telefono: e.target.value })}
                placeholder="987654321"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Contraseña:</label>
              <input
                type="password"
                required
                value={regData.password}
                onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition disabled:opacity-50 mt-2"
          >
            {loading ? 'Creando Cuenta...' : 'Registrarme e Ingresar'}
          </button>
        </form>
      )}
    </Modal>
  );
};
