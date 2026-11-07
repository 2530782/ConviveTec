// =====================================================================
// Crea la base de datos, las tablas y carga datos de demostración.
// Uso:  npm run setup
// ATENCIÓN: borra y vuelve a crear todas las tablas.
// =====================================================================
require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { cifrar, generarFolio } = require('../utils/seguridad');

// Cuentas de demostración (cámbialas antes de usar el sistema en una escuela)
const USUARIOS_DEMO = [
    {
        nombre: 'Administración ConviveTec',
        correo: 'admin@convivetec.mx',
        password: 'Admin2026*',
        rol: 'admin'
    },
    {
        nombre: 'Laura Hernández (Orientación)',
        correo: 'orientacion1@convivetec.mx',
        password: 'Orienta2026*',
        rol: 'orientador'
    },
    {
        nombre: 'Miguel Ramírez (Orientación)',
        correo: 'orientacion2@convivetec.mx',
        password: 'Orienta2026*',
        rol: 'orientador'
    },
    {
        nombre: 'Prof. Andrea Torres',
        correo: 'docente@convivetec.mx',
        password: 'Docente2026*',
        rol: 'docente'
    }
];

// Casos ficticios para probar el panel
const REPORTES_DEMO = [
    {
        categoria: 'ciberacoso',
        descripcion: 'En un grupo de mensajería del salón están compartiendo fotos editadas de una compañera con apodos ofensivos. Ya lleva dos semanas y ella dejó de venir a algunas clases.',
        lugar: 'Grupo de mensajería del 3°B',
        relacion: 'lo_presencie',
        riesgo: 0,
        urgencia: 'alta',
        estado: 'en_atencion',
        orientador: 2,
        dias: 6
    },
    {
        categoria: 'acoso',
        descripcion: 'Unos compañeros de otro grupo me esperan a la salida y me quitan mis cosas. Me da miedo decirle a alguien porque me dijeron que si hablo me va a ir peor.',
        lugar: 'Salida principal',
        relacion: 'me_ocurre',
        riesgo: 1,
        urgencia: 'critica',
        estado: 'en_revision',
        orientador: 2,
        dias: 1
    },
    {
        categoria: 'conflicto_companeros',
        descripcion: 'Dos equipos del proyecto integrador discutieron fuerte en el laboratorio porque se acusan de copiar el trabajo. Casi llegan a los golpes.',
        lugar: 'Laboratorio de cómputo 2',
        relacion: 'lo_presencie',
        riesgo: 0,
        urgencia: 'media',
        estado: 'recibido',
        orientador: null,
        dias: 2
    },
    {
        categoria: 'discriminacion',
        descripcion: 'En la cafetería se burlan de un compañero por su forma de hablar y por venir de una comunidad indígena. Lo imitan y no lo dejan sentarse con ellos.',
        lugar: 'Cafetería',
        relacion: 'me_contaron',
        riesgo: 0,
        urgencia: 'media',
        estado: 'recibido',
        orientador: null,
        dias: 3
    },
    {
        categoria: 'otro',
        descripcion: 'Hubo una discusión en clase de educación física por el uso de la cancha, pero ya se resolvió hablando entre los grupos con ayuda del profesor.',
        lugar: 'Cancha',
        relacion: 'lo_presencie',
        riesgo: 0,
        urgencia: 'baja',
        estado: 'cerrado',
        orientador: 3,
        dias: 15
    }
];

async function main() {
    console.log('Conectando a MySQL...');

    const conexion = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
        charset: 'utf8mb4'
    });

    // 1. Estructura de la base de datos
    let sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');

    const nombreBD = process.env.DB_NAME || 'convivetec';
    sql = sql.replace(/\bconvivetec\b/g, nombreBD);

    await conexion.query(sql);
    console.log(`Base de datos "${nombreBD}" y tablas creadas.`);

    await conexion.changeUser({ database: nombreBD });

    // 2. Usuarios
    const ids = [];

    for (const usuario of USUARIOS_DEMO) {
        const hash = await bcrypt.hash(usuario.password, 10);

        const [resultado] = await conexion.query(
            'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES (?, ?, ?, ?)',
            [usuario.nombre, usuario.correo, hash, usuario.rol]
        );

        ids.push(resultado.insertId);
    }

    console.log('Usuarios de demostración creados.');

    // 3. Reportes de ejemplo
    const claveHash = await bcrypt.hash('DEMO00', 10);

    for (const r of REPORTES_DEMO) {
        const orientadorId = r.orientador ? ids[r.orientador - 1] : null;

        const [resultado] = await conexion.query(
            `INSERT INTO reportes
                (folio, clave_hash, categoria, descripcion_cifrada, lugar, relacion,
                 riesgo_inmediato, urgencia, estado, orientador_id, creado_en, actualizado_en)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     NOW() - INTERVAL ? DAY, NOW() - INTERVAL ? DAY)`,
            [
                generarFolio('CT'),
                claveHash,
                r.categoria,
                cifrar(r.descripcion),
                r.lugar,
                r.relacion,
                r.riesgo,
                r.urgencia,
                r.estado,
                orientadorId,
                r.dias,
                Math.max(r.dias - 1, 0)
            ]
        );

        await conexion.query(
            `INSERT INTO seguimientos (reporte_id, autor, mensaje_cifrado, visible_reportante, creado_en)
             VALUES (?, 'sistema', ?, 1, NOW() - INTERVAL ? DAY)`,
            [
                resultado.insertId,
                cifrar('Tu reporte fue recibido. Una persona del área de orientación lo revisará pronto.'),
                r.dias
            ]
        );
    }

    console.log('Reportes de ejemplo creados.');

    // 4. Mediación de ejemplo
    await conexion.query(
        `INSERT INTO mediaciones
            (folio, clave_hash, nombre_cifrado, grupo, contacto_cifrado, partes_cifrado,
             motivo_cifrado, disponibilidad, es_menor, consentimiento_tutor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
            generarFolio('MD'),
            claveHash,
            cifrar('Daniela Pérez'),
            '403',
            cifrar('daniela.ejemplo@correo.com'),
            cifrar('Compañera de equipo del proyecto integrador'),
            cifrar('Tenemos diferencias por la repartición del trabajo y ya no nos hablamos. Queremos llegar a un acuerdo para terminar el proyecto.'),
            'Martes y jueves después de las 13:00'
        ]
    );

    console.log('Solicitud de mediación de ejemplo creada.');

    await conexion.end();

    console.log('\nListo. Cuentas de demostración:');

    USUARIOS_DEMO.forEach((u) => {
        console.log(`  ${u.rol.padEnd(11)} ${u.correo.padEnd(28)} ${u.password}`);
    });

    console.log('\nInicia el servidor con:  npm start');
}

main().catch((error) => {
    console.error('Error al preparar la base de datos:', error.message);
    process.exit(1);
});
