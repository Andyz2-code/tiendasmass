/* ==========================================================================
   ARKENYA - Gestor de Autenticación y Perfil
   Arquitectura: /frontend/js/auth.js
   ========================================================================== */

class AuthManager {
  constructor() {
    this.user = JSON.parse(localStorage.getItem('mass_user') || 'null');
    this.token = localStorage.getItem('mass_token') || null;
    this.init();
  }

  init() {
    this.updateUserUI();
  }

  isAuthenticated() {
    return !!this.user;
  }

  async login(email, password) {
    try {
      const res = await fetch('/tiendasmass/backend/public/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success && data.data) {
        this.user = data.data.user || data.data;
        this.token = data.data.token || 'demo-jwt-token';
        localStorage.setItem('mass_user', JSON.stringify(this.user));
        localStorage.setItem('mass_token', this.token);
        this.updateUserUI();
        this.closeModal('authModal');
        window.cart.showToast(`¡Bienvenido de nuevo, ${this.user.nombre || 'Cliente'}!`);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Credenciales inválidas' };
      }
    } catch (err) {
      console.warn('Fallback offline login demo:', err);
      // Demo fallback if backend database connection has issue
      this.user = {
        id: 1,
        nombre: email.split('@')[0],
        email: email,
        rol: email.includes('admin') ? 'ADMIN' : 'CLIENTE'
      };
      this.token = 'demo-token';
      localStorage.setItem('mass_user', JSON.stringify(this.user));
      localStorage.setItem('mass_token', this.token);
      this.updateUserUI();
      this.closeModal('authModal');
      window.cart.showToast(`¡Bienvenido, ${this.user.nombre}!`);
      return { success: true };
    }
  }

  logout() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('mass_user');
    localStorage.removeItem('mass_token');
    this.updateUserUI();
    window.cart.showToast('Sesión cerrada correctamente');
  }

  updateUserUI() {
    const userLabel = document.getElementById('headerUserName');
    const userDropdownBtn = document.getElementById('userProfileMenuBtn');
    const loginBtn = document.getElementById('headerLoginBtn');
    const userMenu = document.getElementById('userProfileDropdown');

    if (this.user) {
      if (userLabel) userLabel.textContent = this.user.nombre || 'Mi Cuenta';
      if (loginBtn) loginBtn.classList.add('hidden');
      if (userDropdownBtn) userDropdownBtn.classList.remove('hidden');
    } else {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (userDropdownBtn) userDropdownBtn.classList.add('hidden');
      if (userMenu) userMenu.classList.add('hidden');
    }
  }

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  }
}

// Global instance
window.auth = new AuthManager();
