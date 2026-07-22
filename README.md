# 💸 Expense Tracker SaaS

Una plataforma Full-Stack de gestión financiera personal. Esta aplicación permite a los usuarios llevar un control exacto de sus gastos a través de un dashboard interactivo en modo oscuro, combinando la entrada manual de datos con un motor de automatización que extrae transacciones directamente desde notificaciones bancarias en Gmail.

## ✨ Características Principales

* **Autenticación Segura (OAuth):** Inicio de sesión integrado con Google, gestionando acceso mediante tokens JWT sin almacenar contraseñas.
* **Sincronización Automatizada (Gmail API):** Motor de extracción en Python que lee, decodifica y parsea correos de notificaciones bancarias (optimizado para Santander) utilizando expresiones regulares (Regex) para registrar gastos automáticamente.
* **Arquitectura Multi-Usuario (SaaS):** Base de datos aislada donde cada usuario solo tiene acceso a su propia información, garantizado mediante Políticas de Seguridad a Nivel de Fila (RLS).
* **Dashboard Analítico:** Visualización de datos en tiempo real mediante gráficas interactivas (distribución por categorías y tendencias mensuales) usando Recharts.
* **Operaciones CRUD:** Interfaz intuitiva para crear, leer, actualizar y eliminar gastos manualmente, con validación de formularios y manejo de estados.

## 🛠️ Tecnologías y Arquitectura

**Frontend (Cliente)**
* **React (Vite):** Construcción de la interfaz de usuario.
* **Recharts:** Renderizado de gráficas SVG dinámicas.
* **CSS Grid & Flexbox:** Interfaz responsiva y diseño UI/UX en Dark Mode.
* **Supabase JS Client:** Conexión directa con los servicios de autenticación.

**Backend (Servidor)**
* **FastAPI (Python):** Creación de endpoints RESTful rápidos y tipados.
* **Google API Client:** Integración con OAuth 2.0 y consumo de Gmail API de forma programática.
* **Uvicorn:** Servidor ASGI para despliegue.

**Base de Datos (Infraestructura)**
* **Supabase (PostgreSQL):** Almacenamiento relacional.
* **Row-Level Security (RLS):** Blindaje de seguridad directo en la base de datos para restringir consultas por `usuario_id`.
* **JSONB:** Almacenamiento optimizado de tokens de sesión para conexiones persistentes.

## 🚀 Instalación y Despliegue Local

### Prerrequisitos
* Node.js (v18+)
* Python (3.10+)
* Cuenta en Supabase
* Credenciales OAuth en Google Cloud Console


### Seguridad de Datos y QA
* El proyecto fue diseñado pensando en la privacidad y la robustez funcional:
* Los endpoints del backend validan estrictamente el token de portador (Bearer Token) antes de procesar cualquier transacción.
* Prevención de errores de "Sesión Fantasma" mediante la verificación de la existencia de relaciones foráneas antes de ejecutar sentencias SQL.
* Manejo de excepciones en los scripts de extracción para evitar caídas del servidor ante correos con formatos no reconocidos.
* Desarrollado para simplificar la toma de decisiones financieras a través de la automatización.
