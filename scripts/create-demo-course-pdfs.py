from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1] / "storage" / "course-resources"
ROOT.mkdir(parents=True, exist_ok=True)

docs = {
"01_Guia_Inicio_TaskFlow.pdf": {
"title": "Guia de inicio | TaskFlow",
"subtitle": "Orientacion para el espacio academico demostrativo",
"sections": [
("Proposito", "Este documento presenta una ruta breve para organizar el trabajo academico en TaskFlow. El contenido es material de apoyo demostrativo y no reemplaza las instrucciones oficiales del docente ni del aula institucional."),
("Ruta de trabajo", "1. Lee la descripcion de la asignatura y el objetivo de cada actividad. 2. Revisa las instrucciones, los criterios y la fecha limite. 3. Consulta los recursos adjuntos. 4. Prepara tu producto y verifica que corresponda a lo solicitado. 5. Entrega la evidencia en el espacio habilitado cuando la funcion de entregas este disponible."),
("Organizacion recomendada", "Conserva una carpeta por asignatura y subcarpetas para guias, borradores, entregas y retroalimentacion. Usa nombres claros con asignatura, actividad y version. Guarda una copia local de los archivos importantes."),
("Seguimiento", "Una actividad publicada representa una tarea de trabajo. Una calificacion solo debe considerarse oficial cuando el docente la registre y la plataforma confirme su guardado. No interpretes ejemplos o datos demostrativos como resultados academicos reales."),
("Buenas practicas", "Respeta las fechas e indicaciones del docente, cita las fuentes consultadas, protege tus credenciales y evita compartir datos personales en documentos publicos.")
]},
"02_Guia_IA_Responsable.pdf": {
"title": "Guia de uso responsable de inteligencia artificial",
"subtitle": "Apoyo al aprendizaje, pensamiento critico y transparencia",
"sections": [
("Para que usar IA", "Puedes usar herramientas de inteligencia artificial para aclarar conceptos, proponer un plan de estudio, comparar alternativas, revisar la estructura de un texto, generar preguntas de practica o detectar errores en un borrador."),
("Lo que no debe hacer por ti", "La IA no debe sustituir tu comprension, inventar resultados, fabricar citas, suplantar tu autoria ni presentar como realizado un experimento o una actividad que no hiciste. Verifica siempre los datos y las fuentes."),
("Flujo recomendado", "1. Formula una pregunta concreta. 2. Solicita una explicacion paso a paso. 3. Contrasta la respuesta con el material del curso. 4. Prueba el procedimiento por tu cuenta. 5. Corrige y documenta lo que aprendiste. 6. Declara el uso de IA cuando las reglas del docente o la institucion lo exijan."),
("Privacidad", "No pegues contrasenas, documentos de identidad, datos privados de companeros, historias clinicas ni informacion institucional reservada en servicios externos. Anonimiza ejemplos y usa solo los datos necesarios."),
("Verificacion", "Comprueba formulas, codigo, fechas, referencias y afirmaciones importantes. Una respuesta convincente puede ser incorrecta. Si no puedes verificar una afirmacion, indicalo en lugar de presentarla como un hecho."),
("Declaracion sugerida", "Ejemplo: Se utilizo una herramienta de IA como apoyo para organizar ideas y revisar claridad. El analisis, la verificacion de fuentes y la version final fueron revisados por el estudiante.")
]},
"03_Plantilla_Informe_Academico.pdf": {
"title": "Plantilla de informe academico",
"subtitle": "Estructura base editable para actividades y proyectos",
"sections": [
("Portada", "Institucion: ______________________________\nPrograma: _________________________________\nAsignatura: ________________________________\nActividad: __________________________________\nEstudiante: _________________________________\nDocente: ___________________________________\nFecha: _____________________________________"),
("1. Introduccion", "Presenta el contexto del trabajo, el problema o necesidad abordada y la finalidad del documento. Evita adelantar resultados que aun no hayas obtenido."),
("2. Objetivos", "Objetivo general: expresa el resultado principal que se busca.\nObjetivos especificos: enumera acciones concretas, verificables y coherentes con el objetivo general."),
("3. Desarrollo", "Describe el procedimiento, las decisiones tomadas, las herramientas utilizadas y los fundamentos conceptuales. Incluye tablas, diagramas o fragmentos de codigo cuando aporten evidencia."),
("4. Resultados", "Registra unicamente resultados observados o comprobados. Diferencia claramente entre resultados obtenidos, resultados esperados y aspectos pendientes."),
("5. Analisis", "Explica que significan los resultados, que limitaciones aparecieron y como se relacionan con los objetivos y conceptos del curso."),
("6. Conclusiones", "Responde a los objetivos con base en la evidencia. No agregues afirmaciones que no se desprendan del desarrollo."),
("7. Referencias", "Incluye las fuentes consultadas con el formato solicitado por el docente. Verifica autor, titulo, fecha y enlace antes de entregar."),
("Anexos", "Agrega capturas, instrumentos, tablas extensas o evidencias complementarias. Identifica cada anexo y mencionalo en el cuerpo del informe.")
]}
}

