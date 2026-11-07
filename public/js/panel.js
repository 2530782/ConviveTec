// =====================================================================
// ConviveTec - Panel del personal (orientación, docentes y administración)
// =====================================================================

let usuarioActual = null;

// Ventanas modales de Bootstrap
let modalCaso;
let modalMediacion;
let modalAsignar;
let modalContenido;
let modalUsuario;

// Qué se está asignando en la ventana "Asignar orientador"
let asignacionPendiente = null;

const alertaGeneral = document.getElementById('alertaGeneral');

// ---------------------------------------------------------------------
// Utilidades del panel
// ---------------------------------------------------------------------

function insigniaUrgencia(urgencia) {
    return `<span class="urg urg-${urgencia}">${etiqueta('urgencia', urgencia)}</span>`;
}

function insigniaEstado(estado) {
    return `<span class="est est-${estado}">${etiqueta('estado', estado)}</span>`;
}

function filaVacia(columnas, texto) {
    return `<tr><td colspan="${columnas}" class="text-center text-body-secondary py-4">${texto}</td></tr>`;
}

/**
 * Ejecuta una petición del panel. Si la sesión expiró, regresa al inicio de sesión.
 */
async function apiPanel(ruta, opciones) {
    try {
        return await api(ruta, opciones);
    } catch (error) {
        if (error.estado === 401) {
            cerrarSesion();
        }

        throw error;
    }
}

function cerrarSesion() {
    sessionStorage.removeItem('ct_token');
    sessionStorage.removeItem('ct_usuario');
    window.location.href = 'login.html';
}

// ---------------------------------------------------------------------
// Navegación entre secciones
// ---------------------------------------------------------------------

const CARGADORES = {
    resumen: cargarResumen,
    casos: cargarCasos,
    mediaciones: cargarMediaciones,
    canalizar: async () => {},
    mis: cargarMisCanalizaciones,
    contenido: cargarContenido,
    usuarios: cargarUsuarios,
    bitacora: cargarBitacora
};

function mostrarSeccion(nombre) {
    document.querySelectorAll('.seccion-panel').forEach((seccion) => {
        seccion.classList.add('oculto');
    });

    document.querySelectorAll('.panel-lateral .nav-link').forEach((enlace) => {
        enlace.classList.toggle('active', enlace.dataset.seccion === nombre);
    });

    document.getElementById('sec-' + nombre).classList.remove('oculto');
    alertaGeneral.innerHTML = '';

    CARGADORES[nombre]().catch((error) => {
        mostrarAlerta(alertaGeneral, error.message);
    });
}

// ---------------------------------------------------------------------
// RESUMEN
// ---------------------------------------------------------------------

