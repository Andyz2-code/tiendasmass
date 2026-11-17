/**
 * TIENDAS MASS - Componente para Agregar Nuevo Producto
 * Ubicación: frontend/src/interfaz-administrador/productos/agregar-producto.jsx
 */
import React from 'react';
import { ProductEditModal } from './ProductEditModal';

export const AgregarProductoModal = ({ isOpen, onClose, onSuccess }) => {
  return (
    <ProductEditModal
      isOpen={isOpen}
      product={null}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
};

export default AgregarProductoModal;
