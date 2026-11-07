-- =====================================================================
-- ConviveTec - Base de datos
-- Plataforma web para la convivencia saludable y la prevención de
-- conflictos en comunidades escolares.
--
-- Nota de privacidad: los campos con sufijo "_cifrado" se guardan
-- cifrados con AES-256-GCM desde el servidor. Ninguna tabla guarda
-- direcciones IP ni datos que identifiquen a quien hace un reporte
-- anónimo.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS convivetec
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE convivetec;

-- Se eliminan en orden inverso por las llaves foráneas
DROP TABLE IF EXISTS auditoria;
DROP TABLE IF EXISTS encuestas;
DROP TABLE IF EXISTS contenidos;
DROP TABLE IF EXISTS mediaciones;
DROP TABLE IF EXISTS seguimientos;
DROP TABLE IF EXISTS reportes;
DROP TABLE IF EXISTS usuarios;

-- ---------------------------------------------------------------------
-- Usuarios del personal escolar (los alumnos NO necesitan cuenta)
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(120)  NOT NULL,
    correo          VARCHAR(150)  NOT NULL UNIQUE,
    password_hash   VARCHAR(100)  NOT NULL,
    rol             ENUM('admin', 'orientador', 'docente') NOT NULL,
    activo          TINYINT(1)    NOT NULL DEFAULT 1,
    creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Reportes de situaciones de conflicto
