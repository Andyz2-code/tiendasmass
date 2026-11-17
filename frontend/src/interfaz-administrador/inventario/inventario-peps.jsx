import React, { useState, useEffect } from 'react';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import { DataTable } from '../../components/DataTable';
import { AbcBadge, StockStatusBadge } from '../../components/AlertBadge';
import { Boxes, Layers, History, RefreshCw, FileText } from 'lucide-react';

export const InventarioView = () => {
  const { selectedBranch } = useBranch();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'lotes' | 'kardex'
  const [inventario, setInventario] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [kardex, setKardex] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!selectedBranch?.id) return;
    setLoading(true);
    try {
      if (activeTab === 'stock') {
        const res = await api.get(`/inventarios?sucursal_id=${selectedBranch.id}`);
        setInventario(res.data || []);
      } else if (activeTab === 'lotes') {
        const res = await api.get(`/lotes?sucursal_id=${selectedBranch.id}`);
        setLotes(res.data || []);
      } else if (activeTab === 'kardex') {
        const res = await api.get(`/inventarios/kardex?sucursal_id=${selectedBranch.id}`);
        setKardex(res.data || []);
      }
    } catch (err) {
      console.error('Error al cargar datos de inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [selectedBranch, activeTab]);

  // Columnas para Stock Consolidado
  const stockColumns = [
    { header: 'SKU / Código', accessor: 'codigo_sku', render: (r) => <span className="font-mono text-xs">{r.codigo_sku}</span> },
    { header: 'Producto', accessor: 'producto_nombre', render: (r) => <span className="font-bold text-stone-900">{r.producto_nombre}</span> },
    { header: 'Categoría', accessor: 'categoria_nombre' },
    { header: 'Stock Actual', accessor: 'stock_actual', render: (r) => <span className="font-extrabold text-sm text-stone-900">{r.stock_actual} un.</span> },
    { header: 'P. Reorden (POR)', accessor: 'punto_reorden' },
    { header: 'Clasificación ABC', accessor: 'clasificacion_abc', render: (r) => <AbcBadge clase={r.clasificacion_abc} /> },
    { header: 'Costo Base', accessor: 'costo_base', render: (r) => `S/. ${Number.parseFloat(r.costo_base).toFixed(2)}` },
    { header: 'Precio Venta', accessor: 'precio_venta', render: (r) => `S/. ${Number.parseFloat(r.precio_venta).toFixed(2)}` }
  ];

  // Columnas para Lotes y Caducidades
  const lotesColumns = [
    { header: 'Código Lote', accessor: 'codigo_lote', render: (r) => <span className="font-mono font-bold text-xs">{r.codigo_lote}</span> },
    { header: 'Producto', accessor: 'producto_nombre', render: (r) => <span className="font-bold text-stone-900">{r.producto_nombre}</span> },
    { header: 'Fecha Ingreso', accessor: 'fecha_ingreso' },
    { header: 'Fecha Vencimiento', accessor: 'fecha_vencimiento', render: (r) => r.fecha_vencimiento || 'No perecedero' },
    { header: 'Disponible / Inicial', accessor: 'cantidad_disponible', render: (r) => <span className="font-bold">{r.cantidad_disponible} / {r.cantidad_inicial} un.</span> },
    { header: 'Ubicación Almacén', accessor: 'ubicacion_almacen' },
    {
      header: 'Estado Lote',
      accessor: 'estado',
      render: (r) => (
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
          r.estado === 'DISPONIBLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
        }`}>
          {r.estado}
        </span>
      )
    }
  ];

  // Columnas para Kardex Físico-Valorado
  const kardexColumns = [
    { header: 'Fecha / Hora', accessor: 'created_at', render: (r) => <span className="text-[11px] text-stone-500">{r.created_at}</span> },
    { header: 'Producto', accessor: 'producto_nombre', render: (r) => <span className="font-bold text-stone-900">{r.producto_nombre}</span> },
    {
      header: 'Tipo Movimiento',
      accessor: 'tipo_movimiento',
      render: (r) => {
        const isEntrada = r.tipo_movimiento.includes('ENTRADA');
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}>
            {r.tipo_movimiento}
          </span>
        );
      }
    },
    { header: 'Referencia / Doc.', accessor: 'documento_referencia' },
    { header: 'Cantidad', accessor: 'cantidad', render: (r) => <span className="font-bold">{r.cantidad}</span> },
    { header: 'Saldo Ant.', accessor: 'saldo_anterior' },
    { header: 'Saldo Nuevo', accessor: 'saldo_nuevo', render: (r) => <span className="font-bold text-stone-950">{r.saldo_nuevo}</span> },
    { header: 'Observaciones', accessor: 'observaciones', render: (r) => <span className="text-stone-500 text-xs">{r.observaciones}</span> }
  ];

  return (
    <div className="space-y-6">
      {/* Header y Selector de Pestañas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Control de Inventario y Kardex Físico-Valorado
          </h1>
          <p className="text-xs text-stone-500">
            Sucursal: <span className="font-bold text-stone-800">{selectedBranch?.nombre}</span> – Trazabilidad completa bajo el principio PEPS (NIC 2).
          </p>
        </div>

        <button
          onClick={() => { void fetchData(); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 shadow-sm transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refrescar</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 gap-2">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'stock'
              ? 'border-mass-red text-stone-950'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <Boxes className="w-4 h-4 text-mass-red" />
          <span>Stock Consolidado ({inventario.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('lotes')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'lotes'
              ? 'border-mass-red text-stone-950'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-500" />
          <span>Lotes & Vencimientos PEPS ({lotes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('kardex')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'kardex'
              ? 'border-mass-red text-stone-950'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <History className="w-4 h-4 text-blue-600" />
          <span>Kardex Físico-Valorado ({kardex.length})</span>
        </button>
      </div>

      {/* Tablas correspondientes */}
      {activeTab === 'stock' && (
        <DataTable columns={stockColumns} data={inventario} searchPlaceholder="Buscar por producto, SKU..." />
      )}

      {activeTab === 'lotes' && (
        <DataTable columns={lotesColumns} data={lotes} searchPlaceholder="Buscar lote, producto, ubicación..." />
      )}

      {activeTab === 'kardex' && (
        <DataTable columns={kardexColumns} data={kardex} searchPlaceholder="Buscar movimiento, producto, referencia..." />
      )}
    </div>
  );
};