async function cargarResumen() {
    const datos = await apiPanel('/estadisticas');

    const contar = (lista, campo, valor) => {
        const fila = lista.find((f) => f[campo] === valor);
        return fila ? fila.total : 0;
    };

    const totalReportes = datos.reportes_por_estado.reduce((suma, f) => suma + f.total, 0);
    const abiertos = totalReportes
        - contar(datos.reportes_por_estado, 'estado', 'cerrado')
        - contar(datos.reportes_por_estado, 'estado', 'descartado');
    const urgentes = contar(datos.abiertos_por_urgencia, 'urgencia', 'critica')
        + contar(datos.abiertos_por_urgencia, 'urgencia', 'alta');
    const mediacionesPendientes = contar(datos.mediaciones_por_estado, 'estado', 'pendiente');

    const tarjetas = [
        { numero: abiertos, texto: 'Casos abiertos', icono: 'bi-folder2-open' },
        { numero: urgentes, texto: 'Urgencia alta o crítica', icono: 'bi-exclamation-triangle' },
        { numero: datos.sin_asignar, texto: 'Sin orientador asignado', icono: 'bi-person-dash' },
        { numero: mediacionesPendientes, texto: 'Mediaciones pendientes', icono: 'bi-people' }
    ];

    document.getElementById('tarjetasResumen').innerHTML = tarjetas.map((t) => `
        <div class="col-6 col-xl-3">
            <div class="tarjeta-dato">
                <i class="bi ${t.icono} text-body-secondary"></i>
                <div class="numero">${t.numero}</div>
                <div class="descripcion">${t.texto}</div>
            </div>
        </div>
    `).join('');

    const maximo = Math.max(1, ...datos.reportes_por_categoria.map((f) => f.total));

    document.getElementById('graficaCategorias').innerHTML = datos.reportes_por_categoria.length
        ? datos.reportes_por_categoria.map((f) => `
            <div class="mb-3">
                <div class="d-flex justify-content-between small fw-bold mb-1">
                    <span>${escaparHTML(etiqueta('categoria', f.categoria))}</span>
                    <span>${f.total}</span>
                </div>
                <div class="barra-dato"><span style="width: ${(f.total / maximo) * 100}%"></span></div>
            </div>
        `).join('')
        : '<p class="text-body-secondary">Aún no hay reportes.</p>';

    const ev = datos.evaluacion;

    document.getElementById('resumenEvaluacion').innerHTML = ev.respuestas
        ? `
            <div class="row g-3 text-center">
                <div class="col-6">
                    <div class="numero">${ev.sus_promedio}</div>
                    <div class="descripcion">Puntaje SUS promedio <br><span class="fw-normal">(meta: 68 o más)</span></div>
                </div>
                <div class="col-6">
                    <div class="numero">${ev.utilidad_promedio} / 5</div>
                    <div class="descripcion">Utilidad percibida</div>
                </div>
                <div class="col-6">
                    <div class="numero">${ev.segundos_promedio ? ev.segundos_promedio + ' s' : '—'}</div>
                    <div class="descripcion">Tiempo promedio para reportar <br><span class="fw-normal">(meta: menos de 120 s)</span></div>
                </div>
                <div class="col-6">
                    <div class="numero">${ev.respuestas}</div>
                    <div class="descripcion">Encuestas respondidas</div>
                </div>
            </div>
        `
        : '<p class="text-body-secondary">Aún no hay encuestas. Comparte la página <a href="evaluacion.html" target="_blank">evaluacion.html</a> con los usuarios de prueba.</p>';
}

// ---------------------------------------------------------------------
// CASOS
// ---------------------------------------------------------------------

async function cargarCasos() {
    const parametros = new URLSearchParams({
        asignacion: document.getElementById('filtroAsignacion').value,
        estado: document.getElementById('filtroEstado').value,
        urgencia: document.getElementById('filtroUrgencia').value
    });

    const casos = await apiPanel('/reportes?' + parametros.toString());
    const tabla = document.getElementById('tablaCasos');
    const esOrientador = usuarioActual.rol === 'orientador';

    if (!casos.length) {
        tabla.innerHTML = filaVacia(7, 'No hay casos con estos filtros.');
        return;
    }

    tabla.innerHTML = casos.map((c) => {
        let accion = '';

        if (esOrientador && c.puede_ver) {
            accion = `<button class="btn btn-sm btn-primary" data-accion="ver-caso" data-id="${c.id}">Abrir</button>`;
        } else if (esOrientador && !c.orientador_id) {
            accion = `<button class="btn btn-sm btn-outline-primary" data-accion="tomar-caso" data-id="${c.id}">Tomar caso</button>`;
        } else if (usuarioActual.rol === 'admin') {
            accion = `<button class="btn btn-sm btn-outline-primary" data-accion="asignar-caso" data-id="${c.id}">${c.orientador_id ? 'Reasignar' : 'Asignar'}</button>`;
        } else {
            accion = '<span class="small text-body-secondary"><i class="bi bi-lock"></i> Confidencial</span>';
        }

        return `
            <tr>
                <td class="folio">${escaparHTML(c.folio)}</td>
                <td>
                    ${escaparHTML(etiqueta('categoria', c.categoria))}
                    ${c.origen === 'docente' ? '<span class="badge text-bg-light">Docente</span>' : ''}
                    ${c.riesgo_inmediato ? '<i class="bi bi-exclamation-triangle-fill text-danger" title="Riesgo inmediato"></i>' : ''}
                </td>
                <td>${insigniaUrgencia(c.urgencia)}</td>
                <td>${insigniaEstado(c.estado)}</td>
                <td>${escaparHTML(c.orientador || '—')}</td>
                <td class="small text-nowrap">${formatearFecha(c.creado_en)}</td>
                <td class="text-end">${accion}</td>
            </tr>
        `;
    }).join('');
}

