# ConviveTec

Plataforma web para la convivencia saludable y la prevención de conflictos en comunidades escolares.

Proyecto de **Ética profesional** · Universidad Politécnica de Tulancingo · Grupo 403
Equipo: Josué Joel Macias Ortega, Angeles Abygail Méndez Aguirre, José Alfredo Castro Mendoza y Johan Derek Cabañas Salazar.

## Funciones

| Función | Quién la usa | Descripción |
|---|---|---|
| Reporte anónimo | Alumnos (sin cuenta) | Formulario que genera un **folio** y una **clave** para dar seguimiento sin revelar la identidad. |
| Consulta de folio | Alumnos (sin cuenta) | Muestra el avance del caso y permite conversar con orientación. |
| Solicitud de mediación | Alumnos (sin cuenta) | Pide una sesión de diálogo; pide consentimiento del tutor si es menor de edad. |
| Contenido formativo | Todos | Infografías, cápsulas y consejos sobre asertividad, empatía y emociones. |
| Panel de seguimiento | Orientadores | Casos ordenados por urgencia, cambio de estado, mensajes al reportante y notas internas. |
| Canalizar situación | Docentes | Envían a orientación conflictos que observan en el aula. |
| Administración | Administrador | Asigna casos, administra contenido y usuarios, revisa la bitácora de auditoría. |
| Evaluación (SUS) | Usuarios de prueba | Cuestionario de usabilidad SUS; el panel muestra el promedio. |

## Tecnologías

- **Frontend:** HTML5, CSS3, JavaScript y Bootstrap 5 (servido localmente, funciona sin internet).
- **Backend:** Node.js 18+ con Express 5.
- **Base de datos:** MySQL 8 (o MariaDB 10.6+).
- **Seguridad:** contraseñas con bcrypt, sesiones con JWT, control de acceso por roles, cifrado AES-256-GCM de los datos sensibles, encabezados de seguridad con Helmet, límite de peticiones y soporte para HTTPS.

## Instalación

1. Instala [Node.js](https://nodejs.org) (18 o superior) y MySQL.
2. Abre una terminal en la carpeta del proyecto e instala las dependencias:

   ```bash
   npm install
   ```

3. Copia `.env.example` como `.env` y escribe tu usuario y contraseña de MySQL.
4. Genera dos claves aleatorias y pégalas en `.env` (una en `JWT_SECRET` y otra en `CLAVE_CIFRADO`):

   ```bash
   npm run generar-clave
   ```

5. Crea la base de datos con datos de demostración (**borra las tablas si ya existían**):

   ```bash
   npm run setup
   ```

6. Inicia el servidor y abre <http://localhost:3000>:

   ```bash
   npm start
   ```

### Cuentas de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@convivetec.mx | Admin2026* |
| Orientador | orientacion1@convivetec.mx | Orienta2026* |
| Orientador | orientacion2@convivetec.mx | Orienta2026* |
| Docente | docente@convivetec.mx | Docente2026* |

Cambia estas contraseñas antes de usar el sistema con datos reales.

## Estructura

```
convivetec/
├── database/
│   └── schema.sql           Tablas y contenido formativo inicial
├── public/                  Sitio web (lo que ve el navegador)
│   ├── css/                 estilos.css y fuentes.css
│   ├── img/                 Imágenes (se pueden reemplazar libremente)
│   ├── js/                  Un archivo por página + comun.js
│   ├── index.html           Inicio
│   ├── reportar.html        Reporte anónimo
│   ├── consultar.html       Consulta con folio y clave
│   ├── mediacion.html       Solicitud de mediación
│   ├── contenido.html       Contenido formativo
│   ├── articulo.html        Detalle de un contenido
│   ├── evaluacion.html      Cuestionario SUS
│   ├── privacidad.html      Aviso de privacidad
│   ├── login.html           Acceso del personal
│   └── panel.html           Panel por roles
└── src/
    ├── config/db.js         Conexión a MySQL
    ├── middleware/auth.js   JWT, roles y bitácora
    ├── routes/              Rutas de la API
    ├── scripts/init-db.js   Crea la base y los datos de demostración
    ├── utils/               Cifrado, folios y validaciones
    └── server.js            Servidor Express
```

## Cambiar imágenes

Las imágenes están en `public/img/`. Para cambiar una, reemplaza el archivo o cambia la ruta en el HTML
(por ejemplo `img/hero.svg` en `index.html`). Las imágenes del contenido formativo se eligen desde el panel
del administrador escribiendo la ruta, por ejemplo `img/mi-infografia.png`.

## API principal

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/reportes` | Público |
| POST | `/api/consulta` | Público (folio + clave) |
| POST | `/api/consulta/mensaje` | Público (folio + clave) |
| POST | `/api/mediaciones` | Público |
| GET | `/api/contenidos` | Público |
| POST | `/api/encuestas` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/reportes` | Orientador, administrador |
| GET | `/api/reportes/:id` | Solo el orientador asignado |
| POST | `/api/reportes/:id/tomar` | Orientador |
| PUT | `/api/reportes/:id` | Solo el orientador asignado |
| POST | `/api/reportes/:id/seguimientos` | Solo el orientador asignado |
| PUT | `/api/reportes/:id/asignar` | Administrador |
| POST | `/api/reportes/canalizar` | Docente |
| GET | `/api/estadisticas` | Orientador, administrador |
| GET | `/api/auditoria` | Administrador |
| CRUD | `/api/contenidos`, `/api/usuarios` | Administrador |

## HTTPS

En producción configura `SSL_CERT` y `SSL_KEY` en `.env`, o coloca el servidor detrás de un proxy con HTTPS
(por ejemplo Nginx o el servicio de hosting).
