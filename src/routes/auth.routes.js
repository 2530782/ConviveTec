// Rutas de inicio de sesión para el personal escolar
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verificarToken, registrarAuditoria } = require('../middleware/auth');
const validar = require('../utils/validar');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const correo = validar.texto(req.body.correo, 150).toLowerCase();
    const password = validar.texto(req.body.password, 100);

    if (!correo || !password) {
        return res.status(400).json({ error: 'Escribe tu correo y contraseña.' });
    }

    const [filas] = await pool.query(
        'SELECT id, nombre, correo, password_hash, rol, activo FROM usuarios WHERE correo = ?',
        [correo]
    );

    const usuario = filas[0];
    const coincide = usuario ? await bcrypt.compare(password, usuario.password_hash) : false;

    // Mismo mensaje para correo o contraseña incorrectos (no revela cuál falló)
    if (!usuario || !coincide) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    if (!usuario.activo) {
        return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
    }

    const token = jwt.sign(
        {
            id: usuario.id,
            nombre: usuario.nombre,
            rol: usuario.rol
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRA || '8h' }
    );

    await registrarAuditoria(usuario.id, 'inicio_sesion', 'usuario', usuario.id);

    res.json({
        token,
        usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            correo: usuario.correo,
            rol: usuario.rol
        }
    });
});

// GET /api/auth/yo  -> datos de la sesión actual
router.get('/yo', verificarToken, (req, res) => {
    res.json({ usuario: req.usuario });
});

module.exports = router;
