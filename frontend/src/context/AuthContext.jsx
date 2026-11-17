import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mass_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('mass_token') || null);
  const [loading, setLoading] = useState(false);

  const saveSession = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('mass_token', newToken);
    localStorage.setItem('mass_user', JSON.stringify(newUser));
  };

  const loginUser = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login-user', { email, password });
      saveSession(res.data.token, res.data.user);
      return res.data.user;
    } finally {
      setLoading(false);
    }
  };

  const loginClient = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login-client', { email, password });
      saveSession(res.data.token, { ...res.data.client, rol_nombre: 'Cliente' });
      return res.data.client;
    } finally {
      setLoading(false);
    }
  };

  const registerClient = async (formData) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/register-client', formData);
      saveSession(res.data.token, { ...res.data.client, rol_nombre: 'Cliente' });
      return res.data.client;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('mass_token');
    localStorage.removeItem('mass_user');
  };

  const isInternal = user && (user.rol_nombre === 'Administrador' || user.rol_nombre === 'Supervisor');
  const isAdmin = user && user.rol_nombre === 'Administrador';
  const isSupervisor = user && user.rol_nombre === 'Supervisor';
  const isClient = user && (user.rol_nombre === 'Cliente' || user.tipo_usuario === 'cliente');

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginUser,
        loginClient,
        registerClient,
        logout,
        isLoggedIn: !!token,
        isInternal,
        isAdmin,
        isSupervisor,
        isClient
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
