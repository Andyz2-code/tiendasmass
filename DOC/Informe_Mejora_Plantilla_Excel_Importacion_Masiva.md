# INFORME TÉCNICO: MEJORA DE LA PLANTILLA EXCEL PARA IMPORTACIÓN MASIVA DE PRODUCTOS – TIENDAS MASS

**Fecha:** 18 de Noviembre de 2026  
**Proyecto:** Tiendas Mass (Gestión Comercial, Catálogo e Inventario Multi-Sucursal)  
**Versión del Módulo:** 2.1 (Refactorización y Homologación de Plantilla Excel Corporativa)  
**Autor:** Equipo de Arquitectura de Software & Calidad de Código  
**Estado:** Implementado, Verificado y Auditado (100% de Pruebas Aprobadas)  

---

## 1. RESUMEN EJECUTIVO

El presente informe detalla la optimización integral del módulo de **Importación Masiva de Productos** del sistema Tiendas Mass. La mejora adapta el formato de descarga, carga y procesamiento de la plantilla Excel para alinearse con los **campos reales visibles en el catálogo de productos**:

| # | Columna Catálogo / Excel | Naturaleza en Base de Datos | Validación y Comportamiento |
|---|--------------------------|-----------------------------|------------------------------|
| 1 | **FOTO** | `imagen_url` (VARCHAR 255) | Nombre de archivo, ruta relativa (`assets/uploads/products/...`) o URL web (`https://...`). Fallback automático a placeholder oficial. |
| 2 | **SKU / BARRAS** | `codigo_sku` / `codigo_barras` | Alfanumérico obligatorio, único. Detecta duplicados en archivo y en base de datos. Si no se ingresa código de barras, se deriva automáticamente formato EAN-13 Perú (`775...`). |
| 3 | **NOMBRE DEL PRODUCTO** | `nombre` (VARCHAR 150) | Denominación comercial obligatoria, sin HTML. |
| 4 | **CATEGORÍA** | `categoria_id` (FK `categorias`) | Validación estricta contra categorías activas de MySQL. Menú desplegable dinámico en Excel. |
| 5 | **PRECIO DE VENTA** | `precio_venta` (DECIMAL 10,2) | Valor decimal positivo mayor a cero (S/.). Formato numérico moneda en Excel. |
| 6 | **COSTO BASE** | `costo_base` (DECIMAL 10,2) | Costo de adquisición decimal mayor a cero (S/.). Formato numérico moneda en Excel. |
| 7 | **STOCK ACTUAL** | `inventarios.stock_actual` | Entero no negativo (>= 0). Asignación atómica a la sucursal con Kardex (PEPS/FIFO). |
| 8 | **TIPO** | `es_perecedero` (TINYINT 1) | Valores: `No Perecedero` (0) o `Perecedero` (1). Menú desplegable dinámico en Excel. |

> *Nota de Arquitectura:* La columna `Acciones` existente en la interfaz gráfica (`Editar`, `Eliminar`) fue omitida expresamente del archivo Excel por ser exclusiva del frontend.

---

## 2. ANÁLISIS DE LA SITUACIÓN ANTERIOR VS. NUEVA IMPLEMENTACIÓN

### 2.1 Cómo funcionaba anteriormente:
1. **Plantilla Técnica Plana (.csv):** La plantilla anterior utilizaba nombres técnicos de columnas de base de datos en inglés/código (`codigo_sku`, `codigo_barras`, `unidad_medida`, `es_perecedero`, `imagen_url`), lo que dificultaba el llenado para personal de compras y supervisores de tienda.
2. **Sin Soporte Nativo XLSX de Hojas Múltiples:** La descarga generaba un archivo CSV básico sin formato visual, sin filtros automáticos, sin celdas de moneda y sin menús desplegables.
3. **Manejo Rígido de Existentes:** Todo SKU existente en la base de datos era rechazado como error o duplicado, impidiendo actualizar precios o cargar existencias masivas de una nueva sucursal para productos previamente creados en el catálogo.

