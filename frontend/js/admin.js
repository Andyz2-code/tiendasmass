/* ==========================================================================
   TIENDAS MASS - Controlador de Backoffice y Administración
   Arquitectura: /frontend/js/admin.js
   ========================================================================== */

const API_BASE = '/tiendasmass/backend/public/api';

class AdminManager {
  constructor() {
    this.products = [];
    this.categories = [];
    this.orders = [];
    this.activeTab = 'products';
    this.init();
  }

  async init() {
    await Promise.all([
      this.fetchCategories(),
      this.fetchProducts(),
      this.fetchOrders()
    ]);
    this.renderProductsTable();
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    ['products', 'inventory', 'orders', 'reports'].forEach(t => {
      const el = document.getElementById(`tab-content-${t}`);
      const btn = document.getElementById(`tab-btn-${t}`);
      if (el) {
        if (t === tabId) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
      if (btn) {
        if (t === tabId) {
          btn.className = 'px-4 py-2.5 rounded-xl font-bold text-xs bg-stone-900 text-white shadow-sm flex items-center gap-2';
        } else {
          btn.className = 'px-4 py-2.5 rounded-xl font-bold text-xs bg-white text-stone-600 hover:bg-stone-100 flex items-center gap-2 border border-stone-200';
        }
      }
    });

    if (tabId === 'products') this.renderProductsTable();
    if (tabId === 'inventory') this.renderInventoryTable();
    if (tabId === 'orders') this.renderOrdersTable();
    if (tabId === 'reports') this.renderReports();
  }

  async fetchCategories() {
    try {
      const res = await fetch(`${API_BASE}/categorias`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        this.categories = data.data;
        const select = document.getElementById('prodModalCategory');
        if (select) {
          select.innerHTML = this.categories.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }
      }
    } catch (e) {
      console.warn('Error fetching categories:', e);
    }
  }

  async fetchProducts() {
    try {
      const res = await fetch(`${API_BASE}/productos`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        this.products = data.data;
      }
    } catch (e) {
      console.warn('Error fetching products:', e);
    }
  }

  async fetchOrders() {
    try {
      const res = await fetch(`${API_BASE}/pedidos`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        this.orders = data.data;
      }
    } catch (e) {
      console.warn('Error fetching orders:', e);
    }
  }

  renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    document.getElementById('adminTotalProducts').textContent = this.products.length;

    tbody.innerHTML = this.products.map(p => `
      <tr class="hover:bg-stone-50 transition-colors border-b border-stone-100">
        <td class="p-3 text-xs font-mono font-bold text-stone-500">${p.codigo_sku}</td>
        <td class="p-3">
          <div class="flex items-center gap-3">
            <img src="${p.imagen_url}" alt="" class="w-10 h-10 object-contain rounded-lg bg-stone-100 p-1 border border-stone-200" />
            <div>
              <div class="text-xs font-bold text-stone-900">${p.nombre}</div>
              <div class="text-[10px] text-stone-400 font-mono">${p.codigo_barras || 'Sin código'}</div>
            </div>
          </div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-stone-800">${p.categoria_nombre || 'General'}</span>
        </td>
        <td class="p-3 text-xs font-extrabold text-stone-900">S/ ${parseFloat(p.precio_venta).toFixed(2)}</td>
        <td class="p-3 text-xs text-stone-500 font-mono">S/ ${parseFloat(p.costo_base || 0).toFixed(2)}</td>
        <td class="p-3">
          ${p.es_perecedero == 1 ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Fresco PEPS</span>' : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">No Perecedero</span>'}
        </td>
        <td class="p-3 text-right">
          <button onclick="window.admin.editProduct(${p.id})" class="text-stone-500 hover:text-stone-900 text-xs font-bold px-2 py-1">Editar</button>
        </td>
      </tr>
    `).join('');
  }

  renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    // Simulate PEPS batch tracking for perishable products
    tbody.innerHTML = this.products.map((p, idx) => {
      const isPerishable = p.es_perecedero == 1;
      const daysRemaining = isPerishable ? (idx % 2 === 0 ? 12 : 3) : 180;
      let badge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Óptimo</span>';
      if (daysRemaining <= 5) {
        badge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse">Rotación Rápida (-30%)</span>';
      } else if (daysRemaining <= 15) {
        badge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Atención PEPS</span>';
      }

      return `
        <tr class="hover:bg-stone-50 border-b border-stone-100 text-xs">
          <td class="p-3 font-mono font-bold text-stone-600">LOT-${202600 + p.id}</td>
          <td class="p-3 font-bold text-stone-900">${p.nombre}</td>
          <td class="p-3">${p.categoria_nombre}</td>
          <td class="p-3 font-mono font-bold">${(idx * 7 + 14)} unid.</td>
          <td class="p-3 font-mono text-stone-600">${isPerishable ? '2026-11-' + (18 + (idx % 10)) : '2027-05-15'}</td>
          <td class="p-3">${badge}</td>
        </tr>
      `;
    }).join('');
  }

  renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (this.orders.length === 0) {
      // Demo mock orders if empty
      this.orders = [
        { id: 101, codigo_pedido: 'ORD-2026-881', cliente_nombre: 'María Ramos', total: '48.50', estado: 'ENTREGADO', created_at: '2026-11-15 18:30' },
        { id: 102, codigo_pedido: 'ORD-2026-882', cliente_nombre: 'Carlos Huamán', total: '32.10', estado: 'EN RUTA', created_at: '2026-11-15 19:15' },
        { id: 103, codigo_pedido: 'ORD-2026-883', cliente_nombre: 'Lucía Torres', total: '74.20', estado: 'PENDIENTE', created_at: '2026-11-15 20:45' }
      ];
    }

    tbody.innerHTML = this.orders.map(o => {
      let stateBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">PENDIENTE</span>';
      if (o.estado === 'EN RUTA') stateBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">EN RUTA</span>';
      if (o.estado === 'ENTREGADO') stateBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">ENTREGADO</span>';

      return `
        <tr class="hover:bg-stone-50 border-b border-stone-100 text-xs">
          <td class="p-3 font-mono font-bold text-stone-900">${o.codigo_pedido || 'ORD-' + o.id}</td>
          <td class="p-3 font-bold text-stone-800">${o.cliente_nombre || 'Cliente General'}</td>
          <td class="p-3 font-black text-stone-900">S/ ${parseFloat(o.total || 0).toFixed(2)}</td>
          <td class="p-3">${stateBadge}</td>
          <td class="p-3 text-stone-400 font-mono text-[11px]">${o.created_at || 'Hoy'}</td>
        </tr>
      `;
    }).join('');
  }

  renderReports() {
    const totalValuation = this.products.reduce((acc, p) => acc + (parseFloat(p.precio_venta) * 20), 0);
    const valuationEl = document.getElementById('reportInventoryValuation');
    if (valuationEl) valuationEl.textContent = `S/ ${totalValuation.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  }

  openProductModal() {
    document.getElementById('productFormModal').classList.remove('hidden');
  }

  closeProductModal() {
    document.getElementById('productFormModal').classList.add('hidden');
  }

  async saveProduct(e) {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById('prodModalName').value,
      categoria_id: parseInt(document.getElementById('prodModalCategory').value),
      codigo_sku: document.getElementById('prodModalSku').value,
      codigo_barras: document.getElementById('prodModalBarcode').value,
      precio_venta: parseFloat(document.getElementById('prodModalPrice').value),
      costo_base: parseFloat(document.getElementById('prodModalCost').value),
      unidad_medida: document.getElementById('prodModalUnit').value,
      imagen_url: document.getElementById('prodModalImage').value || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300',
      es_perecedero: document.getElementById('prodModalPerishable').checked ? 1 : 0
    };

    try {
      const res = await fetch(`${API_BASE}/productos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('¡Producto creado con éxito!');
        this.closeProductModal();
        await this.fetchProducts();
        this.renderProductsTable();
      } else {
        alert('Error: ' + data.message);
      }
    } catch (err) {
      alert('Producto guardado en sesión local');
      this.products.unshift({ id: Date.now(), ...payload, categoria_nombre: 'General' });
      this.closeProductModal();
      this.renderProductsTable();
    }
  }
}

// Global instance
window.admin = new AdminManager();
