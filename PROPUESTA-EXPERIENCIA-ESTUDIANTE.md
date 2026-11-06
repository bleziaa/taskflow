# Propuesta de experiencia estudiantil — TaskFlow

Fecha: 5 de noviembre de 2026  
Estado: propuesta de diseño y arquitectura de interfaz; **no implementada**.

## 1. Objetivo

Convertir TaskFlow en un espacio de trabajo académico para estudiantes: que cada persona pueda entender rápidamente qué debe hacer, cuándo debe hacerlo, cómo avanza su práctica y qué retroalimentación ha recibido. La interfaz debe priorizar claridad, seguimiento y acciones concretas, no parecer un tablero genérico de tareas.

La experiencia debe funcionar en móvil y escritorio, conservar accesibilidad y reutilizar los módulos actuales sin inventar datos ni simular sincronización.

## 2. Hallazgos de la inspección actual

- `public/dashboard.html` es un tablero de demostración: tareas y miembros se guardan en `localStorage`. El propio HTML lo advierte. No debe convertirse en el panel académico real ni presentarse como si sus métricas provinieran del backend.
- Ya existen páginas separadas para Prácticas, Actividades, Evaluaciones e Informes, con scripts propios. Estas páginas son la base funcional que conviene conservar y mejorar.
- El panel de Prácticas contempla estudiantes, empresas, tutores, fechas, estado y objetivo.
- Actividades contempla práctica relacionada, fecha límite, prioridad, estado e instrucciones; además muestra un espacio para evidencias.
- Evaluaciones contempla calificación, concepto, fortalezas, aspectos por mejorar y observaciones.
- Informes ya contempla resumen, filtro por práctica y exportación CSV / impresión a PDF.
- La hoja `styles.css` define el azul `#3da9fc`, pero `theme.css` redefine las variables principales con morado `#6841b8`. La cascada actual puede hacer que el sitio no respete la identidad azul acordada. Hay que resolverlo en una fase visual controlada, sin cambiar el resto de la identidad por sorpresa.
- El panel actual mezcla navegación general, una barra lateral de demo y contenidos de gestión de equipo. La arquitectura de navegación no está todavía organizada alrededor del recorrido del estudiante.

## 3. Referencias de producto revisadas

- **ImBlaze**: experiencia centrada en oportunidades, hitos, registro de actividad y reflexión del estudiante. Referencia: https://www.imblaze.org/ y https://www.imblaze.org/post/imblaze-2-0-is-here
- **SONIA Student Placement Administration**: administración de prácticas, asignaciones, supervisores y evaluaciones desde una plataforma institucional. Referencia: https://www.otago.ac.nz/digital-services/services/software/sonia-student-placement-administration
- **WIL Portal (Tshwane University of Technology)**: entrega de informes y documentos, autoevaluación, comentarios y avisos de fechas límite. Referencia: https://wil.tut.ac.za/
- **CareerHive WIL**: enfoque mobile-first para solicitudes, documentos, horas, bitácora, evaluación y feedback. Referencia: https://careerhive.com.au/wil

La propuesta toma patrones funcionales de estas plataformas, no copia sus marcas ni sus pantallas.

## 4. Arquitectura de información propuesta

### Navegación principal del estudiante

1. **Inicio** — resumen personalizado y acciones prioritarias.
2. **Mis asignaturas** — cursos, docentes, progreso y actividades por asignatura (cuando el módulo académico esté conectado).
3. **Mi práctica** — empresa, tutor, periodo, objetivo, estado y datos de seguimiento.
4. **Actividades** — lista de entregas, instrucciones, prioridad, fecha y estado.
5. **Evidencias** — archivos entregados, fecha, actividad asociada y observaciones.
6. **Evaluaciones** — calificaciones, conceptos y retroalimentación.
7. **Calendario** — próximas entregas y eventos provenientes de datos reales.
8. **Mi progreso** — resumen de hitos y evolución, solo con indicadores respaldados por el backend.

Las opciones administrativas y de tutoría deben aparecer según permisos, sin mezclar herramientas de administración con el espacio personal del estudiante.

## 5. Diseño propuesto para Inicio

### Encabezado
- Saludo con nombre del usuario autenticado.
- Contexto de organización / periodo académico cuando esté disponible.
- Acceso a notificaciones y perfil.
- Selector de organización solo si el backend confirma que la cuenta pertenece a más de una organización y el flujo de contexto institucional está implementado.

### Bloque principal
- Título: “Tu avance académico”.
- Una frase breve que explique el estado actual, sin mensajes genéricos de productividad.
- Tarjeta de práctica actual con empresa, tutor, fechas y estado; ocultar campos que no existan.
- Indicadores pequeños: actividades pendientes, entregas en revisión y evaluaciones registradas. No calcular porcentajes con datos parciales.

