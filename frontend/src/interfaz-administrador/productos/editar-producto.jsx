import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Modal } from '../../components/Modal';
import { Image, Upload, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export const ProductEditModal = ({ isOpen, onClose, product, sucursalId, onProductUpdated, categorias = [] }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    categoria_id: 1,
    codigo_sku: '',
    codigo_barras: '',
    precio_venta: '',
    costo_base: '',
    stock_actual: '',
    unidad_medida: 'UNIDAD',
    es_perecedero: 0,
    imagen_url: ''
  });

  const [imagePreview, setImagePreview] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        nombre: product.nombre || '',
        descripcion: product.descripcion || '',
        categoria_id: product.categoria_id || 1,
        codigo_sku: product.codigo_sku || '',
        codigo_barras: product.codigo_barras || '',
        precio_venta: product.precio_venta || '',
        costo_base: product.costo_base || '',
        stock_actual: product.stock_actual !== undefined ? product.stock_actual : 50,
        unidad_medida: product.unidad_medida || 'UNIDAD',
        es_perecedero: product.es_perecedero ? 1 : 0,
        imagen_url: product.imagen_url || ''
      });
      setImagePreview(product.imagen_url || '');
      setSelectedImageFile(null);
      setError('');
      setSuccessMsg('');
    }
  }, [product]);

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de peso (máximo 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen supera el peso máximo permitido de 5 MB.');
      return;
    }

    // Validación de tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Formato no permitido. Solo se aceptan archivos JPG, PNG o WEBP.');
      return;
    }

    setError('');
    setSelectedImageFile(file);

    // Vista previa inmediata en navegador
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product) return;

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      let finalImageUrl = formData.imagen_url;

      // Si el usuario seleccionó un archivo nuevo, subirlo primero
      if (selectedImageFile) {
        setUploadingImage(true);
        const uploadFormData = new FormData();
        uploadFormData.append('image', selectedImageFile);

        const uploadRes = await api.post('/upload/image', uploadFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        finalImageUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
        setUploadingImage(false);
      }

      // Enviar actualización del producto con la imagen (nueva o conservada)
      const payload = {
        ...formData,
        categoria_id: Number(formData.categoria_id),
        precio_venta: Number(formData.precio_venta),
        costo_base: Number(formData.costo_base),
        es_perecedero: Number(formData.es_perecedero),
        imagen_url: finalImageUrl,
        sucursal_id: sucursalId ? Number(sucursalId) : undefined,
        stock_actual: formData.stock_actual !== '' ? Number(formData.stock_actual) : undefined
      };

      const res = await api.put(`/productos/${product.id}`, payload);
      setSuccessMsg('Producto actualizado con éxito.');

      setTimeout(() => {
        onProductUpdated && onProductUpdated(res.data?.data || res.data);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al actualizar producto');
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Editar Producto: ${product?.nombre || ''}`} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl flex items-center gap-2 font-bold animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Sección de Imagen con Vista Previa */}
        <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
          <label className="block font-bold text-stone-800 flex items-center gap-1.5">
            <Image className="w-4 h-4 text-amber-600" />
            <span>Imagen del Producto (Formato JPG, PNG, WEBP · Máx 5MB)</span>
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Contenedor de Vista Previa */}
            <div className="w-24 h-24 rounded-2xl border-2 border-stone-300 overflow-hidden bg-white shrink-0 shadow-sm flex items-center justify-center relative">
              {imagePreview ? (
                <img
                  src={imagePreview.startsWith('http') || imagePreview.startsWith('data:') ? imagePreview : `/tiendasmass/frontend/${imagePreview}`}
                  alt="Vista previa"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400'; }}
                />
              ) : (
                <span className="text-[10px] text-stone-400 font-bold">Sin imagen</span>
              )}
            </div>

            {/* Selector de Archivo e Información */}
            <div className="flex-1 space-y-1.5 w-full">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileChange}
                className="w-full text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
              />
              <p className="text-[11px] text-stone-500">
                {selectedImageFile ? (
                  <span className="text-emerald-700 font-bold">✓ Nueva imagen lista: {selectedImageFile.name} ({(selectedImageFile.size / 1024).toFixed(0)} KB)</span>
                ) : (
                  <span>Si no seleccionas un archivo nuevo, se <strong>conservará la imagen actual</strong> del producto.</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Campos del Producto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-stone-700 mb-1">Nombre Comercial:</label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Categoría:</label>
            <select
              value={formData.categoria_id}
              onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none font-bold"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Código SKU:</label>
            <input
              type="text"
              required
              value={formData.codigo_sku}
              onChange={(e) => setFormData({ ...formData, codigo_sku: e.target.value.toUpperCase() })}
              className="w-full p-2 border border-stone-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Código de Barras:</label>
            <input
              type="text"
              required
              value={formData.codigo_barras}
              onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Precio de Venta (S/.):</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formData.precio_venta}
              onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl font-bold text-stone-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Costo Base / Compra (S/.):</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formData.costo_base}
              onChange={(e) => setFormData({ ...formData, costo_base: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Stock Actual (Sucursal):</label>
            <input
              type="number"
              min="0"
              value={formData.stock_actual}
              onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Unidad de Medida:</label>
            <select
              value={formData.unidad_medida}
              onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
              className="w-full p-2 border border-stone-300 rounded-xl font-bold"
            >
              <option value="UNIDAD">UNIDAD</option>
              <option value="BOLSA">BOLSA</option>
              <option value="BOTELLA">BOTELLA</option>
              <option value="LATA">LATA</option>
              <option value="PAQUETE">PAQUETE</option>
              <option value="KG">KILOGRAMO (KG)</option>
              <option value="LITRO">LITRO</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-bold text-stone-700 mb-1">Descripción del Producto:</label>
          <textarea
            rows="2"
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            className="w-full p-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="perecedero_chk"
            checked={!!formData.es_perecedero}
            onChange={(e) => setFormData({ ...formData, es_perecedero: e.target.checked ? 1 : 0 })}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
          />
          <label htmlFor="perecedero_chk" className="font-bold text-stone-700 cursor-pointer">
            Producto perecedero (Requiere control estricto de fecha de vencimiento y rotación PEPS)
          </label>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 font-bold text-stone-700 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || uploadingImage}
            className="px-5 py-2 rounded-xl bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black shadow-md transition flex items-center gap-2 disabled:opacity-50"
          >
            {(loading || uploadingImage) && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>{loading ? 'Guardando Cambios...' : 'Guardar Producto'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
