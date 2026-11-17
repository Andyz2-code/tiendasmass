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
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email).trim());
};

export const isValidPositiveNumber = (val) => {
  const n = Number(val);
  return !Number.isNaN(n) && n >= 0;
};
