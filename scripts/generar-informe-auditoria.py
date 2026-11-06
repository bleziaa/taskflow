from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "escrito" / "INFORME_AUDITORIA_TECNICA_TASKFLOW_INGSOFT_4_9.docx"
doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(0.72)
sec.bottom_margin = Inches(0.72)
sec.left_margin = Inches(0.78)
sec.right_margin = Inches(0.78)

styles = doc.styles
styles["Normal"].font.name = "Aptos"
styles["Normal"].font.size = Pt(9.5)
styles["Normal"].font.color.rgb = RGBColor(45, 55, 65)
for stylename, size, color in [("Title", 25, "123B5D"), ("Heading 1", 16, "123B5D"), ("Heading 2", 12, "167D9A"), ("Heading 3", 10, "167D9A")]:
    st = styles[stylename]
    st.font.name = "Aptos Display"
    st.font.size = Pt(size)
    st.font.bold = True
    st.font.color.rgb = RGBColor.from_string(color)

header = sec.header.paragraphs[0]
header.text = "TASKFLOW  |  INGSOFT 4_9  |  AUDITORÍA TÉCNICA"
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
header.runs[0].font.size = Pt(8)
header.runs[0].font.color.rgb = RGBColor(100, 115, 125)
footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = footer.add_run("Informe de auditoría interna  •  5 de noviembre de 2026  •  Página ")
r.font.size = Pt(8)
fld = OxmlElement("w:fldSimple")
fld.set(qn("w:instr"), "PAGE")
footer._p.append(fld)

def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)

def set_cell(cell, text, bold=False, color=None, size=8.3):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(str(text))
    run.bold = bold
    run.font.name = "Aptos"
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

