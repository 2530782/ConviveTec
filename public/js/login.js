// Página: Inicio de sesión del personal
document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formLogin');
    const alerta = document.getElementById('alerta');
    const boton = document.getElementById('btnEntrar');

    // Si ya hay sesión, se va directo al panel
    if (sessionStorage.getItem('ct_token')) {
        window.location.href = 'panel.html';
        return;
    }

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        alerta.innerHTML = '';
        boton.disabled = true;

        try {
            const respuesta = await api('/auth/login', {
                method: 'POST',
                body: {
                    correo: document.getElementById('correo').value,
                    password: document.getElementById('password').value
                }
            });

            // sessionStorage: la sesión se borra al cerrar la pestaña
            sessionStorage.setItem('ct_token', respuesta.token);
            sessionStorage.setItem('ct_usuario', JSON.stringify(respuesta.usuario));

            window.location.href = 'panel.html';
        } catch (error) {
            mostrarAlerta(alerta, error.message);
        } finally {
            boton.disabled = false;
        }
    });
});
