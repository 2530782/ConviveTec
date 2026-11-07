// Página: Contenido formativo
document.addEventListener('DOMContentLoaded', () => {
    const lista = document.getElementById('listaContenido');
    const alerta = document.getElementById('alerta');
    const filtroTipo = document.getElementById('filtroTipo');
    const chips = document.querySelectorAll('#filtrosTema .chip');

    let temaActual = '';

    async function cargar() {
        const parametros = new URLSearchParams();

        if (temaActual) {
            parametros.set('tema', temaActual);
        }

        if (filtroTipo.value) {
            parametros.set('tipo', filtroTipo.value);
        }

        try {
            const contenidos = await api('/contenidos?' + parametros.toString());

            if (!contenidos.length) {
                lista.innerHTML = '<p class="text-body-secondary">No hay contenido con esos filtros todavía.</p>';
                return;
            }

            lista.innerHTML = contenidos.map((c) => `
                <div class="col-sm-6 col-lg-4">
                    <a href="articulo.html?id=${c.id}" class="tarjeta-contenido">
                        <img src="${escaparHTML(c.imagen || 'img/logo.svg')}" alt="" loading="lazy">
                        <div class="cuerpo">
                            <span class="insignia-tipo">${escaparHTML(etiqueta('tipo', c.tipo))}</span>
                            <h2>${escaparHTML(c.titulo)}</h2>
                            <p class="mb-2 text-body-secondary">${escaparHTML(c.resumen)}</p>
                            <span class="small fw-bold">${escaparHTML(etiqueta('tema', c.tema))}</span>
                        </div>
                    </a>
                </div>
            `).join('');
        } catch (error) {
            mostrarAlerta(alerta, error.message);
        }
    }

    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            chips.forEach((otro) => otro.classList.remove('activo'));
            chip.classList.add('activo');
            temaActual = chip.dataset.tema;
            cargar();
        });
    });

    filtroTipo.addEventListener('change', cargar);

    cargar();
});
