import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { CartProvider } from './context/CartContext';

// Layouts
import { StoreLayout } from './layouts/StoreLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Vistas Cliente Modularizadas
import { CatalogoView } from './interfaz-cliente/catalogo/CatalogoCliente';
import { CheckoutView } from './interfaz-cliente/carrito/CarritoDrawer';

// Vistas Administrador y Almacén Modularizadas
import { DashboardView } from './modules/dashboard/DashboardView';
import { InventarioView } from './interfaz-administrador/inventario/inventario-peps';
import { AlmacenView } from './interfaz-administrador/inventario/matriz-abc';
import { ConteosView } from './interfaz-administrador/inventario/conteos-fisicos';
import { DeliveryTrackingView } from './interfaz-administrador/ventas/delivery-tracking';
import { ReportesView } from './interfaz-administrador/reportes/estadisticas';
import { BannerAdminView } from './interfaz-administrador/banners/banners-admin';
import { ReportesGeneralesView } from './interfaz-administrador/reportes/reportes-generales';
import { ProductosAdminView } from './interfaz-administrador/productos/productos-admin';
import { UsuariosAdminView } from './interfaz-administrador/usuarios/usuarios-admin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <CartProvider>
            <Routes>
              {/* Rutas de la Tienda Virtual */}
              <Route path="/" element={<StoreLayout />}>
                <Route index element={<CatalogoView />} />
                <Route path="checkout" element={<CheckoutView />} />
              </Route>

              {/* Rutas del Panel Administrativo y Almacén */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/reportes-generales" replace />} />
                <Route path="reportes-generales" element={<ReportesGeneralesView />} />
                <Route path="productos" element={<ProductosAdminView />} />
                <Route path="dashboard" element={<DashboardView />} />
                <Route path="inventario" element={<InventarioView />} />
                <Route path="almacen" element={<AlmacenView />} />
                <Route path="conteos" element={<ConteosView />} />
                <Route path="delivery" element={<DeliveryTrackingView />} />
                <Route path="reportes" element={<ReportesView />} />
                <Route path="banners" element={<BannerAdminView />} />
                <Route path="usuarios" element={<UsuariosAdminView />} />
              </Route>

              {/* Redirección por defecto */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CartProvider>
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
