// Rutas de reportes de conflicto
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { verificarToken, permitirRoles, registrarAuditoria } = require('../middleware/auth');
const { cifrar, descifrar, generarFolio, generarClave } = require('../utils/seguridad');
const validar = require('../utils/validar');

const router = express.Router();

const CATEGORIAS = [
    'acoso',
    'ciberacoso',
    'discriminacion',
    'conflicto_companeros',
    'violencia_fisica',
    'otro'
];

const RELACIONES = ['me_ocurre', 'lo_presencie', 'me_contaron'];
const ESTADOS = ['recibido', 'en_revision', 'en_atencion', 'cerrado', 'descartado'];
const URGENCIAS = ['baja', 'media', 'alta', 'critica'];

const TEXTO_ESTADO = {
    recibido: 'Recibido',
    en_revision: 'En revisión',
    en_atencion: 'En atención',
    cerrado: 'Cerrado',
    descartado: 'Descartado'
};

// Límite de envíos para evitar el uso abusivo (el contador vive en memoria,
// no se guarda la IP en la base de datos)
const limiteReportes = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Has enviado varios reportes seguidos. Espera unos minutos e inténtalo de nuevo.' }
});

/**
 * Valida los datos del formulario de reporte.
 * Devuelve { datos } si todo está bien o { error } si algo falta.
 */
function validarReporte(cuerpo) {
    const datos = {
        categoria: validar.opcion(cuerpo.categoria, CATEGORIAS),
        descripcion: validar.texto(cuerpo.descripcion, 3000),
        lugar: validar.texto(cuerpo.lugar, 120) || null,
        fecha_suceso: validar.fechaPasada(cuerpo.fecha_suceso),
        relacion: validar.opcion(cuerpo.relacion, RELACIONES),
        riesgo_inmediato: cuerpo.riesgo_inmediato === true || cuerpo.riesgo_inmediato === 'true'
    };

    if (!datos.categoria) {
        return { error: 'Selecciona el tipo de situación.' };
    }

    if (!datos.relacion) {
        return { error: 'Indica si te ocurre a ti, lo presenciaste o te lo contaron.' };
    }

    if (datos.descripcion.length < 20) {
        return { error: 'Describe la situación con al menos 20 caracteres.' };
    }

    return { datos };
}

/**
 * Inserta un reporte y su primer mensaje de seguimiento.
 */
