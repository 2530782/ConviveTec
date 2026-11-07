// Página: Consultar el avance de un caso con folio y clave
document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formConsulta');
    const alerta = document.getElementById('alerta');
    const resultado = document.getElementById('resultado');
    const campoFolio = document.getElementById('folio');
    const campoClave = document.getElementById('clave');

    // Pasos que se muestran en la barra de progreso
    const PASOS_REPORTE = ['recibido', 'en_revision', 'en_atencion', 'cerrado'];
    const PASOS_MEDIACION = ['pendiente', 'programada', 'realizada'];

    const AUTORES = {
        sistema: 'ConviveTec',
        orientador: 'Orientación',
        reportante: 'Tú'
    };

    function barraDePasos(pasos, estadoActual) {
        const posicion = pasos.indexOf(estadoActual);

        return `
            <div class="pasos-estado" aria-label="Avance del caso">
                ${pasos.map((paso, indice) => `
                    <div class="paso ${indice <= posicion ? 'hecho' : ''}">${etiqueta('estado', paso)}</div>
                `).join('')}
            </div>
        `;
    }

    function mostrarReporte(caso) {
        const cerrado = ['cerrado', 'descartado'].includes(caso.estado);

        let barra = barraDePasos(PASOS_REPORTE, caso.estado);

        if (caso.estado === 'descartado') {
            barra = '<p class="alert alert-secondary my-3">Este reporte fue revisado y descartado por orientación. Si la situación continúa, puedes hacer un nuevo reporte.</p>';
        }

        resultado.innerHTML = `
            <div class="d-flex flex-wrap justify-content-between gap-2">
                <div>
                    <div class="small fw-bold text-body-secondary">REPORTE</div>
                    <h2 class="h3 folio mb-0">${escaparHTML(caso.folio)}</h2>
                </div>
                <div class="text-sm-end">
                    <div class="fw-bold">${escaparHTML(etiqueta('categoria', caso.categoria))}</div>
                    <div class="small text-body-secondary">Enviado el ${formatearFecha(caso.creado_en)}</div>
                </div>
            </div>

            ${barra}

            <h3 class="h5 mb-3">Mensajes de tu caso</h3>
            <ul class="linea-tiempo mb-4">
                ${caso.seguimientos.map((s) => `
                    <li class="${s.autor}">
                        <div class="meta">${AUTORES[s.autor]} · ${formatearFecha(s.creado_en)}</div>
                        <div class="burbuja">${escaparHTML(s.mensaje)}</div>
                    </li>
                `).join('')}
            </ul>

            ${cerrado ? '' : `
                <form id="formMensaje" novalidate>
                    <label for="mensaje" class="form-label">Agregar información o responder a orientación</label>
                    <textarea id="mensaje" class="form-control mb-2" rows="3" maxlength="2000"></textarea>
                    <div id="alertaMensaje"></div>
                    <button type="submit" class="btn btn-primary"><i class="bi bi-send"></i> Enviar mensaje</button>
                </form>
            `}
        `;

        const formMensaje = document.getElementById('formMensaje');

        if (formMensaje) {
            formMensaje.addEventListener('submit', enviarMensaje);
        }
    }

    function mostrarMediacion(caso) {
        let detalle = '<p class="mb-0">Tu solicitud está en espera. Un orientador te contactará pronto.</p>';

        if (caso.estado === 'programada') {
            detalle = `
                <div class="caja-folio text-start">
                    <div class="fw-bold mb-1"><i class="bi bi-calendar-event"></i> Sesión programada</div>
                    <div>${formatearFecha(caso.fecha_sesion)}</div>
                    <div>${escaparHTML(caso.lugar_sesion || 'Lugar por confirmar')}</div>
                </div>
            `;
        } else if (caso.estado === 'realizada') {
            detalle = '<p class="mb-0">La sesión de mediación ya se realizó. Si necesitas otra, puedes solicitarla de nuevo.</p>';
        } else if (caso.estado === 'cancelada') {
            detalle = '<p class="mb-0">La solicitud fue cancelada. Si aún lo necesitas, acude a orientación o envía una nueva solicitud.</p>';
        }

        resultado.innerHTML = `
            <div class="small fw-bold text-body-secondary">SOLICITUD DE MEDIACIÓN</div>
            <h2 class="h3 folio">${escaparHTML(caso.folio)}</h2>
            <div class="small text-body-secondary">Enviada el ${formatearFecha(caso.creado_en)}</div>
            ${caso.estado === 'cancelada' ? '' : barraDePasos(PASOS_MEDIACION, caso.estado)}
            ${detalle}
        `;
    }

    async function consultar() {
        alerta.innerHTML = '';

        const caso = await api('/consulta', {
            method: 'POST',
            body: {
                folio: campoFolio.value.trim(),
                clave: campoClave.value.trim()
            }
        });

        if (caso.tipo === 'reporte') {
            mostrarReporte(caso);
        } else {
            mostrarMediacion(caso);
        }

        resultado.classList.remove('oculto');
    }

    async function enviarMensaje(evento) {
        evento.preventDefault();

        const mensaje = document.getElementById('mensaje').value.trim();
        const alertaMensaje = document.getElementById('alertaMensaje');

        if (mensaje.length < 3) {
            mostrarAlerta(alertaMensaje, 'Escribe tu mensaje.');
            return;
        }

        try {
            await api('/consulta/mensaje', {
                method: 'POST',
                body: {
                    folio: campoFolio.value.trim(),
                    clave: campoClave.value.trim(),
                    mensaje
                }
            });

            await consultar();
        } catch (error) {
            mostrarAlerta(alertaMensaje, error.message);
        }
    }

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        resultado.classList.add('oculto');

        if (!campoFolio.value.trim() || campoClave.value.trim().length !== 6) {
            mostrarAlerta(alerta, 'Escribe tu folio y tu clave de 6 caracteres.');
            return;
        }

        try {
            await consultar();
        } catch (error) {
            mostrarAlerta(alerta, error.message);
        }
    });
});
