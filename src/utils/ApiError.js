/**
 * Error controlado de la API.
 *
 * Permite lanzar errores con codigo HTTP, codigo interno y detalles
 * adicionales, de forma que el manejador central de errores sepa
 * exactamente que respuesta devolver.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode Codigo HTTP.
   * @param {string} message Mensaje legible para el cliente.
   * @param {{ code?: string | null, details?: unknown }} [opciones]
   */
  constructor(statusCode, message, { code = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.esOperacional = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = ApiError;
