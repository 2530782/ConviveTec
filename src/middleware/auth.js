// Middleware de autenticación con JWT y control de acceso por roles
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Verifica que la petición traiga un token válido en el encabezado
 * "Authorization: Bearer <token>".
 */
function verificarToken(req, res, next) {
    const encabezado = req.headers.authorization || '';
    const [tipo, token] = encabezado.split(' ');

    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Debes iniciar sesión.' });
    }

    try {
        const datos = jwt.verify(token, process.env.JWT_SECRET);

        req.usuario = {
            id: datos.id,
            nombre: datos.nombre,
            rol: datos.rol
        };

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Tu sesión expiró. Inicia sesión de nuevo.' });
    }
}

/**
 * Permite el paso solo a los roles indicados.
 * Uso: permitirRoles('admin', 'orientador')
 */
function permitirRoles(...roles) {
    return (req, res, next) => {
        if (!req.usuario || !roles.includes(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
        }

        next();
    };
}

/**
 * Registra en la bitácora quién hizo qué.
 * No se guarda la IP ni el contenido del caso.
 */
async function registrarAuditoria(usuarioId, accion, entidad, entidadId) {
    try {
        await pool.query(
            'INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id) VALUES (?, ?, ?, ?)',
            [usuarioId, accion, entidad, entidadId || null]
        );
    } catch (error) {
        console.error('No se pudo registrar la auditoría:', error.message);
    }
}

module.exports = {
    verificarToken,
    permitirRoles,
    registrarAuditoria
};