async function abrirCaso(id) {
    const caso = await apiPanel('/reportes/' + id);
    const cerrado = ['cerrado', 'descartado'].includes(caso.estado);

    document.getElementById('tituloCaso').textContent = caso.folio;

    const opcionesEstado = ['recibido', 'en_revision', 'en_atencion', 'cerrado', 'descartado']
        .map((e) => `<option value="${e}" ${e === caso.estado ? 'selected' : ''}>${etiqueta('estado', e)}</option>`)
        .join('');

    const opcionesUrgencia = ['critica', 'alta', 'media', 'baja']
        .map((u) => `<option value="${u}" ${u === caso.urgencia ? 'selected' : ''}>${etiqueta('urgencia', u)}</option>`)
        .join('');

    const autores = {
        sistema: 'Sistema',
        orientador: 'Orientación',
        reportante: 'Reportante'
    };

    document.getElementById('cuerpoCaso').innerHTML = `
        ${caso.riesgo_inmediato ? `
            <div class="alert alert-danger"><i class="bi bi-exclamation-triangle-fill"></i>
                Quien reportó indicó <strong>riesgo inmediato</strong>. Atiende este caso de inmediato y, si es necesario, avisa a las autoridades.
            </div>` : ''}

        <div class="row g-3 mb-3 small">
            <div class="col-sm-4"><div class="fw-bold">Situación</div>${escaparHTML(etiqueta('categoria', caso.categoria))}</div>
            <div class="col-sm-4"><div class="fw-bold">Quien reporta</div>${escaparHTML(etiqueta('relacion', caso.relacion))}</div>
            <div class="col-sm-4"><div class="fw-bold">Origen</div>${caso.origen === 'docente' ? 'Docente: ' + escaparHTML(caso.docente || '') : 'Reporte anónimo'}</div>
            <div class="col-sm-4"><div class="fw-bold">Lugar</div>${escaparHTML(caso.lugar || '—')}</div>
            <div class="col-sm-4"><div class="fw-bold">Fecha del suceso</div>${formatearFecha(caso.fecha_suceso, false)}</div>
            <div class="col-sm-4"><div class="fw-bold">Recibido</div>${formatearFecha(caso.creado_en)}</div>
        </div>

        <h3 class="h6">Descripción</h3>
        <div class="texto-caso mb-4">${escaparHTML(caso.descripcion)}</div>

        <form id="formEstadoCaso" class="row g-2 align-items-end mb-4">
            <div class="col-sm-5">
                <label for="casoEstado" class="form-label small">Estado</label>
                <select id="casoEstado" class="form-select">${opcionesEstado}</select>
            </div>
            <div class="col-sm-4">
                <label for="casoUrgencia" class="form-label small">Urgencia</label>
                <select id="casoUrgencia" class="form-select">${opcionesUrgencia}</select>
            </div>
            <div class="col-sm-3">
                <button type="submit" class="btn btn-primary w-100">Guardar</button>
            </div>
        </form>

        <h3 class="h6">Seguimiento</h3>
        <ul class="linea-tiempo mb-3">
            ${caso.seguimientos.map((s) => `
                <li class="${s.autor} ${s.autor === 'orientador' && !s.visible_reportante ? 'interna' : ''}">
                    <div class="meta">
                        ${autores[s.autor]}${s.usuario && s.autor === 'orientador' ? ' · ' + escaparHTML(s.usuario) : ''}
                        · ${formatearFecha(s.creado_en)}
                        ${s.autor === 'orientador' ? (s.visible_reportante ? '· <i class="bi bi-eye"></i> visible para quien reporta' : '· <i class="bi bi-lock"></i> nota interna') : ''}
                    </div>
                    <div class="burbuja">${escaparHTML(s.mensaje)}</div>
                </li>
            `).join('')}
        </ul>

        <form id="formSeguimiento" class="${cerrado ? 'oculto' : ''}">
            <label for="segMensaje" class="form-label small">Nuevo mensaje o nota</label>
            <textarea id="segMensaje" class="form-control mb-2" rows="3" maxlength="2000"></textarea>
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="segVisible">
                    <label class="form-check-label small" for="segVisible">Enviar como mensaje a quien reporta (si no, queda como nota interna)</label>
                </div>
                <button type="submit" class="btn btn-primary btn-sm">Agregar</button>
            </div>
        </form>
        <div id="alertaCaso" class="mt-3"></div>
    `;

    document.getElementById('formEstadoCaso').addEventListener('submit', async (evento) => {
        evento.preventDefault();

        try {
            await apiPanel('/reportes/' + id, {
                method: 'PUT',
                body: {
                    estado: document.getElementById('casoEstado').value,
                    urgencia: document.getElementById('casoUrgencia').value
                }
            });

            await abrirCaso(id);
            cargarCasos();
        } catch (error) {
            mostrarAlerta(document.getElementById('alertaCaso'), error.message);
        }
    });

    document.getElementById('formSeguimiento').addEventListener('submit', async (evento) => {
        evento.preventDefault();

        try {
            await apiPanel(`/reportes/${id}/seguimientos`, {
                method: 'POST',
                body: {
                    mensaje: document.getElementById('segMensaje').value,
                    visible_reportante: document.getElementById('segVisible').checked
                }
            });

            await abrirCaso(id);
        } catch (error) {
            mostrarAlerta(document.getElementById('alertaCaso'), error.message);
        }
    });

    modalCaso.show();
}

