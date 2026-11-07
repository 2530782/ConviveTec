// Página: Solicitud de mediación
document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formMediacion');
    const alerta = document.getElementById('alerta');
    const esMenor = document.getElementById('esMenor');
    const cajaConsentimiento = document.getElementById('cajaConsentimiento');
    const botonEnviar = document.getElementById('btnEnviar');

    esMenor.addEventListener('change', () => {
        cajaConsentimiento.classList.toggle('oculto', !esMenor.checked);
    });

    function valor(id) {
        return document.getElementById(id).value.trim();
    }

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        alerta.innerHTML = '';

        const consentimiento = document.getElementById('consentimiento').checked;

        if (valor('nombre').length < 3 || valor('contacto').length < 5 || valor('partes').length < 3) {
            mostrarAlerta(alerta, 'Completa tu nombre, un medio de contacto y con quién quieres dialogar.');
            return;
        }

        if (valor('motivo').length < 20) {
            mostrarAlerta(alerta, 'Describe el motivo con al menos 20 caracteres.');
            return;
        }

        if (esMenor.checked && !consentimiento) {
            mostrarAlerta(alerta, 'Si eres menor de edad, tu madre, padre o tutor debe estar enterado. Pídele apoyo o acude a orientación en persona.', 'warning');
            return;
        }

        if (!document.getElementById('aceptaAviso').checked) {
            mostrarAlerta(alerta, 'Debes aceptar el aviso de privacidad.');
            return;
        }

        botonEnviar.disabled = true;

        try {
            const respuesta = await api('/mediaciones', {
                method: 'POST',
                body: {
                    nombre: valor('nombre'),
                    grupo: valor('grupo'),
                    contacto: valor('contacto'),
                    partes: valor('partes'),
                    motivo: valor('motivo'),
                    disponibilidad: valor('disponibilidad'),
                    es_menor: esMenor.checked,
                    consentimiento_tutor: consentimiento,
                    acepta_aviso: true
                }
            });

            document.getElementById('resFolio').textContent = respuesta.folio;
            document.getElementById('resClave').textContent = respuesta.clave;

            formulario.classList.add('oculto');
            document.getElementById('vistaResultado').classList.remove('oculto');
            document.getElementById('vistaResultado').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            mostrarAlerta(alerta, error.message);
        } finally {
            botonEnviar.disabled = false;
        }
    });
});
