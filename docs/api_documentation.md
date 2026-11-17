# DOCUMENTACIÓN DE LA API REST – TIENDAS MASS
## Sistema de Gestión Comercial, Control PEPS y Geolocalización

### 1. Convenciones Globales
* **Base URL en Entorno Local:** `http://localhost/tiendasmass/backend/public/api`
* **Formato de Comunicación:** JSON (`Content-Type: application/json; charset=utf-8`)
* **Autenticación:** Cabecera HTTP `Authorization: Bearer <token_jwt>`
* **Moneda e Impuestos:** Precios en Soles (`S/.`) e **IGV del 18%** desglosado.

---

### 2. Módulo de Autenticación (`/auth`)

#### `POST /auth/login-user`
Autentica personal interno (Administrador global o Supervisor de sucursal).
* **Payload:**
  ```json
  {
    "email": "admin@tiendasmass.pe",
    "password": "Admin123!"
  }
  ```
* **Respuesta exitosa (200):**
  ```json
  {
    "success": true,
    "message": "Sesión iniciada exitosamente.",
    "data": {
      "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
      "user": {
        "id": 1,
        "nombres": "Carlos",
        "apellidos": "Mendoza Valdivia",
        "email": "admin@tiendasmass.pe",
        "rol_nombre": "Administrador"
      }
    }
  }
  ```

#### `POST /auth/login-client`
Autentica a un cliente comprador en la tienda virtual.
* **Payload:**
  ```json
  {
    "email": "juan.perez@gmail.com",
    "password": "Cliente123!"
  }
  ```

#### `POST /auth/register-client`
Registra un nuevo cliente con **restricción documental estricta (DNI exacto 8 dígitos numéricos o PASAPORTE de 6 a 12 caracteres)**.
* **Payload:**
  ```json
  {
    "tipo_documento": "DNI",
    "numero_documento": "72458912",
    "nombres": "Juan Víctor",
    "apellidos": "Pérez Quispe",
    "email": "juan.perez@gmail.com",
    "password": "Cliente123!",
    "telefono": "987654321"
  }
  ```

---

### 3. Módulo de Inventarios y Algoritmos Inteligentes (`/inventarios`)

#### `GET /inventarios?sucursal_id=1`
Lista el inventario consolidado de la sucursal seleccionada.

#### `GET /inventarios/abc?sucursal_id=1`
Ejecuta y retorna el análisis de Pareto ABC (80/20) sobre el valor de inversión $V_i = \text{Stock} \times \text{Costo Unitario}$.
* **Respuesta exitosa:**
  ```json
  {
    "success": true,
    "data": {
      "resumen": {
        "total_inversion": 2575.50,
        "conteo_A": 5,
        "conteo_B": 2,
        "conteo_C": 1
      },
      "items": [...]
    }
  }
  ```

#### `GET /inventarios/reorder-alerts?sucursal_id=1`
Calcula el Punto de Reorden ($POR = d \times L + SS$) y emite semáforos de criticidad y sugerencia de compra.

#### `GET /inventarios/obsolescence?sucursal_id=1`
Retorna el semáforo de Consumo Responsable y el Índice de Obsolescencia ($IOI$) para lotes perecederos que vencen a 30, 15 y 7 días bajo directrices de la **NIC 2 (Valor Neto Realizable)**.

#### `POST /lotes/recepcion`
*(Requiere JWT: Administrador o Supervisor)*
Registra una compra y apertura de lote con fecha de ingreso y caducidad para el control PEPS.

---

### 4. Módulo de Pedidos y Delivery (`/pedidos` y `/delivery`)

#### `POST /pedidos`
Procesa una orden de compra bajo transacción atómica ACID:
1. Valida stock y bloquea registros con `FOR UPDATE`.
2. Aplica algoritmo PEPS asignando los lotes más antiguos disponibles.
3. Descuenta inventario consolidado.
4. Asienta los movimientos en el Kardex (`SALIDA_VENTA`).
5. Desglosa Subtotal y 18% IGV.
6. Registra orden en `deliveries` si aplica.

#### `POST /delivery/quote`
Valida si las coordenadas del cliente se encuentran dentro del radio de entrega ($km$) de la tienda y calcula el costo del envío.
* **Payload:**
  ```json
  {
    "sucursal_id": 1,
    "latitud": -12.0691,
    "longitud": -75.2092
  }
  ```

#### `GET /delivery/track/{pedido_id}`
Retorna el estado de la entrega, repartidor asignado y coordenadas GPS en tiempo real.