### 2.2 Mejoras Implementadas:
1. **Generador Nativo OpenXML (`ProductExcelTemplateService.php`):**
   - Construcción de archivos `.xlsx` reales mediante compresión ZIP nativa (`ZipArchive`), sin librerías pesadas ni dependencias externas.
   - **Hoja 1: `IMPORTACIÓN DE PRODUCTOS`:** Tabla estructurada con encabezados corporativos Tiendas Mass (Amarillo / Gris Oscuro), congelamiento de la fila de encabezados (`<pane ySplit="1"...>`), autofiltro (`<autoFilter ref="A1:H4"/>`), filas alternadas tipo cebra para lectura descansada, y formatos numéricos (`#,##0.00` para precios y `#,##0` para stock).
   - **Hoja 2: `INSTRUCCIONES`:** Guía detallada paso a paso explicando cada columna, campos obligatorios, sintaxis de precios, reglas de stock, políticas por sucursal y cómo asociar fotos.
   - **Hoja 3: `LISTAS DE REFERENCIA`:** Extracción dinámica desde MySQL de categorías activas (`Abarrotes y Despensa`, `Lácteos y Huevos`, `Bebidas y Licores`, `Limpieza y Cuidado`, `Frutas y Verduras`) y tipos válidos (`No Perecedero`, `Perecedero`), enlazados mediante fórmulas de validación de datos a las columnas de la Hoja 1 (`<dataValidations>`).
2. **Diferenciación Inteligente de Registros en Backend:**
   - **Producto Nuevo:** Inserta en `productos`, crea registros de inventario para la sucursal seleccionada, asigna lote inicial y movimiento Kardex bajo método PEPS.
   - **Producto Existente:** Actualiza precio de venta, costo base, categoría, tipo e imagen; y actualiza el stock de la sucursal destino con trazabilidad Kardex.
   - **Duplicado en Archivo:** Detecta si el mismo SKU se repite más de una vez en el archivo cargado y lo reporta con el número de fila correspondiente.
   - **Filas Inválidas / Errores:** Valida tipos de datos, precios <= 0, stock negativo y categorías inexistentes, reportando con precisión la causa exacta.
3. **Control Estricto de Permisos por Sucursal:**
   - Si el usuario autenticado tiene rol `Supervisor`, el backend valida que `sucursal_id` coincida obligatoriamente con su tienda asignada. De intentar importar en otra sede, se bloquea con código HTTP `403 Forbidden`.
   - Si el usuario es `Administrador`, puede seleccionar la sucursal objetivo.
4. **Vista Previa Interactiva y Reporte en Frontend:**
   - Soporte dual para archivos `.xlsx` (vía SheetJS client-side) y `.csv`.
   - Lectura y mapeo flexible de las 8 columnas del catálogo.
   - Previsualización en tabla con indicador de estado por fila (`Válido`, `Duplicado`, `Error`).
   - Contadores de resumen (`Total Leídos`, `Listos para Importar`, `Duplicados Omitidos`, `Con Errores`).
   - Modal de reporte final con conteo detallado de Nuevos Registrados, Actualizados, Omitidos y desglose de incidencias.

---

## 3. ESTRUCTURA Y ARCHIVOS MODIFICADOS / CREADOS

```
tiendasmass/
├── backend/
│   ├── app/
│   │   ├── Controllers/
│   │   │   └── ProductoController.php          [MODIFICADO: importExcel con dual-mapping, templateExcel con streaming XLSX]
│   │   ├── Repositories/
│   │   │   └── ProductoRepository.php          [MODIFICADO: métodos getBySku y getByBarcode agregados]
│   │   ├── Routes/
│   │   │   └── Router.php                      [MODIFICADO: normalización de prefijos /index.php]
│   │   └── Services/
│   │       └── ProductExcelTemplateService.php [CREADO: Generación nativa OpenXML multi-hoja, sanitización de imágenes]
│   └── tests/
│       └── excel_import_test.php               [CREADO: Batería completa de 26 pruebas automatizadas 100% aprobadas]
├── frontend/
│   ├── admin.html                              [MODIFICADO: Modal AdminExcelImportModal con 8 columnas y soporte XLSX]
│   ├── supervisor.html                         [MODIFICADO: Modal homologado para supervisores con restricción de sucursal]
│   └── src/
│       └── interfaz-administrador/
│           └── productos/
│               └── ExcelImportModal.jsx        [MODIFICADO: Componente React con previsualización de 8 columnas y descarga XLSX]
├── DOC/
│   ├── Informe_Mejora_Plantilla_Excel_Importacion_Masiva.md [CREADO: Informe técnico exhaustivo]
│   └── Plantilla_Oficial_Importacion_Productos_Mass.xlsx     [CREADO: Archivo XLSX oficial generado y validado]
└── docs/
    ├── Informe_Mejora_Plantilla_Excel_Importacion_Masiva.md [CREADO: Réplica en docs]
    └── Plantilla_Oficial_Importacion_Productos_Mass.xlsx     [CREADO: Réplica en docs]
```

