// Encuesta de evaluación del prototipo (SUS), estadísticas y bitácora
const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const validar = require('../utils/validar');

const router = express.Router();

const TIPOS_USUARIO = ['alumno', 'docente', 'orientador', 'padre'];

const limiteEncuestas = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados envíos. Espera unos minutos.' }
});

/**
 * Calcula el puntaje SUS (System Usability Scale) de 0 a 100.
 * Preguntas impares: (respuesta - 1)
 * Preguntas pares:   (5 - respuesta)
 * La suma se multiplica por 2.5
 */
function calcularSUS(respuestas) {
    let suma = 0;

    respuestas.forEach((valor, indice) => {
        const esImpar = (indice + 1) % 2 === 1;
        suma += esImpar ? valor - 1 : 5 - valor;
    });

    return suma * 2.5;
}

// POST /api/encuestas  -> público, sin datos personales
router.post('/encuestas', limiteEncuestas, async (req, res) => {
    const tipoUsuario = validar.opcion(req.body.tipo_usuario, TIPOS_USUARIO);
    const respuestas = Array.isArray(req.body.respuestas) ? req.body.respuestas : [];
    const utilidad = validar.entero(req.body.utilidad, 1, 5);
    const segundos = validar.entero(req.body.segundos_reporte, 1, 3600);
    const comentario = validar.texto(req.body.comentario, 500) || null;

    const validas = respuestas.length === 10 && respuestas.every((r) => validar.entero(r, 1, 5) !== null);

    if (!tipoUsuario || !validas || !utilidad) {
        return res.status(400).json({ error: 'Responde todas las preguntas.' });
    }

    const valores = respuestas.map(Number);
    const puntaje = calcularSUS(valores);

    await pool.query(
        `INSERT INTO encuestas (tipo_usuario, respuestas, puntaje_sus, utilidad, segundos_reporte, comentario)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tipoUsuario, JSON.stringify(valores), puntaje, utilidad, segundos, comentario]
    );

    res.status(201).json({ puntaje_sus: puntaje });
});

// GET /api/estadisticas  -> resumen general para el panel
router.get('/estadisticas', verificarToken, permitirRoles('admin', 'orientador'), async (req, res) => {
    const [porEstado] = await pool.query(
        'SELECT estado, COUNT(*) AS total FROM reportes GROUP BY estado'
    );

    const [porCategoria] = await pool.query(
        'SELECT categoria, COUNT(*) AS total FROM reportes GROUP BY categoria ORDER BY total DESC'
    );

    const [porUrgencia] = await pool.query(
        "SELECT urgencia, COUNT(*) AS total FROM reportes WHERE estado NOT IN ('cerrado', 'descartado') GROUP BY urgencia"
    );

    const [mediaciones] = await pool.query(
        'SELECT estado, COUNT(*) AS total FROM mediaciones GROUP BY estado'
    );

    const [sinAsignar] = await pool.query(
        "SELECT COUNT(*) AS total FROM reportes WHERE orientador_id IS NULL AND estado NOT IN ('cerrado', 'descartado')"
    );

    const [encuestas] = await pool.query(
        `SELECT COUNT(*) AS respuestas,
                ROUND(AVG(puntaje_sus), 1) AS sus_promedio,
                ROUND(AVG(utilidad), 2) AS utilidad_promedio,
                ROUND(AVG(segundos_reporte)) AS segundos_promedio
         FROM encuestas`
    );

    res.json({
        reportes_por_estado: porEstado,
        reportes_por_categoria: porCategoria,
        abiertos_por_urgencia: porUrgencia,
        mediaciones_por_estado: mediaciones,
        sin_asignar: sinAsignar[0].total,
        evaluacion: encuestas[0]
    });
});

// GET /api/auditoria  -> últimos movimientos (solo administrador)
router.get('/auditoria', verificarToken, permitirRoles('admin'), async (req, res) => {
    const [filas] = await pool.query(
        `SELECT a.id, a.accion, a.entidad, a.entidad_id, a.creado_en, u.nombre AS usuario, u.rol
         FROM auditoria a
         LEFT JOIN usuarios u ON u.id = a.usuario_id
         ORDER BY a.creado_en DESC, a.id DESC
         LIMIT 150`
    );

    res.json(filas);
});

// GET /api/orientadores  -> lista para asignar casos (solo administrador)
router.get('/orientadores', verificarToken, permitirRoles('admin'), async (req, res) => {
    const [filas] = await pool.query(
        "SELECT id, nombre FROM usuarios WHERE rol = 'orientador' AND activo = 1 ORDER BY nombre"
    );

    res.json(filas);
});

module.exports = router;
