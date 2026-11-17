import React, { useState, useEffect } from 'react';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import { Modal } from '../../components/Modal';
import {
  PackageCheck,
  PlusCircle,
  Truck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Boxes,
  MapPin,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export const AlmacenView = () => {
  const { selectedBranch } = useBranch();
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [isRecepcionOpen, setIsRecepcionOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Formulario de Recepción de Compras
  const [formData, setFormData] = useState({
    producto_id: '',
    codigo_lote: '',
    cantidad: '',
    costo_unitario: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    ubicacion_almacen: 'PASAJE-A-ESTANTE-1',
    documento_referencia: 'FAC-PROV-' + Math.floor(1000 + Math.random() * 9000)
  });

  const fetchData = async () => {
    if (!selectedBranch?.id) return;
    setLoading(true);
    try {
      const [pedRes, prodRes] = await Promise.all([
        api.get(`/pedidos?sucursal_id=${selectedBranch.id}`),
        api.get(`/productos?sucursal_id=${selectedBranch.id}`)
      ]);
      setPedidos(pedRes.data || []);
      setProductos(prodRes.data || []);
    } catch (err) {
      console.error('Error al cargar datos del almacén:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranch]);

  const handleUpdateStatus = async (pedidoId, nuevoEstado) => {
    setActionLoading(true);
    try {
      await api.put(`/pedidos/${pedidoId}/estado`, { estado_pedido: nuevoEstado });
      setSuccessMsg(`Pedido ${nuevoEstado.toLowerCase()} exitosamente.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
      if (selectedPedido?.id === pedidoId) {
        const updated = await api.get(`/pedidos/${pedidoId}`);
        setSelectedPedido(updated.data);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecepcionSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post('/lotes/recepcion', {
        ...formData,
        sucursal_id: selectedBranch.id
      });
      setIsRecepcionOpen(false);
      setSuccessMsg('Recepción de compras registrada. Lote activo bajo control PEPS.');
      setTimeout(() => setSuccessMsg(''), 3000);
      setFormData({
        producto_id: '',
        codigo_lote: '',
        cantidad: '',
        costo_unitario: '',
        fecha_ingreso: new Date().toISOString().split('T')[0],
        fecha_vencimiento: '',
        ubicacion_almacen: 'PASAJE-A-ESTANTE-1',
        documento_referencia: 'FAC-PROV-' + Math.floor(1000 + Math.random() * 9000)
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openPedidoDetails = async (id) => {
    try {
      const res = await api.get(`/pedidos/${id}`);
      setSelectedPedido(res.data);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Almacén, Picking y Despacho Operativo
          </h1>
          <p className="text-xs text-stone-500">
            Sucursal: <span className="font-bold text-stone-800">{selectedBranch?.nombre}</span> – Módulo del Supervisor para asignación física de lotes PEPS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRecepcionOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-mass-yellow hover:bg-amber-400 text-stone-950 text-xs font-extrabold shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Compra / Lote</span>
          </button>
          <button
            onClick={fetchData}
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

      {/* Cola de Pedidos para Picking y Empaque */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { key: 'PENDIENTE', label: 'Pendientes de Picking', color: 'bg-amber-500', next: 'EN_PREPARACION', nextLabel: 'Iniciar Picking' },
          { key: 'EN_PREPARACION', label: 'En Preparación / Picking', color: 'bg-blue-500', next: 'LISTO_PARA_DESPACHO', nextLabel: 'Listo p/ Despacho' },
          { key: 'LISTO_PARA_DESPACHO', label: 'Listos para Despacho', color: 'bg-purple-500', next: 'DESPACHADO', nextLabel: 'Despachar (En Ruta)' },
          { key: 'DESPACHADO', label: 'Despachados / En Ruta', color: 'bg-emerald-600', next: 'ENTREGADO', nextLabel: 'Confirmar Entrega' }
        ].map((col) => {
          const colPedidos = pedidos.filter((p) => p.estado_pedido === col.key);
          return (
            <div key={col.key} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm flex flex-col h-[600px]">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.color}`}></span>
                  <span className="text-xs font-bold text-stone-900">{col.label}</span>
                </div>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                  {colPedidos.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {colPedidos.map((ped) => (
                  <div
                    key={ped.id}
                    onClick={() => openPedidoDetails(ped.id)}
                    className="p-3 bg-stone-50 hover:bg-amber-50/60 rounded-xl border border-stone-200 cursor-pointer transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-stone-900">{ped.codigo_pedido}</span>
                      <span className="text-[10px] bg-stone-200 px-1.5 py-0.5 rounded font-semibold text-stone-700">
                        {ped.tipo_entrega}
                      </span>
                    </div>

                    <div className="text-xs text-stone-600">
                      Cliente: <strong className="text-stone-900">{ped.cliente_nombres} {ped.cliente_apellidos}</strong>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200">
                      <span className="text-stone-500 font-medium">S/. {parseFloat(ped.total).toFixed(2)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(ped.id, col.next);
                        }}
                        disabled={actionLoading}
                        className="px-2 py-1 bg-stone-900 hover:bg-black text-amber-400 font-bold text-[10px] rounded-lg transition"
                      >
                        {col.nextLabel}
                      </button>
                    </div>
                  </div>
                ))}

                {colPedidos.length === 0 && (
                  <div className="h-full flex items-center justify-center text-stone-400 text-xs text-center p-4">
                    Sin pedidos en este estado
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Detalle de Picking con desglose PEPS */}
      {selectedPedido && (
        <Modal
          isOpen={!!selectedPedido}
          onClose={() => setSelectedPedido(null)}
          title={`Detalle de Picking: ${selectedPedido.codigo_pedido}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div>
                <span className="text-stone-500 block">Cliente:</span>
                <span className="font-bold text-stone-900">{selectedPedido.cliente_nombres} {selectedPedido.cliente_apellidos}</span>
                <div className="text-stone-500 text-[11px]">Doc: {selectedPedido.tipo_documento} {selectedPedido.numero_documento}</div>
              </div>
              <div>
                <span className="text-stone-500 block">Modalidad & Estado:</span>
                <span className="font-bold text-stone-900">{selectedPedido.tipo_entrega} ({selectedPedido.estado_pedido})</span>
                <div className="text-stone-500 text-[11px]">Pago: {selectedPedido.metodo_pago}</div>
              </div>
            </div>

            {/* Hoja de Picking PEPS */}
            <div>
              <h4 className="font-bold text-stone-900 mb-2 flex items-center gap-1.5 text-xs">
                <PackageCheck className="w-4 h-4 text-mass-red" />
                <span>Hoja de Picking de Almacén (Asignación Automática PEPS / NIC 2)</span>
              </h4>
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5">Lote Despachado</th>
                      <th className="p-2.5">Ubicación</th>
                      <th className="p-2.5">Vencimiento</th>
                      <th className="p-2.5 text-right">Cant.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 font-medium">
                    {selectedPedido.detalles?.map((det, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/40">
                        <td className="p-2.5 font-bold text-stone-900">{det.producto_nombre}</td>
                        <td className="p-2.5 font-mono text-amber-700 font-bold">{det.codigo_lote}</td>
                        <td className="p-2.5 font-semibold text-stone-700">{det.ubicacion_almacen}</td>
                        <td className="p-2.5 text-stone-500">{det.fecha_vencimiento || 'N/A'}</td>
                        <td className="p-2.5 text-right font-extrabold text-stone-950">{det.cantidad} un.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-stone-200">
              <button
                onClick={() => setSelectedPedido(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 font-bold rounded-xl text-stone-800 text-xs"
              >
                Cerrar Hoja de Picking
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Registrar Compra / Lote */}
      <Modal
        isOpen={isRecepcionOpen}
        onClose={() => setIsRecepcionOpen(false)}
        title="Recepción de Compras & Entrada de Lotes PEPS"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleRecepcionSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Producto:</label>
            <select
              required
              value={formData.producto_id}
              onChange={(e) => setFormData({ ...formData, producto_id: e.target.value })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
            >
              <option value="">-- Seleccionar producto del catálogo --</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (SKU: {p.codigo_sku})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Código de Lote:</label>
              <input
                type="text"
                required
                value={formData.codigo_lote}
                onChange={(e) => setFormData({ ...formData, codigo_lote: e.target.value })}
                placeholder="LOT-2026-X01"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">N° Doc. Factura / Guía:</label>
              <input
                type="text"
                required
                value={formData.documento_referencia}
                onChange={(e) => setFormData({ ...formData, documento_referencia: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Cantidad Comprada (Unidades):</label>
              <input
                type="number"
                min="1"
                required
                value={formData.cantidad}
                onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                placeholder="100"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Costo Unitario (S/.):</label>
              <input
                type="number"
                step="0.01"
                min="0.10"
                required
                value={formData.costo_unitario}
                onChange={(e) => setFormData({ ...formData, costo_unitario: e.target.value })}
                placeholder="3.50"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Fecha de Ingreso:</label>
              <input
                type="date"
                required
                value={formData.fecha_ingreso}
                onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Fecha Vencimiento (NIC 2):</label>
              <input
                type="date"
                value={formData.fecha_vencimiento}
                onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Ubicación en Almacén:</label>
            <input
              type="text"
              value={formData.ubicacion_almacen}
              onChange={(e) => setFormData({ ...formData, ubicacion_almacen: e.target.value })}
              placeholder="Ej: ESTANTE-A1 / CAMARA-FRIO-1"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={actionLoading}
            className="w-full py-3 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition mt-2 disabled:opacity-50"
          >
            {actionLoading ? 'Registrando en Kardex...' : 'Ingresar Lote a Inventario'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
