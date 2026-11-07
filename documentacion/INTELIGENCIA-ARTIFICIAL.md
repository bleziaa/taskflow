# Asistente de IA de TaskFlow

El asistente es un módulo independiente: no es una cuenta de usuario ni sustituye a Agnes, quien conserva su rol institucional de docente. Los permisos se derivan de la membresía activa de la organización.

## Configuración

1. Obtén una clave de Gemini desde Google AI Studio.
2. Añade `GEMINI_API_KEY=...` al `.env` local del servidor.
3. Opcionalmente define `GEMINI_MODEL=gemini-2.5-flash`.
4. Reinicia TaskFlow y abre `Mis cursos`.

La clave no debe enviarse al navegador, subirse al repositorio ni compartirse en capturas. No se incluye una clave por defecto.

## Seguridad y límites

- Solo usuarios autenticados con membresía activa y rol `tutor` o `estudiante` pueden consultar el asistente.
- Las solicitudes POST requieren token CSRF.
- El mensaje está limitado a 6000 caracteres y la consulta usa timeout de 30 segundos.
- La IA no crea actividades, no modifica registros, no entrega trabajos y no asigna calificaciones oficiales.
- No se guarda el texto de las conversaciones. MongoDB recibe únicamente metadatos técnicos de uso (organización, usuario, rol, modelo, estado y latencia).
- La clave de Gemini se mantiene exclusivamente en el entorno del servidor.

## Persistencia

MongoDB conserva el perfil del asistente y sus plantillas. MariaDB conserva los cursos, matrículas, actividades y recursos. La integración no cambia el rol de Agnes ni la fuente de verdad de los datos académicos.
