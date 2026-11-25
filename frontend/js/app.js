/* ==========================================================================
   ARKENYA - Controlador Principal de Tienda y Catálogo
   Arquitectura: /frontend/js/app.js
   ========================================================================== */

const API_BASE = '/tiendasmass/backend/public/api';

class TiendasMassApp {
  constructor() {
    this.products = [];
    this.categories = [];
    this.branches = [];
    this.selectedBranch = null;
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.selectedBrands = new Set();
    this.maxPrice = 40;
    this.sortBy = 'relevance';
    this.filterStock = 'all'; // all, in_stock, low_stock
    this.quantities = {}; // { [productId]: number }

    this.init();
  }

  async init() {
    this.bindEvents();
    await Promise.all([
      this.fetchBranches(),
      this.fetchCategories(),
      this.fetchProducts()
    ]);
  }

  bindEvents() {
    // Search inputs (Header and Toolbar)
    const headerSearch = document.getElementById('headerSearchInput');
    const catalogSearch = document.getElementById('catalogSearchInput');
    
    if (headerSearch) {
      headerSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        if (catalogSearch) catalogSearch.value = e.target.value;
        this.renderCatalog();
      });
    }

    if (catalogSearch) {
      catalogSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        if (headerSearch) headerSearch.value = e.target.value;
        this.renderCatalog();
      });
    }

    // Price range slider
    const priceRange = document.getElementById('priceRangeSlider');
    const priceDisplay = document.getElementById('priceRangeDisplay');
    if (priceRange) {
      priceRange.addEventListener('input', (e) => {
        this.maxPrice = parseFloat(e.target.value);
        if (priceDisplay) priceDisplay.textContent = `S/ ${this.maxPrice.toFixed(2)}`;
        this.renderCatalog();
      });
    }

    // Sort selector
    const sortSelector = document.getElementById('sortSelector');
    if (sortSelector) {
      sortSelector.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.renderCatalog();
      });
    }

    // Branch selector
    const branchSelect = document.getElementById('branchSelector');
    if (branchSelect) {
      branchSelect.addEventListener('change', (e) => {
        this.selectedBranch = e.target.value;
        localStorage.setItem('mass_selected_branch', this.selectedBranch);
        this.renderCatalog();
      });
    }

    // Clear filters button
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.resetFilters());
    }
  }

  resetFilters() {
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.selectedBrands.clear();
    this.maxPrice = 40;
    this.sortBy = 'relevance';
    this.filterStock = 'all';

    const headerSearch = document.getElementById('headerSearchInput');
    const catalogSearch = document.getElementById('catalogSearchInput');
    const priceRange = document.getElementById('priceRangeSlider');
    const priceDisplay = document.getElementById('priceRangeDisplay');
    const sortSelector = document.getElementById('sortSelector');

    if (headerSearch) headerSearch.value = '';
    if (catalogSearch) catalogSearch.value = '';
    if (priceRange) priceRange.value = 40;
    if (priceDisplay) priceDisplay.textContent = 'S/ 40.00';
    if (sortSelector) sortSelector.value = 'relevance';

    document.querySelectorAll('.brand-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.category-nav-pill').forEach(pill => {
      pill.classList.remove('bg-mass-yellow', 'text-stone-900', 'font-bold');
      pill.classList.add('bg-stone-100', 'text-stone-600');
    });

    this.renderCategoriesSidebar();
    this.renderCatalog();
  }

  async fetchBranches() {
    try {
      const res = await fetch(`${API_BASE}/sucursales`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        this.branches = data.data;
        this.renderBranches();
      }
    } catch (err) {
      console.warn('Usando sucursales por defecto:', err);
      this.branches = [
        { id: 1, nombre: 'Huancayo Centro', direccion: 'Calle Real 450' },
        { id: 2, nombre: 'El Tambo / San Carlos', direccion: 'Av. Huancavelica 1120' }
      ];
      this.renderBranches();
    }
  }

  renderBranches() {
    const select = document.getElementById('branchSelector');
    if (!select) return;
    
    select.innerHTML = this.branches.map(b => `
      <option value="${b.id}">${b.nombre} (${b.direccion || 'Local'})</option>
    `).join('');

    const saved = localStorage.getItem('mass_selected_branch');
    if (saved) {
      select.value = saved;
      this.selectedBranch = saved;
    } else if (this.branches.length > 0) {
      this.selectedBranch = this.branches[0].id;
    }
  }

  async fetchCategories() {
    try {
      const res = await fetch(`${API_BASE}/categorias`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        this.categories = data.data;
      }
    } catch (err) {
      console.warn('Categorías fallback:', err);
    }
  }

  async fetchProducts() {
    const grid = document.getElementById('productsGrid');
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full py-16 flex flex-col items-center justify-center text-stone-400">
          <svg class="animate-spin h-8 w-8 text-mass-yellow mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <p class="text-sm font-semibold text-stone-600">Cargando productos del catálogo Mass...</p>
        </div>
      `;
    }

    try {
      const res = await fetch(`${API_BASE}/productos`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        this.products = data.data;
      }
    } catch (err) {
      console.error('Error cargando productos:', err);
    }

    this.renderCategoriesSidebar();
    this.renderBrandsFilter();
    this.renderCatalog();
  }

  renderCategoriesSidebar() {
    const container = document.getElementById('categorySidebarList');
    const navPillsContainer = document.getElementById('categoryNavPills');
    if (!container) return;

    // Calculate product counts per category
    const counts = { all: this.products.length };
    this.products.forEach(p => {
      const cat = p.categoria_nombre || 'Otros';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const categoryNames = Object.keys(counts).filter(k => k !== 'all');

    container.innerHTML = `
      <li>
        <button onclick="window.app.filterByCategory('all')" 
          class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${this.selectedCategory === 'all' ? 'bg-amber-100 text-stone-900 font-bold border-l-4 border-mass-yellow' : 'text-stone-600 hover:bg-stone-100'}">
          <span>🛒 Todos los productos</span>
          <span class="bg-stone-200 text-stone-700 text-[11px] font-bold px-2 py-0.5 rounded-full">${counts.all}</span>
        </button>
      </li>
      ${categoryNames.map(cat => `
        <li>
          <button onclick="window.app.filterByCategory('${cat}')" 
            class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${this.selectedCategory === cat ? 'bg-amber-100 text-stone-900 font-bold border-l-4 border-mass-yellow' : 'text-stone-600 hover:bg-stone-100'}">
            <span class="truncate">${cat}</span>
            <span class="bg-stone-200 text-stone-700 text-[11px] font-bold px-2 py-0.5 rounded-full">${counts[cat]}</span>
          </button>
        </li>
      `).join('')}
    `;

    if (navPillsContainer) {
      navPillsContainer.innerHTML = `
        <button onclick="window.app.filterByCategory('all')" 
          class="category-nav-pill px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${this.selectedCategory === 'all' ? 'bg-mass-yellow text-stone-900 shadow-sm' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}">
          Todos (${counts.all})
        </button>
        ${categoryNames.map(cat => `
          <button onclick="window.app.filterByCategory('${cat}')" 
            class="category-nav-pill px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${this.selectedCategory === cat ? 'bg-mass-yellow text-stone-900 shadow-sm' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}">
            ${cat} (${counts[cat]})
          </button>
        `).join('')}
      `;
    }
  }

  renderBrandsFilter() {
    const container = document.getElementById('brandsFilterList');
    if (!container) return;

    // Detect known Peruvian supermarket brands
    const popularBrands = ['PRIMOR', 'COSTEÑO', 'GLORIA', 'MASS', 'CAMPO MASS', 'BOLÍVAR', 'INKA KOLA', 'LA CALERA', 'LAIVE', 'ALTOMAYO', 'BIMBO', 'SAPOLIO'];
    
    container.innerHTML = popularBrands.map(brand => {
      const matchCount = this.products.filter(p => p.nombre.toUpperCase().includes(brand)).length;
      if (matchCount === 0) return '';
      return `
        <label class="flex items-center justify-between text-xs text-stone-700 hover:text-stone-900 cursor-pointer py-1">
          <span class="flex items-center gap-2">
            <input type="checkbox" value="${brand}" onchange="window.app.toggleBrand('${brand}', this.checked)" class="brand-checkbox rounded text-amber-500 focus:ring-amber-400 h-3.5 w-3.5" />
            <span class="font-medium">${brand}</span>
          </span>
          <span class="text-[11px] text-stone-400 font-mono">(${matchCount})</span>
        </label>
      `;
    }).join('');
  }

  toggleBrand(brand, isChecked) {
    if (isChecked) {
      this.selectedBrands.add(brand);
    } else {
      this.selectedBrands.delete(brand);
    }
    this.renderCatalog();
  }

  filterByCategory(cat) {
    this.selectedCategory = cat;
    this.renderCategoriesSidebar();
    this.renderCatalog();
  }

  setStockFilter(type) {
    this.filterStock = type;
    this.renderCatalog();
  }

  setProductQty(productId, qty) {
    this.quantities[productId] = Math.max(1, qty);
    const label = document.getElementById(`qty-${productId}`);
    if (label) label.textContent = this.quantities[productId];
  }

  renderCatalog() {
    const grid = document.getElementById('productsGrid');
    const countBadge = document.getElementById('catalogResultsCount');
    if (!grid) return;

    let filtered = this.products.filter(p => {
      // Category filter
      if (this.selectedCategory !== 'all' && (p.categoria_nombre || '') !== this.selectedCategory) {
        return false;
      }

      // Search text
      if (this.searchQuery) {
        const text = `${p.nombre} ${p.descripcion || ''} ${p.categoria_nombre || ''} ${p.codigo_sku || ''}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }

      // Price slider
      const price = parseFloat(p.precio_venta || 0);
      if (price > this.maxPrice) return false;

      // Brand filter
      if (this.selectedBrands.size > 0) {
        const pName = p.nombre.toUpperCase();
        let matchesBrand = false;
        for (const brand of this.selectedBrands) {
          if (pName.includes(brand)) {
            matchesBrand = true;
            break;
          }
        }
        if (!matchesBrand) return false;
      }

      return true;
    });

    // Sorting
    if (this.sortBy === 'price_asc') {
      filtered.sort((a, b) => parseFloat(a.precio_venta) - parseFloat(b.precio_venta));
    } else if (this.sortBy === 'price_desc') {
      filtered.sort((a, b) => parseFloat(b.precio_venta) - parseFloat(a.precio_venta));
    } else if (this.sortBy === 'name_asc') {
      filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    if (countBadge) countBadge.textContent = `${filtered.length} productos`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
          <div class="w-16 h-16 mx-auto mb-3 bg-amber-50 rounded-full flex items-center justify-center text-mass-yellow">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <h3 class="text-base font-bold text-stone-800">No encontramos productos con esos filtros</h3>
          <p class="text-xs text-stone-500 mt-1 max-w-sm mx-auto">Prueba ajustando el rango de precio, quitando las marcas seleccionadas o buscando otra palabra clave.</p>
          <button onclick="window.app.resetFilters()" class="mt-4 px-4 py-2 bg-mass-yellow text-stone-900 rounded-xl text-xs font-bold hover:bg-amber-400">Restablecer filtros</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((p, idx) => {
      const price = parseFloat(p.precio_venta).toFixed(2);
      const isMassBrand = p.nombre.toUpperCase().includes('MASS');
      const isPerishable = p.es_perecedero == 1;
      const initialQty = this.quantities[p.id] || 1;

      // Add a promo banner after the 6th item
      const insertBanner = idx === 5 ? `
        <div class="col-span-full my-4 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl">
              ⚡
            </div>
            <div>
              <span class="inline-block px-2.5 py-0.5 bg-yellow-400 text-stone-900 text-[10px] font-black rounded-full uppercase tracking-wider mb-1">OFERTA BOMBA MASS</span>
              <h3 class="text-lg font-black tracking-tight leading-tight">Rotación Corta PEPS con hasta 35% de descuento</h3>
              <p class="text-xs text-red-100 mt-0.5">Lotes frescos con fecha de vencimiento controlada para ahorrar al máximo.</p>
            </div>
          </div>
          <button onclick="window.app.filterByCategory('Lácteos y Huevos')" class="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-stone-900 font-extrabold rounded-xl text-xs whitespace-nowrap shadow-md transition-all">
            Ver Ofertas Bomba →
          </button>
        </div>
      ` : '';

      return `
        ${insertBanner}
        <div class="product-card p-4 flex flex-col justify-between relative group">
          <!-- Badges -->
          <div class="absolute top-3 left-3 flex flex-col gap-1 z-10">
            ${isMassBrand ? `<span class="mass-badge-tag">Marca Mass</span>` : ''}
            ${isPerishable ? `<span class="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Fresco PEPS</span>` : ''}
          </div>

          <!-- Product Image -->
          <div class="h-44 w-full bg-stone-50 rounded-xl overflow-hidden flex items-center justify-center mb-3 p-2 relative">
            <img src="${p.imagen_url}" alt="${p.nombre}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          </div>

          <!-- Category & Title -->
          <div class="flex-1 flex flex-col">
            <span class="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">${p.categoria_nombre || 'General'}</span>
            <h3 class="text-xs font-bold text-stone-900 line-clamp-2 mt-0.5 leading-snug group-hover:text-red-600 transition-colors" title="${p.nombre}">
              ${p.nombre}
            </h3>
            <p class="text-[11px] text-stone-500 mt-1 line-clamp-2">${p.descripcion || ''}</p>
          </div>

          <!-- Price & Quantity Selector -->
          <div class="mt-4 pt-3 border-t border-stone-100">
            <div class="flex items-baseline justify-between mb-3">
              <div>
                <span class="text-[11px] text-stone-500 font-medium">Precio Mass</span>
                <div class="text-lg font-black text-stone-900">
                  <span class="text-xs font-bold text-red-600 align-top">S/</span> ${price}
                </div>
              </div>
              <span class="text-[11px] text-stone-400 font-medium">${p.unidad_medida || 'UN'}</span>
            </div>

            <div class="flex items-center gap-2">
              <!-- Quantity Selector -->
              <div class="flex items-center bg-stone-100 border border-stone-200 rounded-xl px-2 py-1.5 flex-shrink-0">
                <button type="button" onclick="window.app.decrementQty(${p.id})" class="text-stone-500 hover:text-stone-900 font-bold px-1 text-xs select-none">-</button>
                <span id="qty-${p.id}" class="text-xs font-bold text-stone-800 w-6 text-center select-none">${initialQty}</span>
                <button type="button" onclick="window.app.incrementQty(${p.id})" class="text-stone-500 hover:text-stone-900 font-bold px-1 text-xs select-none">+</button>
              </div>

              <!-- Add to Cart Button -->
              <button type="button" onclick="window.app.addToCart(${p.id})" class="flex-1 btn-mass-primary py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                <span>Agregar</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  incrementQty(id) {
    const current = this.quantities[id] || 1;
    this.setProductQty(id, current + 1);
  }

  decrementQty(id) {
    const current = this.quantities[id] || 1;
    if (current > 1) {
      this.setProductQty(id, current - 1);
    }
  }

  addToCart(id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;
    const qty = this.quantities[id] || 1;
    window.cart.addItem(product, qty);
    this.setProductQty(id, 1); // Reset back to 1
  }
}

// Global instance
window.app = new TiendasMassApp();
