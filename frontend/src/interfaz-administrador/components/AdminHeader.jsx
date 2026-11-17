/**
 * TIENDAS MASS - Header Superior Administrador
 * Ubicación: frontend/src/interfaz-administrador/components/AdminHeader.jsx
 */
import React from 'react';
import { HeaderBackoffice } from '../../components-compartidos/header/HeaderBackoffice';

export const AdminHeader = (props) => {
  return <HeaderBackoffice role="Administrador" sucursalNombre="Todas las Sucursales (Global)" {...props} />;
};

export default AdminHeader;
