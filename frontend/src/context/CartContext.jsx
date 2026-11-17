import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('mass_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('mass_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (producto, cantidad = 1) => {
    const stockDisponible = parseInt(producto.stock_actual || 0);
    if (stockDisponible <= 0) {
      alert(`El producto "${producto.nombre}" se encuentra agotado.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.producto.id === producto.id);
      if (existing) {
        const nuevaCantidad = existing.cantidad + cantidad;
        if (nuevaCantidad > stockDisponible) {
          alert(`Solo quedan ${stockDisponible} unidades disponibles de "${producto.nombre}". Se ajustó a la cantidad máxima.`);
          return prev.map((item) =>
            item.producto.id === producto.id
              ? { ...item, cantidad: stockDisponible }
              : item
          );
        }
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: nuevaCantidad }
            : item
        );
      }

      const cantidadFinal = Math.min(cantidad, stockDisponible);
      return [...prev, { producto, cantidad: cantidadFinal }];
    });
  };

  const updateQuantity = (productoId, cantidad) => {
    if (cantidad <= 0) {
      removeFromCart(productoId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.producto.id !== productoId) return item;
        const stockDisponible = parseInt(item.producto.stock_actual || 9999);
        if (cantidad > stockDisponible) {
          alert(`No se pueden solicitar más de ${stockDisponible} unidades de este producto.`);
          return { ...item, cantidad: stockDisponible };
        }
        return { ...item, cantidad };
      })
    );
  };

  const removeFromCart = (productoId) => {
    setCart((prev) => prev.filter((item) => item.producto.id !== productoId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Cálculos comerciales en Soles (PEN) con IGV 18%
  const totalMercaderia = cart.reduce(
    (acc, item) => acc + parseFloat(item.producto.precio_venta) * item.cantidad,
    0
  );

  const subtotalSinIgv = totalMercaderia / 1.18;
  const igv = totalMercaderia - subtotalSinIgv;
  const itemsCount = cart.reduce((acc, item) => acc + item.cantidad, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalMercaderia: parseFloat(totalMercaderia.toFixed(2)),
        subtotalSinIgv: parseFloat(subtotalSinIgv.toFixed(2)),
        igv: parseFloat(igv.toFixed(2)),
        itemsCount
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de un CartProvider');
  }
  return context;
};
