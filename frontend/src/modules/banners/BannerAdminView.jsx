import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import axios from 'axios';
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  Building,
  Tag,
  AlertCircle,
  Upload,
  RefreshCw,
  X
} from 'lucide-react';

export const BannerAdminView = () => {
  const { user, isAdmin } = useAuth();
  const { sucursales, selectedBranch } = useBranch();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    titulo: '',
    subtitulo: '',
    tag_promocion: 'OFERTAS BOMBA',
    precio_destacado: '',
    imagen_url: '',
    boton_texto: 'Comprar Ahora',
    boton_enlace: '#catalogo',
    sucursal_id: '',
    orden: 1,
    activo: 1,
    fecha_inicio: '',
    fecha_fin: ''
  });

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await api.get('/banners/admin');
      setBanners(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Error al cargar banners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleToggle = async (id) => {
    try {
      await api.patch(`/banners/${id}/toggle`);
      fetchBanners();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Desea eliminar este banner publicitario?')) return;
    try {
      await api.delete(`/banners/${id}`);
      fetchBanners();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'tiff', 'tif'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!allowed.includes(ext)) {
      alert(`Formato no compatible (.${ext}). Seleccione JPG, PNG, GIF, WebP, AVIF, SVG, BMP o TIFF.`);
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen no debe superar los 8 MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPreviewUrl(editingBanner?.imagen_url || '');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      let finalUrl = formData.imagen_url;

      if (selectedFile) {
        const uploadData = new FormData();
        uploadData.append('banner_image', selectedFile);

        const token = localStorage.getItem('mass_admin_token');
        const uploadRes = await axios.post('http://localhost/tiendasmass/backend/public/api/upload/banner', uploadData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        });

        finalUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
      }

      if (!finalUrl && !editingBanner) {
        alert('Debe cargar una imagen para el banner.');
        setIsUploading(false);
        return;
      }

      const payload = {
        ...formData,
        imagen_url: finalUrl || editingBanner?.imagen_url
      };

      if (!isAdmin && user?.sucursal_id) payload.sucursal_id = user.sucursal_id;

      if (editingBanner) {
        await api.put(`/banners/${editingBanner.id}`, payload);
      } else {
        await api.post('/banners', payload);
      }

      setIsModalOpen(false);
      setSelectedFile(null);
      fetchBanners();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 rounded-xl text-lg">🖼️</span>
            <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">Gestión de Banners Promocionales</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Cargue imágenes directamente desde su equipo sin depender de URLs externas (JPG, PNG, WebP, SVG, AVIF, GIF).
          </p>
        </div>
        <button
          onClick={() => {
            setEditingBanner(null);
            setSelectedFile(null);
            setPreviewUrl('');
            setFormData({
              titulo: '',
              subtitulo: '',
              tag_promocion: 'OFERTAS BOMBA',
              precio_destacado: '',
              imagen_url: '',
              boton_texto: 'Comprar Ahora',
              boton_enlace: '#catalogo',
              sucursal_id: !isAdmin ? user?.sucursal_id : '',
              orden: banners.length + 1,
              activo: 1,
              fecha_inicio: '',
              fecha_fin: ''
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-mass-yellow hover:bg-amber-400 font-extrabold text-stone-950 rounded-xl text-xs shadow-xs border border-amber-300 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Banner</span>
        </button>
      </div>

      {/* Grid de Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {banners.map((b) => (
          <div key={b.id} className="bg-white rounded-3xl border overflow-hidden shadow-xs flex flex-col justify-between">
            <div className="relative h-48 bg-stone-950 overflow-hidden">
              <img src={b.imagen_url} alt={b.titulo} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent"></div>
              <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                <span className="px-2.5 py-1 bg-mass-red text-white text-[10px] font-black rounded-full uppercase">
                  {b.tag_promocion}
                </span>
                <span className="px-2.5 py-1 bg-stone-900 text-amber-300 text-[10px] font-black rounded-full border border-stone-700">
                  {b.sucursal_id ? `🏢 ${b.sucursal_nombre}` : '🌐 Global'}
                </span>
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <h3 className="font-extrabold text-base">{b.titulo}</h3>
                {b.precio_destacado && <span className="text-xs font-black text-amber-300">{b.precio_destacado}</span>}
              </div>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-stone-600 line-clamp-2">{b.subtitulo}</p>
              <div className="flex justify-between items-center pt-2 border-t">
                <button
                  onClick={() => handleToggle(b.id)}
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${b.activo == 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-400'}`}
                >
                  {b.activo == 1 ? '● Activo' : '○ Inactivo'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingBanner(b);
                      setSelectedFile(null);
                      setPreviewUrl(b.imagen_url || '');
                      setFormData({ ...b });
                      setIsModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-amber-50 text-amber-900 rounded-lg text-xs font-bold"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Carga de Banner */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-xs shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b">
              <h2 className="text-base font-extrabold text-stone-900">{editingBanner ? 'Editar Banner' : 'Registrar Nuevo Banner'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="font-bold block mb-1">Título de la Promoción *</label>
                <input
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full p-2.5 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Subtítulo / Mensaje Promocional</label>
                <textarea
                  rows="2"
                  value={formData.subtitulo || ''}
                  onChange={e => setFormData({ ...formData, subtitulo: e.target.value })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Tag Promoción</label>
                  <input
                    type="text"
                    value={formData.tag_promocion}
                    onChange={e => setFormData({ ...formData, tag_promocion: e.target.value })}
                    className="w-full p-2 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Precio Destacado</label>
                  <input
                    type="text"
                    value={formData.precio_destacado || ''}
                    onChange={e => setFormData({ ...formData, precio_destacado: e.target.value })}
                    className="w-full p-2 border rounded-xl font-bold"
                  />
                </div>
              </div>

              {/* Selector Visual de Imagen */}
              <div className="p-4 bg-stone-50 border-2 border-dashed rounded-2xl space-y-3">
                <label className="font-extrabold text-stone-900 block">Cargar Imagen desde Computadora *</label>
                {previewUrl ? (
                  <div className="space-y-2">
                    <div className="h-44 rounded-xl overflow-hidden border bg-stone-950 flex items-center justify-center">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold"
                      >
                        Cambiar Imagen
                      </button>
                      {selectedFile && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-200"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <Upload className="w-8 h-8 mx-auto text-amber-500" />
                    <div className="font-bold text-stone-800">Cargar archivo de imagen local</div>
                    <p className="text-[11px] text-stone-500">Formatos: JPG, PNG, GIF, WebP, AVIF, SVG (sanitizado), BMP, TIFF</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-mass-yellow font-extrabold text-stone-950 rounded-xl"
                    >
                      Explorar archivos
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,.webp,.avif,.svg,.bmp,.tiff"
                  className="hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold">Cancelar</button>
                <button type="submit" disabled={isUploading} className="px-5 py-2 bg-mass-yellow text-stone-950 font-extrabold rounded-xl">
                  {isUploading ? 'Subiendo...' : 'Guardar Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannerAdminView;
