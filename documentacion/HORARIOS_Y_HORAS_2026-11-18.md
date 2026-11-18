# Horarios, asistencia y correo de bienvenida

Actualización del 18 de noviembre de 2026, sobre el commit 5b90884.

## Uso

1. El administrador o el profesor crea la práctica en **Prácticas → Nueva práctica**, selecciona empresa y estudiante, registra objetivo y fechas y configura días de asistencia, entrada, salida, descanso y horas requeridas.
2. El tutor responsable o un administrador puede modificar **Configurar horario y meta**. El horario habitual se muestra al estudiante en **Mi práctica**. Las prácticas anteriores continúan funcionando sin horario ni meta.
3. En una práctica en curso, el estudiante abre **Ver y registrar horas**, selecciona la fecha e indica entrada, salida, descanso y lo realizado. El servidor calcula los minutos; no acepta un total impuesto por el navegador.
4. El tutor responsable o un administrador abre **Ver y revisar horas** y aprueba o solicita correcciones. Solo las horas aprobadas aumentan el progreso. Al rechazar, debe escribir el motivo; el estudiante puede corregir esa jornada y enviarla de nuevo.
5. Se conserva el autor y el historial de las revisiones, incluido el contenido de la jornada revisada. No se permite duplicar una fecha, modificar una jornada aprobada o revisar una versión antigua.

Las fechas de asistencia se interpretan como fechas de calendario y las comprobaciones de «hoy» utilizan America/Bogota. Se rechazan fechas inexistentes, futuras o fuera del periodo de práctica; descansos negativos o superiores a la jornada; y salidas anteriores a la entrada. Los turnos nocturnos se dividen por fecha. Se admite una jornada continua por fecha; varios turnos separados en la misma fecha quedan fuera de este alcance.

El horario es una referencia de planificación: una jornada real puede diferir del horario habitual y necesita revisión. El sistema no certifica automáticamente asistencia física ni valida políticas académicas de una institución. Los totales incluyen todo el historial; se presentan las últimas 100 jornadas. No se elimina una práctica con jornadas ni se cambia su estudiante o su periodo para excluir registros existentes.

## Persistencia y permisos

- Nuevos campos opcionales `horario` y `horasRequeridas` en Practice.
- Colección PracticeAttendance con índice único por institución, práctica y fecha, preparado al iniciar el servidor.
- Rutas institucionales para consultar y reportar jornadas, revisarlas y configurar el horario. Protegidas por sesión, organización, rol, asignación del tutor y CSRF en escrituras.
- No se requiere migración SQL para estos datos de prácticas; se conserva el modelo existente en MongoDB.

## Correo de bienvenida

Crear una cuenta desde administración ya enviaba al correo de esa persona su usuario, contraseña temporal y enlace de acceso. Se verificó mediante pruebas que esa contraseña corresponde al hash de la cuenta y que el primer acceso exige cambiarla.

Se corrigió el estado de envío: solo se anuncia `sent` cuando el servidor SMTP acepta al destinatario. Si lo rechaza, se informa del fallo y se conserva la alternativa administrativa existente. El modo de demostración identifica claramente que no se creó una cuenta real.

Se realizó un envío real de demostración a la dirección facilitada expresamente por el usuario. SMTP aceptó el mensaje y el usuario confirmó su llegada a la bandeja de entrada. No se creó una cuenta real y no se publican aquí su dirección ni credenciales.

## Verificación

`npm test`: **109 pruebas aprobadas, 0 fallidas, 0 omitidas**.

Nuevas pruebas: horarios y descansos; acceso de tutor asignado frente a tutor ajeno, estudiante y otra institución; rechazo de fechas inválidas y futuras; bloqueo de duplicados; exclusión de horas pendientes del progreso; aprobación; rechazo con motivo; corrección; conservación del historial; control de versiones de revisión; protección de prácticas cerradas y de registros históricos. Correo: destinatario correcto, contraseña temporal válida, cambio obligatorio, rechazo SMTP y mensaje de demostración.

Pruebas visuales con datos ficticios y MongoDB aislado:

- **Profesora:** creó una práctica con lunes a viernes, 08:00–17:00, 60 minutos de descanso y meta de 160 horas.
- **Estudiante:** vio el horario y reportó una jornada de 8 horas; el progreso aprobado permaneció en cero.
- **Profesora:** aprobó la jornada; el total pasó a 8 horas aprobadas y quedaron 152 horas para la meta.
- **Administradora:** cambió la meta a 120 horas; la jornada y sus 8 horas se conservaron.
- **Estudiante:** comprobó 8 horas aprobadas, 0 pendientes, 112 restantes y el nombre y observación de su revisora.

Las capturas y el resultado completo de pruebas se entregan como archivos locales. Las cuentas y registros visuales son ficticios. Esta verificación no constituye un despliegue remoto ni pruebas en todos los dispositivos. El correo real de demostración sí fue confirmado por su destinatario.
