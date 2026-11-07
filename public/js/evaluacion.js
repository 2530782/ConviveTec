// Página: Encuesta de usabilidad SUS (System Usability Scale)
const PREGUNTAS_SUS = [
    'Creo que me gustaría usar esta plataforma con frecuencia.',
    'Encontré la plataforma innecesariamente compleja.',
    'Pensé que la plataforma era fácil de usar.',
    'Creo que necesitaría ayuda de una persona experta para poder usar esta plataforma.',
    'Las funciones de la plataforma están bien integradas.',
    'Pensé que había demasiadas inconsistencias en la plataforma.',
    'Imagino que la mayoría de las personas aprendería a usar esta plataforma muy rápido.',
    'Encontré la plataforma muy complicada de usar.',
    'Me sentí con confianza al usar la plataforma.',
    'Necesité aprender muchas cosas antes de poder usar la plataforma.'
];

function crearEscala(nombre, etiquetaAccesible) {
    let html = '';

    for (let valor = 1; valor <= 5; valor++) {
        html += `
            <div class="form-check form-check-inline me-0">
                <input class="form-check-input" type="radio" name="${nombre}" id="${nombre}-${valor}" value="${valor}" aria-label="${etiquetaAccesible}: ${valor}">
                <label class="form-check-label fw-bold" for="${nombre}-${valor}">${valor}</label>
            </div>
        `;
    }

    return html;
}

function interpretarSUS(puntaje) {
    if (puntaje >= 85) {
        return 'Excelente: la plataforma es muy fácil de usar.';
    }

    if (puntaje >= 68) {
        return 'Bueno: por encima del promedio (68), la meta del proyecto.';
    }

    if (puntaje >= 51) {
        return 'Aceptable, pero hay aspectos que mejorar.';
    }

    return 'Por debajo de lo esperado; tus comentarios nos ayudarán a mejorar.';
}

document.addEventListener('DOMContentLoaded', () => {
    const contenedor = document.getElementById('preguntasSUS');
    const formulario = document.getElementById('formEvaluacion');
    const alerta = document.getElementById('alerta');

    contenedor.innerHTML = PREGUNTAS_SUS.map((pregunta, indice) => `
        <fieldset class="mb-4 pb-3 border-bottom">
            <legend class="fs-6 fw-bold">${indice + 1}. ${pregunta}</legend>
            <div class="d-flex align-items-center gap-3 flex-wrap">
                <span class="small text-body-secondary">En desacuerdo</span>
                ${crearEscala('p' + (indice + 1), 'Pregunta ' + (indice + 1))}
                <span class="small text-body-secondary">De acuerdo</span>
            </div>
        </fieldset>
    `).join('');

    document.getElementById('escalaUtilidad').innerHTML =
        '<span class="small text-body-secondary">Nada útil</span>' +
        crearEscala('utilidad', 'Utilidad') +
        '<span class="small text-body-secondary">Muy útil</span>';

    // Tiempo que tardó en hacer un reporte de prueba (si lo hizo en esta sesión)
    const segundos = sessionStorage.getItem('ct_segundos_reporte');

    if (segundos) {
        document.getElementById('notaTiempo').textContent =
            `Se registrará que completaste tu reporte de prueba en ${segundos} segundos.`;
    }

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        const respuestas = [];

        for (let i = 1; i <= 10; i++) {
            const elegida = formulario.querySelector(`input[name="p${i}"]:checked`);
            respuestas.push(elegida ? Number(elegida.value) : null);
        }

        const utilidad = formulario.querySelector('input[name="utilidad"]:checked');
        const tipoUsuario = document.getElementById('tipoUsuario').value;

        if (!tipoUsuario || respuestas.includes(null) || !utilidad) {
            mostrarAlerta(alerta, 'Responde todas las preguntas antes de enviar.');
            alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        try {
            const resultado = await api('/encuestas', {
                method: 'POST',
                body: {
                    tipo_usuario: tipoUsuario,
                    respuestas,
                    utilidad: Number(utilidad.value),
                    segundos_reporte: segundos ? Number(segundos) : null,
                    comentario: document.getElementById('comentario').value
                }
            });

            sessionStorage.removeItem('ct_segundos_reporte');

            document.getElementById('resPuntaje').textContent = resultado.puntaje_sus;
            document.getElementById('resInterpretacion').textContent = interpretarSUS(resultado.puntaje_sus);

            formulario.classList.add('oculto');
            alerta.innerHTML = '';
            document.getElementById('vistaResultado').classList.remove('oculto');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            mostrarAlerta(alerta, error.message);
        }
    });
});