// ---------------------------------------------------------------------
// MEDIACIONES
// ---------------------------------------------------------------------

async function cargarMediaciones() {
    const parametros = new URLSearchParams({
        asignacion: document.getElementById('filtroAsignacionMed').value,
        estado: document.getElementById('filtroEstadoMed').value
    });

    const lista = await apiPanel('/mediaciones?' + parametros.toString());
    const tabla = document.getElementById('tablaMediaciones');
    const esOrientador = usuarioActual.rol === 'orientador';

    if (!lista.length) {
        tabla.innerHTML = filaVacia(7, 'No hay solicitudes con estos filtros.');
        return;
    }

    tabla.innerHTML = lista.map((m) => {
        let accion = '';

        if (esOrientador && m.puede_ver) {
            accion = `<button class="btn btn-sm btn-primary" data-accion="ver-mediacion" data-id="${m.id}">Abrir</button>`;
        } else if (esOrientador && !m.orientador_id) {
            accion = `<button class="btn btn-sm btn-outline-primary" data-accion="tomar-mediacion" data-id="${m.id}">Tomar</button>`;
        } else if (usuarioActual.rol === 'admin') {
            accion = `<button class="btn btn-sm btn-outline-primary" data-accion="asignar-mediacion" data-id="${m.id}">${m.orientador_id ? 'Reasignar' : 'Asignar'}</button>`;
        } else {
            accion = '<span class="small text-body-secondary"><i class="bi bi-lock"></i> Confidencial</span>';
        }

        return `
            <tr>
                <td class="folio">${escaparHTML(m.folio)}</td>
                <td>${escaparHTML(m.grupo || '—')}</td>
                <td>${insigniaEstado(m.estado)}</td>
                <td class="small">${m.fecha_sesion ? formatearFecha(m.fecha_sesion) : '—'}</td>
                <td>${m.es_menor ? (m.consentimiento_tutor ? 'Sí, con consentimiento' : 'Sí') : 'No'}</td>
                <td>${escaparHTML(m.orientador || '—')}</td>
                <td class="text-end">${accion}</td>
            </tr>
        `;
    }).join('');
}