---

## 4. DESCRIPCIÓN DE CADA COLUMNA DE LA PLANTILLA

| Columna | Tipo de Dato | Obligatorio | Regla de Validación y Comportamiento |
|---------|--------------|-------------|--------------------------------------|
| **FOTO** | Texto | Opcional | Nombre del archivo de imagen (`aceite_primor.jpg`), ruta relativa dentro del sistema (`assets/uploads/products/...`) o URL web (`https://...`). Si se deja vacío o se conserva `imagen_producto.jpg`, se asigna el placeholder corporativo por defecto. Se sanitiza contra directory traversal (`../`). Si el producto ya existía y la celda viene vacía, se conserva la imagen anterior. |
| **SKU / BARRAS** | Alfanumérico | Sí | Código de identificación único comercial. Debe tener entre 3 y 50 caracteres alfanuméricos. Se valida contra duplicados en el mismo archivo. Si ya existe en base de datos, clasifica la fila como actualización. |
| **NOMBRE DEL PRODUCTO** | Texto | Sí | Nombre comercial descriptivo (máx. 150 caracteres). No se permiten valores vacíos ni inyecciones de código. |
| **CATEGORÍA** | Texto | Sí | Debe coincidir con una de las categorías activas registradas en la tabla `categorias` (ej. `Abarrotes y Despensa`, `Lácteos y Huevos`, `Bebidas y Licores`, `Limpieza y Cuidado`, `Frutas y Verduras`). Se ofrece menú desplegable automático. Si no existe, se rechaza la fila. |
| **PRECIO DE VENTA** | Numérico Decimal | Sí | Valor numérico mayor a 0 con 2 decimales (ej. `8.90`). Representa el precio final al consumidor en Nuevos Soles (S/.). |
| **COSTO BASE** | Numérico Decimal | Sí | Valor numérico mayor a 0 con 2 decimales (ej. `6.20`). Representa el costo unitario de adquisición para cálculo de margen comercial y valoración de inventario bajo NIC 2. |
| **STOCK ACTUAL** | Numérico Entero | Sí | Número entero no negativo (>= 0). Se registra en la tabla `inventarios` y genera lote en `lotes` con trazabilidad Kardex en `movimientos_inventario`. |
| **TIPO** | Texto | Sí | Valores válidos: `No Perecedero` o `Perecedero`. Los productos perecederos activan el control de rotación estricta PEPS/FIFO con fecha de vencimiento estimada. Menú desplegable disponible. |

---

## 5. CONTROL DE INVENTARIO Y SEGURIDAD MULTI-SUCURSAL

1. **Aislamiento por Sucursal:**
   - La tabla `inventarios` vincula `(sucursal_id, producto_id)`. La importación actualiza o inserta el stock exclusivamente para la sucursal de destino.
2. **Defensa en Profundidad (RBAC):**
   - El supervisor no puede alterar el inventario de otras tiendas. Si el payload contiene un `sucursal_id` distinto al de su sesión JWT, el servidor aborta la operación con `HTTP 403 Forbidden`.
   - El administrador tiene potestad de definir la sucursal de destino desde el selector del panel corporativo.
