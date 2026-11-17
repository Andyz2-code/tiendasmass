import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import api from '../../services/api';
import {
  Image,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  Building,
  Tag,
  AlertCircle
} from 'lucide-react';

export const BannerAdminView = () => {
  const { user, isAdmin, isSupervisor } = useAuth();
  const { sucursales, selectedBranch } = useBranch();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [previewBanner, setPreviewBanner] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    titulo: '',
    subtitulo: '',
    tag_promocion: 'OFERTAS BOMBA',
    precio_destacado: '',
    imagen_url: '',
    boton_texto: 'Comprar Ahora',
    boton_enlace: '#catalogo',
    sucursal_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    orden: 1,
    activo: 1
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
    void fetchBanners();
  }, []);

  const openCreateModal = () => {
    setEditingBanner(null);
    setFormData({
      titulo: '',
      subtitulo: '',
      tag_promocion: 'OFERTAS BOMBA',
      precio_destacado: '',
      imagen_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80',
      boton_texto: 'Comprar Ahora',
      boton_enlace: '#catalogo',
      sucursal_id: isSupervisor ? user?.sucursal_id || '' : '',
      fecha_inicio: '',
      fecha_fin: '',
      orden: banners.length + 1,
      activo: 1
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (banner) => {
    setEditingBanner(banner);
    setFormData({
      titulo: banner.titulo || '',
      subtitulo: banner.subtitulo || '',
      tag_promocion: banner.tag_promocion || 'OFERTAS BOMBA',
      precio_destacado: banner.precio_destacado || '',
      imagen_url: banner.imagen_url || '',
      boton_texto: banner.boton_texto || 'Comprar Ahora',
      boton_enlace: banner.boton_enlace || '#catalogo',
      sucursal_id: banner.sucursal_id || '',
      fecha_inicio: banner.fecha_inicio || '',
      fecha_fin: banner.fecha_fin || '',
      orden: banner.orden || 1,
      activo: banner.activo ?? 1
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleToggle = async (id) => {
    try {
      await api.patch(`/banners/${id}/toggle`);
      setSuccessMsg('Estado del banner actualizado');
      void fetchBanners();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este banner publicitario?')) return;
    try {
      await api.delete(`/banners/${id}`);
      setSuccessMsg('Banner eliminado con éxito');
      void fetchBanners();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Error al eliminar');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.titulo.trim()) {
      setErrorMsg('El título del banner es obligatorio.');
      return;
    }
    if (!formData.imagen_url.trim()) {
      setErrorMsg('La URL de la imagen es obligatoria.');
      return;
    }

    try {
      if (editingBanner) {
        await api.put(`/banners/${editingBanner.id}`, formData);
        setSuccessMsg('Banner actualizado correctamente');
      } else {
        await api.post('/banners', formData);
        setSuccessMsg('Banner creado correctamente');
      }
      setIsModalOpen(false);
      void fetchBanners();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar banner');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-stone-900 rounded-xl">
              <Image className="w-5 h-5 text-mass-red" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Gestión de Banners y Promociones
            </h1>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-1">
            {isAdmin
              ? 'Administre los banners globales para toda la cadena y promociones por sucursal.'
              : `Administración de promociones exclusivas para su sucursal asignada (${user?.sucursal_nombre || 'Local'}).`}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl shadow-xs transition flex items-center gap-2 self-start border border-amber-300"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Banner</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Lista / Grilla de Banners */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-48 bg-stone-200 rounded-2xl"></div>
          ))}
        </div>
      ) : banners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((b) => {
            const isGlobal = !b.sucursal_id;
            const canManage = isAdmin || (isSupervisor && b.sucursal_id === user?.sucursal_id);

            return (
              <div
                key={b.id}
                className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                {/* Imagen del Banner con Badges */}
                <div className="relative h-44 w-full bg-stone-900 overflow-hidden">
                  <img
                    src={b.imagen_url}
                    alt={b.titulo}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-black/20"></div>

                  {/* Badges superiores */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-mass-red text-white shadow">
                      {b.tag_promocion || 'OFERTA'}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                        isGlobal
                          ? 'bg-amber-400 text-stone-950'
                          : 'bg-stone-800 text-amber-300'
                      }`}
                    >
                      {isGlobal ? '🌐 Banner Global' : `🏢 ${b.sucursal_nombre || 'Sucursal'}`}
                    </span>
                  </div>

                  {/* Título en la imagen */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="font-extrabold text-sm sm:text-base leading-snug drop-shadow">
                      {b.titulo}
                    </h3>
                    {b.precio_destacado && (
                      <span className="text-xs font-black text-amber-300">
                        {b.precio_destacado}
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalles y Acciones */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-stone-600 line-clamp-2 font-medium">
                    {b.subtitulo || 'Sin descripción adicional.'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 font-semibold pt-2 border-t border-stone-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-400 font-bold">Orden:</span>
                      <span className="font-black text-stone-800">#{b.orden}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(b.id)}
                        disabled={!canManage}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black transition ${
                          b.activo == 1
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                        } disabled:opacity-50`}
                      >
                        {b.activo == 1 ? '● Activo' : '○ Inactivo'}
                      </button>
                    </div>
                  </div>

                  {/* Barra de Botones */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      onClick={() => setPreviewBanner(b)}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Vista Previa</span>
                    </button>

                    {canManage && (
                      <>
                        <button
                          onClick={() => openEditModal(b)}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => handleDelete(b.id)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-stone-200 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-stone-400 mx-auto stroke-1" />
          <h3 className="text-sm font-bold text-stone-900">No hay banners registrados</h3>
          <p className="text-xs text-stone-500">Comience agregando promociones y ofertas destacadas para sus clientes.</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-mass-yellow text-stone-950 font-black rounded-xl text-xs"
          >
            Crear Primer Banner
          </button>
        </div>
      )}

      {/* Modal de Registro / Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scroll">
            <h2 className="text-lg font-black text-stone-900">
              {editingBanner ? 'Editar Banner Publicitario' : 'Nuevo Banner Publicitario'}
            </h2>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label htmlFor="banner_titulo" className="font-bold text-stone-700 block mb-1">Título de la Promoción *</label>
                <input
                  id="banner_titulo"
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ej. ¡Precios Imbatibles en Abarrotes!"
                  className="w-full p-2.5 rounded-xl border border-stone-300 font-semibold focus:outline-none focus:border-mass-red"
                />
              </div>

              <div>
                <label htmlFor="banner_subtitulo" className="font-bold text-stone-700 block mb-1">Subtítulo / Mensaje Promocional</label>
                <textarea
                  id="banner_subtitulo"
                  rows="2"
                  value={formData.subtitulo}
                  onChange={(e) => setFormData({ ...formData, subtitulo: e.target.value })}
                  placeholder="Detalles de la promoción, marcas participantes y vigencia..."
                  className="w-full p-2.5 rounded-xl border border-stone-300 font-semibold focus:outline-none focus:border-mass-red"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="banner_tag" className="font-bold text-stone-700 block mb-1">Badge / Tag Promoción</label>
                  <input
                    id="banner_tag"
                    type="text"
                    value={formData.tag_promocion}
                    onChange={(e) => setFormData({ ...formData, tag_promocion: e.target.value })}
                    placeholder="Ej. 💥 OFERTAS BOMBA"
                    className="w-full p-2.5 rounded-xl border border-stone-300 font-semibold focus:outline-none focus:border-mass-red"
                  />
                </div>
                <div>
                  <label htmlFor="banner_precio" className="font-bold text-stone-700 block mb-1">Precio / Descuento Destacado</label>
                  <input
                    id="banner_precio"
                    type="text"
                    value={formData.precio_destacado}
                    onChange={(e) => setFormData({ ...formData, precio_destacado: e.target.value })}
                    placeholder="Ej. Desde S/ 1.90 o Hasta 30% DSCTO"
                    className="w-full p-2.5 rounded-xl border border-stone-300 font-semibold focus:outline-none focus:border-mass-red"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="banner_img_url" className="font-bold text-stone-700 block mb-1">URL de la Imagen *</label>
                <input
                  id="banner_img_url"
                  type="url"
                  required
                  value={formData.imagen_url}
                  onChange={(e) => setFormData({ ...formData, imagen_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 rounded-xl border border-stone-300 font-semibold focus:outline-none focus:border-mass-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="banner_btn_texto" className="font-bold text-stone-700 block mb-1">Texto del Botón</label>
                  <input
                    id="banner_btn_texto"
                    type="text"
                    value={formData.boton_texto}
                    onChange={(e) => setFormData({ ...formData, boton_texto: e.target.value })}
                    placeholder="Comprar Ahora"
                    className="w-full p-2.5 rounded-xl border border-stone-300 font-semibold focus:outline-none focus:border-mass-red"
                  />
                </div>
                <div>
                  <label htmlFor="banner_orden" className="font-bold text-stone-700 block mb-1">Orden de Visualización</label>
                  <input
                    id="banner_orden"
                    type="number"
                    min="1"
                    value={formData.orden}
                    onChange={(e) => setFormData({ ...formData, orden: Number.parseInt(e.target.value, 10) || 1 })}
                    className="w-full p-2.5 rounded-xl border border-stone-300 font-semibold focus:outline-none focus:border-mass-red"
                  />
                </div>
              </div>

              {/* Selector de Ámbito / Sucursal */}
              {isAdmin ? (
                <div>
                  <label htmlFor="banner_sucursal" className="font-bold text-stone-700 block mb-1">Ámbito de Visualización</label>
                  <select
                    id="banner_sucursal"
                    value={formData.sucursal_id}
                    onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-stone-300 font-semibold focus:outline-none focus:border-mass-red bg-white"
                  >
                    <option value="">🌐 Global (Todas las Tiendas Mass)</option>
                    {sucursales.map(s => (
                      <option key={s.id} value={s.id}>🏢 Solo {s.nombre}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-stone-800 text-[11px] font-bold">
                  🏢 Este banner se publicará exclusivamente para su sede asignada.
                </div>
              )}

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 font-bold text-stone-700 hover:bg-stone-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-mass-yellow hover:bg-amber-400 font-black text-stone-950 shadow-xs border border-amber-300"
                >
                  {editingBanner ? 'Guardar Cambios' : 'Registrar Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa */}
      {previewBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="font-black text-sm text-stone-900">Vista Previa del Banner</span>
              <button
                onClick={() => setPreviewBanner(null)}
                className="w-7 h-7 rounded-full bg-stone-100 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="relative h-64 rounded-2xl overflow-hidden bg-stone-900">
              <img src={previewBanner.imagen_url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/60 to-transparent"></div>
              <div className="absolute inset-0 p-6 flex flex-col justify-center items-start text-white space-y-2 max-w-lg">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-mass-red text-white uppercase">
                  {previewBanner.tag_promocion}
                </span>
                <h3 className="text-2xl font-black">{previewBanner.titulo}</h3>
                <p className="text-xs text-stone-200">{previewBanner.subtitulo}</p>
                <div className="pt-2 flex items-center gap-3">
                  {previewBanner.precio_destacado && (
                    <span className="text-base font-black text-amber-300">{previewBanner.precio_destacado}</span>
                  )}
                  <span className="px-4 py-2 bg-mass-yellow text-stone-950 font-black text-xs rounded-xl uppercase">
                    {previewBanner.boton_texto || 'Comprar Ahora'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
