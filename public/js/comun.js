// =====================================================================
// ConviveTec - Funciones compartidas por todas las páginas
// =====================================================================

// Sitio neutral al que lleva la salida rápida (se puede cambiar)
const SITIO_SALIDA = 'https://www.google.com/search?q=clima+hoy';

// Textos legibles para los valores guardados en la base de datos
const ETIQUETAS = {
    categoria: {
        acoso: 'Acoso escolar',
        ciberacoso: 'Ciberacoso',
        discriminacion: 'Discriminación',
        conflicto_companeros: 'Conflicto entre compañeros',
        violencia_fisica: 'Violencia física',
        otro: 'Otra situación'
    },
    relacion: {
        me_ocurre: 'Le ocurre a quien reporta',
        lo_presencie: 'Lo presenció',
        me_contaron: 'Se lo contaron'
    },
    estado: {
        recibido: 'Recibido',
        en_revision: 'En revisión',
        en_atencion: 'En atención',
        cerrado: 'Cerrado',
        descartado: 'Descartado',
        pendiente: 'Pendiente',
        programada: 'Programada',
        realizada: 'Realizada',
        cancelada: 'Cancelada'
    },
    urgencia: {
        critica: 'Crítica',
        alta: 'Alta',
        media: 'Media',
        baja: 'Baja'
    },
    tipo: {
        infografia: 'Infografía',
        capsula: 'Cápsula',
        consejo: 'Consejo'
    },
    tema: {
        comunicacion_asertiva: 'Comunicación asertiva',
        empatia: 'Empatía',
        manejo_emociones: 'Manejo de emociones',
        prevencion_acoso: 'Prevención del acoso'
    },
    rol: {
        admin: 'Administrador',
        orientador: 'Orientador',
        docente: 'Docente'
    }
};

/**
 * Devuelve la etiqueta legible de un valor, por ejemplo:
 * etiqueta('estado', 'en_revision') -> 'En revisión'
 */
function etiqueta(grupo, valor) {
    return (ETIQUETAS[grupo] && ETIQUETAS[grupo][valor]) || valor || '';
}

/**
 * Escapa texto antes de insertarlo como HTML (evita ataques XSS).
 */
function escaparHTML(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Convierte "2026-11-07 16:13:19" en "7 nov 2026, 16:13".
 */
function formatearFecha(texto, conHora = true) {
    if (!texto) {
        return '—';
    }

    let valor = String(texto).replace(' ', 'T');

    // Una fecha sin hora ("2026-11-04") se toma como hora local, no UTC
    if (valor.length === 10) {
        valor += 'T00:00:00';
    }

    const fecha = new Date(valor);

    if (isNaN(fecha.getTime())) {
        return texto;
    }

    const opciones = {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    };

    if (conHora) {
        opciones.hour = '2-digit';
        opciones.minute = '2-digit';
    }

    return fecha.toLocaleString('es-MX', opciones);
}

/**
 * Hace una petición a la API y devuelve el JSON.
 * Si hay sesión iniciada, agrega el token automáticamente.
 */
async function api(ruta, opciones = {}) {
    const encabezados = {
        'Content-Type': 'application/json'
    };

    const token = sessionStorage.getItem('ct_token');

    if (token) {
        encabezados.Authorization = 'Bearer ' + token;
    }

    const respuesta = await fetch('/api' + ruta, {
        method: opciones.method || 'GET',
        headers: encabezados,
        body: opciones.body ? JSON.stringify(opciones.body) : undefined
    });

    let datos = null;

    try {
        datos = await respuesta.json();
    } catch (error) {
        datos = null;
    }

    if (!respuesta.ok) {
        const mensaje = (datos && datos.error) || 'No se pudo completar la acción.';
        const falla = new Error(mensaje);
        falla.estado = respuesta.status;
        throw falla;
    }

    return datos;
}

/**
 * Muestra un mensaje dentro de un contenedor de alerta.
 * tipo: 'danger', 'success', 'warning' o 'info'
 */
function mostrarAlerta(contenedor, mensaje, tipo = 'danger') {
    if (!contenedor) {
        return;
    }

    contenedor.innerHTML = `
        <div class="alert alert-${tipo} d-flex gap-2 align-items-start" role="alert">
            <i class="bi ${tipo === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'} mt-1"></i>
            <div>${escaparHTML(mensaje)}</div>
        </div>
    `;
}

/**
 * Salida rápida: abre un sitio neutral y reemplaza la página actual
 * para que el botón "Atrás" no regrese a ConviveTec.
 */
function salidaRapida() {
    try {
        sessionStorage.clear();
    } catch (error) {
        // Sin acceso al almacenamiento: no pasa nada
    }

    window.location.replace(SITIO_SALIDA);
}

document.addEventListener('DOMContentLoaded', () => {
    // Botón de salida rápida
    document.querySelectorAll('[data-salida-rapida]').forEach((boton) => {
        boton.addEventListener('click', salidaRapida);
    });

    // Atajo: presionar Esc dos veces seguidas
    let ultimoEsc = 0;

    document.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Escape') {
            return;
        }

        const ahora = Date.now();

        if (ahora - ultimoEsc < 600 && !document.querySelector('.modal.show')) {
            salidaRapida();
        }

        ultimoEsc = ahora;
    });

    // Marca el enlace de la página actual en el menú
    const paginaActual = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '/index');

    document.querySelectorAll('.navbar-ct .nav-link').forEach((enlace) => {
        const destino = new URL(enlace.href).pathname.replace(/\.html$/, '').replace(/\/$/, '/index');

        if (destino === paginaActual) {
            enlace.classList.add('active');
            enlace.setAttribute('aria-current', 'page');
        }
    });

    // Botones para copiar texto (folio y clave)
    document.addEventListener('click', async (evento) => {
        const boton = evento.target.closest('[data-copiar]');

        if (!boton) {
            return;
        }

        const objetivo = document.getElementById(boton.dataset.copiar);

        try {
            await navigator.clipboard.writeText(objetivo.textContent.trim());
            const textoOriginal = boton.innerHTML;
            boton.innerHTML = '<i class="bi bi-check2"></i> Copiado';
            setTimeout(() => {
                boton.innerHTML = textoOriginal;
            }, 1500);
        } catch (error) {
            // Algunos navegadores no permiten copiar; el usuario puede anotarlo
        }
    });
});
