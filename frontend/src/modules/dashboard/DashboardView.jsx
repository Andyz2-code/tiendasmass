import React, { useState, useEffect } from 'react';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import { AbcBadge, StockStatusBadge, ExpiryAlertBadge } from '../../components/AlertBadge';
import {
  DollarSign,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  Flame,
  Clock,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const DashboardView = () => {
  const { selectedBranch } = useBranch();
  const [kpis, setKpis] = useState(null);
  const [abcData, setAbcData] = useState(null);
  const [reorderData, setReorderData] = useState(null);
  const [obsolescenceData, setObsolescenceData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!selectedBranch?.id) return;
    setLoading(true);
    try {
      const [kpiRes, abcRes, reorderRes, obsRes] = await Promise.all([
        api.get(`/reportes/dashboard-kpi?sucursal_id=${selectedBranch.id}`),
        api.get(`/inventarios/abc?sucursal_id=${selectedBranch.id}`),
        api.get(`/inventarios/reorder-alerts?sucursal_id=${selectedBranch.id}`),
        api.get(`/inventarios/obsolescence?sucursal_id=${selectedBranch.id}`)
      ]);
      setKpis(kpiRes.data || {});
      setAbcData(abcRes.data || {});
      setReorderData(reorderRes.data || {});
      setObsolescenceData(obsRes.data || {});
    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedBranch]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-stone-200"></div>
          ))}
        </div>
        <div className="h-80 bg-white rounded-2xl border border-stone-200"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado con botón de refresco */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Dashboard Ejecutivo & Control Inteligente de Inventarios
          </h1>
          <p className="text-xs text-stone-500">
            Sucursal activa: <span className="font-bold text-stone-800">{selectedBranch?.nombre}</span> (Modelos ABC Pareto, PEPS NIC 2 y POR)
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 shadow-sm transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar Indicadores</span>
        </button>
      </div>

      {/* 1. Tarjetas KPI Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas Mes */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Ventas del Mes</span>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">
              S/. {parseFloat(kpis?.ventas_mes || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Transacciones en regla
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Pedidos Totales */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Pedidos Atendidos</span>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">
              {kpis?.total_pedidos || 0}
            </div>
            <span className="text-[10px] text-stone-500 font-medium mt-1 block">
              Omnicanal (Delivery / Tienda)
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        {/* Inversión en Inventario */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Valor Inventario (Costo)</span>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">
              S/. {parseFloat(kpis?.valor_inventario_soles || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-stone-500 font-medium mt-1 block">
              Valuado al costo base
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Alertas de Reorden POR */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Alertas de Stock POR</span>
            <div className="text-2xl font-extrabold text-red-600 mt-1">
              {kpis?.alertas_reorden_count || 0}
            </div>
            <span className="text-[10px] text-red-600 font-bold mt-1 block">
              Stock ≤ Punto de Reorden
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Sección: Clasificación ABC (Pareto 80/20) & Consumo Responsable (IOI) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pareto ABC */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-500" />
              <h2 className="text-sm font-extrabold text-stone-900">Estratificación ABC (Pareto 80/20)</h2>
            </div>
            <span className="text-[11px] font-bold text-stone-500">
              Inversión Total: <strong className="text-stone-900">S/. {abcData?.resumen?.total_inversion || 0}</strong>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-extrabold text-amber-700 uppercase">Clase A (Hasta 80%)</span>
              <div className="text-xl font-extrabold text-amber-900 mt-0.5">
                {abcData?.resumen?.conteo_A || 0} prod.
              </div>
              <span className="text-[10px] text-amber-800 block">Revisión mensual</span>
            </div>
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
              <span className="text-[10px] font-extrabold text-blue-700 uppercase">Clase B (80% - 95%)</span>
              <div className="text-xl font-extrabold text-blue-900 mt-0.5">
                {abcData?.resumen?.conteo_B || 0} prod.
              </div>
              <span className="text-[10px] text-blue-800 block">Revisión trimestral</span>
            </div>
            <div className="p-3 rounded-2xl bg-stone-100 border border-stone-200">
              <span className="text-[10px] font-extrabold text-stone-600 uppercase">Clase C (95% - 100%)</span>
              <div className="text-xl font-extrabold text-stone-800 mt-0.5">
                {abcData?.resumen?.conteo_C || 0} prod.
              </div>
              <span className="text-[10px] text-stone-600 block">Revisión semestral</span>
            </div>
          </div>

          {/* Tabla de Productos Top en Inversión */}
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-y border-stone-200">
                <tr>
                  <th className="py-2 px-3">Producto</th>
                  <th className="py-2 px-3">Stock</th>
                  <th className="py-2 px-3">Inversión (S/.)</th>
                  <th className="py-2 px-3">% Acum.</th>
                  <th className="py-2 px-3 text-center">Clase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {abcData?.items?.slice(0, 5).map((item, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/50">
                    <td className="py-2.5 px-3 truncate max-w-[180px] font-semibold text-stone-900">
                      {item.producto_nombre}
                    </td>
                    <td className="py-2.5 px-3">{item.stock_actual}</td>
                    <td className="py-2.5 px-3">S/. {item.valor_inversion}</td>
                    <td className="py-2.5 px-3">{item.porcentaje_acumulado}%</td>
                    <td className="py-2.5 px-3 text-center">
                      <AbcBadge clase={item.clasificacion_abc} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Consumo Responsable / Índice de Obsolescencia (IOI) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-600" />
              <h2 className="text-sm font-extrabold text-stone-900">Consumo Responsable (IOI - NIC 2)</h2>
            </div>
            <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
              IOI: {obsolescenceData?.resumen?.indice_obsolescencia || 0}%
            </span>
          </div>

          <p className="text-[11px] text-stone-500">
            Lotes perecederos en riesgo de caducidad. Se sugieren descuentos preventivos para acelerar rotación antes de generar mermas.
          </p>

          <div className="space-y-3">
            {/* Lotes críticos 7 días */}
            {obsolescenceData?.lotes_criticos_7_dias?.length > 0 ? (
              obsolescenceData.lotes_criticos_7_dias.slice(0, 3).map((lote) => (
                <div key={lote.lote_id} className="p-3 bg-red-50 border border-red-200 rounded-2xl flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-950 truncate">{lote.producto_nombre}</span>
                    <ExpiryAlertBadge dias={lote.dias_para_vencer} />
                  </div>
                  <div className="text-[11px] text-red-700 flex justify-between">
                    <span>Lote: {lote.codigo_lote} ({lote.cantidad_disponible} un.)</span>
                    <span className="font-bold">Vence: {lote.fecha_vencimiento}</span>
                  </div>
                  <div className="text-[10px] bg-white/80 p-1.5 rounded text-red-900 font-medium mt-1">
                    Acción: {lote.sugerencia_accion}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs text-emerald-800 font-bold flex flex-col items-center gap-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <span>No hay lotes con vencimiento crítico menor a 7 días.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Tabla de Alertas de Punto de Reorden (POR) */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-extrabold text-stone-900">
              Alertas de Reorden de Mercadería (POR = d · L + SS)
            </h2>
          </div>
          <span className="text-xs text-stone-500 font-medium">
            Mostrando productos con stock menor o igual al punto de reorden
          </span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-y border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Producto / SKU</th>
                <th className="py-2.5 px-3">Stock Actual</th>
                <th className="py-2.5 px-3">Demanda (d)</th>
                <th className="py-2.5 px-3">Lead Time (L)</th>
                <th className="py-2.5 px-3">Stock Seg. (SS)</th>
                <th className="py-2.5 px-3">P. Reorden (POR)</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 font-extrabold text-stone-900">Sugerencia Compra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {reorderData?.alertas_activas?.map((row, idx) => (
                <tr key={idx} className="hover:bg-stone-50">
                  <td className="py-3 px-3">
                    <div className="font-bold text-stone-900">{row.producto_nombre}</div>
                    <div className="text-[10px] text-stone-400 font-mono">{row.codigo_sku}</div>
                  </td>
                  <td className="py-3 px-3 font-bold text-stone-900">{row.stock_actual}</td>
                  <td className="py-3 px-3">{row.demanda_diaria_promedio} un./día</td>
                  <td className="py-3 px-3">{row.lead_time_dias} días</td>
                  <td className="py-3 px-3">{row.stock_seguridad}</td>
                  <td className="py-3 px-3 font-extrabold text-amber-700">{row.por_calculado}</td>
                  <td className="py-3 px-3">
                    <StockStatusBadge estado={row.estado_stock} stock={row.stock_actual} por={row.por_calculado} />
                  </td>
                  <td className="py-3 px-3 font-extrabold text-emerald-700">
                    +{row.sugerencia_compra} unidades
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