async function guardarReporte(datos, origen, docenteId) {
    const clave = generarClave();
    const claveHash = await bcrypt.hash(clave, 10);
    const urgencia = datos.riesgo_inmediato ? 'critica' : 'media';

    // Se reintenta en el caso (muy raro) de que el folio ya exista
    for (let intento = 0; intento < 5; intento++) {
        const folio = generarFolio('CT');

        try {
            const [resultado] = await pool.query(
                `INSERT INTO reportes
                    (folio, clave_hash, categoria, descripcion_cifrada, lugar, fecha_suceso,
                     relacion, riesgo_inmediato, origen, docente_id, urgencia)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    folio,
                    claveHash,
                    datos.categoria,
                    cifrar(datos.descripcion),
                    datos.lugar,
                    datos.fecha_suceso,
                    datos.relacion,
                    datos.riesgo_inmediato ? 1 : 0,
                    origen,
                    docenteId,
                    urgencia
                ]
            );

            await agregarSeguimiento(
                resultado.insertId,
                'sistema',
                null,
                'Tu reporte fue recibido. Una persona del área de orientación lo revisará pronto.',
                true
            );

            return { id: resultado.insertId, folio, clave, urgencia };
        } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY') {
                throw error;
            }
        }
    }

    throw new Error('No se pudo generar un folio único.');
}

async function agregarSeguimiento(reporteId, autor, usuarioId, mensaje, visible) {
    await pool.query(
        `INSERT INTO seguimientos (reporte_id, autor, usuario_id, mensaje_cifrado, visible_reportante)
         VALUES (?, ?, ?, ?, ?)`,
        [reporteId, autor, usuarioId, cifrar(mensaje), visible ? 1 : 0]
    );
}

/**
 * Obtiene un reporte y verifica que el usuario actual sea el orientador asignado.
 */
async function obtenerReporteAsignado(req, res) {
    const id = validar.entero(req.params.id, 1, 2147483647);

    if (!id) {
        res.status(400).json({ error: 'Identificador no válido.' });
        return null;
    }

    const [filas] = await pool.query('SELECT * FROM reportes WHERE id = ?', [id]);
    const reporte = filas[0];

    if (!reporte) {
        res.status(404).json({ error: 'El reporte no existe.' });
        return null;
    }

    if (reporte.orientador_id !== req.usuario.id) {
        res.status(403).json({ error: 'Solo el orientador asignado puede ver o modificar el detalle de este caso.' });
        return null;
    }

    return reporte;
}

// =====================================================================
// RUTAS PÚBLICAS (sin cuenta)
// =====================================================================

// POST /api/reportes  -> reporte anónimo
router.post('/', limiteReportes, async (req, res) => {
    const { datos, error } = validarReporte(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    const reporte = await guardarReporte(datos, 'anonimo', null);

    res.status(201).json({
        folio: reporte.folio,
        clave: reporte.clave,
        riesgo_inmediato: datos.riesgo_inmediato
    });
});

// =====================================================================
// RUTAS PARA DOCENTES
// =====================================================================

// POST /api/reportes/canalizar  -> el docente canaliza una situación observada
router.post('/canalizar', verificarToken, permitirRoles('docente'), async (req, res) => {
    const { datos, error } = validarReporte(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    const reporte = await guardarReporte(datos, 'docente', req.usuario.id);

    await registrarAuditoria(req.usuario.id, 'canalizar_reporte', 'reporte', reporte.id);

    res.status(201).json({ folio: reporte.folio });
});

// GET /api/reportes/mis-canalizaciones
router.get('/mis-canalizaciones', verificarToken, permitirRoles('docente'), async (req, res) => {
    const [filas] = await pool.query(
        `SELECT folio, categoria, estado, creado_en, actualizado_en
         FROM reportes
         WHERE docente_id = ?
         ORDER BY creado_en DESC`,
        [req.usuario.id]
    );

    res.json(filas);
});

// =====================================================================
// RUTAS PARA ORIENTACIÓN Y ADMINISTRACIÓN
// =====================================================================

// GET /api/reportes  -> lista de casos (solo datos generales, sin descripción)
router.get('/', verificarToken, permitirRoles('orientador', 'admin'), async (req, res) => {
    const condiciones = [];
    const valores = [];

    const estado = validar.opcion(req.query.estado, ESTADOS);
    const urgencia = validar.opcion(req.query.urgencia, URGENCIAS);
    const asignacion = req.query.asignacion;

    if (estado) {
        condiciones.push('r.estado = ?');
        valores.push(estado);
    }

    if (urgencia) {
        condiciones.push('r.urgencia = ?');
        valores.push(urgencia);
    }

    if (asignacion === 'mios') {
        condiciones.push('r.orientador_id = ?');
        valores.push(req.usuario.id);
    } else if (asignacion === 'sin_asignar') {
        condiciones.push('r.orientador_id IS NULL');
    }

    const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

    const [filas] = await pool.query(
        `SELECT r.id, r.folio, r.categoria, r.relacion, r.riesgo_inmediato, r.origen,
                r.urgencia, r.estado, r.orientador_id, u.nombre AS orientador,
                r.creado_en, r.actualizado_en
         FROM reportes r
         LEFT JOIN usuarios u ON u.id = r.orientador_id
         ${where}
         ORDER BY
            FIELD(r.urgencia, 'critica', 'alta', 'media', 'baja'),
            r.creado_en DESC`,
        valores
    );

    // Se indica si el usuario actual puede abrir el detalle
    const lista = filas.map((fila) => ({
        ...fila,
        puede_ver: fila.orientador_id === req.usuario.id
    }));

    res.json(lista);
});

// GET /api/reportes/:id  -> detalle completo (solo orientador asignado)
router.get('/:id', verificarToken, permitirRoles('orientador'), async (req, res) => {
    const reporte = await obtenerReporteAsignado(req, res);

    if (!reporte) {
        return;
    }

    const [seguimientos] = await pool.query(
        `SELECT s.id, s.autor, s.mensaje_cifrado, s.visible_reportante, s.creado_en,
                u.nombre AS usuario
         FROM seguimientos s
         LEFT JOIN usuarios u ON u.id = s.usuario_id
         WHERE s.reporte_id = ?
         ORDER BY s.creado_en ASC, s.id ASC`,
        [reporte.id]
    );

    let docente = null;

    if (reporte.docente_id) {
        const [docentes] = await pool.query('SELECT nombre FROM usuarios WHERE id = ?', [reporte.docente_id]);
        docente = docentes[0] ? docentes[0].nombre : null;
    }

    await registrarAuditoria(req.usuario.id, 'ver_reporte', 'reporte', reporte.id);

    res.json({
        id: reporte.id,
        folio: reporte.folio,
        categoria: reporte.categoria,
        descripcion: descifrar(reporte.descripcion_cifrada),
        lugar: reporte.lugar,
        fecha_suceso: reporte.fecha_suceso,
        relacion: reporte.relacion,
        riesgo_inmediato: reporte.riesgo_inmediato,
        origen: reporte.origen,
        docente,
        urgencia: reporte.urgencia,
        estado: reporte.estado,
        creado_en: reporte.creado_en,
        actualizado_en: reporte.actualizado_en,
        seguimientos: seguimientos.map((s) => ({
            id: s.id,
            autor: s.autor,
            usuario: s.usuario,
            mensaje: descifrar(s.mensaje_cifrado),
            visible_reportante: s.visible_reportante,
            creado_en: s.creado_en
        }))
    });
});

// POST /api/reportes/:id/tomar  -> un orientador toma un caso sin asignar
router.post('/:id/tomar', verificarToken, permitirRoles('orientador'), async (req, res) => {
    const id = validar.entero(req.params.id, 1, 2147483647);

    const [resultado] = await pool.query(
        `UPDATE reportes
         SET orientador_id = ?,
             estado = IF(estado = 'recibido', 'en_revision', estado)
         WHERE id = ? AND orientador_id IS NULL`,
        [req.usuario.id, id]
    );

    if (resultado.affectedRows === 0) {
        return res.status(409).json({ error: 'El caso ya fue tomado por otra persona o no existe.' });
    }

    await agregarSeguimiento(
        id,
        'sistema',
        req.usuario.id,
        'Un orientador fue asignado a tu caso y lo está revisando.',
        true
    );

    await registrarAuditoria(req.usuario.id, 'tomar_reporte', 'reporte', id);

    res.json({ mensaje: 'Caso asignado a ti.' });
});

// PUT /api/reportes/:id/asignar  -> el administrador asigna un orientador
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

    const [resultado] = await pool.query(
        `UPDATE reportes
         SET orientador_id = ?,
             estado = IF(estado = 'recibido', 'en_revision', estado)
         WHERE id = ?`,
        [orientadorId, id]
    );

    if (resultado.affectedRows === 0) {
        return res.status(404).json({ error: 'El reporte no existe.' });
    }

    await registrarAuditoria(req.usuario.id, 'asignar_reporte', 'reporte', id);

    res.json({ mensaje: 'Orientador asignado.' });
});

// PUT /api/reportes/:id  -> cambiar estado y urgencia
router.put('/:id', verificarToken, permitirRoles('orientador'), async (req, res) => {
    const reporte = await obtenerReporteAsignado(req, res);

    if (!reporte) {
        return;
    }

    const estado = validar.opcion(req.body.estado, ESTADOS) || reporte.estado;
    const urgencia = validar.opcion(req.body.urgencia, URGENCIAS) || reporte.urgencia;

    await pool.query(
        'UPDATE reportes SET estado = ?, urgencia = ? WHERE id = ?',
        [estado, urgencia, reporte.id]
    );

    if (estado !== reporte.estado) {
        await agregarSeguimiento(
            reporte.id,
            'sistema',
            req.usuario.id,
            `El estado de tu caso cambió a: ${TEXTO_ESTADO[estado]}.`,
            true
        );
    }

    await registrarAuditoria(req.usuario.id, 'actualizar_reporte', 'reporte', reporte.id);

    res.json({ mensaje: 'Caso actualizado.' });
});

// POST /api/reportes/:id/seguimientos  -> nota interna o mensaje al reportante
router.post('/:id/seguimientos', verificarToken, permitirRoles('orientador'), async (req, res) => {
    const reporte = await obtenerReporteAsignado(req, res);

    if (!reporte) {
        return;
    }

    const mensaje = validar.texto(req.body.mensaje, 2000);
    const visible = req.body.visible_reportante === true;

    if (mensaje.length < 3) {
        return res.status(400).json({ error: 'Escribe un mensaje.' });
    }

    await agregarSeguimiento(reporte.id, 'orientador', req.usuario.id, mensaje, visible);
    await pool.query('UPDATE reportes SET actualizado_en = NOW() WHERE id = ?', [reporte.id]);
    await registrarAuditoria(req.usuario.id, 'agregar_seguimiento', 'reporte', reporte.id);

    res.status(201).json({ mensaje: 'Seguimiento agregado.' });
});

module.exports = router;
module.exports.agregarSeguimiento = agregarSeguimiento;
