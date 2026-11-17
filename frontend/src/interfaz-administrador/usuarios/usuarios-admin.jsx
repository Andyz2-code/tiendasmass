/**
 * TIENDAS MASS - Gestión de Usuarios y Roles (Administrador y Supervisor)
 * Requerimiento 5: El usuario con rol "Administrador" puede registrar nuevos usuarios con rol "Supervisor"
 * asignándole obligatoriamente a qué "Sucursal" pertenecerá y administrará.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import {
  Users,
  UserPlus,
  Building2,
  ShieldCheck,
  Mail,
  Phone,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power
} from 'lucide-react';

export const UsuariosAdminView = () => {
  const { user, isAdmin } = useAuth();
  const { sucursales } = useBranch();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    rol_id: 2, // Por defecto 2 = Supervisor
    sucursal_id: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    password: ''
  });

  const loadUsuarios = async () => {
    setLoading(true);
    try {
      const res = await api.get('/usuarios');
      setUsuarios(res.data || []);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsuarios();
  }, []);

  const handleOpenModal = () => {
    setErrorMsg('');
    setFormData({
      rol_id: 2,
      sucursal_id: sucursales?.[0]?.id || '',
      nombres: '',
      apellidos: '',
      email: '',
      telefono: '',
      password: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validación estricta de negocio (Requerimiento 5):
    // Si el rol es Supervisor (rol_id == 2), la Sucursal es obligatoria
    if (Number(formData.rol_id) === 2 && !formData.sucursal_id) {
      setErrorMsg('Es obligatorio seleccionar la Sucursal que pertenecerá y administrará el Supervisor.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        rol_id: Number(formData.rol_id),
        sucursal_id: Number(formData.rol_id) === 2 ? Number(formData.sucursal_id) : null
      };
      const res = await api.post('/usuarios', payload);
      setIsModalOpen(false);
      setSuccessMsg(res.message || 'Supervisor registrado exitosamente con su sucursal asignada.');
      setTimeout(() => setSuccessMsg(''), 5000);
      void loadUsuarios();
    } catch (err) {
      setErrorMsg(err.message || 'Error al registrar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEstado = async (u) => {
    if (u.id === 1) return;
    try {
      await api.patch(`/usuarios/${u.id}/toggle`);
      void loadUsuarios();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isAdmin && user?.rol_nombre !== 'Administrador') {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="text-sm font-black text-red-900">Acceso Exclusivo para Administradores</h3>
        <p className="text-xs text-red-700">Solo el rol de Administrador puede registrar nuevos Supervisores y asignarles sucursal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-mass-red" />
            <span>Gestión de Usuarios y Asignación de Supervisores</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Registre nuevos usuarios con el rol de <strong>Supervisor</strong> y asígneles obligatoriamente la <strong>Sucursal</strong> que administrarán.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadUsuarios}
            className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 transition"
            title="Actualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl text-xs shadow-md transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Registrar Nuevo Supervisor</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center text-xs font-bold text-stone-700">
          <span>Personal Registrado ({usuarios.length})</span>
          <span className="text-stone-500 font-normal">Control de Acceso Basado en Roles (RBAC)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200 text-stone-600 font-extrabold uppercase text-[10px]">
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Nombre Completo</th>
                <th className="py-3.5 px-4">Correo Institucional</th>
                <th className="py-3.5 px-4">Teléfono</th>
                <th className="py-3.5 px-4">Rol en el Sistema</th>
                <th className="py-3.5 px-4">Sucursal Asignada / Administrada</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-stone-400 font-bold">Cargando usuarios...</td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-stone-400 font-bold">No hay usuarios registrados.</td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-3 px-4 font-mono text-stone-400">#{u.id}</td>
                    <td className="py-3 px-4 font-bold text-stone-900">
                      {u.nombres} {u.apellidos}
                    </td>
                    <td className="py-3 px-4 text-stone-600 font-mono text-[11px]">{u.email}</td>
                    <td className="py-3 px-4 text-stone-600">{u.telefono || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${u.rol_nombre === 'Administrador'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                        {u.rol_nombre}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.rol_nombre === 'Administrador' ? (
                        <span className="text-stone-500 font-bold text-[11px]">🌐 Todas las Sucursales (Global)</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-extrabold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                          <Building2 className="w-3.5 h-3.5 text-mass-red" />
                          <span>{u.sucursal_nombre || `Sucursal ID #${u.sucursal_id}`}</span>
                          {u.sucursal_codigo && <span className="text-[10px] font-mono text-stone-500">({u.sucursal_codigo})</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${Number(u.estado) === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                        }`}>
                        {Number(u.estado) === 1 ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.id !== 1 && (
                        <button
                          onClick={() => handleToggleEstado(u)}
                          className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition"
                          title={Number(u.estado) === 1 ? 'Desactivar usuario' : 'Activar usuario'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Registrar Nuevo Supervisor con Asignación Obligatoria de Sucursal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-900">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-stone-900">Registrar Nuevo Supervisor de Sucursal</h2>
                  <p className="text-[11px] text-stone-500">Asignación obligatoria de tienda para control aislado de inventario</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 font-bold text-stone-600"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="user_rol_id" className="block font-bold text-stone-700 mb-1">Rol del Usuario *</label>
                  <select
                    id="user_rol_id"
                    value={formData.rol_id}
                    onChange={(e) => setFormData({ ...formData, rol_id: Number(e.target.value) })}
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-extrabold text-stone-900 bg-amber-50/60 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value={2}>📦 Supervisor de Sucursal</option>
                    <option value={1}>👑 Administrador Global</option>
                  </select>
                </div>

                {Number(formData.rol_id) === 2 && (
                  <div>
                    <label htmlFor="user_sucursal_id" className="block font-extrabold text-mass-red mb-1">
                      🏢 Sucursal que Administrará (Obligatorio) *
                    </label>
                    <select
                      id="user_sucursal_id"
                      required
                      value={formData.sucursal_id}
                      onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
                      className="w-full p-2.5 border-2 border-mass-red/60 rounded-xl font-extrabold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-mass-red"
                    >
                      <option value="">-- Seleccione una Sucursal --</option>
                      {sucursales.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} ({s.codigo_tienda})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="user_nombres" className="block font-bold text-stone-700 mb-1">Nombres *</label>
                  <input
                    id="user_nombres"
                    type="text"
                    required
                    value={formData.nombres}
                    onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                    placeholder="Ej: Luis Alberto"
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="user_apellidos" className="block font-bold text-stone-700 mb-1">Apellidos *</label>
                  <input
                    id="user_apellidos"
                    type="text"
                    required
                    value={formData.apellidos}
                    onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                    placeholder="Ej: Paredes Soto"
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="user_email" className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-stone-400" /> Correo Institucional *
                  </label>
                  <input
                    id="user_email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="supervisor.sede@tiendasmass.pe"
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="user_telefono" className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-stone-400" /> Teléfono Móvil
                  </label>
                  <input
                    id="user_telefono"
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="964001122"
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="user_password" className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-stone-400" /> Contraseña de Acceso *
                </label>
                <input
                  id="user_password"
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full p-2.5 border border-stone-300 rounded-xl font-medium"
                />
              </div>

              {Number(formData.rol_id) === 2 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-950">
                  🔒 <strong>Política de Seguridad RBAC:</strong> El Supervisor registrado tendrá acceso exclusivo al inventario, recepción de lotes PEPS, registro de mermas y despacho de pedidos de la sucursal seleccionada.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 font-bold text-stone-700 hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-mass-yellow hover:bg-amber-400 text-stone-950 font-extrabold shadow-md transition disabled:opacity-50"
                >
                  {saving ? 'Registrando...' : 'Registrar y Asignar Sucursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosAdminView;
