import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { ProductEditModal } from './ProductEditModal';
import { ExcelImportModal } from './ExcelImportModal';
import {
  Package,
  Plus,
  FileSpreadsheet,
  Download,
  Edit2,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Boxes
} from 'lucide-react';

export const ProductosAdminView = () => {
  const { user, isAdmin, isSupervisor } = useAuth();
  const { selectedBranch } = useBranch();

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');

  // Modales
  const [editingProduct, setEditingProduct] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Formulario de creación
  const [newProductForm, setNewProductForm] = useState({
    categoria_id: 1,
    codigo_sku: '',
    codigo_barras: '',
    nombre: '',
    descripcion: '',
    unidad_medida: 'UNIDAD',
    precio_venta: '',
    costo_base: '',
    stock_inicial: 50,
    es_perecedero: 0,
    imagen_url: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const fetchProductos = async () => {
    if (!selectedBranch?.id) return;
    setLoading(true);
    try {
      let query = `?sucursal_id=${selectedBranch.id}`;
      if (categoriaFilter) query += `&categoria_id=${categoriaFilter}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;

      const [pRes, cRes] = await Promise.all([
        api.get(`/productos${query}`),
        api.get('/categorias')
      ]);

      setProductos(pRes.data?.data || pRes.data || []);
      setCategorias(cRes.data?.data || cRes.data || []);
    } catch (err) {
      console.error('Error al cargar productos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, [selectedBranch, categoriaFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProductos();
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setIsEditModalOpen(true);
  };

  const handleProductSaved = () => {
    setFeedbackMsg('Producto actualizado y sincronizado en el catálogo.');
    setTimeout(() => setFeedbackMsg(''), 4000);
    fetchProductos();
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await api.post('/productos', newProductForm);
      setIsCreateModalOpen(false);
      setFeedbackMsg(`Producto "${newProductForm.nombre}" creado exitosamente.`);
      setTimeout(() => setFeedbackMsg(''), 4000);
      setNewProductForm({
        categoria_id: 1,
        codigo_sku: '',
        codigo_barras: '',
        nombre: '',
        descripcion: '',
        unidad_medida: 'UNIDAD',
        precio_venta: '',
        costo_base: '',
        stock_inicial: 50,
        es_perecedero: 0,
        imagen_url: ''
      });
      fetchProductos();
    } catch (err) {
      alert('Error al registrar producto: ' + (err.response?.data?.message || err.message));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "codigo_sku,codigo_barras,nombre,descripcion,categoria,precio_venta,costo_base,stock_inicial,unidad_medida,es_perecedero,imagen_url\n" +
      "SKU-ARR-010,7750123450011,Arroz Extra Costeño 1kg,Arroz seleccionado de grano largo,Abarrotes y Despensa,4.80,3.70,80,BOLSA,0,https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400\n" +
      "SKU-BEB-011,7750123450022,Agua Mineral San Luis 625ml,Agua de mesa sin gas,Bebidas y Licores,2.00,1.30,120,BOTELLA,0,https://images.unsplash.com/photo-1559839914-ba2ac55d683a?w=400\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Plantilla_Oficial_Importacion_Productos_Mass.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-mass-red" />
            <span>Gestión & Edición del Catálogo Maestro</span>
          </h1>
          <p className="text-xs text-stone-500">
            Administre productos, edite precios, actualice imágenes o realice importaciones masivas con plantilla Excel.
          </p>
        </div>

        {/* Botones de Acción de Cabecera */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            title="Descargar plantilla de Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Plantilla Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar productos desde Excel</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black text-xs shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-stone-900 text-white font-bold rounded-xl hover:bg-black transition"
          >
            Buscar
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-stone-400 shrink-0" />
          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            className="p-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-400 w-full sm:w-48"
          >
            <option value="">Todas las Categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden text-xs">
        <div className="p-4 bg-stone-50 border-b flex justify-between items-center font-bold text-stone-700">
          <span>Catálogo de Productos ({productos.length})</span>
          <span className="text-stone-500 font-normal">Sede: {selectedBranch?.nombre || 'Huancayo'}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2 font-bold">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
            <span>Cargando productos...</span>
          </div>
        ) : productos.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <Boxes className="w-8 h-8 mx-auto text-stone-300" />
            <p className="font-bold">No se encontraron productos coincidentes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] font-bold border-b">
                <tr>
                  <th className="p-3">Foto</th>
                  <th className="p-3">SKU / Barras</th>
                  <th className="p-3">Nombre del Producto</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3 text-right">Precio Venta</th>
                  <th className="p-3 text-right">Costo Base</th>
                  <th className="p-3 text-right">Stock Actual</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {productos.map((prod) => (
                  <tr key={prod.id} className="hover:bg-amber-50/40 transition">
                    <td className="p-3">
                      <div className="w-12 h-12 rounded-xl border bg-white overflow-hidden p-1 shrink-0">
                        <img
                          src={prod.imagen_url?.startsWith('http') ? prod.imagen_url : `/tiendasmass/frontend/${prod.imagen_url || 'assets/logo-mass.jpg'}`}
                          alt={prod.nombre}
                          className="w-full h-full object-contain"
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400'; }}
                        />
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      <div className="font-bold text-stone-900">{prod.codigo_sku}</div>
                      <div className="text-[10px] text-stone-400">{prod.codigo_barras}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-stone-900">{prod.nombre}</div>
                      <div className="text-[10px] text-stone-500 truncate max-w-xs">{prod.descripcion || 'Sin descripción'}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 font-bold text-[10px] text-stone-700 border border-stone-200">
                        {prod.categoria_nombre || 'General'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-stone-900">
                      S/. {parseFloat(prod.precio_venta || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-stone-500 font-mono">
                      S/. {parseFloat(prod.costo_base || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-black">
                      <span className={`px-2 py-0.5 rounded-lg text-xs ${
                        (prod.stock_actual || 0) <= 0
                          ? 'bg-red-100 text-red-700'
                          : (prod.stock_actual || 0) <= 10
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {prod.stock_actual || 0}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-xs transition border border-amber-300 shadow-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edición de Producto */}
      <ProductEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        product={editingProduct}
        sucursalId={selectedBranch?.id}
        categorias={categorias}
        onProductUpdated={handleProductSaved}
      />

      {/* Modal de Importación Masiva Excel */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        sucursalId={selectedBranch?.id}
        categorias={categorias}
        onImportCompleted={fetchProductos}
      />
    </div>
  );
};
