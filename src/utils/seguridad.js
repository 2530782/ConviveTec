// Utilidades de seguridad: cifrado de datos sensibles y generación de folios
const crypto = require('crypto');

const ALGORITMO = 'aes-256-gcm';

function obtenerLlave() {
    const llaveHex = process.env.CLAVE_CIFRADO || '';

    if (!/^[0-9a-fA-F]{64}$/.test(llaveHex)) {
        throw new Error('CLAVE_CIFRADO debe tener 64 caracteres hexadecimales (ejecuta: npm run generar-clave)');
    }

    return Buffer.from(llaveHex, 'hex');
}

/**
 * Cifra un texto con AES-256-GCM.
 * Devuelve "iv:etiqueta:texto" en base64 para guardarlo en la base de datos.
 */
function cifrar(texto) {
    if (texto === null || texto === undefined || texto === '') {
        return null;
    }

    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv(ALGORITMO, obtenerLlave(), iv);

    const cifrado = Buffer.concat([
        cifrador.update(String(texto), 'utf8'),
        cifrador.final()
    ]);

    const etiqueta = cifrador.getAuthTag();

    return [
        iv.toString('base64'),
        etiqueta.toString('base64'),
        cifrado.toString('base64')
    ].join(':');
}

/**
 * Descifra un valor generado por cifrar().
 */
function descifrar(valor) {
    if (!valor) {
        return null;
    }

    const [ivB64, etiquetaB64, cifradoB64] = valor.split(':');

    const descifrador = crypto.createDecipheriv(
        ALGORITMO,
        obtenerLlave(),
        Buffer.from(ivB64, 'base64')
    );

    descifrador.setAuthTag(Buffer.from(etiquetaB64, 'base64'));

    const texto = Buffer.concat([
        descifrador.update(Buffer.from(cifradoB64, 'base64')),
        descifrador.final()
    ]);

    return texto.toString('utf8');
}

// Caracteres sin letras confusas (sin 0/O, 1/I/L)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function cadenaAleatoria(longitud) {
    let resultado = '';
    const bytes = crypto.randomBytes(longitud);

    for (let i = 0; i < longitud; i++) {
        resultado += ALFABETO[bytes[i] % ALFABETO.length];
    }

    return resultado;
}

/**
 * Genera un folio legible, por ejemplo: CT-7KQ4-M9XA
 * prefijo "CT" para reportes y "MD" para mediaciones.
 */
function generarFolio(prefijo) {
    return `${prefijo}-${cadenaAleatoria(4)}-${cadenaAleatoria(4)}`;
}

/**
 * Clave secreta de 6 caracteres que se entrega junto con el folio.
 * Solo quien la tenga puede consultar el avance del caso.
 */
function generarClave() {
    return cadenaAleatoria(6);
}

module.exports = {
    cifrar,
    descifrar,
    generarFolio,
    generarClave
};
