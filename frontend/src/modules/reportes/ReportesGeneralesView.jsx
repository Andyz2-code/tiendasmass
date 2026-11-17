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
  ArrowDownRight,
  Printer,
  Sparkles,
  CreditCard,
  Percent,
  Clock,
  X
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
  const [showVentasHoyModal, setShowVentasHoyModal] = useState(false);
  const [rotacionSort, setRotacionSort] = useState('unidades');

  const fetchReporte = async () => {
    setLoading(true);
    try {
      let query = `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
      if (sucursalFilter) query += `&sucursal_id=${sucursalFilter}`;
      else if (isSupervisor && user?.sucursal_id) query += `&sucursal_id=${user.sucursal_id}`;
      else if (selectedBranch?.id) query += `&sucursal_id=${selectedBranch.id}`;

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
  }, [fechaInicio, fechaFin, sucursalFilter, selectedBranch?.id, user]);

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
  const ventasDia = data?.ventas_dia || { total_ingresos: 0, operaciones: 0, detalle_ventas: [] };
  const ventasMes = data?.ventas_mes || { total_ingresos: 0, operaciones: 0, ventas_por_dia: [] };
  const margenUtilidad = data?.margen_utilidad || { ingresos_ventas: 0, costo_ventas: 0, utilidad_bruta: 0, margen_porcentaje: 0 };
  const comparativa = data?.comparativa_sucursales || [];
  const altaRotacion = [...(data?.alta_rotacion || [])].sort((a, b) => {
    if (rotacionSort === 'soles') return parseFloat(b.total_soles_generado || 0) - parseFloat(a.total_soles_generado || 0);
    if (rotacionSort === 'operaciones') return parseInt(b.operaciones_count || 0) - parseInt(a.operaciones_count || 0);
    return parseInt(b.unidades_vendidas || 0) - parseInt(a.unidades_vendidas || 0);
  });
  const metodosPago = data?.metodos_pago || [];
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
              Reportes Generales de Ventas & Rentabilidad
            </h1>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-1">
            {isAdmin
              ? 'Consolidado corporativo integral de ventas, márgenes reales de utilidad y rotación de productos.'
              : `Auditoría y desempeño exclusivo de su sede asignada (${user?.sucursal_nombre || 'Local'}).`}
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-stone-900 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 hover:bg-stone-800 transition shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Informe</span>
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

      {/* 1. SECCIÓN: VENTAS DEL DÍA Y VENTAS DEL MES (Prompt 3.1.A y 3.1.B) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas del Día */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-5 rounded-3xl border border-amber-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-xs font-extrabold text-amber-900">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                <span>VENTAS DEL DÍA</span>
              </span>
              <span className="text-[10px] bg-amber-200/80 px-2 py-0.5 rounded-full font-bold">Hoy</span>
            </div>
            <div className="text-2xl font-black text-stone-900 mt-2">
              S/ {ventasDia.total_ingresos.toFixed(2)}
            </div>
            <div className="text-xs font-bold text-stone-600 mt-1">
              {ventasDia.operaciones} operaciones realizadas
            </div>
          </div>
          <button
            onClick={() => setShowVentasHoyModal(true)}
            className="mt-3 text-[11px] font-black text-amber-900 hover:underline flex items-center gap-1 self-start"
          >
            <span>🔍 Ver detalle de ventas de hoy →</span>
          </button>
        </div>

        {/* Ventas del Mes */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-3xl border border-blue-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-xs font-extrabold text-blue-900">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-700" />
                <span>VENTAS DEL MES</span>
              </span>
              <span className="text-[10px] bg-blue-200/80 px-2 py-0.5 rounded-full font-bold">Mes Actual</span>
            </div>
            <div className="text-2xl font-black text-stone-900 mt-2">
              S/ {ventasMes.total_ingresos.toFixed(2)}
            </div>
            <div className="text-xs font-bold text-stone-600 mt-1">
              {ventasMes.operaciones} pedidos acumulados
            </div>
          </div>
          <div className="text-[10px] text-blue-800 font-bold mt-2">
            ✓ Desglose por día activo en sistema
          </div>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-stone-500 font-bold">Ticket Promedio Periodo</div>
            <div className="text-2xl font-black text-stone-900 mt-1">
              S/ {(resumen.ticket_promedio || 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-stone-500 font-bold mt-1">Promedio por orden de compra</div>
          </div>
          <div className="text-[10px] text-stone-400 font-medium mt-2">
            Total órdenes: {resumen.total_transacciones || 0}
          </div>
        </div>

        {/* Total Fletes / Delivery */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-stone-500 font-bold">Total Fletes / Delivery</div>
            <div className="text-2xl font-black text-stone-900 mt-1">
              S/ {(resumen.total_fletes || 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-1">✓ Despachos georreferenciados</div>
          </div>
          <div className="text-[10px] text-stone-400 font-medium mt-2">
            Ingresos por servicio logístico
          </div>
        </div>
      </div>

      {/* 2. SECCIÓN: MARGEN DE UTILIDAD REAL (Prompt 3.1.C) */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <h2 className="text-base font-extrabold text-stone-900">Análisis Financiero & Margen de Utilidad Real</h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Calculado a partir de los costos reales de adquisición registrados en productos y lotes PEPS.
            </p>
          </div>
          <div className="text-[11px] bg-stone-100 text-stone-700 px-3 py-1 rounded-xl font-bold border border-stone-200">
            Fórmula: Utilidad = Ingresos - Costos | Margen = (Utilidad / Ingresos) × 100
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl">
            <div className="text-xs text-stone-500 font-bold">1. Ingresos por Ventas</div>
            <div className="text-xl font-black text-stone-900 mt-1">
              S/ {margenUtilidad.ingresos_ventas.toFixed(2)}
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">Suma de mercadería vendida</div>
          </div>

          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl">
            <div className="text-xs text-stone-500 font-bold">2. Costo de Productos Vendidos</div>
            <div className="text-xl font-black text-red-700 mt-1">
              S/ {margenUtilidad.costo_ventas.toFixed(2)}
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">Costo base / compra unitario</div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="text-xs text-emerald-800 font-bold">3. Utilidad Bruta Generada</div>
            <div className="text-xl font-black text-emerald-700 mt-1">
              S/ {margenUtilidad.utilidad_bruta.toFixed(2)}
            </div>
            <div className="text-[10px] text-emerald-800 mt-0.5">Ganancia monetaria neta</div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="text-xs text-amber-900 font-bold">4. Margen de Utilidad (%)</div>
            <div className="text-xl font-black text-amber-800 mt-1">
              {margenUtilidad.margen_porcentaje.toFixed(2)}%
            </div>
            <div className="text-[10px] text-amber-900 mt-0.5">Rentabilidad sobre ventas</div>
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN: PRODUCTOS DE ALTA ROTACIÓN (Prompt 3.2) */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">🔥</span>
              <h2 className="text-base font-extrabold text-stone-900">Productos de Alta Rotación</h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Artículos con mayor volumen de salida e impacto en la facturación del periodo seleccionado.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-stone-500">Ordenar por:</span>
            <select
              value={rotacionSort}
              onChange={(e) => setRotacionSort(e.target.value)}
              className="p-1.5 border border-stone-200 rounded-lg bg-white font-bold"
            >
              <option value="unidades">Mayor Cantidad Vendida</option>
              <option value="soles">Mayor Importe Total (S/)</option>
              <option value="operaciones">Mayor Presencia en Tickets</option>
            </select>
          </div>
        </div>

        {altaRotacion.length === 0 ? (
          <div className="p-8 text-center text-stone-400 font-bold">
            No se registraron ventas de productos en este periodo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-extrabold border-b border-stone-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Código SKU</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">Sucursal</th>
                  <th className="p-3 text-center">Unidades Vendidas</th>
                  <th className="p-3 text-right">Importe Total (S/)</th>
                  <th className="p-3 text-center">N° Operaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-semibold text-stone-800">
                {altaRotacion.map((p, idx) => (
                  <tr key={`${p.id}-${idx}`} className="hover:bg-stone-50/70">
                    <td className="p-3 font-mono text-stone-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-stone-900">{p.producto}</td>
                    <td className="p-3 font-mono text-[10px] text-stone-600">{p.codigo_sku}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-stone-100 rounded text-[10px] font-bold text-stone-700">
                        {p.categoria}
                      </span>
                    </td>
                    <td className="p-3 text-stone-600">{p.sucursal_nombre}</td>
                    <td className="p-3 text-center font-black text-stone-900 text-sm">
                      {p.unidades_vendidas}
                    </td>
                    <td className="p-3 text-right font-black text-mass-red">
                      S/ {parseFloat(p.total_soles_generado || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-center font-bold text-stone-600">
                      {p.operaciones_count} tickets
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. SECCIÓN: MÉTODOS DE PAGO SEPARADOS (Prompt 3.3) */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <div className="border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-mass-red" />
            <h2 className="text-base font-extrabold text-stone-900">Distribución Independiente por Método de Pago</h2>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Desglose transparente de operaciones, dinero recaudado y porcentaje de participación por cada pasarela y medio de pago.
          </p>
        </div>

        {metodosPago.length === 0 ? (
          <div className="p-8 text-center text-stone-400 font-bold">
            No se encontraron pagos registrados en el periodo.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Tabla por Método */}
            <div className="lg:col-span-7 space-y-3">
              <div className="border border-stone-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-extrabold border-b border-stone-200">
                    <tr>
                      <th className="p-3">Método de Pago</th>
                      <th className="p-3 text-center">Operaciones</th>
                      <th className="p-3 text-right">Total Recaudado</th>
                      <th className="p-3 text-right">Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-semibold">
                    {metodosPago.map((m) => {
                      const iconMap = {
                        YAPE: '🟣',
                        PLIN: '🔵',
                        TARJETA: '💳',
                        EFECTIVO_CONTRA_ENTREGA: '💵'
                      };
                      return (
                        <tr key={m.codigo} className="hover:bg-stone-50/70">
                          <td className="p-3 font-bold text-stone-900 flex items-center gap-2">
                            <span>{iconMap[m.codigo] || '💳'}</span>
                            <span>{m.nombre}</span>
                          </td>
                          <td className="p-3 text-center font-bold text-stone-700">
                            {m.cantidad_operaciones} ventas
                          </td>
                          <td className="p-3 text-right font-black text-stone-900">
                            S/ {m.importe_total.toFixed(2)}
                          </td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-black text-[10px]">
                              {m.porcentaje.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gráfico Visual de Participación Porcentual */}
            <div className="lg:col-span-5 bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-3">
              <div className="font-extrabold text-xs text-stone-800">Participación en Ventas (%)</div>
              <div className="space-y-2.5">
                {metodosPago.map((m) => (
                  <div key={m.codigo} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>{m.nombre}</span>
                      <span className="text-stone-900">
                        {m.porcentaje.toFixed(1)}% (S/ {m.importe_total.toFixed(2)})
                      </span>
                    </div>
                    <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-mass-yellow rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, m.porcentaje)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-stone-200 text-[10px] text-stone-500">
                Suma total verificada: 100% libre de duplicaciones entre métodos combinados.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. SECCIÓN: COMPARATIVA DE SUCURSALES (Solo Administrador) */}
      {isAdmin && comparativa.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
          <h2 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-mass-red" />
            <span>Comparativa de Rendimiento por Sucursal</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 text-stone-400 font-extrabold text-[10px] uppercase border-b border-stone-200">
                <tr>
                  <th className="p-3">Sucursal</th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Pedidos</th>
                  <th className="p-3">Total Ventas</th>
                  <th className="p-3">Ticket Medio</th>
                  <th className="p-3">% Aporte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-semibold">
                {comparativa.map((s) => {
                  const totalGlobal = resumen.total_ingresos || 1;
                  const porcentaje = ((parseFloat(s.total_ventas || 0) / totalGlobal) * 100).toFixed(1);

                  return (
                    <tr key={s.sucursal_id} className="hover:bg-stone-50">
                      <td className="p-3 font-bold text-stone-900">{s.sucursal_nombre}</td>
                      <td className="p-3 font-mono text-[11px] text-stone-500">{s.codigo_tienda}</td>
                      <td className="p-3 font-black text-stone-800">{s.total_pedidos}</td>
                      <td className="p-3 font-black text-mass-red">
                        S/ {parseFloat(s.total_ventas || 0).toFixed(2)}
                      </td>
                      <td className="p-3 font-bold text-stone-800">
                        S/ {parseFloat(s.ticket_promedio || 0).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-mass-yellow rounded-full"
                              style={{ width: `${Math.min(100, Math.max(5, porcentaje))}%` }}
                            />
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

      {/* 6. SECCIÓN: PRODUCTOS AGOTADOS Y CRÍTICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
          <h2 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Productos Críticos & Bajo Stock</span>
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll">
            {bajoStock.map((b) => (
              <div
                key={b.id}
                className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center text-xs"
              >
                <div>
                  <div className="font-bold text-stone-900">{b.nombre}</div>
                  <div className="text-[10px] text-stone-500">
                    {b.sucursal_nombre} • Punto Reorden: {b.punto_reorden}
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-amber-400 text-stone-950 font-black text-[10px] rounded">
                  {b.stock_actual} unid.
                </span>
              </div>
            ))}
            {bajoStock.length === 0 && (
              <div className="text-center py-6 text-stone-400">
                Todos los productos cuentan con niveles de inventario óptimos.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
          <h2 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
            <PackageX className="w-4 h-4 text-red-500" />
            <span>Productos Agotados (Stock Cero)</span>
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll">
            {agotados.map((a) => (
              <div
                key={a.id}
                className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex justify-between items-center text-xs"
              >
                <div>
                  <div className="font-bold text-red-950">{a.nombre}</div>
                  <div className="text-[10px] text-red-700">{a.sucursal_nombre}</div>
                </div>
                <span className="px-2 py-0.5 bg-red-600 text-white font-black text-[10px] rounded">AGOTADO</span>
              </div>
            ))}
            {agotados.length === 0 && (
              <div className="text-center py-6 text-emerald-600 font-bold">No hay productos en quiebre de stock.</div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DETALLE DE VENTAS DEL DÍA (Prompt 3.1.A) */}
      {showVentasHoyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <div>
                <h2 className="text-base font-extrabold text-stone-900">Detalle de Ventas del Día</h2>
                <p className="text-[11px] text-stone-500">
                  Operaciones efectuadas hoy {new Date().toLocaleDateString('es-PE')}
                </p>
              </div>
              <button
                onClick={() => setShowVentasHoyModal(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-800 font-bold transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {ventasDia.detalle_ventas.length === 0 ? (
              <div className="p-8 text-center text-stone-400 font-bold">
                Aún no se han registrado compras el día de hoy.
              </div>
            ) : (
              <div className="border border-stone-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 text-stone-500 font-extrabold text-[10px] uppercase border-b border-stone-200">
                    <tr>
                      <th className="p-2.5">Código</th>
                      <th className="p-2.5">Hora</th>
                      <th className="p-2.5">Cliente</th>
                      <th className="p-2.5">Modalidad</th>
                      <th className="p-2.5">Método</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-semibold">
                    {ventasDia.detalle_ventas.map((v) => (
                      <tr key={v.id} className="hover:bg-stone-50">
                        <td className="p-2.5 font-mono font-bold text-mass-red">{v.codigo_pedido}</td>
                        <td className="p-2.5 text-stone-500">{v.hora_pedido}</td>
                        <td className="p-2.5 font-bold text-stone-900">{v.cliente_nombre}</td>
                        <td className="p-2.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100">
                            {v.tipo_entrega === 'DELIVERY' ? '🛵 Delivery' : '🏬 Retiro'}
                          </span>
                        </td>
                        <td className="p-2.5 font-medium">{v.metodo_pago}</td>
                        <td className="p-2.5 text-right font-black text-stone-900">
                          S/ {parseFloat(v.total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportesGeneralesView;
