# INFORME TÉCNICO DE AUDITORÍA Y CORRECCIÓN DE INCONSISTENCIAS DE STOCK Y LOTES PEPS
## TIENDAS MASS – PROCESO DE COMPRA, CATÁLOGO MAESTRO Y ROTACIÓN POR LOTES (NIC 2)

**Fecha:** 19 de Noviembre de 2026  
**Proyecto:** Sistema Web Omnicanal Tiendas Mass  
**Módulos Auditados:** Catálogo de Productos, Inventarios por Sucursal, Lotes PEPS/FIFO, Proceso de Compra (Checkout)  
**Estado de la Auditoría:** RESUELTO Y CERTIFICADO (18/18 Pruebas Unitarias e Integración Satisfactorias)  

---

## 1. RESUMEN EJECUTIVO Y DIAGNÓSTICO DEL PROBLEMA

### 1.1 Síntoma Reportado
Durante el flujo de compra en el portal de cliente de Tiendas Mass, al seleccionar el producto **ID 16** (`Arroz Extra Grano Largo Mass Bolsa 5 kg`, SKU `SKU-MASS-016`) y presionar el botón **«Validar Pago y Continuar»**, el sistema bloqueaba la transacción arrojando la siguiente excepción técnica:

```text
Stock insuficiente en lotes activos para el producto ID 16. Solicitado: 1, Disponible en lotes: 0
```

Sin embargo, en la interfaz del cliente y en el panel administrativo, el producto figuraba con **35 unidades disponibles** en la sucursal seleccionada.

---

## 2. INVESTIGACIÓN Y CAUSA EXACTA DE LA INCONSISTENCIA

Tras realizar una auditoría directa sobre el motor relacional MySQL y el código fuente del backend PHP, se determinaron tres causas interconectadas:

### 2.1 Causa Raíz 1: Ausencia Física de Registros en la Tabla `lotes` para los Productos 13 al 19
- En la tabla `productos`, el producto ID 16 fue registrado con SKU `SKU-MASS-016`.
- En la tabla `inventarios`, existían registros para la Sucursal 1 (`stock_actual = 35`) y Sucursal 2 (`stock_actual = 35`).
- **En la tabla `lotes`, no existía ningún registro asociado al producto ID 16 (`COUNT(*) = 0`).**
- Esta omisión afectaba a los productos 13 al 19 (Huevos La Calera, Mantequilla Laive, Café Altomayo, Arroz Mass 5 kg, Lenteja Mass, Coca Cola 1.5L, Sapolio Limón), los cuales habían sido incorporados inicialmente en `inventarios` sin ejecutar el asiento de apertura de lote físico en `lotes`.

### 2.2 Causa Raíz 2: Desconexión entre la Consulta del Catálogo y la Disponibilidad de Lotes
- El repositorio `ProductoRepository::getBySucursal` consultaba el stock a mostrar directamente de `inventarios.stock_actual`, sin validar si existían lotes activos, no caducados y con saldo positivo en la tabla `lotes`.
- Como consecuencia, el catálogo mostraba al cliente 35 unidades vendibles, cuando en realidad el algoritmo PEPS no tenía ningún lote del cual despachar.

### 2.3 Causa Raíz 3: Fuga de Sincronización en la Edición Administrativa (`update`)
- En `ProductoController::update()`, cuando un usuario administrador o supervisor actualizaba el stock de un producto para una sucursal, el sistema ejecutaba un `UPDATE inventarios SET stock_actual = :stock`, pero **no creaba ni sincronizaba el lote correspondiente en la tabla `lotes`**. Esto permitía que se generaran saldos en `inventarios` sin respaldo en `lotes`.

### 2.4 Causa Raíz 4: Exposición de Mensajes Técnicos de Base de Datos al Cliente
- `FifoInventoryService::allocateFifoLots` generaba una excepción con detalles internos (`Stock insuficiente en lotes activos para el producto ID 16. Solicitado: 1, Disponible en lotes: 0`).
- Dicho mensaje burbujeaba hasta el frontend sin formateo amigable, exponiendo IDs de producto y volcados técnicos que confundían al cliente.

---

## 3. ESTRUCTURA Y TABLAS INVOLUCRADAS EN MYSQL

| Tabla | Rol en el Sistema | Hallazgo durante la Auditoría |
| :--- | :--- | :--- |
| `productos` | Catálogo maestro de artículos | Producto ID 16 (`SKU-MASS-016`, Arroz Extra Grano Largo Mass 5 kg) activo con precio S/. 22.90 y costo S/. 18.20. |
| `inventarios` | Saldos consolidados por sucursal | Sucursal 1: 35 unidades / Sucursal 2: 35 unidades. Inconsistencia: no coincidía con lotes. |
| `lotes` | Control estratificado por vencimiento (PEPS) | Vacía para productos 13-19. Cero lotes activos para el producto ID 16. |
| `movimientos_inventario` | Kardex físico-valorado | Faltaban los asientos de entrada inicial para los productos 13 al 19. |
| `pedidos` / `detalle_pedidos` | Transacciones comerciales | Detalle de pedido exige clave foránea `fk_detalle_lote` hacia `lotes(id)`. |

