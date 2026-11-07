// Rutas del contenido formativo (infografías, cápsulas y consejos)
const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { verificarToken, permitirRoles, registrarAuditoria } = require('../middleware/auth');
const validar = require('../utils/validar');

const router = express.Router();

const TIPOS = ['infografia', 'capsula', 'consejo'];
const TEMAS = ['comunicacion_asertiva', 'empatia', 'manejo_emociones', 'prevencion_acoso'];
const CARPETA_IMG = path.join(__dirname, '..', '..', 'public', 'img');

function validarContenido(cuerpo) {
    const datos = {
        titulo: validar.texto(cuerpo.titulo, 150),
        tipo: validar.opcion(cuerpo.tipo, TIPOS),
        tema: validar.opcion(cuerpo.tema, TEMAS),
        resumen: validar.texto(cuerpo.resumen, 300),
        cuerpo: validar.texto(cuerpo.cuerpo, 8000),
        imagen: validar.texto(cuerpo.imagen, 200) || null,
        publicado: cuerpo.publicado === false ? 0 : 1
    };

    // La imagen debe ser una ruta dentro de public/img (evita enlaces externos)
    if (datos.imagen && !/^img\/[\w\-.]+\.(svg|png|jpe?g|webp)$/i.test(datos.imagen)) {
        return { error: 'La imagen debe ser una ruta como img/mi-imagen.png' };
    }

    if (datos.titulo.length < 3 || !datos.tipo || !datos.tema || datos.resumen.length < 10 || datos.cuerpo.length < 20) {
        return { error: 'Completa título, tipo, tema, resumen y contenido.' };
    }

    return { datos };
}

// =====================================================================
// RUTAS PÚBLICAS
// =====================================================================

// GET /api/contenidos?tema=empatia&tipo=consejo
router.get('/', async (req, res) => {
    const condiciones = ['publicado = 1'];
    const valores = [];

    const tema = validar.opcion(req.query.tema, TEMAS);
    const tipo = validar.opcion(req.query.tipo, TIPOS);

    if (tema) {
        condiciones.push('tema = ?');
        valores.push(tema);
    }

    if (tipo) {
        condiciones.push('tipo = ?');
        valores.push(tipo);
    }

    const [filas] = await pool.query(
        `SELECT id, titulo, tipo, tema, resumen, imagen, creado_en
         FROM contenidos
         WHERE ${condiciones.join(' AND ')}
         ORDER BY creado_en DESC, id DESC`,
        valores
    );

    res.json(filas);
});

// =====================================================================
// RUTAS DE ADMINISTRACIÓN (van antes de "/:id")
// =====================================================================

// GET /api/contenidos/admin/todos  -> incluye los no publicados
router.get('/admin/todos', verificarToken, permitirRoles('admin'), async (req, res) => {
    const [filas] = await pool.query(
        'SELECT * FROM contenidos ORDER BY creado_en DESC, id DESC'
    );

    res.json(filas);
});

// GET /api/contenidos/admin/imagenes  -> imágenes disponibles en public/img
router.get('/admin/imagenes', verificarToken, permitirRoles('admin'), (req, res) => {
    const archivos = fs.readdirSync(CARPETA_IMG)
        .filter((nombre) => /\.(svg|png|jpe?g|webp)$/i.test(nombre))
        .map((nombre) => 'img/' + nombre);

    res.json(archivos);
});

// POST /api/contenidos
router.post('/', verificarToken, permitirRoles('admin'), async (req, res) => {
    const { datos, error } = validarContenido(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    const [resultado] = await pool.query(
        `INSERT INTO contenidos (titulo, tipo, tema, resumen, cuerpo, imagen, publicado)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [datos.titulo, datos.tipo, datos.tema, datos.resumen, datos.cuerpo, datos.imagen, datos.publicado]
    );

    await registrarAuditoria(req.usuario.id, 'crear_contenido', 'contenido', resultado.insertId);

    res.status(201).json({ id: resultado.insertId });
});

// PUT /api/contenidos/:id
router.put('/:id', verificarToken, permitirRoles('admin'), async (req, res) => {
    const id = validar.entero(req.params.id, 1, 2147483647);
    const { datos, error } = validarContenido(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    await pool.query(
        `UPDATE contenidos
         SET titulo = ?, tipo = ?, tema = ?, resumen = ?, cuerpo = ?, imagen = ?, publicado = ?
         WHERE id = ?`,
        [datos.titulo, datos.tipo, datos.tema, datos.resumen, datos.cuerpo, datos.imagen, datos.publicado, id]
    );

    await registrarAuditoria(req.usuario.id, 'editar_contenido', 'contenido', id);

    res.json({ mensaje: 'Contenido actualizado.' });
});

// DELETE /api/contenidos/:id
router.delete('/:id', verificarToken, permitirRoles('admin'), async (req, res) => {
    const id = validar.entero(req.params.id, 1, 2147483647);

    await pool.query('DELETE FROM contenidos WHERE id = ?', [id]);
    await registrarAuditoria(req.usuario.id, 'eliminar_contenido', 'contenido', id);

    res.json({ mensaje: 'Contenido eliminado.' });
});

// GET /api/contenidos/:id  -> artículo completo (público)
router.get('/:id', async (req, res) => {
    const id = validar.entero(req.params.id, 1, 2147483647);

    const [filas] = await pool.query(
        'SELECT * FROM contenidos WHERE id = ? AND publicado = 1',
        [id]
    );

    if (!filas.length) {
        return res.status(404).json({ error: 'El contenido no existe.' });
    }

    res.json(filas[0]);
});

module.exports = router;
