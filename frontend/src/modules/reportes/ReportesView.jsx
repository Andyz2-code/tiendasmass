import React, { useState, useEffect } from 'react';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import {
  BarChart3,
  Flame,
  TrendingDown,
  Printer,
  FileSpreadsheet,
  AlertOctagon,
  RefreshCw
} from 'lucide-react';

export const ReportesView = () => {
  const { selectedBranch } = useBranch();
  const [mermasData, setMermasData] = useState({ total_perdida_soles: 0, detalles: [] });
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    if (!selectedBranch?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/reportes/mermas?sucursal_id=${selectedBranch.id}`);
      setMermasData(res.data || { total_perdida_soles: 0, detalles: [] });
    } catch (err) {
      console.error('Error al cargar reportes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedBranch]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Auditoría de Mermas, Desmedros y Control NIC 2 (Inventarios)
          </h1>
          <p className="text-xs text-stone-500">
            Sucursal: <span className="font-bold text-stone-800">{selectedBranch?.nombre}</span> – Reporte de pérdidas por caducidad y ajustes físicos valorados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Informe</span>
          </button>
          <button
            onClick={fetchReports}
            className="p-1.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tarjeta de Pérdida Financiera por Mermas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 p-5 rounded-2xl border border-red-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider">
              Pérdida Total por Mermas (NIC 2)
            </span>
            <div className="text-2xl font-extrabold text-red-900 mt-1">
              S/. {parseFloat(mermasData.total_perdida_soles || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-red-700 font-medium mt-0.5 block">
              Desmedros y caducidades contabilizadas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-200 text-red-800 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">
              Incidentes de Desmedro
            </span>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">
              {mermasData.detalles?.length || 0}
            </div>
            <span className="text-[10px] text-stone-500 font-medium mt-0.5 block">
              Asientos de ajuste en Kardex
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <AlertOctagon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">
              Enfoque Consumo Responsable
            </span>
            <div className="text-sm font-extrabold text-amber-950 mt-1">
              VNR y Promociones Activas
            </div>
            <span className="text-[10px] text-amber-800 font-medium mt-0.5 block">
              Liquidación anticipada a 30, 15 y 7 días
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-200 text-amber-900 flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabla Detallada de Mermas y Asientos Contables */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-stone-50 border-b border-stone-200 font-bold text-xs text-stone-700 flex justify-between items-center">
          <span>Registro Contable de Bajas de Inventario</span>
          <span className="text-[11px] text-stone-500 font-mono">Norma Internacional de Contabilidad N° 2</span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">Fecha / Asiento</th>
                <th className="py-3 px-4">Producto Afectado</th>
                <th className="py-3 px-4">Doc. Referencia</th>
                <th className="py-3 px-4 text-center">Unidades de Baja</th>
                <th className="py-3 px-4">Costo Unitario</th>
                <th className="py-3 px-4 text-right">Pérdida Valorada</th>
                <th className="py-3 px-4">Justificación / Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-medium">
              {mermasData.detalles?.map((m, idx) => (
                <tr key={idx} className="hover:bg-red-50/30">
                  <td className="py-3 px-4 text-stone-500 text-[11px]">{m.created_at}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-stone-900">{m.producto_nombre}</div>
                    <div className="text-[10px] text-stone-400 font-mono">{m.codigo_sku}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">{m.documento_referencia}</td>
                  <td className="py-3 px-4 text-center font-extrabold text-red-600">-{m.cantidad} un.</td>
                  <td className="py-3 px-4 text-stone-700">S/. {parseFloat(m.costo_unitario).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-extrabold text-red-600">
                    S/. {parseFloat(m.perdida_estimada_soles || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-stone-600 text-[11px]">{m.observaciones}</td>
                </tr>
              ))}

              {mermasData.detalles?.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-stone-400">
                    No se han registrado mermas ni desmedros en esta sucursal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
