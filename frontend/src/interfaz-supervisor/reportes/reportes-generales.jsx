import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  Building2,
  Calendar,
  Filter,
  PackageX,
  Boxes,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export const ReportesGeneralesView = () => {
  const { user, isAdmin, isSupervisor } = useAuth();
  const { sucursales, selectedBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState('2026-01-01');
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [sucursalFilter, setSucursalFilter] = useState('');

  const fetchReporte = async () => {
    setLoading(true);
    try {
      let query = `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
      if (sucursalFilter) query += `&sucursal_id=${sucursalFilter}`;
      else if (isSupervisor && user?.sucursal_id) query += `&sucursal_id=${user.sucursal_id}`;

      const res = await api.get(`/reportes/general-admin${query}`);
      setData(res.data?.data || res.data);
    } catch (err) {
      console.error('Error al cargar reporte general:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReporte();
  }, [fechaInicio, fechaFin, sucursalFilter, user]);

  const setPreset = (preset) => {
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'hoy') {
      setFechaInicio(today);
      setFechaFin(today);
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFechaInicio(d.toISOString().split('T')[0]);
      setFechaFin(today);
    } else if (preset === 'mes') {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      setFechaInicio(firstDay);
      setFechaFin(today);
    } else if (preset === 'ano') {
      setFechaInicio('2026-01-01');
      setFechaFin(today);
    }
  };

  const resumen = data?.resumen || {};
  const comparativa = data?.comparativa_sucursales || [];
  const topVendidos = data?.top_vendidos || [];
  const agotados = data?.productos_agotados || [];
  const bajoStock = data?.productos_bajo_stock || [];
  const movimientos = data?.movimientos_kardex || [];

  return (
    <div className="space-y-6">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-stone-900 rounded-xl">
              <BarChart3 className="w-5 h-5 text-mass-red" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Reportes Ejecutivos & Auditoría de Ventas
            </h1>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-1">
            {isAdmin
              ? 'Consolidado corporativo nacional, comparativa entre sucursales y control de rotación de stock.'
              : `Auditoría y estadísticas operativas exclusivas de su sucursal asignada (${user?.sucursal_nombre || 'Local'}).`}
          </p>
        </div>

        {/* Presets Rápidos */}
        <div className="flex items-center gap-1.5 self-start bg-stone-100 p-1 rounded-2xl border border-stone-200">
          <button
            onClick={() => setPreset('hoy')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 hover:bg-white transition"
          >
            Hoy
          </button>
          <button
            onClick={() => setPreset('7d')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 hover:bg-white transition"
          >
            7 Días
          </button>
          <button
            onClick={() => setPreset('mes')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 hover:bg-white transition"
          >
            Este Mes
          </button>
          <button
            onClick={() => setPreset('ano')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 hover:bg-white transition"
          >
            Año 2026
          </button>
        </div>
      </div>

      {/* Barra de Filtros por Fechas y Sucursal */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center gap-4 text-xs font-bold">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-stone-400" />
          <span className="text-stone-500">Desde:</span>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-stone-900 font-bold"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-stone-500">Hasta:</span>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-stone-900 font-bold"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <Building2 className="w-4 h-4 text-amber-500" />
            <span className="text-stone-500">Sucursal:</span>
            <select
              value={sucursalFilter}
              onChange={(e) => setSucursalFilter(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-stone-900 font-bold cursor-pointer"
            >
              <option value="">Todas las Sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4 KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>Ingresos por Ventas</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-stone-900">
            S/. {(resumen.total_ingresos || 0).toFixed(2)}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ventas netas confirmadas</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>Transacciones / Pedidos</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {resumen.total_transacciones || 0}
          </div>
          <p className="text-[11px] text-stone-500 font-semibold">
            Órdenes procesadas con éxito
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>Ticket Promedio</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-stone-900">
            S/. {(resumen.ticket_promedio || 0).toFixed(2)}
          </div>
          <p className="text-[11px] text-stone-500 font-semibold">
            Gasto medio por cliente
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>Total Fletes de Delivery</span>
            <span className="p-2 rounded-xl bg-orange-50 text-orange-600">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-stone-900">
            S/. {(resumen.total_fletes || 0).toFixed(2)}
          </div>
          <p className="text-[11px] text-stone-500 font-semibold">
            Entregas georreferenciadas
          </p>
        </div>
      </div>

      {/* Sección Comparativa de Sucursales (Solo Administrador) */}
      {isAdmin && comparativa.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <h2 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-mass-red" />
            <span>Comparativa de Rendimiento por Sucursal</span>
          </h2>

          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-extrabold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Sucursal</th>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">N° Pedidos</th>
                  <th className="py-2.5 px-3">Ventas Totales</th>
                  <th className="py-2.5 px-3">Ticket Medio</th>
                  <th className="py-2.5 px-3">% Aporte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                {comparativa.map((s) => {
                  const totalGlobal = resumen.total_ingresos || 1;
                  const porcentaje = ((parseFloat(s.total_ventas || 0) / totalGlobal) * 100).toFixed(1);

                  return (
                    <tr key={s.sucursal_id} className="hover:bg-stone-50 transition">
                      <td className="py-3 px-3 font-bold text-stone-900">{s.sucursal_nombre}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-stone-500">{s.codigo_tienda}</td>
                      <td className="py-3 px-3 font-black text-stone-800">{s.total_pedidos}</td>
                      <td className="py-3 px-3 font-extrabold text-mass-red">
                        S/. {parseFloat(s.total_ventas || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-bold text-stone-800">
                        S/. {parseFloat(s.ticket_promedio || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-mass-yellow rounded-full"
                              style={{ width: `${Math.min(100, Math.max(5, porcentaje))}%` }}
                            ></div>
                          </div>
                          <span className="font-extrabold text-[11px] text-stone-900">{porcentaje}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grilla a Dos Columnas: Top Vendidos & Auditoría de Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Productos Más Vendidos */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <h2 className="text-base font-extrabold text-stone-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>🏆</span>
              <span>Top Productos Más Vendidos</span>
            </span>
            <span className="text-xs font-bold text-stone-400">Por volumen de compra</span>
          </h2>

          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-extrabold uppercase text-[10px]">
                  <th className="py-2.5 px-2">Producto</th>
                  <th className="py-2.5 px-2">Categoría</th>
                  <th className="py-2.5 px-2 text-center">Unidades</th>
                  <th className="py-2.5 px-2 text-right">Total Soles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                {topVendidos.length > 0 ? (
                  topVendidos.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-stone-50 transition">
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-stone-900 truncate max-w-[180px]">{p.producto}</div>
                        <div className="text-[10px] text-stone-400 font-mono">{p.codigo_sku}</div>
                      </td>
                      <td className="py-2.5 px-2 text-stone-500">{p.categoria}</td>
                      <td className="py-2.5 px-2 text-center font-black text-stone-900">{p.unidades_vendidas}</td>
                      <td className="py-2.5 px-2 text-right font-extrabold text-emerald-700">
                        S/. {parseFloat(p.ingresos_generados).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-stone-400">Sin datos de ventas en este rango.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertas de Stock Agotado y Bajo Stock */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <h2 className="text-base font-extrabold text-stone-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Productos Críticos & Bajo Stock</span>
            </span>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {agotados.length} Agotados
            </span>
          </h2>

          <div className="space-y-3 max-h-80 overflow-y-auto custom-scroll pr-1">
            {/* Agotados */}
            {agotados.map((item) => (
              <div
                key={`agotado-${item.id}`}
                className="p-3 bg-red-50/70 border border-red-200 rounded-2xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-red-950 truncate max-w-[220px]">{item.nombre}</div>
                  <div className="text-[10px] text-red-700 font-mono">
                    SKU: {item.codigo_sku} • {item.sucursal_nombre}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 bg-red-600 text-white rounded font-black text-[10px] uppercase">
                    Agotado (0)
                  </span>
                  <div className="text-[10px] text-stone-500 font-bold mt-0.5">Sugerido: +{item.punto_reorden || 20}</div>
                </div>
              </div>
            ))}

            {/* Bajo stock */}
            {bajoStock.map((item) => (
              <div
                key={`bajo-${item.id}`}
                className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-stone-900 truncate max-w-[220px]">{item.nombre}</div>
                  <div className="text-[10px] text-stone-500 font-mono">
                    SKU: {item.codigo_sku} • {item.sucursal_nombre}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 bg-amber-500 text-stone-950 rounded font-black text-[10px] uppercase">
                    {item.stock_actual} unidades
                  </span>
                  <div className="text-[10px] text-stone-500 font-bold mt-0.5">
                    Punto reorden: {item.punto_reorden}
                  </div>
                </div>
              </div>
            ))}

            {agotados.length === 0 && bajoStock.length === 0 && (
              <div className="py-8 text-center text-stone-400">
                <Boxes className="w-8 h-8 mx-auto mb-1 stroke-1 text-emerald-500" />
                <p className="font-bold text-stone-600">¡Niveles de inventario óptimos!</p>
                <p className="text-[11px]">No hay productos con stock agotado ni por debajo del punto de reorden.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resumen de Movimientos Kardex */}
      {movimientos.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
          <h2 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-mass-red" />
            <span>Resumen de Movimientos Físicos en Kardex</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {movimientos.map((m, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                <div className="font-extrabold text-stone-700">{m.tipo_movimiento}</div>
                <div className="text-lg font-black text-stone-950">{m.total_unidades} unidades</div>
                <div className="text-[11px] text-stone-500 flex justify-between pt-1 border-t border-stone-200">
                  <span>Operaciones: <strong>{m.total_operaciones}</strong></span>
                  <span>Valor: <strong>S/. {parseFloat(m.valor_monetario_soles).toFixed(2)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
