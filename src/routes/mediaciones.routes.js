// Rutas de solicitudes de mediación
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { verificarToken, permitirRoles, registrarAuditoria } = require('../middleware/auth');
const { cifrar, descifrar, generarFolio, generarClave } = require('../utils/seguridad');
const validar = require('../utils/validar');

const router = express.Router();

const ESTADOS = ['pendiente', 'programada', 'realizada', 'cancelada'];

const limiteSolicitudes = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Has enviado varias solicitudes seguidas. Espera unos minutos.' }
});

async function obtenerMediacionAsignada(req, res) {
    const id = validar.entero(req.params.id, 1, 2147483647);
    const [filas] = await pool.query('SELECT * FROM mediaciones WHERE id = ?', [id]);
    const mediacion = filas[0];

    if (!mediacion) {
        res.status(404).json({ error: 'La solicitud no existe.' });
        return null;
    }

    if (mediacion.orientador_id !== req.usuario.id) {
        res.status(403).json({ error: 'Solo el orientador asignado puede ver o modificar esta solicitud.' });
        return null;
    }

    return mediacion;
}

// =====================================================================
// RUTA PÚBLICA
// =====================================================================

// POST /api/mediaciones  -> solicitar una sesión de mediación
router.post('/', limiteSolicitudes, async (req, res) => {
    const datos = {
        nombre: validar.texto(req.body.nombre, 120),
        grupo: validar.texto(req.body.grupo, 30) || null,
        contacto: validar.texto(req.body.contacto, 150),
        partes: validar.texto(req.body.partes, 500),
        motivo: validar.texto(req.body.motivo, 2000),
        disponibilidad: validar.texto(req.body.disponibilidad, 150) || null,
        es_menor: req.body.es_menor === true,
        consentimiento_tutor: req.body.consentimiento_tutor === true,
        acepta_aviso: req.body.acepta_aviso === true
    };

    if (datos.nombre.length < 3) {
        return res.status(400).json({ error: 'Escribe tu nombre.' });
    }

    if (datos.contacto.length < 5) {
        return res.status(400).json({ error: 'Escribe un correo o teléfono de contacto.' });
    }

    if (datos.partes.length < 3) {
        return res.status(400).json({ error: 'Indica con quién deseas dialogar.' });
    }

    if (datos.motivo.length < 20) {
        return res.status(400).json({ error: 'Describe el motivo con al menos 20 caracteres.' });
    }

    if (datos.es_menor && !datos.consentimiento_tutor) {
        return res.status(400).json({ error: 'Si eres menor de edad, tu madre, padre o tutor debe estar enterado.' });
    }

    if (!datos.acepta_aviso) {
        return res.status(400).json({ error: 'Debes aceptar el aviso de privacidad.' });
    }

    const clave = generarClave();
    const claveHash = await bcrypt.hash(clave, 10);
    const folio = generarFolio('MD');

    await pool.query(
        `INSERT INTO mediaciones
            (folio, clave_hash, nombre_cifrado, grupo, contacto_cifrado, partes_cifrado,
             motivo_cifrado, disponibilidad, es_menor, consentimiento_tutor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            folio,
            claveHash,
            cifrar(datos.nombre),
            datos.grupo,
            cifrar(datos.contacto),
            cifrar(datos.partes),
            cifrar(datos.motivo),
            datos.disponibilidad,
            datos.es_menor ? 1 : 0,
            datos.consentimiento_tutor ? 1 : 0
        ]
    );

    res.status(201).json({ folio, clave });
});

// =====================================================================
// RUTAS PARA ORIENTACIÓN Y ADMINISTRACIÓN
// =====================================================================

// GET /api/mediaciones  -> lista general (sin nombres ni motivos)
router.get('/', verificarToken, permitirRoles('orientador', 'admin'), async (req, res) => {
    const condiciones = [];
    const valores = [];

    const estado = validar.opcion(req.query.estado, ESTADOS);

    if (estado) {
        condiciones.push('m.estado = ?');
        valores.push(estado);
    }

    if (req.query.asignacion === 'mios') {
        condiciones.push('m.orientador_id = ?');
        valores.push(req.usuario.id);
    } else if (req.query.asignacion === 'sin_asignar') {
        condiciones.push('m.orientador_id IS NULL');
    }

    const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

    const [filas] = await pool.query(
        `SELECT m.id, m.folio, m.grupo, m.estado, m.fecha_sesion, m.es_menor,
                m.consentimiento_tutor, m.orientador_id, u.nombre AS orientador, m.creado_en
         FROM mediaciones m
         LEFT JOIN usuarios u ON u.id = m.orientador_id
         ${where}
         ORDER BY FIELD(m.estado, 'pendiente', 'programada', 'realizada', 'cancelada'),
                  m.creado_en DESC`,
        valores
    );

    res.json(filas.map((fila) => ({
        ...fila,
        puede_ver: fila.orientador_id === req.usuario.id
    })));
});

// GET /api/mediaciones/:id  -> detalle (solo orientador asignado)
router.get('/:id', verificarToken, permitirRoles('orientador'), async (req, res) => {
    const m = await obtenerMediacionAsignada(req, res);

    if (!m) {
        return;
    }

    await registrarAuditoria(req.usuario.id, 'ver_mediacion', 'mediacion', m.id);

    res.json({
        id: m.id,
        folio: m.folio,
        nombre: descifrar(m.nombre_cifrado),
        grupo: m.grupo,
        contacto: descifrar(m.contacto_cifrado),
        partes: descifrar(m.partes_cifrado),
        motivo: descifrar(m.motivo_cifrado),
        disponibilidad: m.disponibilidad,
        es_menor: m.es_menor,
        consentimiento_tutor: m.consentimiento_tutor,
        estado: m.estado,
        fecha_sesion: m.fecha_sesion,
        lugar_sesion: m.lugar_sesion,
        acuerdos: descifrar(m.acuerdos_cifrado),
        creado_en: m.creado_en
    });
});

// POST /api/mediaciones/:id/tomar
router.post('/:id/tomar', verificarToken, permitirRoles('orientador'), async (req, res) => {
    const id = validar.entero(req.params.id, 1, 2147483647);

    const [resultado] = await pool.query(
        'UPDATE mediaciones SET orientador_id = ? WHERE id = ? AND orientador_id IS NULL',
        [req.usuario.id, id]
    );

    if (resultado.affectedRows === 0) {
        return res.status(409).json({ error: 'La solicitud ya fue tomada o no existe.' });
    }

    await registrarAuditoria(req.usuario.id, 'tomar_mediacion', 'mediacion', id);

    res.json({ mensaje: 'Solicitud asignada a ti.' });
});

// PUT /api/mediaciones/:id/asignar  -> el administrador asigna un orientador
router.put('/:id/asignar', verificarToken, permitirRoles('admin'), async (req, res) => {
    const id = validar.entero(req.params.id, 1, 2147483647);
    const orientadorId = validar.entero(req.body.orientador_id, 1, 2147483647);

    const [orientadores] = await pool.query(
        "SELECT id FROM usuarios WHERE id = ? AND rol = 'orientador' AND activo = 1",
        [orientadorId]
    );

    if (!orientadores.length) {
        return res.status(400).json({ error: 'Selecciona un orientador válido.' });
    }

    await pool.query('UPDATE mediaciones SET orientador_id = ? WHERE id = ?', [orientadorId, id]);
    await registrarAuditoria(req.usuario.id, 'asignar_mediacion', 'mediacion', id);

    res.json({ mensaje: 'Orientador asignado.' });
});

// PUT /api/mediaciones/:id  -> programar sesión, registrar acuerdos
router.put('/:id', verificarToken, permitirRoles('orientador'), async (req, res) => {
    const m = await obtenerMediacionAsignada(req, res);

    if (!m) {
        return;
    }

    const estado = validar.opcion(req.body.estado, ESTADOS) || m.estado;
    const lugar = validar.texto(req.body.lugar_sesion, 120) || null;
    const acuerdos = validar.texto(req.body.acuerdos, 3000);

    let fechaSesion = null;

    if (req.body.fecha_sesion) {
        const fecha = new Date(req.body.fecha_sesion);

        if (isNaN(fecha.getTime())) {
            return res.status(400).json({ error: 'La fecha de la sesión no es válida.' });
        }

        // Se guarda tal como la escribió el orientador (hora local de la escuela)
        fechaSesion = String(req.body.fecha_sesion).replace('T', ' ').slice(0, 16) + ':00';
    }

    if (estado === 'programada' && !fechaSesion) {
        return res.status(400).json({ error: 'Para programar la sesión indica fecha y hora.' });
    }

    await pool.query(
        `UPDATE mediaciones
         SET estado = ?, fecha_sesion = ?, lugar_sesion = ?, acuerdos_cifrado = ?
         WHERE id = ?`,
        [estado, fechaSesion, lugar, acuerdos ? cifrar(acuerdos) : null, m.id]
    );

    await registrarAuditoria(req.usuario.id, 'actualizar_mediacion', 'mediacion', m.id);

    res.json({ mensaje: 'Solicitud actualizada.' });
});

module.exports = router;
