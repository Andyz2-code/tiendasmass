import React, { useState } from 'react';
import api from '../../services/api';
import { Modal } from '../../components/Modal';
import { FileSpreadsheet, Download, Upload, AlertCircle, RefreshCw } from 'lucide-react';

export const ExcelImportModal = ({ isOpen, onClose, sucursalId, onImportCompleted, categorias = [] }) => {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [previewStats, setPreviewStats] = useState({ total: 0, validos: 0, invalidos: 0, duplicados: 0 });
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');

  // 1. Descargar Plantilla Oficial Excel (.xlsx) generada dinámicamente
  const handleDownloadTemplate = () => {
    try {
      const downloadUrl = '/tiendasmass/backend/public/index.php/api/productos/template-excel?format=xlsx';
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'Plantilla_Oficial_Importacion_Productos_Mass.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      // Fallback CSV en caso de contingencia offline
      const csvContent =
        "FOTO,SKU / BARRAS,NOMBRE DEL PRODUCTO,CATEGORÍA,PRECIO DE VENTA,COSTO BASE,STOCK ACTUAL,TIPO\n" +
        "imagen_producto.jpg,SKU-ACE-002,Aceite Vegetal Primor Clásico 900 ml,Abarrotes y Despensa,8.90,6.20,54,No Perecedero\n" +
        "imagen_producto.jpg,SKU-ARR-001,Arroz Costeño Extra 1 kg,Abarrotes y Despensa,4.50,3.50,90,No Perecedero\n" +
        "imagen_producto.jpg,SKU-MASS-016,Arroz Extra Grano Largo Mass Bolsa 5 kg,Abarrotes y Despensa,22.90,18.20,35,No Perecedero\n";
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Plantilla_Oficial_Importacion_Productos_Mass.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 2. Procesar Archivo Seleccionado (.xlsx o .csv)
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError('');
    setImportResult(null);
    setFile(selected);
    setIsParsing(true);

    const isXlsx = selected.name.toLowerCase().endsWith('.xlsx') || selected.name.toLowerCase().endsWith('.xls');

    if (isXlsx && typeof window !== 'undefined' && window.XLSX) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows = window.XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          processRowObjects(jsonRows);
        } catch (err) {
          setError('Error al leer el archivo Excel (.xlsx). Verifique el formato.');
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsArrayBuffer(selected);
    } else {
      // Parser para CSV o texto
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target.result;
          parseCsvText(text);
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
    }
  };

  // Helper para extraer campos con alias flexibles
  const extractField = (row, keys, def = '') => {
    for (const k of keys) {
      if (row[k] !== undefined && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const lower = k.toLowerCase();
      if (row[lower] !== undefined && String(row[lower]).trim() !== '') {
        return String(row[lower]).trim();
      }
    }
    return def;
  };

  // 3. Procesar lista de objetos (de SheetJS o CSV)
  const processRowObjects = (rawObjects) => {
    if (!rawObjects || rawObjects.length === 0) {
      setError('El archivo no contiene registros de productos.');
      setParsedRows([]);
      return;
    }

    const rows = [];
    const seenSkus = new Set();
    let validCount = 0;
    let invalidCount = 0;
    let dupCount = 0;

    rawObjects.forEach((rowObj, idx) => {
      const errors = [];
      const foto = extractField(rowObj, ['FOTO', 'foto', 'Foto', 'imagen', 'imagen_url'], 'imagen_producto.jpg');
      const sku = extractField(rowObj, ['SKU / BARRAS', 'SKU/BARRAS', 'sku_barras', 'codigo_sku', 'sku'], '').toUpperCase();
      const nombre = extractField(rowObj, ['NOMBRE DEL PRODUCTO', 'NOMBRE', 'nombre del producto', 'nombre'], '');
      const categoria = extractField(rowObj, ['CATEGORÍA', 'CATEGORIA', 'categoría', 'categoria'], '');
      const precio = Number.parseFloat(extractField(rowObj, ['PRECIO DE VENTA', 'precio_venta', 'precio'], '0'));
      const costo = Number.parseFloat(extractField(rowObj, ['COSTO BASE', 'costo_base', 'costo'], '0'));
      const stock = Number.parseInt(extractField(rowObj, ['STOCK ACTUAL', 'stock_actual', 'stock_inicial', 'stock'], '50'), 10);
      const tipo = extractField(rowObj, ['TIPO', 'tipo', 'es_perecedero'], 'No Perecedero');

      if (!sku) errors.push('Falta SKU / Barras');
      else if (seenSkus.has(sku)) {
        errors.push(`SKU duplicado en archivo (${sku})`);
        dupCount++;
      } else {
        seenSkus.add(sku);
      }

      if (!nombre) errors.push('Falta Nombre');
      if (!categoria) errors.push('Falta Categoría');
      if (Number.isNaN(precio) || precio <= 0) errors.push('Precio venta inválido (>0)');
      if (Number.isNaN(costo) || costo <= 0) errors.push('Costo base inválido (>0)');
      if (Number.isNaN(stock) || stock < 0) errors.push('Stock no puede ser negativo');

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      rows.push({
        numFila: idx + 1,
        foto,
        sku,
        nombre,
        categoria,
        precio: Number.isNaN(precio) ? 0 : precio,
        costo: Number.isNaN(costo) ? 0 : costo,
        stock: Number.isNaN(stock) ? 0 : stock,
        tipo,
        isValid,
        errors,
        raw: {
          'FOTO': foto,
          'SKU / BARRAS': sku,
          'NOMBRE DEL PRODUCTO': nombre,
          'CATEGORÍA': categoria,
          'PRECIO DE VENTA': precio,
          'COSTO BASE': costo,
          'STOCK ACTUAL': stock,
          'TIPO': tipo
        }
      });
    });

    setParsedRows(rows);
    setPreviewStats({
      total: rows.length,
      validos: validCount,
      invalidos: invalidCount,
      duplicados: dupCount
    });
  };

  // Parser para texto CSV
  const parseCsvText = (text) => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      setError('El archivo está vacío o solo contiene encabezados.');
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rawObjs = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, colIdx) => {
        obj[h] = cols[colIdx] !== undefined ? cols[colIdx] : '';
      });
      rawObjs.push(obj);
    }

    processRowObjects(rawObjs);
  };

  // 4. Enviar importación al backend
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid).map(r => r.raw);
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

      const data = res?.data || res;
      setImportResult(data?.data || data);
      if (onImportCompleted) onImportCompleted();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error durante la importación masiva');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setPreviewStats({ total: 0, validos: 0, invalidos: 0, duplicados: 0 });
    setImportResult(null);
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importación Masiva de Productos – Tiendas Mass" maxWidth="max-w-5xl">
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
                  <span>Plantilla Oficial de Productos Mass (.xlsx)</span>
                </div>
                <p className="text-stone-600 text-[11px]">
                  Descarga la plantilla con las 8 columnas del catálogo: Foto, SKU / Barras, Nombre, Categoría, Precio, Costo, Stock y Tipo.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-sm transition flex items-center gap-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Plantilla Excel (.xlsx)</span>
              </button>
            </div>

            {/* Zona de Carga */}
            <div className="border-2 border-dashed border-stone-300 rounded-3xl p-8 text-center bg-stone-50 hover:bg-stone-100 transition cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <div className="font-black text-stone-900 text-sm">Selecciona o arrastra tu archivo Excel / CSV aquí</div>
              <p className="text-stone-500 text-[11px] mt-1">Soporta la nueva plantilla estructurada con validaciones y autofiltros</p>
            </div>
          </div>
        )}

        {/* 2. Vista Previa de Registros antes de Importar */}
        {!importResult && parsedRows.length > 0 && (
          <div className="space-y-3">
            {/* Barra de Estadísticas de la Vista Previa */}
            <div className="grid grid-cols-4 gap-2 p-3 bg-stone-100 rounded-2xl border border-stone-200 text-center font-bold">
              <div>
                <span className="text-stone-500 text-[10px] block uppercase">Total Leídos</span>
                <span className="text-base font-black text-stone-900">{previewStats.total}</span>
              </div>
              <div className="text-emerald-700">
                <span className="text-emerald-600 text-[10px] block uppercase">Listos (Válidos)</span>
                <span className="text-base font-black">✓ {previewStats.validos}</span>
              </div>
              <div className="text-amber-700">
                <span className="text-amber-600 text-[10px] block uppercase">Duplicados</span>
                <span className="text-base font-black">⚠ {previewStats.duplicados}</span>
              </div>
              <div className="text-red-700">
                <span className="text-red-600 text-[10px] block uppercase">Con Errores</span>
                <span className="text-base font-black">✕ {previewStats.invalidos}</span>
              </div>
            </div>

            {/* Tabla de Registros: 8 Columnas del Catálogo + Estado */}
            <div className="max-h-72 overflow-y-auto border border-stone-200 rounded-2xl shadow-inner">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-stone-100 sticky top-0 font-extrabold text-stone-700 uppercase text-[9px] border-b">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Foto</th>
                    <th className="p-2">SKU / Barras</th>
                    <th className="p-2">Nombre del Producto</th>
                    <th className="p-2">Categoría</th>
                    <th className="p-2 text-right">Precio Venta</th>
                    <th className="p-2 text-right">Costo Base</th>
                    <th className="p-2 text-right">Stock</th>
                    <th className="p-2 text-center">Tipo</th>
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
                      <td className="p-2 font-mono text-[10px] text-stone-500 truncate max-w-[100px]" title={row.foto}>
                        {row.foto || 'Por defecto'}
                      </td>
                      <td className="p-2 font-mono font-bold text-stone-900">{row.sku}</td>
                      <td className="p-2 font-semibold text-stone-900 truncate max-w-xs">{row.nombre}</td>
                      <td className="p-2 text-stone-600">{row.categoria}</td>
                      <td className="p-2 text-right font-extrabold text-mass-red">S/. {row.precio.toFixed(2)}</td>
                      <td className="p-2 text-right text-stone-500">S/. {row.costo.toFixed(2)}</td>
                      <td className="p-2 text-right font-black text-stone-900">{row.stock}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.tipo.toLowerCase().includes('perecedero') && !row.tipo.toLowerCase().includes('no') ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
                          {row.tipo}
                        </span>
                      </td>
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
                <span>{isImporting ? 'Procesando Importación...' : `Confirmar e Importar ${previewStats.validos} Registros`}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Resumen Final de la Importación Ejecutada */}
        {importResult && (
          <div className="p-6 bg-white rounded-3xl border border-stone-200 shadow-sm space-y-4 animate-fadeIn">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-2xl mx-auto font-black">✓</div>
              <h3 className="text-base font-black text-stone-950">¡Importación Masiva Procesada!</h3>
              <p className="text-[11px] text-stone-500">Los productos y existencias fueron integrados a la base de datos de la sucursal.</p>
            </div>

            {/* Tarjetas de Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border font-bold">
                <span className="text-[10px] text-stone-400 block uppercase">Procesados</span>
                <span className="text-base font-black text-stone-900">{importResult.total_procesados || 0}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 font-bold">
                <span className="text-[10px] text-emerald-600 block uppercase">Nuevos Creados</span>
                <span className="text-base font-black text-emerald-700">✓ {importResult.total_nuevos ?? importResult.total_importados ?? 0}</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 font-bold">
                <span className="text-[10px] text-blue-600 block uppercase">Actualizados</span>
                <span className="text-base font-black text-blue-700">↺ {importResult.total_actualizados || 0}</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 font-bold">
                <span className="text-[10px] text-amber-700 block uppercase">Duplicados Omitidos</span>
                <span className="text-base font-black text-amber-800">{importResult.total_omitidos_duplicados || 0}</span>
              </div>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 font-bold">
                <span className="text-[10px] text-red-600 block uppercase">Errores</span>
                <span className="text-base font-black text-red-700">{importResult.total_errores || 0}</span>
              </div>
            </div>

            {/* Listado de Errores / Omitidos Si Existen */}
            {importResult.detalles_errores && importResult.detalles_errores.length > 0 && (
              <div className="space-y-1.5 p-3 bg-stone-50 rounded-xl border max-h-40 overflow-y-auto">
                <div className="font-extrabold text-stone-700 text-[11px]">Detalle de incidencias registradas:</div>
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
