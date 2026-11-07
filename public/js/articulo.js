// Página: Detalle de un contenido formativo
document.addEventListener('DOMContentLoaded', async () => {
    const contenedor = document.getElementById('articulo');
    const alerta = document.getElementById('alerta');
    const id = new URLSearchParams(window.location.search).get('id');

    if (!id) {
        mostrarAlerta(alerta, 'No se indicó qué contenido mostrar.');
        return;
    }

    try {
        const c = await api('/contenidos/' + encodeURIComponent(id));

        document.title = c.titulo + ' · ConviveTec';

        contenedor.innerHTML = `
            <span class="insignia-tipo">${escaparHTML(etiqueta('tipo', c.tipo))}</span>
            <span class="small fw-bold ms-2">${escaparHTML(etiqueta('tema', c.tema))}</span>
            <h1 class="mt-3">${escaparHTML(c.titulo)}</h1>
            <p class="lead text-body-secondary">${escaparHTML(c.resumen)}</p>
            ${c.imagen ? `<img src="${escaparHTML(c.imagen)}" class="articulo-imagen my-4" alt="">` : ''}
            <div class="articulo-cuerpo">${escaparHTML(c.cuerpo)}</div>

            <div class="tarjeta-funcion mt-5">
                <h2 class="h5">¿Esto te está pasando?</h2>
                <p class="text-body-secondary">No tienes que resolverlo solo. Puedes pedir ayuda de forma anónima.</p>
                <a href="reportar.html" class="btn btn-acento">Hacer un reporte</a>
                <a href="mediacion.html" class="btn btn-outline-primary">Pedir mediación</a>
            </div>
        `;
    } catch (error) {
        mostrarAlerta(alerta, error.message);
    }
});
