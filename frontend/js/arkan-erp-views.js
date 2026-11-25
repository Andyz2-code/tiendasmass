/**
 * Módulos ERP de ARKAN integrados en Arkenya (Backoffice Admin & Supervisor)
 * Sin módulos de POS ni Ventas en caja. Control estricto por rol (isAdmin).
 */
(function () {
  const { useState, useEffect } = React;

  // =========================================================================
  // 1. COMPRAS, PROVEEDORES (CONSULTA RUC) Y CUENTAS POR PAGAR
  // =========================================================================
  window.ArkanComprasView = function ({ branch, user, sucursales }) {
    const isAdmin = user?.rol_nombre === 'Administrador';
    const [tab, setTab] = useState('compras');
    const [compras, setCompras] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(false);

    // Nueva Compra
    const [proveedorId, setProveedorId] = useState('');
    const [tipoComp, setTipoComp] = useState('FACTURA');
    const [numComp, setNumComp] = useState('F001-' + Math.floor(1000 + Math.random() * 9000));
    const [condicionPago, setCondicionPago] = useState('CONTADO');
    const [itemsCompra, setItemsCompra] = useState([]);
    const [selProdId, setSelProdId] = useState('');
    const [selCant, setSelCant] = useState(10);
    const [selCosto, setSelCosto] = useState(3.5);
    const [selVence, setSelVence] = useState('');

    // Nuevo Proveedor
    const [provDoc, setProvDoc] = useState('');
    const [provRazon, setProvRazon] = useState('');
    const [provDir, setProvDir] = useState('');
    const [provTel, setProvTel] = useState('');
    const [provContacto, setProvContacto] = useState('');

    const loadAll = async () => {
      setLoading(true);
      try {
        const [cRes, pRes, prRes] = await Promise.all([
          api.get(`/compras${branch?.id ? `?sucursal_id=${branch.id}` : ''}`),
          api.get('/proveedores'),
          api.get('/productos')
        ]);
        setCompras(cRes.data || []);
        setProveedores(pRes.data || []);
        setProductos(prRes.data || []);
        if ((pRes.data || []).length > 0 && !proveedorId) {
          setProveedorId(String(pRes.data[0].id));
        }
        if ((prRes.data || []).length > 0 && !selProdId) {
          setSelProdId(String(prRes.data[0].id));
          setSelCosto(Number(prRes.data[0].costo_base || 3.5));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => { loadAll(); }, [branch?.id]);

    const handleAddItem = () => {
      const prod = productos.find(p => String(p.id) === String(selProdId));
      if (!prod || selCant <= 0) return;
      setItemsCompra(prev => [
        ...prev,
        {
          producto_id: prod.id,
          nombre: prod.nombre,
          cantidad: Number(selCant),
          costo_unitario: Number(selCosto),
          fecha_vencimiento: selVence || null
        }
      ]);
    };

    const handleSaveCompra = async (e) => {
      e.preventDefault();
      if (!proveedorId || itemsCompra.length === 0) {
        alert('Selecciona proveedor y agrega al menos un producto.');
        return;
      }
      try {
        await api.post('/compras', {
          sucursal_id: branch?.id || 1,
          proveedor_id: Number(proveedorId),
          tipo_comprobante: tipoComp,
          numero_comprobante: numComp,
          condicion_pago: condicionPago,
          items: itemsCompra
        });
        alert('✅ Compra registrada. Stock actualizado automáticamente en Lotes PEPS y Kardex.');
        setItemsCompra([]);
        setNumComp('F001-' + Math.floor(1000 + Math.random() * 9000));
        setTab('compras');
        loadAll();
      } catch (err) {
        alert(err.message || 'Error al registrar compra');
      }
    };

    const handleLookupRuc = async () => {
      if (!provDoc || provDoc.length < 8) {
        alert('Ingresa un RUC (11 dígitos) o DNI (8 dígitos).');
        return;
      }
      try {
        const res = await api.get(`/proveedores/lookup/${provDoc}`);
        if (res.data) {
          setProvRazon(res.data.razon_social || '');
          setProvDir(res.data.direccion || '');
        }
      } catch (err) {
        alert(err.message);
      }
    };

    const handleSaveProveedor = async (e) => {
      e.preventDefault();
      try {
        await api.post('/proveedores', {
          numero_documento: provDoc,
          razon_social: provRazon,
          direccion: provDir,
          telefono: provTel,
          contacto_nombre: provContacto
        });
        alert('✅ Proveedor registrado correctamente.');
        setProvDoc(''); setProvRazon(''); setProvDir(''); setProvTel(''); setProvContacto('');
        loadAll();
      } catch (err) {
        alert(err.message);
      }
    };

    const handlePagarCompra = async (id) => {
      if (!confirm('¿Confirmar pago de esta cuenta por pagar?')) return;
      try {
        await api.patch(`/compras/${id}/pagar`);
        loadAll();
      } catch (err) {
        alert(err.message);
      }
    };

    const totalCompra = itemsCompra.reduce((s, it) => s + (it.cantidad * it.costo_unitario), 0);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-stone-900">Compras, Proveedores & Recepción PEPS</h1>
            <p className="text-xs text-stone-500">
              Sucursal: <strong>{branch?.nombre}</strong> • Perfil: <span className="font-bold text-amber-700">{user?.rol_nombre}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <button onClick={() => setTab('compras')} className={`px-3.5 py-2 rounded-xl ${tab === 'compras' ? 'bg-stone-900 text-amber-300' : 'bg-white border border-stone-200'}`}>📋 Listado Compras</button>
            <button onClick={() => setTab('nueva')} className={`px-3.5 py-2 rounded-xl ${tab === 'nueva' ? 'bg-mass-yellow text-stone-950 font-extrabold' : 'bg-white border border-stone-200'}`}>➕ Nueva Compra</button>
            <button onClick={() => setTab('proveedores')} className={`px-3.5 py-2 rounded-xl ${tab === 'proveedores' ? 'bg-stone-900 text-amber-300' : 'bg-white border border-stone-200'}`}>🏢 Proveedores ({proveedores.length})</button>
            {isAdmin && (
              <button onClick={() => setTab('pagar')} className={`px-3.5 py-2 rounded-xl ${tab === 'pagar' ? 'bg-red-600 text-white' : 'bg-white border border-stone-200'}`}>💳 Cuentas por Pagar</button>
            )}
          </div>
        </div>

        {tab === 'compras' && (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-x-auto shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-900 text-stone-200 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Comprobante</th>
                  <th className="p-3">Condición</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {compras.length === 0 ? (
                  <tr><td colSpan="7" className="p-6 text-center text-stone-400">No hay compras registradas en esta sucursal.</td></tr>
                ) : compras.map(c => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="p-3 font-mono font-bold">{c.codigo_compra}</td>
                    <td className="p-3">{c.fecha_compra}</td>
                    <td className="p-3 font-semibold">{c.proveedor_nombre} <span className="text-[10px] text-stone-400">({c.proveedor_ruc})</span></td>
                    <td className="p-3">{c.tipo_comprobante} {c.numero_comprobante}</td>
                    <td className="p-3">{c.condicion_pago}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.estado_pago === 'PAGADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {c.estado_pago}
                      </span>
                    </td>
                    <td className="p-3 text-right font-extrabold">S/ {Number(c.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'nueva' && (
          <form onSubmit={handleSaveCompra} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-bold text-stone-600 block mb-1">Proveedor</label>
                <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className="w-full border rounded-xl p-2 bg-stone-50 font-semibold">
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-600 block mb-1">Tipo Comprobante</label>
                <select value={tipoComp} onChange={e => setTipoComp(e.target.value)} className="w-full border rounded-xl p-2 bg-stone-50 font-semibold">
                  <option value="FACTURA">FACTURA</option>
                  <option value="BOLETA">BOLETA</option>
                  <option value="GUIA">GUÍA DE REMISIÓN</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-600 block mb-1">N° Comprobante</label>
                <input value={numComp} onChange={e => setNumComp(e.target.value)} className="w-full border rounded-xl p-2" required />
              </div>
              <div>
                <label className="font-bold text-stone-600 block mb-1">Condición de Pago</label>
                <select value={condicionPago} onChange={e => setCondicionPago(e.target.value)} className="w-full border rounded-xl p-2 bg-stone-50 font-semibold">
                  <option value="CONTADO">CONTADO</option>
                  <option value="CREDITO">CRÉDITO (30 días)</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-end text-xs">
              <div className="md:col-span-2">
                <label className="font-bold text-stone-600 block mb-1">Producto</label>
                <select
                  value={selProdId}
                  onChange={e => {
                    setSelProdId(e.target.value);
                    const found = productos.find(x => String(x.id) === e.target.value);
                    if (found) setSelCosto(Number(found.costo_base || 3.5));
                  }}
                  className="w-full border rounded-xl p-2 bg-white font-semibold"
                >
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.codigo_sku})</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-600 block mb-1">Cantidad</label>
                <input type="number" min="1" value={selCant} onChange={e => setSelCant(e.target.value)} className="w-full border rounded-xl p-2 bg-white" />
              </div>
              <div>
                <label className="font-bold text-stone-600 block mb-1">Costo Unit. (S/)</label>
                <input type="number" step="0.01" min="0.1" value={selCosto} onChange={e => setSelCosto(e.target.value)} className="w-full border rounded-xl p-2 bg-white" />
              </div>
              <div>
                <button type="button" onClick={handleAddItem} className="w-full py-2 bg-stone-900 text-amber-300 font-extrabold rounded-xl hover:bg-black">
                  + Agregar Ítem
                </button>
              </div>
            </div>

            {itemsCompra.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-stone-100 text-stone-600">
                    <tr>
                      <th className="p-2.5 text-left">Producto</th>
                      <th className="p-2.5 text-right">Cant.</th>
                      <th className="p-2.5 text-right">Costo Unit.</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                      <th className="p-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {itemsCompra.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-semibold">{it.nombre}</td>
                        <td className="p-2.5 text-right">{it.cantidad}</td>
                        <td className="p-2.5 text-right">S/ {it.costo_unitario.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold">S/ {(it.cantidad * it.costo_unitario).toFixed(2)}</td>
                        <td className="p-2.5 text-right">
                          <button type="button" onClick={() => setItemsCompra(itemsCompra.filter((_, i) => i !== idx))} className="text-red-600 font-bold">Quitar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-3 bg-stone-50 flex items-center justify-between">
                  <span className="text-sm font-black text-stone-900">Total Compra: S/ {totalCompra.toFixed(2)}</span>
                  <button type="submit" className="px-5 py-2.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs shadow">
                    Guardar Compra e Ingresar Stock PEPS
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {tab === 'proveedores' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <form onSubmit={handleSaveProveedor} className="bg-white p-5 rounded-2xl border border-stone-200 space-y-3 text-xs">
              <h3 className="font-extrabold text-sm text-stone-900">Registrar Proveedor (RUC/DNI)</h3>
              <div className="flex gap-2">
                <input placeholder="RUC (11) o DNI (8)" value={provDoc} onChange={e => setProvDoc(e.target.value)} className="flex-1 border rounded-xl p-2" required />
                <button type="button" onClick={handleLookupRuc} className="px-3 py-2 bg-stone-900 text-amber-300 font-bold rounded-xl">🔍 SUNAT</button>
              </div>
              <input placeholder="Razón Social" value={provRazon} onChange={e => setProvRazon(e.target.value)} className="w-full border rounded-xl p-2" required />
              <input placeholder="Dirección Fiscal" value={provDir} onChange={e => setProvDir(e.target.value)} className="w-full border rounded-xl p-2" />
              <input placeholder="Teléfono" value={provTel} onChange={e => setProvTel(e.target.value)} className="w-full border rounded-xl p-2" />
              <input placeholder="Persona de Contacto" value={provContacto} onChange={e => setProvContacto(e.target.value)} className="w-full border rounded-xl p-2" />
              <button type="submit" className="w-full py-2.5 bg-mass-yellow text-stone-950 font-black rounded-xl">Guardar Proveedor</button>
            </form>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-900 text-stone-200 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Documento</th>
                    <th className="p-3">Razón Social</th>
                    <th className="p-3">Contacto</th>
                    <th className="p-3">Teléfono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {proveedores.map(p => (
                    <tr key={p.id}>
                      <td className="p-3 font-mono font-bold">{p.tipo_documento} {p.numero_documento}</td>
                      <td className="p-3 font-semibold">{p.razon_social}</td>
                      <td className="p-3">{p.contacto_nombre || '-'}</td>
                      <td className="p-3">{p.telefono || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'pagar' && isAdmin && (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-red-700 text-white uppercase text-[10px]">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Vencimiento</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {compras.filter(c => c.estado_pago === 'PENDIENTE').length === 0 ? (
                  <tr><td colSpan="5" className="p-6 text-center text-stone-400">No hay cuentas por pagar pendientes.</td></tr>
                ) : compras.filter(c => c.estado_pago === 'PENDIENTE').map(c => (
                  <tr key={c.id}>
                    <td className="p-3 font-mono font-bold">{c.codigo_compra}</td>
                    <td className="p-3 font-semibold">{c.proveedor_nombre}</td>
                    <td className="p-3">{c.fecha_vencimiento_pago || c.fecha_compra}</td>
                    <td className="p-3 text-right font-extrabold text-red-700">S/ {Number(c.total).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => handlePagarCompra(c.id)} className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg">Marcar Pagado</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 2. TRASLADOS ENTRE SUCURSALES (Admin y Supervisor)
  // =========================================================================
  window.ArkanTrasladosView = function ({ branch, user, sucursales }) {
    const [traslados, setTraslados] = useState([]);
    const [productos, setProductos] = useState([]);
    const [origenId, setOrigenId] = useState(String(branch?.id || 1));
    const [destinoId, setDestinoId] = useState('2');
    const [productoId, setProductoId] = useState('1');
    const [cantidad, setCantidad] = useState(5);
    const [motivo, setMotivo] = useState('Reposición de stock entre tiendas');

    const loadData = async () => {
      try {
        const [tRes, pRes] = await Promise.all([api.get('/traslados'), api.get('/productos')]);
        setTraslados(tRes.data || []);
        setProductos(pRes.data || []);
      } catch (e) { console.error(e); }
    };

    useEffect(() => {
      loadData();
      if (branch?.id) {
        setOrigenId(String(branch.id));
        const other = (sucursales || []).find(s => String(s.id) !== String(branch.id));
        if (other) setDestinoId(String(other.id));
      }
    }, [branch?.id]);

    const handleTraslado = async (e) => {
      e.preventDefault();
      try {
        await api.post('/traslados', {
          sucursal_origen_id: Number(origenId),
          sucursal_destino_id: Number(destinoId),
          producto_id: Number(productoId),
          cantidad: Number(cantidad),
          motivo
        });
        alert('✅ Traslado ejecutado con descuento PEPS y Kardex en ambas sucursales.');
        loadData();
      } catch (err) {
        alert(err.message);
      }
    };

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900">Traslados de Mercadería entre Sucursales</h1>
          <p className="text-xs text-stone-500">Descuenta lotes PEPS en origen, genera lote en destino y registra doble Kardex automático.</p>
        </div>

        <form onSubmit={handleTraslado} className="bg-white p-5 rounded-2xl border border-stone-200 grid grid-cols-1 md:grid-cols-6 gap-3 items-end text-xs shadow-sm">
          <div>
            <label className="font-bold text-stone-600 block mb-1">Sucursal Origen</label>
            <select value={origenId} onChange={e => setOrigenId(e.target.value)} className="w-full border rounded-xl p-2 bg-stone-50 font-semibold">
              {(sucursales || []).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="font-bold text-stone-600 block mb-1">Sucursal Destino</label>
            <select value={destinoId} onChange={e => setDestinoId(e.target.value)} className="w-full border rounded-xl p-2 bg-stone-50 font-semibold">
              {(sucursales || []).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="font-bold text-stone-600 block mb-1">Producto</label>
            <select value={productoId} onChange={e => setProductoId(e.target.value)} className="w-full border rounded-xl p-2 bg-stone-50 font-semibold">
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="font-bold text-stone-600 block mb-1">Cantidad</label>
            <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} className="w-full border rounded-xl p-2" required />
          </div>
          <div>
            <button type="submit" className="w-full py-2.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black rounded-xl">Ejecutar Traslado</button>
          </div>
        </form>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-x-auto shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-900 text-stone-200 uppercase text-[10px]">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Producto</th>
                <th className="p-3">Origen</th>
                <th className="p-3">Destino</th>
                <th className="p-3 text-right">Cantidad</th>
                <th className="p-3">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {traslados.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-stone-400">Sin traslados registrados aún.</td></tr>
              ) : traslados.map(t => (
                <tr key={t.id}>
                  <td className="p-3 font-mono font-bold">{t.codigo_traslado}</td>
                  <td className="p-3 font-semibold">{t.producto_nombre}</td>
                  <td className="p-3">{t.origen_nombre}</td>
                  <td className="p-3">{t.destino_nombre}</td>
                  <td className="p-3 text-right font-extrabold">{t.cantidad}</td>
                  <td className="p-3 text-stone-500">{t.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 3. INVENTARIO VALORIZADO & GENERADOR DE ETIQUETAS (Admin y Supervisor)
  // =========================================================================
  window.ArkanValorizadoEtiquetasView = function ({ branch }) {
    const [tab, setTab] = useState('valorizado');
    const [data, setData] = useState({ items: [], total_valor_costo: 0, total_valor_venta: 0, utilidad_potencial: 0 });

    useEffect(() => {
      if (!branch?.id) return;
      api.get(`/inventarios/valorizado?sucursal_id=${branch.id}`)
        .then(res => setData(res.data || { items: [] }))
        .catch(console.error);
    }, [branch?.id]);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-stone-900">Inventario Valorizado & Etiquetas de Góndola</h1>
            <p className="text-xs text-stone-500">Valorización contable en tiempo real (NIC 2) e impresión de etiquetas con código de barras.</p>
          </div>
          <div className="flex gap-2 text-xs font-bold">
            <button onClick={() => setTab('valorizado')} className={`px-3.5 py-2 rounded-xl ${tab === 'valorizado' ? 'bg-stone-900 text-amber-300' : 'bg-white border'}`}>💰 Inventario Valorizado</button>
            <button onClick={() => setTab('etiquetas')} className={`px-3.5 py-2 rounded-xl ${tab === 'etiquetas' ? 'bg-mass-yellow text-stone-950 font-extrabold' : 'bg-white border'}`}>🏷️ Etiquetas Imprimibles</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-[11px] font-bold text-stone-500 uppercase">Valor Total al Costo</div>
            <div className="text-2xl font-black text-stone-900 mt-1">S/ {Number(data.total_valor_costo || 0).toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-[11px] font-bold text-stone-500 uppercase">Valor Potencial de Venta</div>
            <div className="text-2xl font-black text-blue-700 mt-1">S/ {Number(data.total_valor_venta || 0).toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-[11px] font-bold text-stone-500 uppercase">Margen Bruto Proyectado</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">S/ {Number(data.utilidad_potencial || 0).toFixed(2)}</div>
          </div>
        </div>

        {tab === 'valorizado' ? (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-x-auto shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-900 text-stone-200 uppercase text-[10px]">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">ABC</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-right">Valor Costo</th>
                  <th className="p-3 text-right">Valor Venta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data.items || []).map(it => (
                  <tr key={it.id}>
                    <td className="p-3 font-mono font-bold">{it.codigo_sku}</td>
                    <td className="p-3 font-semibold">{it.nombre}</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-extrabold">{it.clasificacion_abc}</span></td>
                    <td className="p-3 text-right font-bold">{it.stock_actual}</td>
                    <td className="p-3 text-right">S/ {Number(it.valor_costo_total).toFixed(2)}</td>
                    <td className="p-3 text-right font-extrabold text-emerald-700">S/ {Number(it.valor_venta_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => window.print()} className="px-4 py-2 bg-stone-900 text-amber-300 font-extrabold rounded-xl text-xs">🖨️ Imprimir Etiquetas</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(data.items || []).map(it => (
                <div key={it.id} className="bg-white border-2 border-dashed border-stone-300 rounded-xl p-3 text-center space-y-1">
                  <div className="text-[10px] font-black text-mass-red uppercase">ARKENYA</div>
                  <div className="text-xs font-extrabold text-stone-900 line-clamp-2 h-8">{it.nombre}</div>
                  <div className="text-xl font-black text-stone-950 bg-mass-yellow rounded-lg py-0.5">S/ {Number(it.precio_venta).toFixed(2)}</div>
                  <div className="font-mono text-[10px] text-stone-500">{it.codigo_barras || it.codigo_sku}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 4. CAJA OPERATIVA & GASTOS (Solo Administrador)
  // =========================================================================
  window.ArkanCajaView = function ({ branch }) {
    const [caja, setCaja] = useState({ movimientos: [], ingresos: 0, egresos: 0, saldo_neto: 0 });
    const [tipo, setTipo] = useState('INGRESO');
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');

    const loadCaja = async () => {
      try {
        const res = await api.get(`/caja/movimientos${branch?.id ? `?sucursal_id=${branch.id}` : ''}`);
        setCaja(res.data || { movimientos: [], ingresos: 0, egresos: 0, saldo_neto: 0 });
      } catch (e) { console.error(e); }
    };

    useEffect(() => { loadCaja(); }, [branch?.id]);

    const handleAdd = async (e) => {
      e.preventDefault();
      try {
        await api.post('/caja/movimientos', {
          sucursal_id: branch?.id || 1,
          tipo,
          concepto,
          monto: Number(monto)
        });
        setConcepto(''); setMonto('');
        loadCaja();
      } catch (err) {
        alert(err.message);
      }
    };

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900">Caja Operativa, Ingresos y Gastos (Solo Admin)</h1>
          <p className="text-xs text-stone-500">Control de flujo operativo de efectivo, pagos a proveedores y gastos administrativos.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-[11px] font-bold text-stone-500 uppercase">Ingresos Operativos</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">S/ {Number(caja.ingresos || 0).toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-[11px] font-bold text-stone-500 uppercase">Egresos / Pagos</div>
            <div className="text-2xl font-black text-red-600 mt-1">S/ {Number(caja.egresos || 0).toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-[11px] font-bold text-stone-500 uppercase">Saldo Neto</div>
            <div className="text-2xl font-black text-stone-900 mt-1">S/ {Number(caja.saldo_neto || 0).toFixed(2)}</div>
          </div>
        </div>

        <form onSubmit={handleAdd} className="bg-white p-4 rounded-2xl border border-stone-200 grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs">
          <div>
            <label className="font-bold text-stone-600 block mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border rounded-xl p-2 bg-stone-50 font-semibold">
              <option value="INGRESO">INGRESO</option>
              <option value="EGRESO">EGRESO / GASTO</option>
              <option value="APERTURA">APERTURA</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-stone-600 block mb-1">Concepto</label>
            <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej. Movilidad / Pago servicio" className="w-full border rounded-xl p-2" required />
          </div>
          <div>
            <label className="font-bold text-stone-600 block mb-1">Monto (S/)</label>
            <input type="number" step="0.01" min="0.1" value={monto} onChange={e => setMonto(e.target.value)} className="w-full border rounded-xl p-2" required />
          </div>
          <button type="submit" className="py-2.5 bg-mass-yellow text-stone-950 font-black rounded-xl">Registrar Movimiento</button>
        </form>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-900 text-stone-200 uppercase text-[10px]">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Concepto</th>
                <th className="p-3">Referencia</th>
                <th className="p-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(caja.movimientos || []).map(m => (
                <tr key={m.id}>
                  <td className="p-3">{m.created_at}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.tipo === 'EGRESO' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{m.tipo}</span></td>
                  <td className="p-3 font-semibold">{m.concepto}</td>
                  <td className="p-3 font-mono text-stone-500">{m.referencia || '-'}</td>
                  <td className="p-3 text-right font-extrabold">S/ {Number(m.monto).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 5. CONFIGURACIÓN OPERATIVA ESTILO ARKAN (Solo Administrador)
  // =========================================================================
  window.ArkanConfiguracionView = function () {
    const [configs, setConfigs] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      api.get('/configuraciones').then(res => setConfigs(res.data || [])).catch(console.error);
    }, []);

    const handleChange = (clave, valor) => {
      setConfigs(prev => prev.map(c => c.clave === clave ? { ...c, valor } : c));
    };

    const handleSave = async () => {
      setSaving(true);
      try {
        const payload = {};
        configs.forEach(c => { payload[c.clave] = c.valor; });
        await api.put('/configuraciones', { configuraciones: payload });
        alert('✅ Configuraciones operativas guardadas.');
      } catch (err) {
        alert(err.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-stone-900">Configuración Operativa del Sistema</h1>
            <p className="text-xs text-stone-500">Parámetros corporativos de inventarios PEPS, alertas y delivery.</p>
          </div>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs shadow">
            {saving ? 'Guardando...' : '💾 Guardar Configuración'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 divide-y shadow-sm">
          {configs.map(c => {
            const isBool = c.valor === '0' || c.valor === '1';
            return (
              <div key={c.clave} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-xs text-stone-900">{c.descripcion}</div>
                  <div className="font-mono text-[10px] text-stone-400">{c.clave}</div>
                </div>
                {isBool ? (
                  <button
                    type="button"
                    onClick={() => handleChange(c.clave, c.valor === '1' ? '0' : '1')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition ${c.valor === '1' ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-700'}`}
                  >
                    {c.valor === '1' ? 'ACTIVO' : 'INACTIVO'}
                  </button>
                ) : (
                  <input
                    value={c.valor}
                    onChange={e => handleChange(c.clave, e.target.value)}
                    className="w-56 border rounded-xl px-3 py-1.5 text-xs font-semibold text-right"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
})();
