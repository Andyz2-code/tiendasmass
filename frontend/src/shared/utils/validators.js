/**
 * TIENDAS MASS - Validadores de Formularios
 * Ubicación: frontend/src/shared/utils/validators.js
 */

export const isValidDni = (dni) => {
  return /^\d{8}$/.test(String(dni).trim());
};

export const isValidPhone = (phone) => {
  return /^9\d{8}$/.test(String(phone).trim());
};

export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

export const isValidPositiveNumber = (val) => {
  const n = Number(val);
  return !isNaN(n) && n >= 0;
};