-- ---------------------------------------------------------------------
CREATE TABLE reportes (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    folio                VARCHAR(20)   NOT NULL UNIQUE,
    clave_hash           VARCHAR(100)  NOT NULL,
    categoria            ENUM(
                            'acoso',
                            'ciberacoso',
                            'discriminacion',
                            'conflicto_companeros',
                            'violencia_fisica',
                            'otro'
                         ) NOT NULL,
    descripcion_cifrada  TEXT          NOT NULL,
    lugar                VARCHAR(120)  NULL,
    fecha_suceso         DATE          NULL,
    relacion             ENUM('me_ocurre', 'lo_presencie', 'me_contaron') NOT NULL,
    riesgo_inmediato     TINYINT(1)    NOT NULL DEFAULT 0,
    origen               ENUM('anonimo', 'docente') NOT NULL DEFAULT 'anonimo',
    docente_id           INT           NULL,
    urgencia             ENUM('baja', 'media', 'alta', 'critica') NOT NULL DEFAULT 'media',
    estado               ENUM(
                            'recibido',
                            'en_revision',
                            'en_atencion',
                            'cerrado',
                            'descartado'
                         ) NOT NULL DEFAULT 'recibido',
    orientador_id        INT           NULL,
    creado_en            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reporte_docente
        FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_reporte_orientador
        FOREIGN KEY (orientador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_reporte_estado (estado),
    INDEX idx_reporte_urgencia (urgencia)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Seguimiento de cada reporte (mensajes y notas internas)
-- ---------------------------------------------------------------------
CREATE TABLE seguimientos (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    reporte_id           INT           NOT NULL,
    autor                ENUM('orientador', 'reportante', 'sistema') NOT NULL,
    usuario_id           INT           NULL,
    mensaje_cifrado      TEXT          NOT NULL,
    visible_reportante   TINYINT(1)    NOT NULL DEFAULT 0,
    creado_en            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_seguimiento_reporte
        FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE,
    CONSTRAINT fk_seguimiento_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Solicitudes de mediación
-- ---------------------------------------------------------------------
CREATE TABLE mediaciones (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    folio                    VARCHAR(20)   NOT NULL UNIQUE,
    clave_hash               VARCHAR(100)  NOT NULL,
    nombre_cifrado           TEXT          NOT NULL,
    grupo                    VARCHAR(30)   NULL,
    contacto_cifrado         TEXT          NOT NULL,
    partes_cifrado           TEXT          NOT NULL,
    motivo_cifrado           TEXT          NOT NULL,
    disponibilidad           VARCHAR(150)  NULL,
    es_menor                 TINYINT(1)    NOT NULL DEFAULT 0,
    consentimiento_tutor     TINYINT(1)    NOT NULL DEFAULT 0,
    estado                   ENUM('pendiente', 'programada', 'realizada', 'cancelada')
                             NOT NULL DEFAULT 'pendiente',
    fecha_sesion             DATETIME      NULL,
    lugar_sesion             VARCHAR(120)  NULL,
    acuerdos_cifrado         TEXT          NULL,
    orientador_id            INT           NULL,
    creado_en                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mediacion_orientador
        FOREIGN KEY (orientador_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Contenido formativo (infografías, cápsulas y consejos)
-- ---------------------------------------------------------------------
CREATE TABLE contenidos (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    titulo       VARCHAR(150)  NOT NULL,
    tipo         ENUM('infografia', 'capsula', 'consejo') NOT NULL,
    tema         ENUM(
                    'comunicacion_asertiva',
                    'empatia',
                    'manejo_emociones',
                    'prevencion_acoso'
                 ) NOT NULL,
    resumen      VARCHAR(300)  NOT NULL,
    cuerpo       TEXT          NOT NULL,
    imagen       VARCHAR(200)  NULL,
    publicado    TINYINT(1)    NOT NULL DEFAULT 1,
    creado_en    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Encuestas de evaluación del prototipo (SUS + utilidad)
-- ---------------------------------------------------------------------
CREATE TABLE encuestas (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    tipo_usuario    ENUM('alumno', 'docente', 'orientador', 'padre') NOT NULL,
    respuestas      JSON          NOT NULL,
    puntaje_sus     DECIMAL(5, 2) NOT NULL,
    utilidad        TINYINT       NOT NULL,
    segundos_reporte INT          NULL,
    comentario      VARCHAR(500)  NULL,
    creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Bitácora de auditoría: quién consultó o modificó qué caso
-- (no guarda IP ni el contenido de los casos)
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT           NULL,
    accion       VARCHAR(60)   NOT NULL,
    entidad      VARCHAR(30)   NOT NULL,
    entidad_id   INT           NULL,
    creado_en    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Contenido formativo inicial
-- (las imágenes están en public/img/ y se pueden cambiar libremente)
-- ---------------------------------------------------------------------
INSERT INTO contenidos (titulo, tipo, tema, resumen, cuerpo, imagen) VALUES
(
    'Habla en primera persona',
    'consejo',
    'comunicacion_asertiva',
    'Decir "yo me siento..." en lugar de "tú siempre..." baja la tensión y abre el diálogo.',
    'Cuando algo te molesta, describe lo que pasó, cómo te hizo sentir y qué necesitas.\n\nEjemplo: "Cuando se burlan de mi trabajo en clase, me siento avergonzado. Me gustaría que si algo no les parece me lo digan en privado."\n\nEvita generalizar con palabras como "siempre" o "nunca", porque la otra persona se pondrá a la defensiva. Habla de hechos concretos, no de cómo "es" la otra persona.',
    'img/contenido-asertividad.svg'
),
(
    'El semáforo de las emociones',
    'infografia',
    'manejo_emociones',
    'Rojo: detente. Amarillo: piensa. Verde: actúa. Una técnica sencilla para no reaccionar con enojo.',
    'ROJO - Detente. Cuando sientas que el enojo sube, no respondas de inmediato. Respira profundo tres veces.\n\nAMARILLO - Piensa. ¿Qué pasó realmente? ¿Qué opciones tengo? ¿Qué consecuencias tendría cada una?\n\nVERDE - Actúa. Elige la opción que resuelva el problema sin lastimar a nadie, ni a ti mismo.\n\nSi la emoción es muy intensa, aléjate un momento y busca a alguien de confianza.',
    'img/contenido-semaforo.svg'
),
(
    'Ponte en los zapatos del otro',
    'capsula',
    'empatia',
    'La empatía no es estar de acuerdo, es intentar entender lo que la otra persona siente.',
    'Antes de juzgar, pregúntate: ¿qué podría estar viviendo esta persona? ¿Cómo me sentiría yo en su lugar?\n\nTres prácticas para ejercitar la empatía:\n1. Escucha sin interrumpir y sin preparar tu respuesta mientras el otro habla.\n2. Repite con tus palabras lo que entendiste: "Entonces lo que te molestó fue...".\n3. Reconoce la emoción del otro aunque no compartas su punto de vista.',
    'img/contenido-empatia.svg'
),
(
    '¿Es broma o es acoso?',
    'infografia',
    'prevencion_acoso',
    'Una broma divierte a todos. Si alguien se siente lastimado y se repite, ya no es broma.',
    'Señales de que una situación es acoso:\n- Se repite y va dirigida a la misma persona.\n- Hay desequilibrio de poder (un grupo contra uno, alguien mayor o más popular).\n- La persona afectada no se ríe, se aísla o tiene miedo.\n\nSi lo presencias: no te sumes, no lo compartas, acompaña a la persona afectada y avisa a un adulto de confianza o haz un reporte en ConviveTec.',
    'img/contenido-acoso.svg'
),
(
    'Ciberacoso: no lo compartas',
    'consejo',
    'prevencion_acoso',
    'Reenviar una captura o un meme humillante también es participar. Corta la cadena.',
    'Si recibes contenido que humilla a alguien:\n1. No lo reenvíes ni reacciones.\n2. Guarda evidencia (captura con fecha) por si se necesita.\n3. Reporta la publicación en la red social.\n4. Avisa a orientación o haz un reporte anónimo.\n\nSi eres tú quien lo vive: no respondas a las provocaciones, bloquea a la persona y pide apoyo. No estás solo y no es tu culpa.',
    'img/contenido-ciberacoso.svg'
),
(
    'Respira antes de responder',
    'capsula',
    'manejo_emociones',
    'La respiración 4-4-6 ayuda a calmar el cuerpo cuando una discusión empieza a subir de tono.',
    'Inhala por la nariz contando hasta 4.\nSostén el aire contando hasta 4.\nExhala lentamente por la boca contando hasta 6.\n\nRepite tres o cuatro veces. Cuando el cuerpo se calma, es más fácil pensar con claridad y elegir qué decir.',
    'img/contenido-respira.svg'
);
