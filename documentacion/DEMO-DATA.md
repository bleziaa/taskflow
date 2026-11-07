# Datos de demostración de TaskFlow

Conjunto ficticio para demostraciones controladas. No representa estudiantes, empresas, prácticas ni calificaciones reales.

## Cuentas

Las cuentas demo usan una contraseña definida localmente mediante la variable `DEMO_TASKFLOW_PASSWORD` (mínimo 12 caracteres). No se almacena ninguna contraseña predeterminada en el repositorio.

| Perfil | Correo |
|---|---|
| Administrador | `admin@demo.taskflow.test` |
| Tutor 1 | `laura.mendez@demo.taskflow.test` |
| Tutor 2 | `andres.castillo@demo.taskflow.test` |
| Estudiante 1 | `ana@demo.taskflow.test` |
| Estudiante 2 | `mateo@demo.taskflow.test` |
| Estudiante 3 | `valeria@demo.taskflow.test` |
| Estudiante 4 | `santiago@demo.taskflow.test` |
| Estudiante 5 | `camila@demo.taskflow.test` |
| Estudiante 6 | `daniel@demo.taskflow.test` |

## Contenido verificado en MongoDB local

- 1 organización y 9 membresías demo creadas.
- 3 empresas, 6 estudiantes y 6 prácticas.
- 24 actividades, 12 archivos PDF ficticios de evidencia y 5 evaluaciones.
- Prácticas con módulos ponderados y actividades con estados variados.

## Ejecución

- Local: `DEMO_TASKFLOW_PASSWORD='una-clave-local-segura' node scripts/seed-taskflow-completo.js --target=offline`
- Atlas: `DEMO_TASKFLOW_PASSWORD='una-clave-local-segura' node scripts/seed-taskflow-completo.js --target=online`

Para las cuentas demo de Base de Datos II, definir `DEMO_STUDENT_PASSWORD` antes de ejecutar `node scripts/seed-demo-student-accounts.js`. Para el conjunto de pruebas integrales antiguo, usar `DEMO_TEST_PASSWORD`.

El modo online requiere que Atlas permita la IP del equipo y que `MONGODB_URI` en `.env` sea válida. El archivo `.env.offline` apunta a MongoDB local y está excluido de Git. La carga es repetible y no elimina colecciones; actualiza el espacio de demostración identificado como `TF-DEMO-2026`.

Los archivos de evidencia se guardan en `storage/evidences`. No ejecutar contra producción ni exponer las credenciales demo en un despliegue público. Desactivar las cuentas de prueba antes de publicar.
