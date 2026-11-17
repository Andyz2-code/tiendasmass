# Tiendas Mass - Sistema de Gestión Comercial e Inventarios PEPS

Sistema integral desarrollado para **XAMPP (Apache + PHP Nativo + MySQL)** con interfaz visual en **HTML5, CSS y JavaScript Puro**.

---

## 🏗️ Arquitectura del Proyecto

```text
tiendasmass/
├── .htaccess                   # Configuración de Apache para enrutamiento limpio
├── .env                        # Configuración de conexión MySQL
├── frontend/                   # Interfaz de usuario (sin dependencias ni compiladores)
│   ├── index.html              # Catálogo interactivo de la tienda
│   ├── admin.html              # Panel Backoffice y control de inventarios PEPS
│   ├── css/
│   │   └── style.css           # Estilos corporativos Tiendas Mass (#FDCB02, #E30613)
│   └── js/
│       ├── app.js              # Controlador principal del catálogo y filtros
│       ├── cart.js             # Carrito de compras y cálculo de envíos
│       ├── auth.js             # Autenticación y perfil de cliente
│       └── admin.js            # Gestión de productos, lotes y pedidos
├── backend/                    # API REST con arquitectura MVC en PHP Nativo
│   ├── app/
│   │   ├── Controllers/        # Controladores (Producto, Pedido, Auth, Inventario)
│   │   ├── Repositories/       # Consultas SQL (PDO)
│   │   └── Routes/             # Enrutamiento de la API
│   └── public/api/             # Puntos de enlace JSON
└── database/                   # Base de datos relacional
    └── tiendas_mass.sql        # Script de creación y datos de prueba
```

---

## 🚀 Cómo Ejecutar en XAMPP

1. **Iniciar Servicios en el Panel de Control de XAMPP:**
   - Iniciar **Apache** (Puerto 80).
   - Iniciar **MySQL** (Puerto 3306).

2. **Abrir en el Navegador:**
   - **Tienda de Clientes:** `http://localhost/tiendasmass/`
   - **Panel Administrativo:** `http://localhost/tiendasmass/admin`
   - **API JSON de Productos:** `http://localhost/tiendasmass/backend/public/api/productos`
Actualización de registro