async function abrirMediacion(id) {
    const m = await apiPanel('/mediaciones/' + id);

    document.getElementById('tituloMediacion').textContent = m.folio;

    const opcionesEstado = ['pendiente', 'programada', 'realizada', 'cancelada']
        .map((e) => `<option value="${e}" ${e === m.estado ? 'selected' : ''}>${etiqueta('estado', e)}</option>`)
        .join('');

    const fechaLocal = m.fecha_sesion ? m.fecha_sesion.replace(' ', 'T').slice(0, 16) : '';

    document.getElementById('cuerpoMediacion').innerHTML = `
        <div class="row g-3 mb-3 small">
            <div class="col-sm-6"><div class="fw-bold">Solicitante</div>${escaparHTML(m.nombre)} ${m.grupo ? '(' + escaparHTML(m.grupo) + ')' : ''}</div>
            <div class="col-sm-6"><div class="fw-bold">Contacto</div>${escaparHTML(m.contacto)}</div>
            <div class="col-sm-6"><div class="fw-bold">Con quién</div>${escaparHTML(m.partes)}</div>
            <div class="col-sm-6"><div class="fw-bold">Disponibilidad</div>${escaparHTML(m.disponibilidad || '—')}</div>
            <div class="col-12">
                <div class="fw-bold">Menor de edad</div>
                ${m.es_menor ? 'Sí · el solicitante confirmó que su madre, padre o tutor está enterado' : 'No'}
            </div>
        </div>

        <h3 class="h6">Motivo</h3>
        <div class="texto-caso mb-4">${escaparHTML(m.motivo)}</div>

        <form id="formMediacionDetalle" class="row g-3">
            <div class="col-sm-4">
                <label for="medEstado" class="form-label small">Estado</label>
                <select id="medEstado" class="form-select">${opcionesEstado}</select>
            </div>
            <div class="col-sm-4">
                <label for="medFecha" class="form-label small">Fecha y hora de la sesión</label>
                <input type="datetime-local" id="medFecha" class="form-control" value="${fechaLocal}">
            </div>
            <div class="col-sm-4">
                <label for="medLugar" class="form-label small">Lugar</label>
                <input type="text" id="medLugar" class="form-control" maxlength="120" value="${escaparHTML(m.lugar_sesion || '')}">
            </div>
            <div class="col-12">
                <label for="medAcuerdos" class="form-label small">Acuerdos de la sesión (confidencial)</label>
                <textarea id="medAcuerdos" class="form-control" rows="4" maxlength="3000">${escaparHTML(m.acuerdos || '')}</textarea>
            </div>
            <div class="col-12">
                <button type="submit" class="btn btn-primary">Guardar cambios</button>
            </div>
        </form>
        <div id="alertaMediacion" class="mt-3"></div>
    `;

    document.getElementById('formMediacionDetalle').addEventListener('submit', async (evento) => {
        evento.preventDefault();

        try {
            await apiPanel('/mediaciones/' + id, {
                method: 'PUT',
                body: {
                    estado: document.getElementById('medEstado').value,
                    fecha_sesion: document.getElementById('medFecha').value,
                    lugar_sesion: document.getElementById('medLugar').value,
                    acuerdos: document.getElementById('medAcuerdos').value
                }
            });

            mostrarAlerta(document.getElementById('alertaMediacion'), 'Cambios guardados.', 'success');
            cargarMediaciones();
        } catch (error) {
            mostrarAlerta(document.getElementById('alertaMediacion'), error.message);
        }
    });

    modalMediacion.show();
}

// ---------------------------------------------------------------------
// ASIGNAR ORIENTADOR (administrador)
// ---------------------------------------------------------------------

async function abrirAsignar(tipo, id) {
    const orientadores = await apiPanel('/orientadores');

    asignacionPendiente = { tipo, id };

    document.getElementById('selectOrientador').innerHTML = orientadores
        .map((o) => `<option value="${o.id}">${escaparHTML(o.nombre)}</option>`)
        .join('');

    document.getElementById('alertaAsignar').innerHTML = '';
    modalAsignar.show();
}

// ---------------------------------------------------------------------
// DOCENTE: canalizar y ver canalizaciones
// ---------------------------------------------------------------------

async function enviarCanalizacion(evento) {
    evento.preventDefault();

    const alerta = document.getElementById('alertaCanalizar');

    try {
        const respuesta = await apiPanel('/reportes/canalizar', {
            method: 'POST',
            body: {
                categoria: document.getElementById('canCategoria').value,
                relacion: document.getElementById('canRelacion').value,
                descripcion: document.getElementById('canDescripcion').value,
                lugar: document.getElementById('canLugar').value,
                fecha_suceso: document.getElementById('canFecha').value,
                riesgo_inmediato: document.getElementById('canRiesgo').checked
            }
        });

        document.getElementById('formCanalizar').reset();
        mostrarAlerta(alerta, `Situación enviada a orientación con el folio ${respuesta.folio}.`, 'success');
    } catch (error) {
        mostrarAlerta(alerta, error.message);
    }
}

async function cargarMisCanalizaciones() {
    const lista = await apiPanel('/reportes/mis-canalizaciones');
    const tabla = document.getElementById('tablaMis');

    if (!lista.length) {
        tabla.innerHTML = filaVacia(5, 'Todavía no has canalizado situaciones.');
        return;
    }

    tabla.innerHTML = lista.map((r) => `
        <tr>
            <td class="folio">${escaparHTML(r.folio)}</td>
            <td>${escaparHTML(etiqueta('categoria', r.categoria))}</td>
            <td>${insigniaEstado(r.estado)}</td>
            <td class="small">${formatearFecha(r.creado_en)}</td>
            <td class="small">${formatearFecha(r.actualizado_en)}</td>
        </tr>
    `).join('');
}

