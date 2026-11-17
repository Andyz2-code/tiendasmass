/* ==========================================================================
   TIENDAS MASS - Gestor de Carrito de Compras
   Arquitectura: /frontend/js/cart.js
   ========================================================================== */

class CartManager {
  constructor() {
    this.items = JSON.parse(localStorage.getItem('mass_cart') || '[]');
    this.deliveryFee = 5.00;
    this.freeDeliveryThreshold = 50.00;
    this.init();
  }

  init() {
    this.updateBadge();
    this.renderDrawer();
  }

  save() {
    localStorage.setItem('mass_cart', JSON.stringify(this.items));
    this.updateBadge();
    this.renderDrawer();
  }

  addItem(product, qty = 1) {
    const existingIndex = this.items.findIndex(item => item.id === product.id);
    if (existingIndex > -1) {
      this.items[existingIndex].quantity += qty;
    } else {
      this.items.push({
        id: product.id,
        nombre: product.nombre,
        precio: parseFloat(product.precio_venta),
        unidad_medida: product.unidad_medida || 'UNIDAD',
        imagen_url: product.imagen_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300',
        categoria_nombre: product.categoria_nombre || '',
        quantity: qty
      });
    }
    this.save();
    this.showToast(`¡Se agregó ${qty} x "${product.nombre}" al carrito!`);
  }

  updateQuantity(id, delta) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeItem(id);
    } else {
      this.save();
    }
  }

  removeItem(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
  }

  clear() {
    this.items = [];
    this.save();
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
  }

  getShippingCost() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    return subtotal >= this.freeDeliveryThreshold ? 0 : this.deliveryFee;
  }

  getTotal() {
    return this.getSubtotal() + this.getShippingCost();
  }

  getItemCount() {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  updateBadge() {
    const badges = document.querySelectorAll('.cart-count-badge');
    const count = this.getItemCount();
    badges.forEach(b => {
      b.textContent = count;
      if (count > 0) {
        b.classList.remove('hidden');
      } else {
        b.classList.add('hidden');
      }
    });
  }

  renderDrawer() {
    const container = document.getElementById('cartDrawerItems');
    const subtotalEl = document.getElementById('cartSubtotal');
    const shippingEl = document.getElementById('cartShipping');
    const totalEl = document.getElementById('cartTotal');
    const emptyStateEl = document.getElementById('cartEmptyState');
    const footerEl = document.getElementById('cartFooter');

    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = '';
      if (emptyStateEl) emptyStateEl.classList.remove('hidden');
      if (footerEl) footerEl.classList.add('hidden');
      return;
    }

    if (emptyStateEl) emptyStateEl.classList.add('hidden');
    if (footerEl) footerEl.classList.remove('hidden');

    const subtotal = this.getSubtotal();
    const shipping = this.getShippingCost();
    const total = this.getTotal();

    if (subtotalEl) subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.textContent = shipping === 0 ? '¡GRATIS!' : `S/ ${shipping.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;

    container.innerHTML = this.items.map(item => `
      <div class="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
        <img src="${item.imagen_url}" alt="${item.nombre}" class="w-14 h-14 object-cover rounded-lg bg-white border border-stone-200 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-stone-800 line-clamp-2 leading-tight">${item.nombre}</h4>
          <p class="text-[11px] text-stone-500 mt-0.5">${item.unidad_medida}</p>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs font-extrabold text-stone-900">S/ ${(item.precio * item.quantity).toFixed(2)}</span>
            <div class="flex items-center gap-1.5 bg-white border border-stone-300 rounded-lg px-2 py-0.5">
              <button onclick="window.cart.updateQuantity(${item.id}, -1)" class="text-stone-500 hover:text-stone-900 font-bold text-xs">-</button>
              <span class="text-xs font-bold text-stone-800 w-5 text-center">${item.quantity}</span>
              <button onclick="window.cart.updateQuantity(${item.id}, 1)" class="text-stone-500 hover:text-stone-900 font-bold text-xs">+</button>
            </div>
          </div>
        </div>
        <button onclick="window.cart.removeItem(${item.id})" class="text-stone-400 hover:text-red-500 p-1" title="Eliminar">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    `).join('');
  }

  showToast(message) {
    const toast = document.getElementById('massToast');
    const toastText = document.getElementById('massToastText');
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.remove('translate-y-24', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.add('translate-y-24', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 2500);
  }
}

// Global instance
window.cart = new CartManager();
