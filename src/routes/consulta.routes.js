// Consulta del avance de un caso con folio + clave (sin cuenta, sin revelar identidad)
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { descifrar } = require('../utils/seguridad');
const { agregarSeguimiento } = require('./reportes.routes');
const validar = require('../utils/validar');

const router = express.Router();

// Evita que alguien intente adivinar folios y claves a fuerza bruta
const limiteConsultas = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }
});

const ERROR_GENERICO = 'El folio o la clave no son correctos.';

/**
 * Busca un caso por folio y valida la clave.
 * Devuelve { tipo, fila } o null.
 */
async function buscarCaso(folioRecibido, claveRecibida) {
    const folio = validar.texto(folioRecibido, 20).toUpperCase();
    const clave = validar.texto(claveRecibida, 10).toUpperCase();

    if (!/^(CT|MD)-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(folio) || clave.length !== 6) {
        return null;
    }

    const tabla = folio.startsWith('CT') ? 'reportes' : 'mediaciones';
    const [filas] = await pool.query(`SELECT * FROM ${tabla} WHERE folio = ?`, [folio]);
    const fila = filas[0];

    if (!fila) {
        return null;
    }

    const coincide = await bcrypt.compare(clave, fila.clave_hash);

    if (!coincide) {
        return null;
    }

    return {
        tipo: tabla === 'reportes' ? 'reporte' : 'mediacion',
        fila
    };
}

// POST /api/consulta  -> estado del caso
router.post('/', limiteConsultas, async (req, res) => {
    const caso = await buscarCaso(req.body.folio, req.body.clave);

    if (!caso) {
        return res.status(404).json({ error: ERROR_GENERICO });
    }

    const { tipo, fila } = caso;

    if (tipo === 'mediacion') {
        return res.json({
            tipo,
            folio: fila.folio,
            estado: fila.estado,
            fecha_sesion: fila.fecha_sesion,
            lugar_sesion: fila.lugar_sesion,
            creado_en: fila.creado_en,
            actualizado_en: fila.actualizado_en
        });
    }

    // Solo se devuelven los mensajes marcados como visibles para el reportante
    const [seguimientos] = await pool.query(
        `SELECT autor, mensaje_cifrado, creado_en
         FROM seguimientos
         WHERE reporte_id = ? AND visible_reportante = 1
         ORDER BY creado_en ASC, id ASC`,
        [fila.id]
    );

    res.json({
        tipo,
        folio: fila.folio,
        categoria: fila.categoria,
        estado: fila.estado,
        creado_en: fila.creado_en,
        actualizado_en: fila.actualizado_en,
        seguimientos: seguimientos.map((s) => ({
            autor: s.autor,
            mensaje: descifrar(s.mensaje_cifrado),
            creado_en: s.creado_en
        }))
    });
});

// POST /api/consulta/mensaje  -> el reportante agrega información a su caso
router.post('/mensaje', limiteConsultas, async (req, res) => {
    const caso = await buscarCaso(req.body.folio, req.body.clave);

    if (!caso || caso.tipo !== 'reporte') {
        return res.status(404).json({ error: ERROR_GENERICO });
    }

    if (['cerrado', 'descartado'].includes(caso.fila.estado)) {
        return res.status(400).json({ error: 'Este caso ya fue cerrado. Si la situación continúa, haz un nuevo reporte.' });
    }

    const mensaje = validar.texto(req.body.mensaje, 2000);

    if (mensaje.length < 3) {
        return res.status(400).json({ error: 'Escribe tu mensaje.' });
    }

    await agregarSeguimiento(caso.fila.id, 'reportante', null, mensaje, true);
    await pool.query('UPDATE reportes SET actualizado_en = NOW() WHERE id = ?', [caso.fila.id]);

    res.status(201).json({ mensaje: 'Tu mensaje fue enviado al orientador.' });
});

module.exports = router;