### Próximas acciones
- Lista priorizada de actividades por fecha límite.
- Estado visible: Pendiente, En revisión, Completada o Vencida, según reglas del backend.
- Acceso directo a instrucciones y entrega de evidencia, si la función está habilitada.

### Seguimiento
- Hitos o progreso de práctica cuando existan datos suficientes.
- Última retroalimentación del tutor.
- Calendario compacto de próximas fechas.

### Estados vacíos
Cada módulo debe explicar qué falta y quién puede habilitarlo. No mostrar ceros como si fueran resultados definitivos cuando todavía no hay datos o permisos.

## 6. Dirección visual

- **Color principal:** conservar el azul actual de TaskFlow (`#3da9fc`) y sus tonos oscuros/tenues. No sustituirlo por morado.
- **Superficies:** fondo gris azulado muy claro, tarjetas blancas, bordes discretos y sombras suaves.
- **Jerarquía:** títulos claros, texto secundario legible, cifras solo cuando tengan significado.
- **Navegación:** barra lateral en escritorio; menú compacto y accesible en móvil.
- **Tarjetas:** radios moderados, espaciado consistente y acciones visibles.
- **Estados:** usar etiquetas de estado coherentes en todos los módulos; el color nunca será la única forma de distinguirlos.
- **Tipografía:** mantener Poppins por ahora para evitar una sustitución innecesaria.
- **Accesibilidad:** foco visible, contraste suficiente, etiquetas de formularios, mensajes de estado accesibles y respeto a movimiento reducido.

## 7. Qué se conserva y qué no se debe simular

Se conservan las páginas y flujos actuales de Prácticas, Actividades, Evaluaciones e Informes, sus formularios, permisos, filtros, exportaciones y llamadas API existentes.

No se deben presentar como funcionalidades reales:
- tareas y miembros del demo guardados en `localStorage`;
- asignaturas, matrículas, calendarios o progreso que todavía no tengan una API conectada;
- evidencias que no se hayan almacenado realmente;
- porcentajes o métricas calculados con datos incompletos.

El dashboard de demostración debe quedar identificado como demo o fuera de la navegación estudiantil final hasta que exista un inicio académico conectado al backend.

## 8. Plan de trabajo por fases

### Fase A — Base visual y navegación
- Confirmar el mapa de pantallas y roles.
- Resolver la contradicción de variables de color entre `styles.css` y `theme.css`.
- Definir un shell compartido (encabezado, navegación, contenido, perfil).
- Validar escritorio y móvil antes de cambiar módulos.

### Fase B — Inicio del estudiante
- Diseñar el nuevo inicio usando exclusivamente endpoints y datos existentes.
- Reutilizar las consultas de prácticas, actividades, evaluaciones e informes que ya estén disponibles.
- No añadir datos de muestra al entorno real.

### Fase C — Módulos
- Homogeneizar Prácticas, Actividades, Evaluaciones e Informes.
- Diseñar la experiencia de Evidencias a partir del flujo real de carga y consulta.
- Añadir calendario solo después de definir las fuentes y reglas de fechas.

### Fase D — Módulos académicos
- Conectar asignaturas, docentes y matrículas cuando estén listos sus repositorios, APIs y permisos.
- Implementar progreso por asignatura después de acordar qué significa “progreso” y qué datos lo alimentan.

### Fase E — Validación
- Probar roles estudiante, tutor y administrador.
- Verificar que un estudiante solo vea sus registros autorizados.
- Probar estados vacíos, errores de red, pantallas pequeñas, teclado y lectores de pantalla.
- Ejecutar la suite de pruebas y una revisión manual de los flujos principales.

## 9. Criterios de aceptación

- El inicio del estudiante muestra únicamente información real y autorizada.
- La identidad azul de TaskFlow se mantiene en todos los módulos.
- Las funciones actuales siguen operativas y no se pierde ningún formulario ni enlace.
- La navegación cambia según rol y no expone acciones administrativas al estudiante.
- En móvil no hay desbordamiento horizontal ni acciones inaccesibles.
- Ningún módulo académico pendiente se presenta como terminado.
- No se ejecutan migraciones ni cambios de base de datos como parte de un ajuste visual.

## 10. Decisiones pendientes antes de implementar

1. Confirmar si “Mis asignaturas” debe aparecer desde la primera versión del panel o solo cuando el módulo de cursos esté conectado.
2. Confirmar el contenido exacto del Inicio: propuesta recomendada, práctica actual + próximas actividades + retroalimentación + calendario compacto.
3. Aprobar el shell de navegación (lateral en escritorio y menú móvil) antes de aplicarlo a todas las páginas.

---
**Regla de implementación:** primero preparar y revisar la interfaz; después integrar cada bloque con sus datos reales; por último probar. No modificar la base de datos ni eliminar funciones existentes.
