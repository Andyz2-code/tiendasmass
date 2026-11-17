import React, { useState, useEffect } from 'react';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import { Modal } from '../../components/Modal';
import { AbcBadge } from '../../components/AlertBadge';
import {
  ClipboardList,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileCheck2,
  Calculator
} from 'lucide-react';

export const ConteosView = () => {
  const { selectedBranch } = useBranch();
  const [conteos, setConteos] = useState([]);
  const [selectedConteo, setSelectedConteo] = useState(null);
  const [isNewCountOpen, setIsNewCountOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Formulario nuevo conteo
  const [estratoAbc, setEstratoAbc] = useState('A');
  const [observaciones, setObservaciones] = useState('Auditoría física mensual de alta inversión');

  // Valores de conteo físico ingresados
  const [physicalCounts, setPhysicalCounts] = useState({});

  const fetchConteos = async () => {
    if (!selectedBranch?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/conteos?sucursal_id=${selectedBranch.id}`);
      setConteos(res.data || []);
    } catch (err) {
      console.error('Error al cargar conteos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConteos();
  }, [selectedBranch]);

  const handleOpenConteo = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/conteos/${id}`);
      const data = res.data;
      setSelectedConteo(data);

      // Precargar valores físicos si ya existen
      const initialMap = {};
      data.detalles?.forEach((d) => {
        initialMap[d.producto_id] = {
          stock_fisico: d.stock_fisico !== null ? d.stock_fisico : '',
          justificacion: d.justificacion || ''
        };
      });
      setPhysicalCounts(initialMap);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCount = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/conteos', {
        sucursal_id: selectedBranch.id,
        estrato_abc: estratoAbc,
        observaciones: observaciones
      });
      setIsNewCountOpen(false);
      setSuccessMsg('Auditoría cíclica programada y muestra de productos generada.');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchConteos();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedConteo) return;
    setSaving(true);
    try {
      const items = Object.entries(physicalCounts)
        .filter(([_, val]) => val.stock_fisico !== '')
        .map(([prodId, val]) => ({
          producto_id: parseInt(prodId),
          stock_fisico: parseInt(val.stock_fisico),
          justificacion: val.justificacion
        }));

      await api.post(`/conteos/${selectedConteo.id}/guardar`, { items });
      setSuccessMsg('Tomas físicas guardadas.');
      setTimeout(() => setSuccessMsg(''), 3000);
      handleOpenConteo(selectedConteo.id);
      fetchConteos();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReconcile = async () => {
    if (!window.confirm('¿Confirmas aplicar la conciliación? Se ajustará el inventario del sistema y se generarán los asientos contables en el Kardex.')) {
      return;
    }

    setSaving(true);
    try {
      // Primero guardar tomas físicas
      await handleSaveDraft();
      // Luego ejecutar conciliación
      await api.post(`/conteos/${selectedConteo.id}/conciliar`, {});
      setSuccessMsg('¡Conciliación completada! Kardex e inventario actualizados con éxito.');
      setTimeout(() => setSuccessMsg(''), 4000);
      handleOpenConteo(selectedConteo.id);
      fetchConteos();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Auditorías Físicas y Conteos Cíclicos por Estrato ABC
          </h1>
          <p className="text-xs text-stone-500">
            Sucursal: <span className="font-bold text-stone-800">{selectedBranch?.nombre}</span> – Control interno para eliminar falsos agotamientos y pérdidas no registradas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewCountOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-mass-yellow hover:bg-amber-400 text-stone-950 text-xs font-extrabold shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Programar Conteo Cíclico</span>
          </button>
          <button
            onClick={fetchConteos}
            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Lista de Conteos Programados */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-stone-50 border-b border-stone-200 font-bold text-xs text-stone-700 flex justify-between items-center">
          <span>Historial de Auditorías Físicas</span>
          <span className="text-stone-500 font-normal">Estratos: A (Mensual), B (Trimestral), C (Semestral)</span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Fecha Prog.</th>
                <th className="py-3 px-4">Estrato Muestreado</th>
                <th className="py-3 px-4">Supervisor</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-center">Discrepancias</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-medium">
              {conteos.map((c) => (
                <tr key={c.id} className="hover:bg-amber-50/50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-900">{c.codigo_conteo}</td>
                  <td className="py-3 px-4">{c.fecha_programada}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold">Estrato {c.estrato_abc}</span>
                  </td>
                  <td className="py-3 px-4 text-stone-700">{c.supervisor_nombres} {c.supervisor_apellidos}</td>
                  <td className="py-3 px-4 text-center font-bold">{c.items_contados || 0} / {c.total_items}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      parseInt(c.items_con_discrepancia || 0) > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {c.items_con_discrepancia || 0} dif.
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      c.estado === 'CONCILIADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenConteo(c.id)}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-black text-amber-400 font-bold rounded-lg text-xs transition"
                    >
                      {c.estado === 'CONCILIADO' ? 'Ver Resultados' : 'Realizar Conteo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Conteo Físico y Conciliación */}
      {selectedConteo && (
        <Modal
          isOpen={!!selectedConteo}
          onClose={() => setSelectedConteo(null)}
          title={`Auditoría Física: ${selectedConteo.codigo_conteo} (Estrato ${selectedConteo.estrato_abc})`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-stone-900">Estado: {selectedConteo.estado}</span>
                <p className="text-[11px] text-stone-500">
                  Ingresa las existencias físicas reales del almacén. La diferencia se calculará automáticamente.
                </p>
              </div>
              {selectedConteo.estado !== 'CONCILIADO' && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 font-bold rounded-lg text-stone-800"
                  >
                    Guardar Borrador
                  </button>
                  <button
                    onClick={handleReconcile}
                    disabled={saving}
                    className="px-3 py-1.5 bg-mass-red hover:bg-red-700 font-bold rounded-lg text-white shadow"
                  >
                    Aplicar Conciliación & Kardex
                  </button>
                </div>
              )}
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">Producto</th>
                    <th className="p-2.5">Clase ABC</th>
                    <th className="p-2.5 text-center">Stock Sistema</th>
                    <th className="p-2.5 text-center w-28">Stock Físico</th>
                    <th className="p-2.5 text-center">Diferencia</th>
                    <th className="p-2.5">Justificación de Ajuste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-medium">
                  {selectedConteo.detalles?.map((det) => {
                    const currentVal = physicalCounts[det.producto_id]?.stock_fisico ?? '';
                    const fisicoNum = currentVal !== '' ? parseInt(currentVal) : null;
                    const diff = fisicoNum !== null ? fisicoNum - det.stock_sistema : null;

                    return (
                      <tr key={det.id} className="hover:bg-amber-50/40">
                        <td className="p-2.5">
                          <div className="font-bold text-stone-900">{det.producto_nombre}</div>
                          <div className="text-[10px] text-stone-400 font-mono">{det.codigo_sku}</div>
                        </td>
                        <td className="p-2.5">
                          <AbcBadge clase={det.clasificacion_abc} />
                        </td>
                        <td className="p-2.5 text-center font-bold text-stone-900">
                          {det.stock_sistema} un.
                        </td>
                        <td className="p-2.5 text-center">
                          {selectedConteo.estado === 'CONCILIADO' ? (
                            <span className="font-extrabold text-stone-950">{det.stock_fisico} un.</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              value={currentVal}
                              onChange={(e) =>
                                setPhysicalCounts({
                                  ...physicalCounts,
                                  [det.producto_id]: {
                                    ...physicalCounts[det.producto_id],
                                    stock_fisico: e.target.value
                                  }
                                })
                              }
                              placeholder="Físico"
                              className="w-20 px-2 py-1 border border-stone-300 rounded text-center font-bold focus:ring-1 focus:ring-amber-400 focus:outline-none"
                            />
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {diff !== null ? (
                            <span
                              className={`font-extrabold px-2 py-0.5 rounded text-[11px] ${
                                diff === 0
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : diff > 0
                                  ? 'text-blue-700 bg-blue-50'
                                  : 'text-red-700 bg-red-50'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          ) : (
                            <span className="text-stone-400">-</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {selectedConteo.estado === 'CONCILIADO' ? (
                            <span className="text-stone-600 text-[11px]">{det.justificacion || 'Sin observaciones'}</span>
                          ) : (
                            <input
                              type="text"
                              value={physicalCounts[det.producto_id]?.justificacion ?? ''}
                              onChange={(e) =>
                                setPhysicalCounts({
                                  ...physicalCounts,
                                  [det.producto_id]: {
                                    ...physicalCounts[det.producto_id],
                                    justificacion: e.target.value
                                  }
                                })
                              }
                              placeholder="Ej: Merma no informada / Conteo conforme"
                              className="w-full px-2 py-1 border border-stone-300 rounded text-[11px] focus:ring-1 focus:ring-amber-400 focus:outline-none"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Programar Conteo */}
      <Modal
        isOpen={isNewCountOpen}
        onClose={() => setIsNewCountOpen(false)}
        title="Programar Toma Física Cíclica"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateCount} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">Estrato ABC a Auditar:</label>
            <select
              value={estratoAbc}
              onChange={(e) => {
                setEstratoAbc(e.target.value);
                if (e.target.value === 'A') setObservaciones('Auditoría física mensual de alta inversión (Clase A)');
                if (e.target.value === 'B') setObservaciones('Auditoría física trimestral (Clase B)');
                if (e.target.value === 'C') setObservaciones('Auditoría física semestral (Clase C)');
                if (e.target.value === 'TODOS') setObservaciones('Conteo general total de almacén');
              }}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none font-bold"
            >
              <option value="A">Clase A (Prioridad Alta - 80% Inversión - Mensual)</option>
              <option value="B">Clase B (Prioridad Media - 15% Inversión - Trimestral)</option>
              <option value="C">Clase C (Prioridad Baja - 5% Inversión - Semestral)</option>
              <option value="TODOS">Todos los Productos (Inventario General)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Observaciones / Motivo:</label>
            <textarea
              rows="3"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition shadow disabled:opacity-50"
          >
            {saving ? 'Generando Muestra...' : 'Crear Auditoría Cíclica'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
