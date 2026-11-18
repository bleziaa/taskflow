const ApiError = require('./ApiError');
const fail = (message) => { throw new ApiError(400, message, { code: 'INVALID_PRACTICE_HOURS' }); };
function minuteOfDay(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('Indica horas válidas con formato HH:MM.');
  const [h, m] = value.split(':').map(Number); return h * 60 + m;
}
function duration({ entrada, salida, descansoMinutos = 0 }) {
  const start = minuteOfDay(entrada), end = minuteOfDay(salida);
  if (!Number.isInteger(descansoMinutos) || descansoMinutos < 0 || end <= start || descansoMinutos >= end - start) fail('La salida debe ser posterior a la entrada y el descanso menor que la jornada. Divide los turnos nocturnos por fecha.');
  return end - start - descansoMinutos;
}
function schedule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('El horario no es válido.');
  const dias = value.dias || [];
  if (!Array.isArray(dias) || dias.some(d => !Number.isInteger(d) || d < 1 || d > 7) || new Set(dias).size !== dias.length) fail('Selecciona días de asistencia válidos sin repetir.');
  const entrada = value.entrada || '', salida = value.salida || '', descansoMinutos = value.descansoMinutos ?? 0;
  if (!dias.length && !entrada && !salida && descansoMinutos === 0) return { dias: [], entrada: '', salida: '', descansoMinutos: 0 };
  if (!dias.length) fail('Selecciona al menos un día de asistencia.');
  duration({ entrada, salida, descansoMinutos });
  return { dias: [...dias].sort((a,b) => a-b), entrada, salida, descansoMinutos };
}
function requiredHours(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10000) fail('Las horas requeridas deben ser un número entero entre 0 y 10000.');
  return value;
}
function todayBogota() { return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function attendanceDate(value, practice) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Selecciona una fecha de asistencia válida.');
  const parsed = new Date(value + 'T12:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) fail('La fecha de asistencia no existe.');
  if (value < practice.fechaInicio.toISOString().slice(0,10) || value > practice.fechaFin.toISOString().slice(0,10)) fail('La jornada debe estar dentro del periodo de la práctica.');
  if (value > todayBogota()) fail('No puedes reportar horas de una fecha futura.');
  return value;
}
module.exports = { duration, schedule, requiredHours, attendanceDate, todayBogota };
