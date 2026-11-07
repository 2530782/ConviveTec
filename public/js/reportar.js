// Página: Reporte anónimo
document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formReporte');
    const alerta = document.getElementById('alerta');
    const descripcion = document.getElementById('descripcion');
    const contador = document.getElementById('contador');
    const riesgo = document.getElementById('riesgo');
    const avisoRiesgo = document.getElementById('avisoRiesgo');
    const fecha = document.getElementById('fecha');
    const botonEnviar = document.getElementById('btnEnviar');

    // No se permiten fechas futuras
    fecha.max = new Date().toISOString().slice(0, 10);

    // Se mide cuánto tarda la persona en llenar el reporte (para la evaluación de usabilidad).
    // El dato solo se guarda en este navegador y no se envía junto con el reporte.
    let inicio = null;

    formulario.addEventListener('input', () => {
        if (!inicio) {
            inicio = Date.now();
        }
    });

    descripcion.addEventListener('input', () => {
        contador.textContent = `${descripcion.value.length} / 3000`;
    });

    riesgo.addEventListener('change', () => {
        avisoRiesgo.classList.toggle('oculto', !riesgo.checked);
    });

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        alerta.innerHTML = '';

        const categoria = formulario.querySelector('input[name="categoria"]:checked');
        const relacion = formulario.querySelector('input[name="relacion"]:checked');

        // Validación en el navegador (el servidor vuelve a validar)
        if (!categoria) {
            mostrarAlerta(alerta, 'Selecciona el tipo de situación.');
            alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (!relacion) {
            mostrarAlerta(alerta, 'Indica cómo te enteraste de la situación.');
            alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (descripcion.value.trim().length < 20) {
            mostrarAlerta(alerta, 'Describe la situación con al menos 20 caracteres.');
            descripcion.focus();
            return;
        }

        if (!document.getElementById('aceptaAviso').checked) {
            mostrarAlerta(alerta, 'Confirma que leíste el aviso de privacidad.');
            return;
        }

        botonEnviar.disabled = true;
        botonEnviar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';

        try {
            const respuesta = await api('/reportes', {
                method: 'POST',
                body: {
                    categoria: categoria.value,
                    relacion: relacion.value,
                    descripcion: descripcion.value,
                    lugar: document.getElementById('lugar').value,
                    fecha_suceso: fecha.value,
                    riesgo_inmediato: riesgo.checked
                }
            });

            if (inicio) {
                const segundos = Math.round((Date.now() - inicio) / 1000);
                sessionStorage.setItem('ct_segundos_reporte', String(segundos));
            }

            document.getElementById('resFolio').textContent = respuesta.folio;
            document.getElementById('resClave').textContent = respuesta.clave;
            document.getElementById('resRiesgo').classList.toggle('oculto', !respuesta.riesgo_inmediato);

            document.getElementById('vistaFormulario').classList.add('oculto');
            document.getElementById('vistaResultado').classList.remove('oculto');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            mostrarAlerta(alerta, error.message);
            alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } finally {
            botonEnviar.disabled = false;
            botonEnviar.innerHTML = '<i class="bi bi-send"></i> Enviar reporte';
        }
    });
});