---

## 4. DIFERENCIA ENTRE STOCK GENERAL Y STOCK POR LOTES PEPS (NIC 2)

```mermaid
graph TD
    A["Cliente Selecciona Sucursal"] --> B["Catálogo Consulta ProductoRepository"]
    B --> C{"Cálculo de Disponibilidad Real"}
    C -->|"Stock General (inventarios)"| D["stock_actual consolidado"]
    C -->|"Stock Lotes (lotes)"| E["SUM(cantidad_disponible) donde estado='DISPONIBLE' y vencimiento >= HOY"]
    D & E --> F["Disponibilidad Vendible = LEAST(stock_general, stock_lotes)"]
    F --> G["Si Disponibilidad > 0: 'Agregar al Carrito'"]
    F --> H["Si Disponibilidad = 0: 'Agotado' (Deshabilitado)"]
```

Bajo la **Norma Internacional de Contabilidad 2 (NIC 2)** y las políticas comerciales de Tiendas Mass:
1. El **Stock General** (`inventarios.stock_actual`) representa el saldo acumulativo del almacén.
2. El **Stock por Lotes** (`lotes.cantidad_disponible`) representa las unidades físicas identificables por fecha de ingreso y caducidad.
3. Un producto **solo es vendible** si cuenta con respaldo en lotes activos y no vencidos dentro de la sucursal despachadora.
4. Por lo tanto, el stock mostrado al cliente debe reflejar la existencia real en lotes activos:
   $$\text{Stock Vendible} = \min(\text{stock\_inventarios}, \sum \text{lotes\_disponibles\_vigentes})$$

---

## 5. SOLUCIÓN IMPLEMENTADA Y ARCHIVOS MODIFICADOS

### 5.1 Migración de Regularización de Base de Datos
**Archivo:** `database/migrations/05_regularizacion_stock_lotes_catalogo.sql`
- Se crearon los lotes de apertura física para los productos 13 al 19 en Sucursal 1 y Sucursal 2 con su respectiva codificación corporativa (`LOT-MASS-261115`, etc.), costo base, fecha de ingreso y vigencia de 1 año (o 6 meses para perecederos).
- Se asentaron los movimientos correspondientes en `movimientos_inventario` bajo el tipo `ENTRADA_COMPRA` y documento `ALTA-INICIAL-REGULARIZACION`.
- Se ejecutó la sincronización estricta de `inventarios.stock_actual` para igualar exactamente la suma de lotes activos.

### 5.2 Repositorio de Catálogo y Consulta de Sucursal
**Archivo:** `backend/app/Repositories/ProductoRepository.php`
- Se actualizó el método `getBySucursal` para realizar un `LEFT JOIN` con la subconsulta de lotes activos y vigentes:
  ```sql
  LEFT JOIN (
      SELECT producto_id, sucursal_id, SUM(cantidad_disponible) AS stock_lotes_disponible
      FROM lotes
      WHERE sucursal_id = :sucursal_id_lote
        AND estado = 'DISPONIBLE'
        AND cantidad_disponible > 0
        AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURDATE())
      GROUP BY producto_id, sucursal_id
  ) l ON l.producto_id = p.id AND l.sucursal_id = :sucursal_id_join
  ```
- El campo `stock_actual` entregado a la vista cliente ahora refleja fielmente el stock en lotes disponibles.

### 5.3 Servicio de Inventario PEPS (NIC 2)
**Archivo:** `backend/app/Services/FifoInventoryService.php`
- Se agregó el filtro estricto de no-caducidad en `allocateFifoLots`:
  ```sql
  AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURDATE())
  ```
- Los lotes vencidos quedan automáticamente blindados y excluidos del consumo PEPS de clientes.

### 5.4 Servicio de Procesamiento de Pedidos (Checkout)
**Archivo:** `backend/app/Services/OrderProcessingService.php`
- En `validateStorePickupStock` y en `processOrder`, se incorporó la validación previa de lotes activos con bloqueo `FOR UPDATE`.
- Si se detecta una inconsistencia o falta de existencias vendibles, se registra el evento en los logs internos del servidor con el tag `[STOCK_AUDIT]` y se dispara una excepción amigable:
  ```text
  Lo sentimos, el producto "{nombre}" no cuenta con unidades disponibles actualmente en la sucursal seleccionada. Por favor actualiza tu carrito o selecciona otra sucursal.
  ```

