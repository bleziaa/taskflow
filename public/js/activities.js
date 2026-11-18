(function () {
'use strict';
const $ = (s) => document.querySelector(s);
const state = { user: null, role: null, practices: [], activities: [], selectedModules: [] };
const labels = { pendiente: 'Pendiente', en_revision: 'En revisión', completada: 'Completada' };
const priorities = { baja: 'Prioridad baja', media: 'Prioridad media', alta: 'Prioridad alta' };
const evidenceLabels = { pendiente: 'Pendiente de revisión', aprobada: 'Aprobada', requiere_cambios: 'Requiere correcciones' };
function notify(text, error = false, target = '#activity-message') { const node = $(target); node.textContent = text; node.className = 'form-mensaje mostrar ' + (error ? 'error' : 'exito'); }
async function api(url, options = {}) {
 const headers = { Accept: 'application/json', ...(options.headers || {}) };
 if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
 const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
 const result = await response.json().catch(() => ({}));
 if (!response.ok) { if (response.status === 401) location.replace('/login.html'); throw new Error(result?.error?.message || 'No se pudo completar la solicitud.'); }
 return result.data || {};
}
async function csrf() { return (await api('/api/auth/csrf-token')).csrfToken; }
async function mutate(url, method, data) { return api(url, { method, headers: { 'X-CSRF-Token': await csrf() }, body: JSON.stringify(data || {}) }); }
const el = (tag, text) => { const item = document.createElement(tag); item.textContent = text || ''; return item; };
async function loadPractices() {
 const data = await api('/api/organization/practices'); state.practices = data.practicas || [];
 const select = $('#a-practica'); select.replaceChildren(); select.add(new Option('Selecciona una práctica…', ''));
 state.practices.filter((p) => p.estado === 'planificada' || p.estado === 'en_curso').forEach((p) => select.add(new Option((p.estudiante?.nombre || 'Estudiante') + ' — ' + p.titulo, p._id)));
 select.addEventListener('change', loadModulesForSelectedPractice);
}
async function loadModulesForSelectedPractice() {
 const practiceId = $('#a-practica').value;
 const select = $('#a-modulo'); select.replaceChildren(); state.selectedModules = [];
 if (!practiceId) { select.add(new Option('Primero selecciona una práctica…', '')); select.disabled = true; return; }
 try {
  const data = await api('/api/organization/practices/' + encodeURIComponent(practiceId) + '/academic-structure');
  state.selectedModules = data.modulos || [];
  if (!state.selectedModules.length) {
   select.add(new Option('Esta práctica aún no tiene etapas de evaluación', '')); select.disabled = true;
   $('#module-help').textContent = 'Configura primero sus etapas en Evaluación de prácticas.'; return;
  }
  select.add(new Option('Selecciona la etapa…', ''));
  state.selectedModules.forEach((m) => select.add(new Option(m.nombre + ' · ' + m.ponderacion + '%', m._id)));
  select.disabled = false; $('#module-help').textContent = 'La actividad contará para la calificación de la etapa seleccionada.';
 } catch (error) { select.add(new Option('No se pudieron cargar las etapas', '')); select.disabled = true; notify(error.message, true); }
}
function render() {
 const root = $('#activity-list');
 if (!state.activities.length) { root.replaceChildren(el('p', 'Todavía no hay actividades registradas para tus prácticas.')); return; }
 root.replaceChildren(...state.activities.map((a) => {
  const card = el('article', ''); card.className = 'activity-card'; const head = el('div', ''); head.className = 'activity-card-head';
  head.append(el('h2', a.titulo), el('span', labels[a.estado] || a.estado)); const practice = a.practica || {};
  const meta = el('div', ''); meta.className = 'activity-meta';
  const module = (practice.estructuraAcademica || []).find((item) => String(item._id) === String(a.moduloAcademicoId));
  meta.append(el('span', 'Práctica: ' + (practice.titulo || '—')), el('span', 'Etapa: ' + (module?.nombre || 'Sin etapa')),
   el('span', 'Apertura: ' + (a.fechaInicio ? new Date(a.fechaInicio).toLocaleDateString('es-CO') : 'Inmediata')),
   el('span', 'Entrega: ' + new Date(a.fechaLimite).toLocaleDateString('es-CO')));
  const studentName = practice.estudiante?.nombre ? ' · Estudiante: ' + practice.estudiante.nombre : '';
  const description = el('p', a.descripcion || 'Sin instrucciones adicionales.'); description.className = 'activity-description';
  card.append(head, meta, el('p', 'Tutor: ' + (practice.tutor?.nombre || '—') + studentName), description);
  if (state.role !== 'estudiante' && Array.isArray(a.historialModificaciones) && a.historialModificaciones.length) {
   const history = el('details', ''); history.className = 'activity-history';
   history.append(el('summary', 'Historial de modificaciones (' + a.historialModificaciones.length + ')'));
   a.historialModificaciones.slice().reverse().forEach((entry) => {
    const item = el('section', ''); item.className = 'activity-history-entry';
    const when = entry.modificadoEn ? new Date(entry.modificadoEn).toLocaleString('es-CO') : 'Fecha no disponible';
    item.append(el('strong', when + ' · ' + (entry.modificadoPor?.nombre || 'Docente')),
      el('p', 'Motivo: ' + (entry.motivo || 'Actualización de actividad')));
    (entry.cambios || []).forEach((change) => item.append(el('p',
      (change.campo || 'Campo') + ': ' + (change.valorAnterior || 'Vacío') + ' → ' + (change.valorNuevo || 'Vacío'))));
    history.append(item);
   });
   card.append(history);
  }
  if (a.recurso?.nombreOriginal) { const view = el('a', 'Ver material PDF'); view.href = '/pdf-viewer.html?file=' + encodeURIComponent('/api/organization/activities/' + a._id + '/resource/download'); view.target = '_blank'; view.rel = 'noopener'; card.append(view); const resource = el('a', '📄 Descargar material: ' + a.recurso.nombreOriginal); resource.href = '/api/organization/activities/' + encodeURIComponent(a._id) + '/resource/download'; resource.className = 'activity-resource-download'; resource.setAttribute('download', a.recurso.nombreOriginal); card.append(resource); }
  if (state.role !== 'estudiante') {
   const actions = el('div', ''); actions.className = 'activity-actions';
   const edit = el('button', 'Editar'); edit.type = 'button'; edit.className = 'btn btn-secundario btn-sm'; edit.dataset.action = 'edit'; edit.dataset.id = a._id;
   const del = el('button', 'Eliminar'); del.type = 'button'; del.className = 'btn btn-secundario btn-sm'; del.dataset.action = 'delete'; del.dataset.id = a._id;
   const evidence = el('button', 'Ver evidencias'); evidence.type = 'button'; evidence.className = 'btn btn-secundario btn-sm'; evidence.dataset.action = 'evidences'; evidence.dataset.id = a._id;
   actions.append(edit, del, evidence); card.append(actions);
  } else {
   const latest = a.myEvidence || null;
   if (a.deliveryLoadError) {
    const warning = el('p', 'No pudimos consultar el estado de tu entrega. Actualiza la actividad antes de enviar un archivo.'); warning.className = 'form-mensaje error'; card.append(warning);
    const retry = el('button', 'Actualizar estado de entrega'); retry.type = 'button'; retry.className = 'btn btn-secundario btn-sm'; retry.dataset.action = 'refresh-delivery'; retry.dataset.id = a._id; card.append(retry);
   } else if (latest && latest.estado !== 'requiere_cambios') {
    const statusBox = el('section', ''); statusBox.className = 'evidence-item student-delivery-status';
    const statusText = latest.estado === 'aprobada' ? 'Actividad aprobada' : 'Ya enviada · En espera de revisión';
    const statusHead = el('div', ''); statusHead.className = 'activity-card-head'; statusHead.append(el('strong', statusText), el('span', evidenceLabels[latest.estado] || 'Entregada'));
    statusBox.append(statusHead, el('p', 'Archivo entregado: ' + latest.nombreOriginal));
    if (latest.observacionTutor) statusBox.append(el('p', 'Observaciones de la entrega: ' + latest.observacionTutor));
    if (latest.createdAt) statusBox.append(el('small', 'Enviada el ' + new Date(latest.createdAt).toLocaleString('es-CO')));
    const download = el('a', 'Descargar mi entrega'); download.href = '/api/organization/evidences/' + encodeURIComponent(latest._id) + '/download'; download.className = 'evidence-download'; statusBox.append(download); if (latest.mimeType === 'application/pdf') { const view = el('a', 'Ver mi PDF'); view.href = '/pdf-viewer.html?file=' + encodeURIComponent(new URL(download.href).pathname); view.target = '_blank'; view.rel = 'noopener'; statusBox.append(view); } card.append(statusBox);
   } else {
    if (latest?.estado === 'requiere_cambios') {
     const correction = el('section', ''); correction.className = 'evidence-item'; correction.append(el('strong', 'El docente solicitó correcciones'));
     if (latest.observacionTutor) correction.append(el('p', 'Observaciones: ' + latest.observacionTutor)); card.append(correction);
    }
    const form = el('form', ''); form.className = 'evidence-upload'; form.dataset.activity = a._id;
    const label = el('label', latest ? 'Adjuntar archivo corregido (PDF, DOC o DOCX · máximo 10 MB)' : 'Adjuntar evidencia (PDF, DOC o DOCX · máximo 10 MB)'); label.htmlFor = 'file-' + a._id;
    const input = el('input', ''); input.type = 'file'; input.id = 'file-' + a._id; input.name = 'archivo'; input.accept = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'; input.required = true;
    const submit = el('button', latest ? 'Enviar corrección' : 'Enviar actividad'); submit.type = 'submit'; submit.className = 'btn btn-primario btn-sm'; form.append(label, input, submit); card.append(form);
   }
   const evidence = el('button', 'Ver mis entregas'); evidence.type = 'button'; evidence.className = 'btn btn-secundario btn-sm'; evidence.dataset.action = 'evidences'; evidence.dataset.id = a._id;
   const actions = el('div', ''); actions.className = 'activity-actions'; actions.append(evidence); card.append(actions);
  }
  if (state.role === 'estudiante') {
   const form = el('form', ''); form.className = 'activity-assessment-form'; form.dataset.activityAssessment = a._id; form.dataset.assessmentType = 'self';
   form.append(el('h3', 'Mi autoevaluación'));
   const scoreLabel = el('label', '¿Cómo valoras tu trabajo? (0 a 5)'); const score = el('input'); score.type = 'number'; score.name = 'calificacion'; score.min = '0'; score.max = '5'; score.step = '0.1'; score.required = true; score.value = a.autoevaluacion?.calificacion ?? '';
   const reflectionLabel = el('label', 'Reflexión'); const reflection = el('textarea'); reflection.name = 'reflexion'; reflection.rows = 2; reflection.maxLength = 2000; reflection.placeholder = '¿Qué aprendiste y qué podrías mejorar?'; reflection.value = a.autoevaluacion?.reflexion || '';
   const submit = el('button', a.autoevaluacion?.evaluadoEn ? 'Actualizar autoevaluación' : 'Enviar autoevaluación'); submit.type = 'submit'; submit.className = 'btn btn-secundario btn-sm';
   score.id = 'self-score-' + a._id; scoreLabel.htmlFor = score.id; reflection.id = 'self-reflection-' + a._id; reflectionLabel.htmlFor = reflection.id; form.append(scoreLabel, score, reflectionLabel, reflection, submit); card.append(form);
  }
  const reviews = Array.isArray(a.solicitudesRevisionNota) ? a.solicitudesRevisionNota : [];
  if (reviews.length) {
   const reviewBox = el('section', ''); reviewBox.className = 'grade-review-list';
   reviewBox.append(el('h3', 'Solicitudes de revisión de nota'));
   reviews.slice().reverse().forEach((review) => {
    const item = el('article', ''); item.className = 'grade-review-item';
    item.append(el('strong', (review.solicitadaPor?.nombre || 'Estudiante') + ' · ' + (review.estado || 'pendiente')),
      el('p', 'Nota al solicitar: ' + Number(review.calificacionOriginal).toFixed(1) + ' / 5'),
      el('p', 'Motivo: ' + review.motivo));
    if (review.respuestaTutor) item.append(el('p', 'Respuesta del tutor: ' + review.respuestaTutor));
    if (review.calificacionNueva !== null && review.calificacionNueva !== undefined) item.append(el('p', 'Nota revisada: ' + Number(review.calificacionNueva).toFixed(1) + ' / 5'));
    if (review.respondidaEn) item.append(el('small', 'Respondida: ' + new Date(review.respondidaEn).toLocaleString('es-CO')));
    if (state.role !== 'estudiante' && review.estado === 'pendiente') {
     const responseForm = el('form', ''); responseForm.className = 'grade-review-response'; responseForm.dataset.activity = a._id; responseForm.dataset.review = review._id;
     const decision = el('select', ''); decision.name = 'estado'; decision.add(new Option('Aceptar revisión', 'aceptada')); decision.add(new Option('Rechazar revisión', 'rechazada'));
     const newGradeLabel = el('label', 'Nueva nota (opcional, de 0 a 5)');
     const newGrade = el('input'); newGrade.type = 'number'; newGrade.name = 'calificacionNueva'; newGrade.min = '0'; newGrade.max = '5'; newGrade.step = '0.1'; newGrade.placeholder = 'Dejar vacío para conservar la nota';
     const responseLabel = el('label', 'Respuesta al estudiante');
     const responseText = el('textarea'); responseText.name = 'respuestaTutor'; responseText.required = true; responseText.minLength = 5; responseText.maxLength = 2000; responseText.rows = 2; responseText.placeholder = 'Explica la decisión y, si corresponde, el ajuste realizado…';
     const send = el('button', 'Responder solicitud'); send.type = 'submit'; send.className = 'btn btn-primario btn-sm';
     responseForm.append(decision, newGradeLabel, newGrade, responseLabel, responseText, send); item.append(responseForm);
    }
    reviewBox.append(item);
   });
   card.append(reviewBox);
  }
  if (state.role === 'estudiante' && a.evaluacionTutor?.calificacion !== null && a.evaluacionTutor?.calificacion !== undefined) {
   const result = el('section'); result.className = 'evidence-item'; result.append(el('h3', 'Mi calificación'), el('strong', Number(a.evaluacionTutor.calificacion).toFixed(1) + ' / 5')); if (a.evaluacionTutor.observaciones) result.append(el('p', 'Retroalimentación del docente: ' + a.evaluacionTutor.observaciones)); card.append(result);
   const pendingReview = reviews.some((review) => review.estado === 'pendiente');
   const reviewForm = el('form', ''); reviewForm.className = 'grade-review-request'; reviewForm.dataset.activity = a._id;
   reviewForm.append(el('h3', 'Solicitar revisión de mi nota'));
   reviewForm.append(el('p', 'Calificación oficial: ' + Number(a.evaluacionTutor.calificacion).toFixed(1) + ' / 5'));
   if (pendingReview) reviewForm.append(el('p', 'Tu solicitud está pendiente de respuesta. No puedes enviar otra hasta que sea resuelta.'));
   else {
    const reasonLabel = el('label', '¿Por qué solicitas la revisión?');
    const reason = el('textarea'); reason.name = 'motivo'; reason.required = true; reason.minLength = 10; reason.maxLength = 2000; reason.rows = 3; reason.placeholder = 'Describe qué aspecto de la calificación consideras que debe revisarse…';
    const submit = el('button', 'Enviar solicitud de revisión'); submit.type = 'submit'; submit.className = 'btn btn-secundario btn-sm';
    reviewForm.append(reasonLabel, reason, submit);
   }
   card.append(reviewForm);
  }
  if (state.role === 'tutor' || state.role === 'administrador') {
   const form = el('form', ''); form.className = 'activity-assessment-form'; form.dataset.activityAssessment = a._id; form.dataset.assessmentType = 'tutor';
   form.append(el('h3', 'Calificación oficial del tutor'));
   const scoreLabel = el('label', 'Nota de la actividad (0 a 5)'); const score = el('input'); score.type = 'number'; score.name = 'calificacion'; score.min = '0'; score.max = '5'; score.step = '0.1'; score.required = true; score.value = a.evaluacionTutor?.calificacion ?? '';
   const observationLabel = el('label', 'Observaciones'); const observation = el('textarea'); observation.name = 'observaciones'; observation.rows = 2; observation.maxLength = 2000; observation.placeholder = 'Retroalimentación para el estudiante…'; observation.value = a.evaluacionTutor?.observaciones || '';
   const submit = el('button', a.evaluacionTutor?.evaluadoEn ? 'Actualizar calificación' : 'Guardar calificación'); submit.type = 'submit'; submit.className = 'btn btn-primario btn-sm';
   score.id = 'teacher-score-' + a._id; scoreLabel.htmlFor = score.id; observation.id = 'teacher-note-' + a._id; observationLabel.htmlFor = observation.id; form.append(scoreLabel, score, observationLabel, observation, submit); card.append(form);
  }
  const evidenceArea = el('div', ''); evidenceArea.className = 'evidence-list'; evidenceArea.id = 'evidence-' + a._id; card.append(evidenceArea);
  return card;
 }));
}
async function load() {
 const data = await api('/api/organization/activities'); state.activities = data.actividades || [];
 if (state.role === 'estudiante') await Promise.all(state.activities.map(async (activity) => {
  try { const result = await api('/api/organization/evidences/activity/' + encodeURIComponent(activity._id)); const evidences = Array.isArray(result.evidencias) ? result.evidencias : []; activity.myEvidence = evidences[0] || null; activity.deliveryLoadError = false; }
  catch (error) { activity.myEvidence = null; activity.deliveryLoadError = true; }
 }));
 render();
}
function reset() { $('#form-activity').reset(); $('#change-reason-field').hidden = true; $('#form-activity').elements.id.value = ''; $('#a-practica').disabled = false; $('#a-modulo').disabled = false; $('#a-modulo').replaceChildren(new Option('Primero selecciona una práctica…', '')); $('#a-modulo').disabled = true; $('#activity-form-wrap').hidden = true; }
async function showEvidences(activityId) {
 const area = $('#evidence-' + activityId); area.replaceChildren(el('p', 'Cargando entregas…'));
 try {
  const data = await api('/api/organization/evidences/activity/' + encodeURIComponent(activityId));
  if (!data.evidencias?.length) { area.replaceChildren(el('p', 'Todavía no hay evidencias entregadas.')); return; }
  area.replaceChildren(...data.evidencias.map((item) => {
   const box = el('section', ''); box.className = 'evidence-item';
   const header = el('div', ''); header.className = 'activity-card-head'; header.append(el('strong', item.nombreOriginal), el('span', evidenceLabels[item.estado] || item.estado));
   const details = el('p', 'Entregada: ' + new Date(item.createdAt).toLocaleString('es-CO') + ' · ' + (item.estudiante?.nombre || 'Estudiante'));
   const download = el('a', 'Descargar archivo'); download.href = '/api/organization/evidences/' + encodeURIComponent(item._id) + '/download'; download.className = 'evidence-download';
   box.append(header, details, download);
   if (item.mimeType === 'application/pdf') { const view = el('a', 'Ver PDF en navegador'); view.href = '/pdf-viewer.html?file=' + encodeURIComponent(new URL(download.href).pathname); view.target = '_blank'; view.rel = 'noopener'; box.append(view); }
   if (item.observacionTutor) box.append(el('p', 'Observación: ' + item.observacionTutor));
   if (state.role !== 'estudiante') {
    const form = el('form', ''); form.className = 'evidence-review'; form.dataset.evidence = item._id;
    const select = el('select', ''); select.name = 'estado'; select.setAttribute('aria-label', 'Resultado de la revisión'); select.add(new Option('Aprobar evidencia', 'aprobada')); select.add(new Option('Solicitar correcciones', 'requiere_cambios')); select.value = item.estado === 'requiere_cambios' ? 'requiere_cambios' : 'aprobada';
    const note = el('textarea', ''); note.name = 'observacion'; note.setAttribute('aria-label', 'Observaciones para el estudiante'); note.rows = 2; note.maxLength = 2000; note.placeholder = 'Observaciones para el estudiante…'; note.value = item.observacionTutor || '';
    const submit = el('button', 'Guardar revisión'); submit.type = 'submit'; submit.className = 'btn btn-primario btn-sm';
    form.append(select, note, submit); box.append(form);
   }
   return box;
  }));
 } catch (error) { area.replaceChildren(el('p', error.message)); }
}
$('#btn-nueva').addEventListener('click', () => { reset(); $('#form-title').textContent = 'Registrar actividad'; $('#change-reason-field').hidden = true; $('#activity-form-wrap').hidden = false; $('#activity-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
$('#btn-cancelar').addEventListener('click', reset);

$('#form-activity').addEventListener('submit', async (event) => {
 event.preventDefault(); const form = event.currentTarget; const formData = new FormData(form); const id = formData.get('id');
 const file = form.elements.recurso.files[0] || null;
 if (file && (file.size > 10 * 1024 * 1024 || file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))) { notify('Adjunta un PDF válido de máximo 10 MB.', true); return; }
 const data = { titulo: formData.get('titulo'), fechaInicio: formData.get('fechaInicio') || null, fechaLimite: formData.get('fechaLimite'), motivoCambio: formData.get('motivoCambio') || '', prioridad: formData.get('prioridad'), descripcion: formData.get('descripcion'), moduloAcademicoId: formData.get('moduloAcademicoId') || null };
 const practiceId = $('#a-practica').value;
 if (!practiceId) { notify('Selecciona una práctica.', true); return; }
 if (!data.moduloAcademicoId) { notify('Selecciona una etapa de evaluación.', true); return; }
 if (data.fechaInicio && data.fechaInicio > data.fechaLimite) { notify('La fecha de apertura no puede ser posterior a la fecha límite.', true); return; }
 try {
   const created = [];
   if (id) {
     await mutate('/api/organization/activities/' + encodeURIComponent(id), 'PATCH', data);
     created.push(id);
   } else {
     const result = await mutate('/api/organization/activities', 'POST', { ...data, practica: practiceId });
     if (result.actividad?._id) created.push(result.actividad._id);
   }
   if (file) {
     for (const activityId of created) {
       const upload = new FormData(); upload.append('archivo', file);
       await api('/api/organization/activities/' + encodeURIComponent(activityId) + '/resource', { method: 'POST', headers: { 'X-CSRF-Token': await csrf() }, body: upload });
     }
   }
   reset(); await load(); notify(id ? 'Actividad actualizada.' : 'Actividad creada correctamente.' + (file ? ' El PDF quedó adjunto.' : ''));
 } catch (error) { await load().catch(() => {}); notify(error.message, true); }
});
document.addEventListener('submit', async (event) => {
 const uploadForm = event.target.closest('.evidence-upload');
 if (uploadForm) {
  event.preventDefault(); const file = uploadForm.elements.archivo.files[0]; if (!file) return;
  if (file.size > 10 * 1024 * 1024) { notify('El archivo supera el límite de 10 MB.', true, '#evidence-message'); return; }
  const form = new FormData(); form.append('archivo', file);
  try { await api('/api/organization/activities/' + encodeURIComponent(uploadForm.dataset.activity) + '/evidences', { method: 'POST', headers: { 'X-CSRF-Token': await csrf() }, body: form }); uploadForm.reset(); await load(); await showEvidences(uploadForm.dataset.activity); notify('Evidencia enviada correctamente.', false, '#evidence-message'); }
  catch (error) { notify(error.message, true, '#evidence-message'); }
  return;
 }
 const assessmentForm = event.target.closest('.activity-assessment-form');
 if (assessmentForm) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(assessmentForm).entries());
  const type = assessmentForm.dataset.assessmentType;
  const endpoint = type === 'self' ? 'self-assessment' : 'tutor-assessment';
  try {
   await mutate('/api/organization/activities/' + encodeURIComponent(assessmentForm.dataset.activityAssessment) + '/' + endpoint, 'PUT', data);
   await load();
   notify(type === 'self' ? 'Autoevaluación guardada.' : 'Calificación oficial guardada.', false, '#evidence-message');
  } catch (error) { notify(error.message, true, '#evidence-message'); }
  return;
 }
 const gradeReviewRequest = event.target.closest('.grade-review-request');
 if (gradeReviewRequest) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(gradeReviewRequest).entries());
  try { await mutate('/api/organization/activities/' + encodeURIComponent(gradeReviewRequest.dataset.activity) + '/grade-reviews', 'POST', data); await load(); notify('Solicitud de revisión enviada al tutor.', false, '#evidence-message'); }
  catch (error) { notify(error.message, true, '#evidence-message'); }
  return;
 }
 const gradeReviewResponse = event.target.closest('.grade-review-response');
 if (gradeReviewResponse) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(gradeReviewResponse).entries());
  if (!data.calificacionNueva) delete data.calificacionNueva;
  try { await mutate('/api/organization/activities/' + encodeURIComponent(gradeReviewResponse.dataset.activity) + '/grade-reviews/' + encodeURIComponent(gradeReviewResponse.dataset.review), 'PATCH', data); await load(); notify('Respuesta de revisión guardada.', false, '#evidence-message'); }
  catch (error) { notify(error.message, true, '#evidence-message'); }
  return;
 }
 const reviewForm = event.target.closest('.evidence-review');
 if (reviewForm) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(reviewForm).entries());
  try { await mutate('/api/organization/evidences/' + encodeURIComponent(reviewForm.dataset.evidence) + '/review', 'PATCH', data); await load(); const activityId = reviewForm.closest('.activity-card').querySelector('[data-action="evidences"]').dataset.id; await showEvidences(activityId); notify('Revisión guardada.', false, '#evidence-message'); }
  catch (error) { notify(error.message, true, '#evidence-message'); }
 }
});
document.addEventListener('click', async (event) => {
 const button = event.target.closest('button[data-action]'); if (!button) return; const activity = state.activities.find((a) => a._id === button.dataset.id); if (!activity) return;
 try {
  if (button.dataset.action === 'evidences') { await showEvidences(activity._id); return; }
  if (button.dataset.action === 'refresh-delivery') { await load(); notify('Estado de entrega actualizado.', false, '#evidence-message'); return; }
  if (button.dataset.action === 'edit') {
   const form = $('#form-activity'); const values = { id: activity._id, titulo: activity.titulo, fechaInicio: activity.fechaInicio ? String(activity.fechaInicio).slice(0, 10) : '', fechaLimite: String(activity.fechaLimite).slice(0, 10), prioridad: activity.prioridad, descripcion: activity.descripcion };
   Object.entries(values).forEach(([key, value]) => { if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value || ''; });
   $('#a-practica').value = activity.practica?._id || '';
   await loadModulesForSelectedPractice();
   $('#a-modulo').value = activity.moduloAcademicoId || '';
   $('#a-practica').disabled = true; $('#a-modulo').disabled = true;
   $('#form-title').textContent = 'Editar actividad'; $('#change-reason-field').hidden = false; $('#a-practica').disabled = true; $('#a-modulo').disabled = true; $('#activity-form-wrap').hidden = false; $('#activity-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (button.dataset.action === 'delete' && confirm('¿Eliminar esta actividad?')) { await mutate('/api/organization/activities/' + encodeURIComponent(activity._id), 'DELETE'); await load(); notify('Actividad eliminada.'); }
 } catch (error) { notify(error.message, true); }
});
$('#btn-logout').addEventListener('click', async () => { try { await mutate('/api/auth/logout', 'POST', {}); location.replace('/login.html'); } catch (error) { notify(error.message, true); } });
(async function init() {
 try { const session = await api('/api/auth/me'); state.user = session.usuario; $('#activity-user').textContent = state.user.nombre;
  const orgs = await api('/api/auth/organizations'); state.role = orgs.organizacionActiva?.role || null;
  if (!state.role) { notify('Selecciona una organización activa para consultar las actividades.', true); return; }
  if (state.role === 'administrador') $('#admin-link').hidden = false; if (state.role !== 'estudiante') $('#btn-nueva').hidden = false;
  if (state.role === 'estudiante') $('.panel-sub').textContent = 'Consulta las instrucciones, envía tus tareas y revisa tus entregas, observaciones y calificaciones.';
  await loadPractices(); if (state.role === 'estudiante') $('#a-practica').disabled = true; $('#a-modulo').disabled = true; await load();
 } catch (error) { notify(error.message, true); }
})();
})();
