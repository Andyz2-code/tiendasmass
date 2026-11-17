import React, { useState, useEffect } from 'react';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Flame,
  TrendingDown,
  Printer,
  AlertOctagon,
  RefreshCw,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Building2,
  PackageMinus
} from 'lucide-react';

export const ReportesView = () => {
  const { selectedBranch, sucursales } = useBranch();
  const { user, isAdmin } = useAuth();

  const [mermasData, setMermasData] = useState({ total_perdida_soles: 0, total_unidades_baja: 0, total_incidentes: 0, detalles: [] });
  const [inventarioSucursal, setInventarioSucursal] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de Registro de Desmedro / Merma (Requerimiento 4)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  const [mermaForm, setMermaForm] = useState({
    sucursal_id: selectedBranch?.id || 1,
    producto_id: '',
    cantidad: 1,
    motivo: 'VENCIMIENTO_CADUCIDAD',
    observaciones: ''
  });

  const motivosDesmedro = [
    { value: 'VENCIMIENTO_CADUCIDAD', label: 'Caducidad / Fecha de Vencimiento Cumplida (NIC 2)' },
    { value: 'DANO_FISICO_ROTURA', label: 'Rotura de Envase / Daño Físico en Manipulación' },
    { value: 'DETERIORO_ALMACEN', label: 'Deterioro o Humedad en Almacén' },
    { value: 'FALLA_CADENA_FRIO', label: 'Falla en Cadena de Frío / Refrigeración' },
    { value: 'ROBO_EXTRAVIO', label: 'Pérdida / Robo / Faltante Detectado' },
    { value: 'OTRO', label: 'Otro Motivo Operativo Justificado' }
  ];

  const fetchReportsAndInventory = async (branchId) => {
    const targetBranch = branchId || selectedBranch?.id || 1;
    setLoading(true);
    try {
      const [mermasRes, invRes] = await Promise.all([
        api.get(`/reportes/mermas?sucursal_id=${targetBranch}`),
        api.get(`/inventarios?sucursal_id=${targetBranch}`)
      ]);
      const rawMermas = mermasRes.data || {};
      if (Array.isArray(rawMermas)) {
        const totalSoles = rawMermas.reduce((acc, r) => acc + parseFloat(r.perdida_estimada_soles || 0), 0);
        setMermasData({ total_perdida_soles: totalSoles, detalles: rawMermas });
      } else {
        setMermasData(rawMermas);
      }
      setInventarioSucursal(invRes.data || []);
    } catch (err) {
      console.error('Error al cargar mermas e inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBranch?.id) {
      setMermaForm((prev) => ({ ...prev, sucursal_id: selectedBranch.id }));
      fetchReportsAndInventory(selectedBranch.id);
    }
  }, [selectedBranch]);

  const handleBranchChangeInModal = async (newBranchId) => {
    const bId = Number(newBranchId);
    setMermaForm((prev) => ({ ...prev, sucursal_id: bId, producto_id: '' }));
    try {
      const invRes = await api.get(`/inventarios?sucursal_id=${bId}`);
      const list = invRes.data || [];
      setInventarioSucursal(list);
      if (list.length > 0) {
        setMermaForm((prev) => ({ ...prev, sucursal_id: bId, producto_id: list[0].producto_id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectedProductInfo = inventarioSucursal.find(
    (i) => Number(i.producto_id) === Number(mermaForm.producto_id)
  );

  const handleOpenModal = () => {
    setErrorMsg('');
    const firstProd = inventarioSucursal[0]?.producto_id || '';
    setMermaForm({
      sucursal_id: selectedBranch?.id || user?.sucursal_id || 1,
      producto_id: firstProd,
      cantidad: 1,
      motivo: 'VENCIMIENTO_CADUCIDAD',
      observaciones: ''
    });
    setIsModalOpen(true);
  };

  const handleRegisterMerma = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!mermaForm.producto_id) {
      setErrorMsg('Seleccione el producto a dar de baja.');
      return;
    }

    const cant = Number(mermaForm.cantidad);
    if (cant <= 0) {
      setErrorMsg('La cantidad a dar de baja debe ser mayor a 0.');
      return;
    }

    if (selectedProductInfo && cant > Number(selectedProductInfo.stock_actual)) {
      setErrorMsg(`La cantidad (${cant}) supera el stock actual disponible en la sucursal (${selectedProductInfo.stock_actual} unidades).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/inventarios/mermas', {
        sucursal_id: Number(mermaForm.sucursal_id),
        producto_id: Number(mermaForm.producto_id),
        cantidad: cant,
        motivo: mermaForm.motivo,
        observaciones: mermaForm.observaciones
      });

      setIsModalOpen(false);
      setFeedbackBanner({
        mensaje: res.message || 'Desmedro registrado y stock actualizado.',
        data: res.data
      });
      fetchReportsAndInventory(Number(mermaForm.sucursal_id));
    } catch (err) {
      setErrorMsg(err.message || 'Error al registrar el desmedro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <PackageMinus className="w-6 h-6 text-mass-red" />
            <span>Módulo de Desmedro, Merma y Bajas de Inventario (NIC 2)</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Sucursal: <span className="font-bold text-stone-800">{selectedBranch?.nombre}</span> – Registro de pérdidas con descuento automático de stock y auditoría de usuario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-mass-red hover:bg-red-700 text-white text-xs font-extrabold shadow-md transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Registrar Desmedro / Merma</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Reporte</span>
          </button>
          <button
            onClick={() => fetchReportsAndInventory(selectedBranch?.id)}
            className="p-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notificación de confirmación y disparo de alerta de stock bajo <= 5 */}
      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-emerald-950">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{feedbackBanner.mensaje}</span>
            </div>
            <button onClick={() => setFeedbackBanner(null)} className="text-stone-400 hover:text-stone-700 font-bold">✕</button>
          </div>
          {feedbackBanner.data && (
            <div className="flex flex-wrap gap-4 text-[11px] text-emerald-900 pl-7">
              <span>Producto: <strong>{feedbackBanner.data.producto_nombre}</strong></span>
              <span>Baja: <strong>-{feedbackBanner.data.cantidad_baja} un.</strong></span>
              <span>Stock Anterior: <strong>{feedbackBanner.data.stock_anterior}</strong> → Stock Final: <strong>{feedbackBanner.data.stock_final} un.</strong></span>
              <span>Responsable: <strong>{feedbackBanner.data.usuario_nombre}</strong></span>
            </div>
          )}
          {feedbackBanner.data?.alerta_stock_bajo?.disparada && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-900 font-extrabold flex items-center gap-2 mt-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 animate-bounce" />
              <span>{feedbackBanner.data.alerta_stock_bajo.mensaje}</span>
            </div>
          )}
        </div>
      )}

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 p-5 rounded-2xl border border-red-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider">
              Pérdida Valorada por Desmedros (NIC 2)
            </span>
            <div className="text-2xl font-extrabold text-red-900 mt-1">
              S/. {parseFloat(mermasData.total_perdida_soles || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-red-700 font-medium mt-0.5 block">
              Mermas y bajas contabilizadas en Kardex
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-200 text-red-800 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">
              Incidentes Registrados
            </span>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">
              {mermasData.detalles?.length || 0}
            </div>
            <span className="text-[10px] text-stone-500 font-medium mt-0.5 block">
              Con auditoría de usuario y motivo
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <AlertOctagon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">
              Usuario Auditor en Sesión
            </span>
            <div className="text-sm font-extrabold text-amber-950 mt-1">
              {user?.nombres} {user?.apellidos}
            </div>
            <span className="text-[10px] text-amber-800 font-bold mt-0.5 block">
              Rol: {user?.rol_nombre} • Sede: {selectedBranch?.nombre}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-200 text-amber-900 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabla Detallada de Mermas y Desmedros */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-stone-50 border-b border-stone-200 font-bold text-xs text-stone-700 flex justify-between items-center">
          <span>Historial de Bajas por Merma / Desmedro ({mermasData.detalles?.length || 0})</span>
          <span className="text-[11px] text-stone-500 font-mono">Actualización inmediata en Kardex y Stock</span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">Fecha / Doc.</th>
                <th className="py-3 px-4">Sucursal</th>
                <th className="py-3 px-4">Producto Afectado</th>
                <th className="py-3 px-4 text-center">Cant. Baja</th>
                <th className="py-3 px-4 text-center">Stock Ant. → Final</th>
                <th className="py-3 px-4 text-right">Pérdida (S/.)</th>
                <th className="py-3 px-4">Motivo del Desmedro</th>
                <th className="py-3 px-4">Usuario que Registró</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-medium">
              {mermasData.detalles?.map((m, idx) => (
                <tr key={idx} className="hover:bg-red-50/30">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-stone-900 text-[11px]">{m.documento_referencia}</div>
                    <div className="text-[10px] text-stone-400">{m.created_at}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-stone-700 text-[11px]">
                    {m.sucursal_nombre || selectedBranch?.nombre}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-stone-900">{m.producto_nombre}</div>
                    <div className="text-[10px] text-stone-400 font-mono">{m.codigo_sku}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-extrabold text-red-600">
                    -{m.cantidad} un.
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-[11px]">
                    <span className="text-stone-500">{m.saldo_anterior}</span>
                    <span className="mx-1 text-stone-400">→</span>
                    <span className={`font-black px-1.5 py-0.5 rounded ${Number(m.saldo_nuevo) <= 5 ? 'bg-red-100 text-red-800' : 'bg-stone-100 text-stone-900'}`}>
                      {m.saldo_nuevo} un.
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-red-600">
                    S/. {parseFloat(m.perdida_estimada_soles || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-stone-700 text-[11px] max-w-xs">
                    {m.observaciones}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-stone-900 text-[11px]">{m.usuario_nombre || `${user?.nombres} ${user?.apellidos}`}</div>
                    <div className="text-[10px] text-amber-700 font-semibold">{m.usuario_rol || user?.rol_nombre}</div>
                  </td>
                </tr>
              ))}

              {(!mermasData.detalles || mermasData.detalles.length === 0) && (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-stone-400 font-bold">
                    No se han registrado mermas ni desmedros en esta sucursal. Use el botón "+ Registrar Desmedro / Merma" para dar de baja unidades dañadas o vencidas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Registrar Merma / Desmedro (Requerimiento 4) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-100 text-mass-red">
                  <PackageMinus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-stone-900">Registrar Desmedro o Merma de Producto</h2>
                  <p className="text-[11px] text-stone-500">Descuento directo del stock físico y asiento contable en Kardex</p>
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

            <form onSubmit={handleRegisterMerma} className="space-y-4">
              {/* 1. Usuario Responsable (Automático) */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-stone-400 block">Usuario que realiza la acción:</span>
                  <span className="font-extrabold text-stone-900">{user?.nombres} {user?.apellidos}</span>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg font-black text-[10px]">
                  {user?.rol_nombre}
                </span>
              </div>

              {/* 2. Selección de Sucursal */}
              <div>
                <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-mass-red" /> Sucursal Afectada *
                </label>
                {isAdmin ? (
                  <select
                    required
                    value={mermaForm.sucursal_id}
                    onChange={(e) => handleBranchChangeInModal(e.target.value)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-bold text-stone-900 bg-white"
                  >
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre} ({s.codigo_tienda})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={selectedBranch?.nombre || user?.sucursal_nombre || 'Sucursal Asignada'}
                    className="w-full p-2.5 border border-stone-200 rounded-xl font-bold text-stone-700 bg-stone-100"
                  />
                )}
              </div>

              {/* 3. Selección de Producto */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Producto a Dar de Baja *</label>
                <select
                  required
                  value={mermaForm.producto_id}
                  onChange={(e) => setMermaForm({ ...mermaForm, producto_id: e.target.value })}
                  className="w-full p-2.5 border border-stone-300 rounded-xl font-bold text-stone-900 bg-white"
                >
                  <option value="">-- Seleccione un producto --</option>
                  {inventarioSucursal.map((item) => (
                    <option key={item.producto_id} value={item.producto_id} disabled={Number(item.stock_actual) <= 0}>
                      {item.producto_nombre} ({item.codigo_sku}) — Stock actual: {item.stock_actual} un.
                    </option>
                  ))}
                </select>
              </div>

              {/* Resumen de impacto en Stock */}
              {selectedProductInfo && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
                  <div>
                    <div className="text-[10px] text-stone-500 font-bold">Stock Actual</div>
                    <div className="text-sm font-black text-stone-900">{selectedProductInfo.stock_actual} un.</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-red-600 font-bold">Cantidad de Baja</div>
                    <div className="text-sm font-black text-red-600">-{mermaForm.cantidad || 0} un.</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-stone-500 font-bold">Stock Final</div>
                    <div className={`text-sm font-black ${(Number(selectedProductInfo.stock_actual) - Number(mermaForm.cantidad || 0)) <= 5 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {Math.max(0, Number(selectedProductInfo.stock_actual) - Number(mermaForm.cantidad || 0))} un.
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Cantidad y Motivo del Desmedro */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Cantidad de Baja *</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProductInfo?.stock_actual || 999}
                    required
                    value={mermaForm.cantidad}
                    onChange={(e) => setMermaForm({ ...mermaForm, cantidad: e.target.value })}
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-extrabold text-stone-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-stone-700 mb-1">Motivo del Desmedro *</label>
                  <select
                    required
                    value={mermaForm.motivo}
                    onChange={(e) => setMermaForm({ ...mermaForm, motivo: e.target.value })}
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-bold text-stone-900 bg-white"
                  >
                    {motivosDesmedro.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Detalle / Justificación */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Observaciones / Detalle de la Inspección</label>
                <textarea
                  rows="2"
                  value={mermaForm.observaciones}
                  onChange={(e) => setMermaForm({ ...mermaForm, observaciones: e.target.value })}
                  placeholder="Ej: Envase abollado detectado en pasaje A1 o producto vencido retirado de góndola..."
                  className="w-full p-2.5 border border-stone-300 rounded-xl font-medium"
                />
              </div>

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
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-mass-red hover:bg-red-700 text-white font-extrabold shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Procesando Baja...' : 'Confirmar Baja y Actualizar Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReportesView;