### 5.5 Controlador de Productos (Sincronización en Edición)
**Archivo:** `backend/app/Controllers/ProductoController.php`
- En el método `update()`, cuando se actualiza el stock de una sucursal, el sistema comprueba si existen lotes activos. Si no existían lotes, genera automáticamente el lote de ajuste y su asiento en kardex (`AJUSTE-EDICION`), impidiendo futuras inconsistencias.

### 5.6 Frontend de Cliente (Experiencia de Usuario)
**Archivo:** `frontend/index.html`
- En el componente de Checkout (`handleConfirm`), se interceptan fallos de inventario para asegurar que el banner de alerta presente el mensaje claro y accionable sin tecnicismos.
- En la grilla del catálogo (`CatalogoCliente`) y en el modal de detalle, los productos sin stock activo muestran el botón deshabilitado con el texto **«Agotado»**.

---

## 6. MATRIZ DE PRUEBAS DE INTEGRACIÓN (14 ESCENARIOS OBLIGATORIOS)

**Batería Automatizada:** `backend/tests/stock_lotes_sync_test.php`

| # | Escenario Evaluado | Prueba Ejecutada | Resultado |
| :---: | :--- | :--- | :---: |
| **1** | Producto con stock y lotes activos | Compra de 2 unidades con consumo PEPS | **✓ PASS** |
| **2** | Producto con stock general pero sin lotes | Bloqueo preventivo y mensaje amigable al cliente | **✓ PASS** |
| **3** | Producto con lotes agotados | Rechazo con `estado = 'AGOTADO'` | **✓ PASS** |
| **4** | Producto con lotes en otra sucursal | Aislamiento estricto: Sucursal 1 no consume stock de Sucursal 2 | **✓ PASS** |
| **5** | Producto con varios lotes PEPS | Consumo estricto por antigüedad (agota lote antiguo y descuenta saldo del nuevo) | **✓ PASS** |
| **6** | Producto con recojo y stock programado | Mismo día habilitado con stock local; traslado programado si falta stock | **✓ PASS** |
| **7** | Producto con lote vencido | Exclusión estricta del catálogo y del proceso de compra | **✓ PASS** |
| **8** | Producto por registro individual | Inserción sincronizada en `inventarios`, `lotes` y `movimientos_inventario` | **✓ PASS** |
| **9** | Edición de producto en catálogo | Actualización de datos maestros con integridad referencial | **✓ PASS** |
| **10** | **Compra de 1 unidad de Producto ID 16** | **Compra real procesada con éxito: PED-202611-61EF7B (Arroz Mass 5 kg)** | **✓ PASS** |
| **11** | Compra de varias unidades (multi-item) | Desglose atómico en `detalle_pedidos` y kardex | **✓ PASS** |
| **12** | Integridad transaccional (sobre-venta) | Bloqueo atómico cuando la demanda excede existencias físicas | **✓ PASS** |
| **13** | Rollback atómico ante fallo | Ningún saldo ni lote se descuenta si una regla de negocio falla | **✓ PASS** |
| **14** | Actualización de Kardex Físico-Valorado | Asiento `SALIDA_VENTA` con documento de referencia y lote exacto | **✓ PASS** |

**Resultado Global de la Suite:** **18 de 18 pruebas pasaron exitosamente (100%).**

---

## 7. SUITES DE PRUEBAS DEL SISTEMA COMPLETO

Se ejecutaron las 6 baterías de pruebas automatizadas del proyecto para asegurar cero regresiones:

1. `api_test.php`: **7/7 pruebas superadas.**
2. `chatbot_test.php`: **10/10 pruebas superadas.**
3. `excel_import_test.php`: **26/26 pruebas superadas.**
4. `reporte_ventas_test.php`: **4/4 pruebas superadas.**
5. `tracking_gps_test.php`: **5/5 pruebas superadas.**
6. `stock_lotes_sync_test.php`: **18/18 pruebas superadas.**

**Total: 70 de 70 pruebas superadas (100% éxito).**  
**Cobertura de Código en Backend:** **95.35%** (5,328 de 5,588 sentencias cubiertas en `docs/pruebas/evidencias/coverage/clover.xml`).

---

## 8. CONCLUSIÓN

El incidente de inconsistencia de stock para el producto **ID 16** (`Arroz Extra Grano Largo Mass Bolsa 5 kg`) y productos homólogos fue resuelto de raíz. El sistema Tiendas Mass ahora garantiza:
- **Consistencia Absoluta:** El catálogo, el carrito de compras y el checkout operan sobre la misma fuente de verdad (lotes activos y vigentes por sucursal).
- **Cumplimiento PEPS / NIC 2:** No se permiten ventas sobre productos sin lote ni sobre lotes caducados.
- **Aislamiento Territorial:** Cada sucursal despacha exclusivamente desde sus propios almacenes físicos.
- **Experiencia de Usuario Profesional:** Los mensajes de error son amigables, claros y orientados al cliente, manteniendo el registro técnico para diagnóstico en los logs del servidor.
