import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const GoogleMapPicker = ({
  branchLocation = { lat: -12.0684, lng: -75.2100, name: 'Tienda Mass - Huancayo Centro', radio: 5.0 },
  onLocationSelect,
  initialLocation = null
}) => {
  const [customerLoc, setCustomerLoc] = useState(
    initialLocation || { lat: -12.0691, lng: -75.2092, address: 'Jr. Puno 345, Huancayo' }
  );
  const [distanceKm, setDistanceKm] = useState(0);
  const [isWithinCoverage, setIsWithinCoverage] = useState(true);

  // Lugares típicos de prueba en Huancayo
  const presets = [
    { name: 'Huancayo Centro (Cerca)', lat: -12.0691, lng: -75.2092, address: 'Jr. Puno 345 (Plaza Huamanmarca)' },
    { name: 'San Carlos (Medio)', lat: -12.0621, lng: -75.1985, address: 'Av. San Carlos 1120' },
    { name: 'El Tambo (Límite)', lat: -12.0530, lng: -75.2180, address: 'Av. Huancavelica 1450, El Tambo' },
    { name: 'Jauja / Fuera Cobertura (> 40km)', lat: -11.7750, lng: -75.4960, address: 'Carretera Central, Jauja' }
  ];

  // Cálculo geodésico Haversine
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number.parseFloat((R * c * 1.25).toFixed(2)); // Factor vial 1.25x
  };

  useEffect(() => {
    const dist = calculateDistance(
      branchLocation.lat,
      branchLocation.lng,
      customerLoc.lat,
      customerLoc.lng
    );
    setDistanceKm(dist);
    const inCoverage = dist <= (branchLocation.radio || 5.0);
    setIsWithinCoverage(inCoverage);

    if (onLocationSelect) {
      onLocationSelect({
        ...customerLoc,
        distanceKm: dist,
        isWithinCoverage: inCoverage
      });
    }
  }, [customerLoc, branchLocation]);

  const handleSelectPreset = (preset) => {
    setCustomerLoc({
      lat: preset.lat,
      lng: preset.lng,
      address: preset.address
    });
  };

  return (
    <div className="bg-stone-50 rounded-2xl border border-stone-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-stone-900 font-bold">
          <Navigation className="w-5 h-5 text-red-600" />
          <span>Geolocalización & Validación de Cobertura (Google Maps)</span>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800">
          Radio tienda: {branchLocation.radio || 5.0} km
        </span>
      </div>

      {/* Simulador / Mapa visual interactivo */}
      <div className="relative w-full h-64 bg-stone-900 rounded-xl overflow-hidden border border-stone-300 shadow-inner flex flex-col justify-between p-4 text-white">
        {/* Grilla visual simulando mapa georreferenciado */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>

        {/* Círculo de cobertura de la sucursal */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 rounded-full border-2 border-dashed border-amber-400 bg-amber-400/10 flex items-center justify-center animate-pulse">
            <span className="text-[10px] text-amber-300 font-mono tracking-widest uppercase">Zona de Cobertura Mass</span>
          </div>
        </div>

        {/* Pin Tienda Mass */}
        <div className="relative z-10 flex items-center gap-2 bg-stone-800/80 backdrop-blur px-3 py-1.5 rounded-lg border border-stone-700 w-fit text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
          <span className="font-bold text-amber-400">Origen:</span> {branchLocation.name}
        </div>

        {/* Marcador dinámico del cliente */}
        <div className="relative z-10 self-center flex flex-col items-center">
          <div className={`p-2 rounded-full shadow-lg ${isWithinCoverage ? 'bg-emerald-500' : 'bg-red-600'} text-white`}>
            <MapPin className="w-6 h-6 animate-bounce" />
          </div>
          <span className="text-[11px] font-bold bg-black/80 px-2 py-0.5 rounded mt-1">
            {customerLoc.address || 'Ubicación seleccionada'}
          </span>
        </div>

        {/* Barra de métricas en tiempo real */}
        <div className="relative z-10 flex items-center justify-between bg-stone-800/90 backdrop-blur p-2.5 rounded-lg border border-stone-700 text-xs">
          <div>
            <span className="text-stone-400">Distancia calculada:</span>{' '}
            <span className="font-bold text-white text-sm">{distanceKm} km</span>
          </div>
          <div>
            {isWithinCoverage ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" /> En Cobertura
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-400 font-bold">
                <AlertTriangle className="w-4 h-4" /> Fuera de Radio ({distanceKm} &gt; {branchLocation.radio} km)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Selectores rápidos de prueba para Huancayo */}
      <div>
        <span className="block text-xs font-semibold text-stone-700 mb-2">
          Puntos de prueba georreferenciados (Huancayo):
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={`p-2 text-left rounded-lg text-xs border transition ${
                customerLoc.address === p.address
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                  : 'border-stone-200 bg-white hover:bg-stone-100 text-stone-700'
              }`}
            >
              <div className="truncate font-semibold">{p.name}</div>
              <div className="text-[10px] text-stone-500 truncate">{p.address}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Formulario de entrada de dirección interactiva */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="md:col-span-2">
          <label htmlFor="map_customer_address" className="block font-medium text-stone-700 mb-1">Dirección de Entrega Exacta:</label>
          <input
            id="map_customer_address"
            type="text"
            value={customerLoc.address}
            onChange={(e) => setCustomerLoc({ ...customerLoc, address: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Ej: Jr. Puno 345, Int. 201"
          />
        </div>
        <div>
          <label htmlFor="map_customer_ref" className="block font-medium text-stone-700 mb-1">Referencia:</label>
          <input
            id="map_customer_ref"
            type="text"
            value={customerLoc.reference || ''}
            onChange={(e) => setCustomerLoc({ ...customerLoc, reference: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Ej: Frente al parque"
          />
        </div>
      </div>
    </div>
  );
};
