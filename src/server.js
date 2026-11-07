// =====================================================================
// ConviveTec - Servidor principal (Node.js + Express)
// =====================================================================
require('dotenv').config({ quiet: true });

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const authRoutes = require('./routes/auth.routes');
const reportesRoutes = require('./routes/reportes.routes');
const consultaRoutes = require('./routes/consulta.routes');
const mediacionesRoutes = require('./routes/mediaciones.routes');
const contenidosRoutes = require('./routes/contenidos.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const evaluacionRoutes = require('./routes/evaluacion.routes');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error('Falta JWT_SECRET en el archivo .env (mínimo 16 caracteres).');
    process.exit(1);
}

const app = express();

// No se registran direcciones IP en ningún archivo de la aplicación.
// "trust proxy" permite que el límite de peticiones funcione detrás de un proxy HTTPS.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------
// Encabezados de seguridad
// ---------------------------------------------------------------------
app.use(helmet({
    contentSecurityPolicy: {
        // Todo (Bootstrap, íconos y tipografías) se sirve desde este mismo servidor
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: null
        }
    },
    // Que el navegador no envíe la URL de ConviveTec a otros sitios
    referrerPolicy: { policy: 'no-referrer' }
}));

// Comprime las respuestas (gzip) para que el sitio cargue más rápido en celulares
app.use(compression());

app.use(express.json({ limit: '50kb' }));

// Límite general para la API
app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false
}));

// Límite de intentos de inicio de sesión
app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' }
}));

// ---------------------------------------------------------------------
// Rutas de la API
// ---------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/consulta', consultaRoutes);
app.use('/api/mediaciones', mediacionesRoutes);
app.use('/api/contenidos', contenidosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api', evaluacionRoutes);

// Ruta de la API que no existe
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
});

// ---------------------------------------------------------------------
// Librerías del frontend instaladas con npm (funcionan sin internet)
// ---------------------------------------------------------------------
const MODULOS = path.join(__dirname, '..', 'node_modules');
const CACHE_LIBRERIAS = { maxAge: '7d', immutable: true };

app.use('/vendor/bootstrap', express.static(path.join(MODULOS, 'bootstrap', 'dist'), CACHE_LIBRERIAS));
app.use('/vendor/bootstrap-icons', express.static(path.join(MODULOS, 'bootstrap-icons', 'font'), CACHE_LIBRERIAS));
app.use('/vendor/fuentes/fraunces', express.static(path.join(MODULOS, '@fontsource', 'fraunces'), CACHE_LIBRERIAS));
app.use('/vendor/fuentes/nunito-sans', express.static(path.join(MODULOS, '@fontsource', 'nunito-sans'), CACHE_LIBRERIAS));

// ---------------------------------------------------------------------
// Archivos del sitio (HTML, CSS, JS, imágenes)
// ---------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public'), {
    extensions: ['html'],
    maxAge: '1h'
}));

// Página no encontrada
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

// Manejo central de errores: nunca se envían detalles internos al navegador
app.use((error, req, res, next) => {
    console.error('Error:', error.message);

    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Datos con formato incorrecto.' });
    }

    res.status(500).json({ error: 'Ocurrió un error en el servidor. Inténtalo más tarde.' });
});

// ---------------------------------------------------------------------
// Arranque (HTTPS si hay certificado, HTTP en desarrollo)
// ---------------------------------------------------------------------
const PUERTO = Number(process.env.PORT) || 3000;

if (process.env.SSL_CERT && process.env.SSL_KEY) {
    const opciones = {
        cert: fs.readFileSync(process.env.SSL_CERT),
        key: fs.readFileSync(process.env.SSL_KEY)
    };

    https.createServer(opciones, app).listen(PUERTO, () => {
        console.log(`ConviveTec en https://localhost:${PUERTO}`);
    });
} else {
    http.createServer(app).listen(PUERTO, () => {
        console.log(`ConviveTec en http://localhost:${PUERTO}`);
        console.log('Modo desarrollo (HTTP). En producción configura SSL_CERT y SSL_KEY o usa un proxy HTTPS.');
    });
}
