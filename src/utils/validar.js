// Funciones de validación de datos recibidos en los formularios

/**
 * Limpia un texto: lo convierte a cadena, quita espacios y recorta a un máximo.
 */
function texto(valor, maximo) {
    if (valor === undefined || valor === null) {
        return '';
    }

    return String(valor).trim().slice(0, maximo);
}

/**
 * Revisa que un valor esté dentro de una lista de opciones permitidas.
 */
function opcion(valor, permitidas) {
    return permitidas.includes(valor) ? valor : null;
}

/**
 * Valida una fecha con formato AAAA-MM-DD que no sea futura.
 */
function fechaPasada(valor) {
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return null;
    }

    const fecha = new Date(valor + 'T00:00:00');

    if (isNaN(fecha.getTime()) || fecha > new Date()) {
        return null;
    }

    return valor;
}

/**
 * Valida un número entero dentro de un rango.
 */
function entero(valor, minimo, maximo) {
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
        return null;
    }

    return numero;
}

module.exports = {
    texto,
    opcion,
    fechaPasada,
    entero
};