// ---------------------------------------------------------------------
// CONTENIDO FORMATIVO (administrador)
// ---------------------------------------------------------------------

let contenidosCargados = [];

async function cargarContenido() {
    contenidosCargados = await apiPanel('/contenidos/admin/todos');
    const tabla = document.getElementById('tablaContenido');

    if (!contenidosCargados.length) {
        tabla.innerHTML = filaVacia(6, 'No hay contenido. Crea el primero.');
        return;
    }

    tabla.innerHTML = contenidosCargados.map((c) => `
        <tr>
            <td><img src="${escaparHTML(c.imagen || 'img/logo.svg')}" alt="" width="72" height="40" style="object-fit: cover; border-radius: 6px;"></td>
            <td class="fw-bold">${escaparHTML(c.titulo)}</td>
            <td>${escaparHTML(etiqueta('tipo', c.tipo))}</td>
            <td>${escaparHTML(etiqueta('tema', c.tema))}</td>
            <td>${c.publicado ? '<i class="bi bi-check-circle-fill text-success"></i> Sí' : 'No'}</td>
            <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-primary" data-accion="editar-contenido" data-id="${c.id}">Editar</button>
                <button class="btn btn-sm btn-outline-danger" data-accion="eliminar-contenido" data-id="${c.id}" aria-label="Eliminar"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function abrirContenido(id) {
    const c = contenidosCargados.find((item) => item.id === id) || {};

    document.getElementById('tituloContenido').textContent = id ? 'Editar contenido' : 'Nuevo contenido';
    document.getElementById('conId').value = id || '';
    document.getElementById('conTitulo').value = c.titulo || '';
    document.getElementById('conTipo').value = c.tipo || 'consejo';
    document.getElementById('conTema').value = c.tema || 'comunicacion_asertiva';
    document.getElementById('conResumen').value = c.resumen || '';
    document.getElementById('conCuerpo').value = c.cuerpo || '';
    document.getElementById('conImagen').value = c.imagen || '';
    document.getElementById('conPublicado').checked = id ? Boolean(c.publicado) : true;
    document.getElementById('alertaContenido').innerHTML = '';

    try {
        const imagenes = await apiPanel('/contenidos/admin/imagenes');
        document.getElementById('listaImagenes').innerHTML = imagenes
            .map((ruta) => `<option value="${escaparHTML(ruta)}">`)
            .join('');
    } catch (error) {
        // Si falla la lista de imágenes, se puede escribir la ruta a mano
    }

    modalContenido.show();
}

async function guardarContenido(evento) {
    evento.preventDefault();

    const id = document.getElementById('conId').value;
    const datos = {
        titulo: document.getElementById('conTitulo').value,
        tipo: document.getElementById('conTipo').value,
        tema: document.getElementById('conTema').value,
        resumen: document.getElementById('conResumen').value,
        cuerpo: document.getElementById('conCuerpo').value,
        imagen: document.getElementById('conImagen').value,
        publicado: document.getElementById('conPublicado').checked
    };

    try {
        await apiPanel(id ? '/contenidos/' + id : '/contenidos', {
            method: id ? 'PUT' : 'POST',
            body: datos
        });

        modalContenido.hide();
        cargarContenido();
    } catch (error) {
        mostrarAlerta(document.getElementById('alertaContenido'), error.message);
    }
}

// ---------------------------------------------------------------------
// USUARIOS (administrador)
// ---------------------------------------------------------------------

let usuariosCargados = [];

async function cargarUsuarios() {
    usuariosCargados = await apiPanel('/usuarios');

    document.getElementById('tablaUsuarios').innerHTML = usuariosCargados.map((u) => `
        <tr>
            <td class="fw-bold">${escaparHTML(u.nombre)}</td>
            <td>${escaparHTML(u.correo)}</td>
            <td>${escaparHTML(etiqueta('rol', u.rol))}</td>
            <td>${u.activo ? '<span class="est est-en_atencion">Activa</span>' : '<span class="est">Desactivada</span>'}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary" data-accion="editar-usuario" data-id="${u.id}">Editar</button>
            </td>
        </tr>
    `).join('');
}

function abrirUsuario(id) {
    const u = usuariosCargados.find((item) => item.id === id) || {};

    document.getElementById('tituloUsuario').textContent = id ? 'Editar usuario' : 'Nuevo usuario';
    document.getElementById('usuId').value = id || '';
    document.getElementById('usuNombre').value = u.nombre || '';
    document.getElementById('usuCorreo').value = u.correo || '';
    document.getElementById('usuRol').value = u.rol || 'orientador';
    document.getElementById('usuPassword').value = '';
    document.getElementById('usuActivo').checked = id ? Boolean(u.activo) : true;

    // Al editar, nombre y correo no se cambian
    document.getElementById('usuNombre').disabled = Boolean(id);
    document.getElementById('usuCorreo').disabled = Boolean(id);
    document.getElementById('cajaActivo').classList.toggle('oculto', !id);
    document.getElementById('ayudaPassword').textContent = id
        ? 'Déjala vacía para no cambiarla. Mínimo 8 caracteres.'
        : 'Mínimo 8 caracteres.';
    document.getElementById('alertaUsuario').innerHTML = '';

    modalUsuario.show();
}

async function guardarUsuario(evento) {
    evento.preventDefault();

    const id = document.getElementById('usuId').value;

    try {
        if (id) {
            await apiPanel('/usuarios/' + id, {
                method: 'PUT',
                body: {
                    rol: document.getElementById('usuRol').value,
                    activo: document.getElementById('usuActivo').checked,
                    password: document.getElementById('usuPassword').value
                }
            });
        } else {
            await apiPanel('/usuarios', {
                method: 'POST',
                body: {
                    nombre: document.getElementById('usuNombre').value,
                    correo: document.getElementById('usuCorreo').value,
                    rol: document.getElementById('usuRol').value,
                    password: document.getElementById('usuPassword').value
                }
            });
        }

        modalUsuario.hide();
        cargarUsuarios();
    } catch (error) {
        mostrarAlerta(document.getElementById('alertaUsuario'), error.message);
    }
}

// ---------------------------------------------------------------------
// BITÁCORA (administrador)
// ---------------------------------------------------------------------

const TEXTO_ACCION = {
    inicio_sesion: 'Inició sesión',
    ver_reporte: 'Consultó el detalle de un reporte',
    tomar_reporte: 'Tomó un reporte',
    asignar_reporte: 'Asignó un reporte',
    actualizar_reporte: 'Actualizó un reporte',
    agregar_seguimiento: 'Agregó seguimiento',
    canalizar_reporte: 'Canalizó una situación',
    ver_mediacion: 'Consultó una mediación',
    tomar_mediacion: 'Tomó una mediación',
    asignar_mediacion: 'Asignó una mediación',
    actualizar_mediacion: 'Actualizó una mediación',
    crear_contenido: 'Creó contenido',
    editar_contenido: 'Editó contenido',
    eliminar_contenido: 'Eliminó contenido',
    crear_usuario: 'Creó un usuario',
    editar_usuario: 'Editó un usuario'
};

async function cargarBitacora() {
    const filas = await apiPanel('/auditoria');

    document.getElementById('tablaBitacora').innerHTML = filas.length
        ? filas.map((f) => `
            <tr>
                <td class="small text-nowrap">${formatearFecha(f.creado_en)}</td>
                <td>${escaparHTML(f.usuario || '—')} <span class="small text-body-secondary">${escaparHTML(etiqueta('rol', f.rol))}</span></td>
                <td>${escaparHTML(TEXTO_ACCION[f.accion] || f.accion)}</td>
                <td class="small">${escaparHTML(f.entidad)} #${f.entidad_id ?? ''}</td>
            </tr>
        `).join('')
        : filaVacia(4, 'Sin movimientos.');
}

// ---------------------------------------------------------------------
// Acciones de los botones dentro de las tablas
// ---------------------------------------------------------------------

async function manejarAccion(boton) {
    const id = Number(boton.dataset.id);
    const accion = boton.dataset.accion;

    switch (accion) {
        case 'ver-caso':
            await abrirCaso(id);
            break;

        case 'tomar-caso':
            await apiPanel(`/reportes/${id}/tomar`, { method: 'POST' });
            await cargarCasos();
            await abrirCaso(id);
            break;

        case 'asignar-caso':
            await abrirAsignar('reportes', id);
            break;

        case 'ver-mediacion':
            await abrirMediacion(id);
            break;

        case 'tomar-mediacion':
            await apiPanel(`/mediaciones/${id}/tomar`, { method: 'POST' });
            await cargarMediaciones();
            await abrirMediacion(id);
            break;

        case 'asignar-mediacion':
            await abrirAsignar('mediaciones', id);
            break;

        case 'editar-contenido':
            await abrirContenido(id);
            break;

        case 'eliminar-contenido':
            if (confirm('¿Eliminar este contenido? Esta acción no se puede deshacer.')) {
                await apiPanel('/contenidos/' + id, { method: 'DELETE' });
                await cargarContenido();
            }
            break;

        case 'editar-usuario':
            abrirUsuario(id);
            break;
    }
}

// ---------------------------------------------------------------------
// Inicio del panel
// ---------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    if (!sessionStorage.getItem('ct_token')) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const respuesta = await apiPanel('/auth/yo');
        usuarioActual = respuesta.usuario;
    } catch (error) {
        return;
    }

    modalCaso = new bootstrap.Modal('#modalCaso');
    modalMediacion = new bootstrap.Modal('#modalMediacion');
    modalAsignar = new bootstrap.Modal('#modalAsignar');
    modalContenido = new bootstrap.Modal('#modalContenido');
    modalUsuario = new bootstrap.Modal('#modalUsuario');

    document.getElementById('nombreUsuario').textContent = usuarioActual.nombre;
    document.getElementById('rolUsuario').textContent = etiqueta('rol', usuarioActual.rol);

    // Solo se muestran las secciones que corresponden al rol
    const enlaces = document.querySelectorAll('.panel-lateral .nav-link');
    let primera = null;

    enlaces.forEach((enlace) => {
        const roles = enlace.dataset.roles.split(' ');

        if (roles.includes(usuarioActual.rol)) {
            primera = primera || enlace.dataset.seccion;
            enlace.addEventListener('click', () => mostrarSeccion(enlace.dataset.seccion));
        } else {
            enlace.remove();
        }
    });

    // Eventos generales
    document.getElementById('btnSalir').addEventListener('click', cerrarSesion);

    ['filtroAsignacion', 'filtroEstado', 'filtroUrgencia'].forEach((id) => {
        document.getElementById(id).addEventListener('change', () => cargarCasos().catch((e) => mostrarAlerta(alertaGeneral, e.message)));
    });

    ['filtroAsignacionMed', 'filtroEstadoMed'].forEach((id) => {
        document.getElementById(id).addEventListener('change', () => cargarMediaciones().catch((e) => mostrarAlerta(alertaGeneral, e.message)));
    });

    document.getElementById('formCanalizar').addEventListener('submit', enviarCanalizacion);
    document.getElementById('canFecha').max = new Date().toISOString().slice(0, 10);

    document.getElementById('btnNuevoContenido').addEventListener('click', () => abrirContenido(null));
    document.getElementById('formContenido').addEventListener('submit', guardarContenido);

    document.getElementById('btnNuevoUsuario').addEventListener('click', () => abrirUsuario(null));
    document.getElementById('formUsuario').addEventListener('submit', guardarUsuario);

    document.getElementById('formAsignar').addEventListener('submit', async (evento) => {
        evento.preventDefault();

        try {
            await apiPanel(`/${asignacionPendiente.tipo}/${asignacionPendiente.id}/asignar`, {
                method: 'PUT',
                body: { orientador_id: Number(document.getElementById('selectOrientador').value) }
            });

            modalAsignar.hide();

            if (asignacionPendiente.tipo === 'reportes') {
                cargarCasos();
            } else {
                cargarMediaciones();
            }
        } catch (error) {
            mostrarAlerta(document.getElementById('alertaAsignar'), error.message);
        }
    });

    document.addEventListener('click', (evento) => {
        const boton = evento.target.closest('[data-accion]');

        if (!boton) {
            return;
        }

        manejarAccion(boton).catch((error) => {
            mostrarAlerta(alertaGeneral, error.message);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    mostrarSeccion(primera);
});
