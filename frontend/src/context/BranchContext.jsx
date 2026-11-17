import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const BranchContext = createContext(null);

export const BranchProvider = ({ children }) => {
  const [sucursales, setSucursales] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(() => {
    const saved = localStorage.getItem('mass_selected_branch');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sucursales');
      const list = res.data || [];
      setSucursales(list);

      // Si no hay sucursal seleccionada o la actual ya no existe, seleccionar la primera por defecto
      if (!selectedBranch && list.length > 0) {
        setSelectedBranch(list[0]);
        localStorage.setItem('mass_selected_branch', JSON.stringify(list[0]));
      }
    } catch (err) {
      console.error('Error al cargar sucursales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBranches();
  }, []);

  const selectBranch = (branchOrId) => {
    let branch = null;
    if (typeof branchOrId === 'object' && branchOrId !== null) {
      branch = branchOrId;
    } else {
      branch = sucursales.find((s) => s.id === Number(branchOrId)) || null;
    }

    if (branch) {
      setSelectedBranch(branch);
      localStorage.setItem('mass_selected_branch', JSON.stringify(branch));
    }
  };

  return (
    <BranchContext.Provider
      value={{
        sucursales,
        selectedBranch,
        selectBranch,
        refreshBranches: fetchBranches,
        loading
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch debe usarse dentro de un BranchProvider');
  }
  return context;
};