3. **Consistencia Contable Kardex:**
   - Cada carga de stock positivo crea un registro atómico en `lotes` con código único `LOT-XXXX-YYMMDD` y su correspondiente movimiento `ENTRADA_COMPRA` en `movimientos_inventario`.

---

## 6. PRUEBAS REALIZADAS Y EVIDENCIAS

Se ejecutó la batería completa de pruebas automatizadas:

```bash
php backend/tests/excel_import_test.php
```
**Resultado:**
```
=== INICIANDO BATERÍA DE PRUEBAS: IMPORTACIÓN MASIVA Y PLANTILLA EXCEL ===

✓ [PASS] Generación física de archivo XLSX con tamaño válido (> 2KB)
✓ [PASS] Archivo generado es un contenedor ZIP/OpenXML válido
✓ [PASS] Hoja 1 presente: IMPORTACIÓN DE PRODUCTOS (sheet1.xml)
✓ [PASS] Hoja 2 presente: INSTRUCCIONES (sheet2.xml)
✓ [PASS] Hoja 3 presente: LISTAS DE REFERENCIA (sheet3.xml)
✓ [PASS] Estructura OpenXML completa: styles.xml y workbook.xml presentes
✓ [PASS] Hoja 1 contiene encabezados requeridos FOTO y SKU / BARRAS
✓ [PASS] Hoja 1 contiene NOMBRE DEL PRODUCTO y CATEGORÍA
✓ [PASS] Hoja 1 contiene PRECIO DE VENTA y COSTO BASE
✓ [PASS] Hoja 1 contiene STOCK ACTUAL y TIPO
✓ [PASS] Hoja 1 contiene definición de autofiltro
✓ [PASS] Hoja 1 contiene congelamiento de fila de encabezados
✓ [PASS] Hoja 1 contiene validación de datos para dropdowns
✓ [PASS] Obtención dinámica de categorías reales desde MySQL (al menos 5)
✓ [PASS] Guardado sincronizado en DOC/ y docs/ de Plantilla_Oficial_Importacion_Productos_Mass.xlsx
✓ [PASS] Fallback corporativo para celda de imagen vacía
✓ [PASS] Fallback corporativo para placeholder de plantilla 'imagen_producto.jpg'
✓ [PASS] Aceptación íntegra de URLs web seguras
✓ [PASS] Sanitización estricta contra Path Traversal (../)
✓ [PASS] Producto existente detectado correctamente por getBySku('SKU-ARR-001')
✓ [PASS] Producto inexistente detectado correctamente como NULL
✓ [PASS] Clasificación y creación exacta de 1 producto NUEVO
✓ [PASS] Clasificación y actualización exacta de 1 producto EXISTENTE
✓ [PASS] Detección exacta de 1 producto DUPLICADO en archivo
✓ [PASS] Detección exacta de 2 filas con ERRORES (categoría inválida y precio negativo)
✓ [PASS] Limpieza atómica de registros de prueba (DB permanece limpia)

=======================================================
RESULTADOS: 26 de 26 pruebas pasaron exitosamente.
=======================================================
```

Adicionalmente, se comprobaron las demás suites de integración:
- `backend/tests/api_test.php`: **7 de 7 pruebas aprobadas (100%)**
- `backend/tests/chatbot_test.php`: **10 de 10 pruebas aprobadas (100%)**
- Cobertura de Código (`scratch/generate_full_clover.php`): **95.38% de cobertura** (> 90.0% requerido).

---

## 7. CONCLUSIÓN

La mejora del módulo de importación masiva de productos de Tiendas Mass se incorporó de forma modular y limpia sobre la arquitectura existente, respetando rigurosamente:
1. Las 8 columnas del catálogo actual: `FOTO`, `SKU / BARRAS`, `NOMBRE DEL PRODUCTO`, `CATEGORÍA`, `PRECIO DE VENTA`, `COSTO BASE`, `STOCK ACTUAL`, `TIPO`.
2. Las 3 hojas oficiales estructuradas en formato Excel (.xlsx).
3. La rotación PEPS/FIFO y trazabilidad en Kardex.
4. El control y restricción de inventarios por sucursal.
5. La integridad de la base de datos MySQL y la estabilidad total del sistema.
