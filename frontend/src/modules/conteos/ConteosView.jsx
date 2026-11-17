import React, { useState, useEffect } from 'react';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Modal } from '../../components/Modal';
import {
  ClipboardList,
  PlusCircle,
  Calendar,
  Clock,
  User,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileCheck2,
  Phone,
  MessageSquare
} from 'lucide-react';

export const ConteosView = () => {
  const { selectedBranch } = useBranch();
  const { user, isAdmin } = useAuth();
  const [conteos, setConteos] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [selectedConteo, setSelectedConteo] = useState(null);
  const [isNewCountOpen, setIsNewCountOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busquedaTrabajador, setBusquedaTrabajador] = useState('');

  // Formulario nuevo conteo (Prompt 1)
  const [formData, setFormData] = useState({
    sucursal_id: selectedBranch?.id || 1,
    encargado_id: '',
    trabajadores_apoyo: [],
    fecha_programada: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    hora_programada: '08:30',
    estrato_abc: 'A',
    observaciones: 'Auditoría periódica de inventario y rotación PEPS'
  });

  const [physicalCounts, setPhysicalCounts] = useState({});

  const fetchConteos = async () => {
    if (!selectedBranch?.id) return;
    setLoading(true);
    try {
      const q = (!isAdmin && user?.sucursal_id) ? `?sucursal_id=${user.sucursal_id}` : `?sucursal_id=${selectedBranch.id}`;
      const res = await api.get(`/conteos${q}`);
      setConteos(res.data || []);
    } catch (err) {
      console.error('Error al cargar conteos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrabajadores = async (sucId) => {
    try {
      const res = await api.get(`/conteos/trabajadores?sucursal_id=${sucId}`);
      const list = res.data || [];
      setTrabajadores(list);
      if (list.length > 0 && !formData.encargado_id) {
        setFormData(prev => ({ ...prev, encargado_id: list[0].id }));
      }
    } catch (err) {
      console.error('Error al cargar trabajadores:', err);
    }
  };

  useEffect(() => {
    fetchConteos();
  }, [selectedBranch, user]);

  useEffect(() => {
    const targetSuc = formData.sucursal_id || selectedBranch?.id || 1;
    fetchTrabajadores(targetSuc);
  }, [formData.sucursal_id, selectedBranch]);

  const handleOpenProgramar = () => {
    setErrorMsg('');
    setSuccessMsg('');
    const defSuc = (!isAdmin && user?.sucursal_id) ? user.sucursal_id : (selectedBranch?.id || 1);
    setFormData({
      sucursal_id: defSuc,
      encargado_id: trabajadores[0]?.id || '',
      trabajadores_apoyo: [],
      fecha_programada: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      hora_programada: '08:30',
      estrato_abc: 'A',
      observaciones: 'Auditoría de inventario con control de lotes y vencimientos'
    });
    setBusquedaTrabajador('');
    setIsNewCountOpen(true);
  };

  const handleToggleApoyo = (id) => {
    setFormData(prev => {
      const current = prev.trabajadores_apoyo || [];
      return {
        ...prev,
        trabajadores_apoyo: current.includes(id) ? current.filter(x => x !== id) : [...current, id]
      };
    });
  };

  const handleCreateConteo = async (e) => {
    e.preventDefault();
    if (!formData.encargado_id) {
      setErrorMsg('Debe designar un encargado responsable para el conteo.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      await api.post('/conteos', formData);
      setSuccessMsg('✓ Conteo programado exitosamente. Asignaciones listas para integración WhatsApp.');
      setIsNewCountOpen(false);
      fetchConteos();
    } catch (err) {
      setErrorMsg(err.message || 'Error al programar conteo');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDetail = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/conteos/${id}`);
      const data = res.data;
      setSelectedConteo(data);
      const initialMap = {};
      data.detalles?.forEach((d) => {
        initialMap[d.producto_id] = d.stock_fisico !== null ? d.stock_fisico : '';
      });
      setPhysicalCounts(initialMap);
      setIsDetailOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCounts = async () => {
    if (!selectedConteo) return;
    setSaving(true);
    try {
      const items = Object.entries(physicalCounts).map(([prodId, val]) => ({
        producto_id: parseInt(prodId),
        stock_fisico: val === '' ? null : parseInt(val),
        justificacion: 'Toma física en almacén'
      }));
      await api.post(`/conteos/${selectedConteo.id}/guardar`, { items });
      setSuccessMsg('Tomas físicas guardadas correctamente.');
      handleOpenDetail(selectedConteo.id);
      fetchConteos();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedConteo) return;
    if (!window.confirm('¿Confirmar conciliación? Se ajustará el inventario en el Kardex.')) return;
    setSaving(true);
    try {
      await api.post(`/conteos/${selectedConteo.id}/conciliar`, {});
      setSuccessMsg('Conciliación completada exitosamente.');
      handleOpenDetail(selectedConteo.id);
      fetchConteos();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const trabajadoresFiltrados = trabajadores.filter(t => {
    const q = busquedaTrabajador.toLowerCase();
    return `${t.nombres} ${t.apellidos} ${t.rol_nombre}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 rounded-xl text-lg">📋</span>
            <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">Programación y Asignación de Conteos Físicos</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Programe auditorías de inventario, asigne encargados principales y trabajadores de apoyo con fecha y hora.
          </p>
        </div>
        <button
          onClick={handleOpenProgramar}
          className="px-4 py-2.5 bg-mass-yellow hover:bg-amber-400 font-extrabold text-stone-950 rounded-xl text-xs shadow-xs border border-amber-300 flex items-center gap-1.5 transition active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Programar Conteo</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold">
          {successMsg}
        </div>
      )}

      {/* Tabla de Conteos */}
      <div className="bg-white rounded-3xl border shadow-xs overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-extrabold border-b">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Sucursal</th>
                <th className="p-3">Fecha & Hora</th>
                <th className="p-3">Encargado Responsable</th>
                <th className="p-3">Personal de Apoyo</th>
                <th className="p-3">Muestra ABC</th>
                <th className="p-3">Avance</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium text-stone-800">
              {conteos.map((c) => {
                const apoyos = (c.asignaciones || []).filter(a => a.tipo_asignacion === 'APOYO');
                return (
                  <tr key={c.id} className="hover:bg-stone-50/80 transition">
                    <td className="p-3 font-mono font-black text-mass-red">{c.codigo_conteo}</td>
                    <td className="p-3 font-bold">{c.sucursal_nombre}</td>
                    <td className="p-3">
                      <div>📅 {c.fecha_programada}</div>
                      <div className="text-[10px] text-stone-500">⏰ {c.hora_programada ? c.hora_programada.substring(0, 5) : '08:00'} hrs</div>
                    </td>
                    <td className="p-3">
                      <div className="font-extrabold text-stone-900">
                        ⭐ {c.encargado_nombres ? `${c.encargado_nombres} ${c.encargado_apellidos}` : 'Sin asignar'}
                      </div>
                      {c.encargado_telefono && <div className="text-[10px] text-stone-500">📱 {c.encargado_telefono}</div>}
                    </td>
                    <td className="p-3">
                      {apoyos.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {apoyos.map(a => (
                            <span key={a.usuario_id} className="px-2 py-0.5 bg-stone-100 rounded text-[10px] font-bold border">
                              👤 {a.nombres}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-stone-400 italic text-[10px]">Solo encargado</span>}
                    </td>
                    <td className="p-3 font-black text-amber-700">Clase {c.estrato_abc}</td>
                    <td className="p-3">
                      <span className="font-bold">{c.items_contados || 0}</span> / {c.total_items}
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-stone-100 border">
                        {c.estado}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleOpenDetail(c.id)}
                        className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[10px] font-bold"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Programar Conteo */}
      {isNewCountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-xs shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b">
              <h2 className="text-base font-extrabold text-stone-900">Programar Conteo de Inventario</h2>
              <button onClick={() => setIsNewCountOpen(false)} className="text-stone-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateConteo} className="space-y-4">
              <div>
                <label className="font-bold block mb-1">1. Sucursal *</label>
                <div className="p-2.5 bg-amber-50 rounded-xl font-bold border border-amber-200">
                  {selectedBranch?.nombre || 'Sede asignada'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">2. Fecha de Inicio *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_programada}
                    onChange={e => setFormData({ ...formData, fecha_programada: e.target.value })}
                    className="w-full p-2 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Hora de Inicio *</label>
                  <input
                    type="time"
                    required
                    value={formData.hora_programada}
                    onChange={e => setFormData({ ...formData, hora_programada: e.target.value })}
                    className="w-full p-2 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">3. Estratificación ABC *</label>
                <select
                  value={formData.estrato_abc}
                  onChange={e => setFormData({ ...formData, estrato_abc: e.target.value })}
                  className="w-full p-2.5 border rounded-xl bg-white font-bold"
                >
                  <option value="A">Clase A (Alta Inversión - 80% Capital)</option>
                  <option value="B">Clase B (Inversión Moderada - 15% Capital)</option>
                  <option value="C">Clase C (Baja Inversión - 5% Capital)</option>
                  <option value="TODOS">Catálogo Completo</option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">4. Encargado Responsable *</label>
                <select
                  value={formData.encargado_id}
                  onChange={e => setFormData({ ...formData, encargado_id: parseInt(e.target.value) })}
                  className="w-full p-2.5 border rounded-xl bg-white font-extrabold"
                  required
                >
                  <option value="">-- Seleccione al Encargado --</option>
                  {trabajadores.map(t => (
                    <option key={t.id} value={t.id}>
                      ⭐ {t.nombres} {t.apellidos} ({t.rol_nombre}) - 📱 {t.telefono}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">5. Personal de Apoyo</label>
                <input
                  type="text"
                  placeholder="Buscar trabajador..."
                  value={busquedaTrabajador}
                  onChange={e => setBusquedaTrabajador(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs mb-2"
                />
                <div className="max-h-32 overflow-y-auto border rounded-xl divide-y p-1">
                  {trabajadoresFiltrados.map(t => {
                    const isEnc = parseInt(formData.encargado_id) === t.id;
                    const isApoyo = formData.trabajadores_apoyo.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => !isEnc && handleToggleApoyo(t.id)}
                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer ${
                          isEnc ? 'bg-amber-100 opacity-75' : isApoyo ? 'bg-blue-100 font-bold' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div>{t.nombres} {t.apellidos} ({t.rol_nombre})</div>
                        {isEnc && <span className="text-[9px] font-black bg-amber-400 px-1.5 rounded">ENCARGADO</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-950">
                📱 <strong>Preparación Chatbot WhatsApp:</strong> Las asignaciones se guardan con estado <code className="font-bold">PENDIENTE_INTEGRACION</code> para su notificación automática posterior.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setIsNewCountOpen(false)} className="px-4 py-2 border rounded-xl font-bold">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-mass-yellow text-stone-950 font-extrabold rounded-xl">
                  {saving ? 'Guardando...' : 'Confirmar y Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle Conteo */}
      {isDetailOpen && selectedConteo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white rounded-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-xs shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <span className="font-mono font-black text-mass-red text-base">{selectedConteo.codigo_conteo}</span>
                <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-stone-900 text-amber-300">{selectedConteo.estado}</span>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-stone-400 font-bold">✕</button>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border">
              <div className="font-bold text-stone-900 mb-1">Personal Asignado:</div>
              <div className="grid grid-cols-2 gap-2">
                {(selectedConteo.asignaciones || []).map(a => (
                  <div key={a.usuario_id} className="p-1.5 bg-white border rounded text-[11px]">
                    {a.tipo_asignacion === 'ENCARGADO_PRINCIPAL' ? '⭐ Encargado: ' : '👤 Apoyo: '}
                    <strong>{a.nombres} {a.apellidos}</strong> (📱 {a.telefono})
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b uppercase text-[9px] font-bold">
                  <tr>
                    <th className="p-2">Producto</th>
                    <th className="p-2 text-center">Stock Sistema</th>
                    <th className="p-2 text-center">Toma Física</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-semibold">
                  {(selectedConteo.detalles || []).map(d => (
                    <tr key={d.producto_id}>
                      <td className="p-2 font-bold">{d.producto_nombre}</td>
                      <td className="p-2 text-center">{d.stock_sistema}</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          value={physicalCounts[d.producto_id] !== undefined ? physicalCounts[d.producto_id] : ''}
                          onChange={e => setPhysicalCounts({ ...physicalCounts, [d.producto_id]: e.target.value })}
                          disabled={selectedConteo.estado === 'FINALIZADO' || selectedConteo.estado === 'CONCILIADO'}
                          className="w-16 p-1 border rounded text-center font-bold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setIsDetailOpen(false)} className="px-4 py-2 border rounded-xl font-bold">Cerrar</button>
              {selectedConteo.estado !== 'FINALIZADO' && selectedConteo.estado !== 'CONCILIADO' && (
                <>
                  <button type="button" onClick={handleSaveCounts} className="px-4 py-2 bg-stone-900 text-white font-bold rounded-xl">Guardar</button>
                  <button type="button" onClick={handleReconcile} className="px-4 py-2 bg-mass-yellow text-stone-950 font-extrabold rounded-xl">Conciliar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConteosView;
