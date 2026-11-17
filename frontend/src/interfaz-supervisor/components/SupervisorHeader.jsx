/**
 * TIENDAS MASS - Header Superior del Supervisor
 * Ubicación: frontend/src/interfaz-supervisor/components/SupervisorHeader.jsx
 */
import React from 'react';
import { HeaderBackoffice } from '../../components-compartidos/header/HeaderBackoffice';

export const SupervisorHeader = ({ user, onLogout }) => {
  const sucursalNombre = user?.sucursal?.nombre || 'Mass - Huancayo Centro (Asignada)';
  return <HeaderBackoffice user={user} role="Supervisor" sucursalNombre={sucursalNombre} onLogout={onLogout} />;
};

export default SupervisorHeader;
