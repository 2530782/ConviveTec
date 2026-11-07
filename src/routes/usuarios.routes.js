// Administración de cuentas del personal (solo administrador)
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verificarToken, permitirRoles, registrarAuditoria } = require('../middleware/auth');
const validar = require('../utils/validar');

const router = express.Router();

const ROLES = ['admin', 'orientador', 'docente'];

router.use(verificarToken, permitirRoles('admin'));

// GET /api/usuarios
router.get('/', async (req, res) => {
    const [filas] = await pool.query(
        `SELECT id, nombre, correo, rol, activo, creado_en
         FROM usuarios
         ORDER BY rol, nombre`
    );

    res.json(filas);
});

// POST /api/usuarios
router.post('/', async (req, res) => {
    const nombre = validar.texto(req.body.nombre, 120);
    const correo = validar.texto(req.body.correo, 150).toLowerCase();
    const rol = validar.opcion(req.body.rol, ROLES);
    const password = validar.texto(req.body.password, 100);

    if (nombre.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || !rol) {
        return res.status(400).json({ error: 'Completa nombre, correo válido y rol.' });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);

        const [resultado] = await pool.query(
            'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, hash, rol]
        );

        await registrarAuditoria(req.usuario.id, 'crear_usuario', 'usuario', resultado.insertId);

        res.status(201).json({ id: resultado.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
        }

        throw error;
    }
});

// PUT /api/usuarios/:id  -> cambiar rol, activar/desactivar o restablecer contraseña
router.put('/:id', async (req, res) => {
    const id = validar.entero(req.params.id, 1, 2147483647);
    const rol = validar.opcion(req.body.rol, ROLES);
    const activo = req.body.activo === false ? 0 : 1;
    const password = validar.texto(req.body.password, 100);

    if (id === req.usuario.id && (activo === 0 || rol !== 'admin')) {
        return res.status(400).json({ error: 'No puedes desactivar ni quitarte el rol de administrador a ti mismo.' });
    }

    if (!rol) {
        return res.status(400).json({ error: 'Rol no válido.' });
    }

    if (password && password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    await pool.query('UPDATE usuarios SET rol = ?, activo = ? WHERE id = ?', [rol, activo, id]);

    if (password) {
        const hash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, id]);
    }

    await registrarAuditoria(req.usuario.id, 'editar_usuario', 'usuario', id);

    res.json({ mensaje: 'Usuario actualizado.' });
});

module.exports = router;
