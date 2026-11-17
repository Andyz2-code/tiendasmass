import React, { useState } from 'react';
import api from '../../services/api';
import { Modal } from '../../components/Modal';
import { FileSpreadsheet, Download, Upload, AlertCircle, CheckCircle, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';

export const ExcelImportModal = ({ isOpen, onClose, sucursalId, onImportCompleted, categorias = [] }) => {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [previewStats, setPreviewStats] = useState({ total: 0, validos: 0, invalidos: 0 });
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');

  // 1. Descargar Plantilla Oficial Excel / CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      "codigo_sku,codigo_barras,nombre,descripcion,categoria,precio_venta,costo_base,stock_inicial,unidad_medida,es_perecedero,imagen_url\n" +
      "SKU-ARR-010,7750123450011,Arroz Extra Costeño 1kg,Arroz seleccionado de grano largo,Abarrotes y Despensa,4.80,3.70,80,BOLSA,0,https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400\n" +
      "SKU-BEB-011,7750123450022,Agua Mineral San Luis 625ml,Agua de mesa sin gas,Bebidas y Licores,2.00,1.30,120,BOTELLA,0,https://images.unsplash.com/photo-1559839914-ba2ac55d683a?w=400\n" +
      "SKU-LAC-012,7750123450033,Leche Evaporada Gloria Azul 400g,Leche entera con vitaminas,Lácteos y Huevos,4.20,3.20,100,LATA,1,https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400\n" +
      "SKU-LIM-013,7750123450044,Detergente Ace Floral 800g,Detergente en polvo multiuso,Limpieza y Cuidado,6.50,4.80,60,BOLSA,0,https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Plantilla_Oficial_Importacion_Productos_Mass.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Procesar Archivo Seleccionado
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError('');
    setImportResult(null);
    setFile(selected);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        parseFileText(text);
      } catch (err) {
        setError('Error al leer el archivo. Verifique que sea un archivo CSV/Excel válido.');
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      setError('Error en la lectura del archivo.');
      setIsParsing(false);
    };
    reader.readAsText(selected, 'UTF-8');
  };

  // 3. Parser de Líneas y Validación Previa
  const parseFileText = (text) => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      setError('El archivo está vacío o solo contiene la fila de encabezados.');
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const expectedHeaders = ['codigo_sku', 'codigo_barras', 'nombre'];
    const hasRequiredHeaders = expectedHeaders.every(h => headers.includes(h));

    if (!hasRequiredHeaders) {
      setError(`El archivo debe contener al menos las columnas obligatorias: ${expectedHeaders.join(', ')}`);
      setParsedRows([]);
      return;
    }

    const rows = [];
    const seenSkus = new Set();
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const rawCols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = rawCols[idx] !== undefined ? rawCols[idx] : '';
      });

      // Validaciones previas de la fila
      const errors = [];
      const sku = (rowObj.codigo_sku || '').toUpperCase().trim();
      const barcode = (rowObj.codigo_barras || '').trim();
      const nombre = (rowObj.nombre || '').trim();
      const precio = Number.parseFloat(rowObj.precio_venta || 0);
      const costo = Number.parseFloat(rowObj.costo_base || 0);

      if (!sku) errors.push('Falta SKU');
      else if (seenSkus.has(sku)) errors.push('SKU duplicado en archivo');
      else seenSkus.add(sku);

      if (!barcode) errors.push('Falta Código de Barras');
      if (!nombre) errors.push('Falta Nombre');
      if (Number.isNaN(precio) || precio <= 0) errors.push('Precio venta inválido (>0)');
      if (Number.isNaN(costo) || costo <= 0) errors.push('Costo base inválido (>0)');

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      rows.push({
        numFila: i + 1,
        data: rowObj,
        isValid,
        errors
      });
    }

    setParsedRows(rows);
    setPreviewStats({ total: rows.length, validos: validCount, invalidos: invalidCount });
  };

  // 4. Enviar importación de los válidos al backend
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid).map(r => r.data);
    if (validRows.length === 0) {
      setError('No hay filas válidas para importar.');
      return;
    }

    setIsImporting(true);
    setError('');

    try {
      const res = await api.post('/productos/import-excel', {
        sucursal_id: sucursalId,
        rows: validRows
      });

      setImportResult(res.data?.data || res.data);
      onImportCompleted && onImportCompleted();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error durante la importación masiva');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setPreviewStats({ total: 0, validos: 0, invalidos: 0 });
    setImportResult(null);
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importación Masiva de Productos (Excel / CSV)" maxWidth="max-w-4xl">
      <div className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Paso Inicial: Descarga y Selección de Archivo */}
        {!importResult && parsedRows.length === 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>Plantilla Oficial de Productos Mass</span>
                </div>
                <p className="text-stone-600 text-[11px]">
                  Descarga la plantilla con las columnas exactas (SKU, Código de barras, Nombre, Categoría, Precios, Stock inicial).
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-sm transition flex items-center gap-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Plantilla (.CSV / Excel)</span>
              </button>
            </div>

            {/* Zona de Carga */}
            <div className="border-2 border-dashed border-stone-300 rounded-3xl p-8 text-center bg-stone-50 hover:bg-stone-100 transition cursor-pointer relative">
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <div className="font-black text-stone-900 text-sm">Selecciona o arrastra tu archivo Excel / CSV aquí</div>
              <p className="text-stone-500 text-[11px] mt-1">Soporta archivos de catálogo preparados según la plantilla oficial</p>
            </div>
          </div>
        )}

        {/* 2. Vista Previa de Registros antes de Importar */}
        {!importResult && parsedRows.length > 0 && (
          <div className="space-y-3">
            {/* Barra de Estadísticas de la Vista Previa */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-stone-100 rounded-2xl border border-stone-200 text-center font-bold">
              <div>
                <span className="text-stone-500 text-[10px] block uppercase">Total Filas Leídas</span>
                <span className="text-lg font-black text-stone-900">{previewStats.total}</span>
              </div>
              <div className="text-emerald-700">
                <span className="text-emerald-600 text-[10px] block uppercase">Listas para Importar</span>
                <span className="text-lg font-black">✓ {previewStats.validos}</span>
              </div>
              <div className="text-red-700">
                <span className="text-red-600 text-[10px] block uppercase">Con Errores / Duplicados</span>
                <span className="text-lg font-black">⚠ {previewStats.invalidos}</span>
              </div>
            </div>

            {/* Tabla de Registros */}
            <div className="max-h-72 overflow-y-auto border border-stone-200 rounded-2xl shadow-inner">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-stone-100 sticky top-0 font-extrabold text-stone-700 uppercase text-[9px] border-b">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Categoría</th>
                    <th className="p-2 text-right">P. Venta</th>
                    <th className="p-2 text-right">Costo</th>
                    <th className="p-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className={row.isValid ? 'hover:bg-emerald-50/50' : 'bg-red-50/40'}>
                      <td className="p-2 font-mono text-stone-400 font-bold">{row.numFila}</td>
                      <td className="p-2">
                        {row.isValid ? (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px]">
                            VÁLIDO
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-black text-[9px]" title={row.errors.join(', ')}>
                            {row.errors.join(' | ')}
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono font-bold">{row.data.codigo_sku}</td>
                      <td className="p-2 font-semibold text-stone-900 truncate max-w-xs">{row.data.nombre}</td>
                      <td className="p-2 text-stone-600">{row.data.categoria}</td>
                      <td className="p-2 text-right font-bold">S/. {Number.parseFloat(row.data.precio_venta || 0).toFixed(2)}</td>
                      <td className="p-2 text-right text-stone-500">S/. {Number.parseFloat(row.data.costo_base || 0).toFixed(2)}</td>
                      <td className="p-2 text-right font-black text-amber-700">{row.data.stock_inicial || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Botones de Acción */}
            <div className="flex justify-between items-center pt-2 border-t">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 font-bold text-stone-700 transition"
              >
                ← Cambiar Archivo
              </button>

              <button
                type="button"
                disabled={previewStats.validos === 0 || isImporting}
                onClick={handleExecuteImport}
                className="px-5 py-2.5 bg-mass-yellow hover:bg-amber-400 text-stone-950 font-black rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {isImporting && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isImporting ? 'Procesando Importación...' : `Importar ${previewStats.validos} Registros Válidos`}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Resumen Final de la Importación Ejecutada */}
        {importResult && (
          <div className="p-6 bg-white rounded-3xl border border-stone-200 shadow-sm space-y-4 animate-fadeIn">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-2xl mx-auto font-black">✓</div>
              <h3 className="text-base font-black text-stone-950">¡Importación Masiva Completada!</h3>
              <p className="text-[11px] text-stone-500">Los productos válidos ya fueron integrados a la base de datos e inventarios.</p>
            </div>

            {/* Tarjetas de Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border font-bold">
                <span className="text-[10px] text-stone-400 block uppercase">Procesados</span>
                <span className="text-base font-black text-stone-900">{importResult.total_procesados}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 font-bold">
                <span className="text-[10px] text-emerald-600 block uppercase">Registrados</span>
                <span className="text-base font-black text-emerald-700">✓ {importResult.total_importados}</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 font-bold">
                <span className="text-[10px] text-amber-700 block uppercase">Duplicados Omitidos</span>
                <span className="text-base font-black text-amber-800">{importResult.total_omitidos_duplicados}</span>
              </div>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 font-bold">
                <span className="text-[10px] text-red-600 block uppercase">Errores</span>
                <span className="text-base font-black text-red-700">{importResult.total_errores}</span>
              </div>
            </div>

            {/* Listado de Errores / Omitidos Si Existen */}
            {importResult.detalles_errores && importResult.detalles_errores.length > 0 && (
              <div className="space-y-1.5 p-3 bg-stone-50 rounded-xl border max-h-40 overflow-y-auto">
                <div className="font-extrabold text-stone-700 text-[11px]">Detalle de incidencias:</div>
                {importResult.detalles_errores.map((err, i) => (
                  <div key={i} className="text-[10px] text-red-700 flex items-start gap-1">
                    <span className="font-mono font-bold shrink-0">Fila {err.fila} ({err.codigo_sku}):</span>
                    <span>{err.error}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-stone-900 text-amber-300 font-extrabold rounded-xl hover:bg-black transition text-xs"
              >
                Cerrar y Ver Catálogo Actualizado
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