def table(headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.style = "Table Grid"
    for i, h in enumerate(headers):
        set_cell(t.rows[0].cells[i], h, True, "FFFFFF", 8.2)
        shade(t.rows[0].cells[i], "123B5D")
    for row in rows:
        cells = t.add_row().cells
        for i, value in enumerate(row):
            set_cell(cells[i], value, False, None, 8.0)
    if widths:
        for row in t.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return t

def para(text="", boldlead=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    if boldlead and text.startswith(boldlead):
        p.add_run(boldlead).bold = True
        p.add_run(text[len(boldlead):])
    else:
        p.add_run(text)
    return p

def bullet(text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(2)
    p.add_run(text)
    return p

def numbered(text):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.space_after = Pt(2)
    p.add_run(text)

# Portada
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(48)
r = p.add_run("INFORME DE AUDITORÍA\nTÉCNICA Y PRUEBAS")
r.bold = True
r.font.name = "Aptos Display"
r.font.size = Pt(25)
r.font.color.rgb = RGBColor(18, 59, 93)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("TASKFLOW — INGSOFT 4_9")
r.bold = True
r.font.size = Pt(17)
r.font.color.rgb = RGBColor(22, 125, 154)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(8)
r = p.add_run("Sistema web para control y seguimiento de prácticas empresariales")
r.italic = True
r.font.size = Pt(12)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(30)
p.add_run("Fecha de revisión: 5 de noviembre de 2026\n").bold = True
p.add_run("Tipo de revisión: Auditoría técnica interna\n")
p.add_run("Alcance: código, persistencia, módulos funcionales y pruebas automatizadas")
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(75)
r = p.add_run("Documento complementario de soporte para la entrega académica")
r.font.size = Pt(9)
r.font.color.rgb = RGBColor(100, 115, 125)
doc.add_page_break()

doc.add_heading("1. Objetivo", level=1)
para("Evaluar el estado técnico y funcional de TaskFlow frente al alcance solicitado en INGSOFT 4_9, verificar la conexión y el uso real de las bases de datos, revisar el flujo de evidencias y consolidar los resultados de pruebas para respaldar la entrega académica.")

doc.add_heading("2. Alcance y metodología", level=1)
for x in [
    "Inspección de controladores, modelos, rutas, middleware, repositorios y pantallas del proyecto.",
    "Comprobación de los servicios locales de MongoDB y MariaDB y de sus conexiones desde la aplicación.",
    "Consulta de tablas, colecciones y recuentos de registros, sin modificar ni eliminar información de negocio.",
    "Revisión de la carga, almacenamiento, consulta, descarga y revisión de evidencias.",
    "Ejecución de la suite automatizada completa, verificaciones de sintaxis y comprobaciones HTTP.",
    "Actualización de la bitácora técnica del proyecto."
]:
    bullet(x)
para("Límite metodológico: esta revisión es una auditoría técnica interna. Las pruebas HTTP y automatizadas no sustituyen una prueba visual completa en navegador con cuentas reales de administrador, tutor y estudiante.")

doc.add_heading("3. Resultado ejecutivo", level=1)
para("TaskFlow dispone de los módulos principales solicitados para el seguimiento de prácticas empresariales. La suite automatizada ejecutada el 5 de noviembre de 2026 finalizó con 63 pruebas aprobadas y 0 fallidas.")
para("Se identificó una decisión arquitectónica pendiente: MongoDB es la persistencia efectivamente utilizada por los controladores operativos; MariaDB está conectada y cuenta con migraciones y repositorios preparados, pero los repositorios académicos de estudiantes y empresas no están conectados a los controladores de la aplicación. No se recomienda realizar una migración apresurada antes de la entrega.")

doc.add_heading("4. Auditoría de bases de datos", level=1)
doc.add_heading("4.1 MongoDB", level=2)
for x in [
    "Servicio local activo y conexión de TaskFlow verificada.",
    "Base configurada: taskflow.",
    "Los modelos Mongoose y controladores actuales utilizan MongoDB para usuarios, organizaciones, membresías, estudiantes, empresas, prácticas, actividades, evidencias, evaluaciones, informes y configuración de marca.",
    "Recuento observado durante la auditoría: 4 usuarios, 3 organizaciones, 4 membresías y 4 configuraciones de marca. Las colecciones de empresas, estudiantes, prácticas, actividades, evidencias y evaluaciones no tenían documentos en ese momento."
]:
    bullet(x)
para("Conclusión: MongoDB es actualmente la fuente efectiva de persistencia para los módulos de negocio activos.")
doc.add_heading("4.2 MariaDB", level=2)
for x in [
    "Servicio local activo y conexión de TaskFlow verificada.",
    "Base configurada: taskflow_relational.",
    "Migraciones registradas: 001_academic_core.sql, 002_tenant_integrity.sql y 003_course_workspaces.sql.",
    "Se encontraron tablas académicas para estudiantes, empresas, prácticas, actividades, evidencias, evaluaciones, cursos, recursos y relaciones de espacios académicos.",
    "Las tablas academic_* no contenían registros al momento de la consulta.",
    "Los repositorios academic-student.repository.js y academic-company.repository.js existen y cuentan con verificaciones aisladas, pero no se encontraron referencias desde controladores o rutas operativas que los invoquen."
]:
    bullet(x)
para("Conclusión: MariaDB está conectada y preparada a nivel de esquema, pero su integración funcional con los flujos actuales está incompleta. Las pruebas aisladas de repositorios no significan que la interfaz esté guardando allí.")
doc.add_heading("4.3 PostgreSQL y decisión recomendada", level=2)
para("No se encontró un servicio activo ni dependencias de PostgreSQL en la aplicación. No forma parte de la arquitectura actual y no se recomienda añadirlo para esta entrega.")
para("Se recomienda mantener MongoDB como fuente operativa durante la entrega y conservar MariaDB como integración preparada, sin escrituras dobles. Una futura migración debe definir una fuente única por entidad, reglas de conversión, respaldo, validación y plan de reversión.")

doc.add_heading("5. Auditoría de requisitos funcionales", level=1)
table(["Requisito", "Estado", "Resultado / observación"], [
    ["Registrar estudiantes", "Implementado", "Controladores y modelos operativos en MongoDB; pruebas CRUD y aislamiento institucional."],
    ["Registrar empresas", "Implementado", "Controladores y modelos operativos en MongoDB; pruebas CRUD y aislamiento institucional."],
    ["Asignar tutores", "Implementado", "Validación de tutor activo y pertenencia a la organización; relaciones con prácticas."],
    ["Registrar actividades", "Implementado", "Actividades asociadas a prácticas y módulos académicos; validación de pertenencia del módulo."],
    ["Subir evidencias", "Implementado y probado por API", "Carga PDF, DOCX y ZIP, almacenamiento privado, metadatos y validación de firma básica."],
    ["Registrar evaluaciones", "Implementado", "Evaluación de prácticas por tutor y cálculo ponderado por módulos. No se incorporan exámenes o cuestionarios estudiantiles."],
    ["Controlar fechas", "Implementado en código", "Campos y validaciones en prácticas y actividades; requiere recorrido visual completo con cuentas reales."],
    ["Generar informes", "Implementado", "Resumen de prácticas, actividades, evidencias y evaluaciones; interfaz incluye exportación CSV."]
], [1.35, 1.25, 4.6])

doc.add_heading("6. Auditoría del módulo de evidencias", level=1)
doc.add_heading("6.1 Flujo revisado", level=2)
for x in [
    "El estudiante autenticado selecciona una actividad propia.",
    "El servidor recibe el archivo y verifica que exista.",
    "El middleware limita el tamaño a 10 MB y acepta extensiones y tipos MIME PDF, DOCX y ZIP.",
    "El archivo se almacena en un directorio privado con nombre aleatorio.",
    "El controlador comprueba la firma básica del contenido antes de crear el registro.",
    "Se registra en MongoDB la actividad, estudiante, nombre original, nombre almacenado, MIME, tamaño y estado.",
    "La actividad cambia a estado en_revision.",
    "El tutor o administrador autorizado puede descargar y revisar la evidencia.",
    "La revisión permite aprobar o solicitar correcciones; el estado de la actividad se actualiza en consecuencia."
]:
    numbered(x)
doc.add_heading("6.2 Controles observados", level=2)
for x in [
    "Autenticación y protección CSRF en operaciones de escritura.",
    "Solo estudiantes pueden subir evidencias y solo en actividades de su propia práctica.",
    "El tutor solo puede revisar evidencias de prácticas que tiene asignadas.",
    "Se comprueba el aislamiento por organización.",
    "Se impide la carga o revisión cuando la práctica está finalizada o suspendida.",
    "Se comprueba que la ruta final del archivo permanezca dentro del directorio de almacenamiento.",
    "Si falla el registro de la evidencia, el controlador intenta eliminar el archivo temporal y el registro parcial."
]:
    bullet(x)
doc.add_heading("6.3 Resultado y limitaciones", level=2)
para("La suite automatizada incluye una prueba de integración que realiza una entrega PDF, revisión y descarga, y comprueba que una evidencia de otra organización no pueda descargarse desde el contexto institucional activo. La prueba pasó.")
para("Limitación: la comprobación automatizada utiliza solicitudes HTTP y datos de prueba. No se declara realizada una prueba manual visual con cuentas reales en el navegador. Se recomienda fortalecer la inspección estructural de DOCX/ZIP y las políticas de análisis antimalware para producción.")

doc.add_heading("7. Pruebas y verificaciones ejecutadas", level=1)
table(["Verificación", "Resultado"], [
    ["Suite completa npm test", "63 aprobadas, 0 fallidas"],
    ["Integración de evidencias entre organizaciones", "Aprobada"],
    ["Pruebas de actividades, prácticas, evaluaciones e informes", "Incluidas en suite aprobada"],
    ["Pruebas de autenticación, roles y organizaciones", "Incluidas en suite aprobada"],
    ["Estructura académica y nota ponderada", "Incluida en suite aprobada"],
    ["Sintaxis de controladores, middleware, rutas y JS de actividades/informes", "5 de 5 correctas"],
    ["/api/health", "HTTP 200"],
    ["activities.html, practices.html, evaluations.html", "HTTP 200"],
    ["reports.html, teacher-academic.html", "HTTP 200"]
], [3.0, 4.2])
para("La respuesta de salud reportó estado general ok, MongoDB connected y MySQL/MariaDB connected.")

doc.add_heading("8. Hallazgos, riesgos y acciones pendientes", level=1)
table(["Hallazgo", "Prioridad", "Acción recomendada"], [
    ["MariaDB no está conectada a los controladores académicos operativos.", "Media", "Definir plan de integración/migración posterior; no duplicar escrituras."],
    ["No se realizó recorrido manual visual con cuentas reales.", "Alta para cierre de calidad", "Probar administrador, tutor y estudiante en navegador antes de la demostración final."],
    ["No hay registros académicos en las tablas MariaDB al momento de la auditoría.", "Informativa", "No interpretar el esquema vacío como error de conexión; poblarlo solo al aprobar la migración."],
    ["Validación de firma de DOCX/ZIP es básica.", "Media para producción", "Añadir inspección estructural y análisis antimalware antes de desplegar."],
    ["Almacenamiento de evidencias local.", "Media para despliegue", "Configurar almacenamiento persistente, copias de seguridad y permisos adecuados."]
], [2.25, 1.2, 3.75])

doc.add_heading("9. Conclusión", level=1)
para("La revisión confirma que TaskFlow cuenta con implementación para los ocho componentes funcionales del enunciado de INGSOFT 4_9 y que la suite automatizada finalizó satisfactoriamente con 63 pruebas aprobadas y ninguna fallida.")
para("MongoDB es la base de datos utilizada por los módulos operativos. MariaDB mantiene una estructura académica migrada y conectividad activa, pero aún no reemplaza la persistencia MongoDB de los controladores actuales. PostgreSQL no forma parte del proyecto.")
para("El módulo de evidencias cuenta con controles de autenticación, permisos, almacenamiento privado y pruebas automatizadas de carga, revisión, descarga y aislamiento institucional. La principal actividad de cierre pendiente es la validación manual visual de los recorridos completos con cuentas reales, además de las mejoras recomendadas para un despliegue productivo.")
para("Este informe describe los resultados efectivamente observados y diferencia las pruebas automatizadas de las verificaciones manuales pendientes.")

doc.add_heading("10. Archivos y registros de respaldo", level=1)
for x in [
    "Código fuente del proyecto TaskFlow.",
    "Suite automatizada ubicada en tests/.",
    "Migraciones SQL en database/mysql/migrations/.",
    "Verificadores de MariaDB en scripts/verify-mysql-schema.js, scripts/verify-academic-repositories.js y scripts/verify-course-workspaces.js.",
    "Bitácora técnica: BITACORA-TASKFLOW.md.",
    "Protocolo académico: escrito/INGSOFT_4_9_TCC_CON_EVIDENCIAS.docx."
]:
    bullet(x)

doc.save(OUT)
print(f"Documento generado: {OUT}")
print(f"Parrafos: {len(doc.paragraphs)} | Tablas: {len(doc.tables)}")