def pdf_bytes(title, subtitle, sections):
    lines = [(title, 18, True), (subtitle, 10, False), ("", 10, False)]
    for heading, body in sections:
        lines.append((heading, 12, True))
        for paragraph in body.split("\n"):
            wrapped = textwrap.wrap(paragraph, width=92, break_long_words=False, break_on_hyphens=False) or [""]
            lines.extend((line, 9.5, False) for line in wrapped)
        lines.append(("", 8, False))
    y = 790
    commands = []
    for text, size, bold in lines:
        if y < 48:
            break
        font = "F2" if bold else "F1"
        encoded = text.encode("cp1252", errors="replace").hex().upper()
        commands.append(f"BT /{font} {size} Tf 52 {y} Td <{encoded}> Tj ET")
        y -= 24 if size >= 17 else (18 if bold else 13)
    stream = ("\n".join(commands)).encode("ascii")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R /F2 6 0 R >> >> /Contents 5 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n%TaskFlow demo materials\n")
    offsets = [0]
    for i, obj in enumerate(objs, 1):
        offsets.append(len(out))
        out.extend(f"{i} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(out)
    out.extend(f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode())
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode())
    out.extend(f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(out)

for filename, doc in docs.items():
    # Add a compact metadata object as object 7 referenced by the trailer.
    data = pdf_bytes(doc["title"], doc["subtitle"], doc["sections"])
    # The writer above uses /Info 7 0 R; append a valid metadata object and update xref below.
    # Rebuild the final object table with metadata included.
    data = data.replace(b"/Info 7 0 R", b"/Info 7 0 R")
    # Insert metadata object before xref and rebuild xref offsets safely.
    marker = b"xref\n"
    prefix, tail = data.split(marker, 1)
    prefix += b"7 0 obj\n<< /Title (" + doc["title"].encode("cp1252", "replace") + b") /Author (TaskFlow) /Subject (Material demostrativo) >>\nendobj\n"
    old_xref = int(tail.split(b"startxref\n",1)[1].splitlines()[0])
    # Recreate xref for seven objects.
    offsets = [0]
    for n in range(1,8):
        pos = prefix.find(f"{n} 0 obj".encode())
        offsets.append(pos)
    xref_pos = len(prefix)
    xref = b"xref\n0 8\n0000000000 65535 f \n" + b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets[1:])
    trailer = b"trailer\n<< /Size 8 /Root 1 0 R /Info 7 0 R >>\nstartxref\n" + str(xref_pos).encode() + b"\n%%EOF\n"
    final = prefix + xref + trailer
    (ROOT / filename).write_bytes(final)
    print(filename, len(final), "bytes")
