(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { role: null, courses: [] };
  const message = $('#courses-message');

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.headers || {}) }, ...options
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) location.replace('/login.html');
      throw new Error(result?.error?.message || 'No se pudo completar la solicitud.');
    }
    return result.data || {};
  }
  async function mutate(url, method, data) {
    const token = (await api('/api/auth/csrf-token')).csrfToken;
    return api(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(data || {}) });
  }
  function el(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }
  function note(text, type = '') {
    message.hidden = false;
    message.textContent = text;
    message.className = 'courses-message' + (type ? ' is-' + type : '');
  }
  function formatDate(value) {
    if (!value) return 'Sin fecha límite';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin fecha límite'
      : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
  function formatDateTime(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin fecha'
      : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }
  function gradeOutcome(evidence) {
    if (evidence.score === null || evidence.score === undefined || evidence.maxScore === null || evidence.maxScore === undefined) return null;
    const score = Number(evidence.score);
    const max = Number(evidence.maxScore);
    if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return null;
    const normalized = (score / max) * 5;
    return normalized >= 3 ? { label: 'Aprobada', className: 'is-approved' } : { label: 'Reprobada · Actividad perdida', className: 'is-failed' };
  }
  function dateInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  const fieldLabels = { title: 'Título', description: 'Descripción', instructions: 'Instrucciones', status: 'Visibilidad', dueAt: 'Fecha de entrega', opensAt: 'Fecha de apertura', moduleId: 'Unidad' };
  function renderIndividualDeadline(course, activity, evidence, card) {
    if (state.role !== 'tutor') return;
    const details = el('details', null, 'course-individual-deadline');
    details.append(el('summary', evidence.deadlineCustomized ? 'Modificar fecha individual' : 'Conceder plazo individual'));
    const form = el('form', null, 'course-individual-deadline-form');
    const label = el('label', 'Nueva fecha y hora límite');
    const input = el('input');
    input.type = 'datetime-local';
    input.required = true;
    input.value = dateInput(evidence.dueAt);
    input.setAttribute('aria-label', 'Fecha y hora límite individual');
    label.append(input);
    const save = el('button', 'Guardar fecha', 'btn btn-secundario btn-sm');
    save.type = 'submit';
    form.append(label, save);
    if (evidence.deadlineCustomized) form.append(el('small', 'Esta fecha solo aplica a este estudiante. La fecha general del curso no cambia.'));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!input.value) return;
      save.disabled = true;
      try {
        await mutate('/api/organization/courses/' + course.id + '/activities/' + activity.id + '/students/' + evidence.studentId + '/deadline', 'PATCH', { dueAt: input.value });
        note('Fecha individual actualizada. No se modificó la fecha de los demás estudiantes.', 'success');
        await loadCourses();
      } catch (error) {
        note(error.message, 'error');
        save.disabled = false;
      }
    });
    details.append(form);
    card.append(details);
  }
  function renderActivity(activity, course, module) {
    const item = el('article', null, 'course-activity');
    const top = el('div', null, 'course-activity-top');
    top.append(el('b', activity.title), el('span', activity.status === 'publicada' ? 'Publicada' : activity.status || 'Borrador', 'course-activity-status'));
    item.append(top);
    if (activity.description) item.append(el('p', activity.description));
    if (activity.instructions) item.append(el('p', activity.instructions, 'course-activity-instructions'));
    item.append(el('small', 'Apertura: ' + (activity.opensAt ? formatDateTime(activity.opensAt) : 'Inmediata') + ' · Entrega: ' + formatDateTime(activity.dueAt)));
    if (state.role === 'tutor' && Array.isArray(activity.history) && activity.history.length) {
      const history = el('details', null, 'course-activity-history');
      history.append(el('summary', 'Historial de cambios (' + activity.history.length + ')'));
      activity.history.forEach(entry => {
        const row = el('div', null, 'course-activity-history-entry');
        row.append(el('b', (entry.actorName || 'Docente') + ' · ' + new Date(entry.changedAt).toLocaleString('es-CO')));
        if (entry.reason) row.append(el('p', 'Motivo: ' + entry.reason));
        entry.fields.forEach(field => row.append(el('p', (fieldLabels[field] || field) + ': ' + (entry.before?.[field] ?? 'Vacío') + ' → ' + (entry.after?.[field] ?? 'Vacío'))));
        history.append(row);
      });
      item.append(history);
    }

    const materials = el('div', null, 'course-activity-materials');
    materials.append(el('b', state.role === 'tutor' ? 'Material de apoyo (opcional)' : 'Material de esta actividad'));
    const resourceList = el('div', null, 'course-resource-list');
    const resources = Array.isArray(activity.resources) ? activity.resources : [];
    if (!resources.length && state.role !== 'tutor') resourceList.append(el('p', 'El docente todavía no ha adjuntado material de apoyo.', 'course-empty'));
    resources.forEach(resource => {
      const row = el('div', null, 'course-resource');
      const info = el('div');
      info.append(el('b', resource.title), el('small', (resource.description || resource.fileName || 'Documento PDF') + ' · ' + (Number(resource.sizeBytes || 0) / 1024).toFixed(1) + ' KB'));
      const link = el('a', 'Descargar PDF');
      link.href = resource.downloadUrl;
      link.setAttribute('download', resource.fileName || 'material.pdf');
      row.append(info, link);
      resourceList.append(row);
    });
    materials.append(resourceList);

    if (state.role === 'tutor') {
      const uploadForm = el('form', null, 'course-activity-resource-form');
      const titleInput = el('input'); titleInput.type = 'text'; titleInput.required = true; titleInput.maxLength = 160; titleInput.placeholder = 'Nombre del material';
      const descriptionInput = el('input'); descriptionInput.type = 'text'; descriptionInput.maxLength = 1000; descriptionInput.placeholder = 'Descripción (opcional)';
      const fileInput = el('input'); fileInput.type = 'file'; fileInput.accept = 'application/pdf,.pdf'; fileInput.required = true;
      const uploadButton = el('button', 'Adjuntar PDF', 'btn btn-secundario btn-sm'); uploadButton.type = 'submit';
      uploadForm.append(titleInput, descriptionInput, fileInput, uploadButton);
      uploadForm.addEventListener('submit', async event => {
        event.preventDefault();
        const file = fileInput.files && fileInput.files[0];
        if (!file) { note('Selecciona un PDF para esta actividad.', 'error'); return; }
        if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) { note('El material debe ser un archivo PDF.', 'error'); return; }
        if (file.size > 10 * 1024 * 1024) { note('El PDF no puede superar los 10 MB.', 'error'); return; }
        uploadButton.disabled = true;
        try {
          const token = (await api('/api/auth/csrf-token')).csrfToken;
          const body = new FormData();
          body.append('archivo', file);
          body.append('title', titleInput.value.trim() || file.name.replace(/\.pdf$/i, ''));
          body.append('description', descriptionInput.value.trim());
          const response = await fetch('/api/organization/courses/' + course.id + '/activities/' + activity.id + '/resources', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { Accept: 'application/json', 'X-CSRF-Token': token }, body
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result?.error?.message || 'No se pudo adjuntar el PDF.');
          await loadCourses();
          note('Material adjuntado a la actividad correctamente.', 'success');
        } catch (error) { note(error.message, 'error'); }
        finally { uploadButton.disabled = false; }
      });
      materials.append(uploadForm);
    }
    item.append(materials);

    if (state.role === 'estudiante' && activity.status === 'publicada') {
      const delivery = el('section', null, 'course-evidence-submit');
      delivery.append(el('b', 'Mi entrega'));
      const form = el('form', null, 'course-evidence-form');
      const file = el('input'); file.type = 'file'; file.required = true; file.accept = '.pdf,.docx,.zip,application/pdf,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const button = el('button', 'Enviar actividad', 'btn btn-primario btn-sm'); button.type = 'submit';
      form.append(file, button);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const selected = file.files && file.files[0];
        if (!selected) return;
        if (selected.size > 10 * 1024 * 1024) { note('La evidencia no puede superar los 10 MB.', 'error'); return; }
        const ext = selected.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx', 'zip'].includes(ext)) { note('Adjunta un PDF, DOCX o ZIP.', 'error'); return; }
        button.disabled = true;
        try {
          const token = (await api('/api/auth/csrf-token')).csrfToken;
          const body = new FormData(); body.append('archivo', selected);
          const response = await fetch('/api/organization/courses/' + course.id + '/activities/' + activity.id + '/evidences', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { Accept: 'application/json', 'X-CSRF-Token': token }, body
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result?.error?.message || 'No se pudo entregar la actividad.');
          await loadCourses();
          note(result?.data?.evidence?.late ? 'Entrega recibida; quedó registrada como tardía.' : 'Actividad entregada correctamente.', 'success');
        } catch (error) { note(error.message, 'error'); }
        finally { button.disabled = false; }
      });
      delivery.append(form);
      const statusLine = el('p', 'Puedes enviar una entrega. Si el docente solicita correcciones, podrás volver a subir una versión.', 'course-empty');
      delivery.append(statusLine);
      const myStatus = el('div', null, 'course-my-evidence');
      myStatus.append(el('small', 'Consultando el estado de tu entrega…', 'course-empty'));
      delivery.append(myStatus);
      (async () => {
        try {
          const result = await api('/api/organization/courses/' + course.id + '/activities/' + activity.id + '/evidences');
          myStatus.replaceChildren();
          const evidence = (result.evidences || [])[0];
          if (evidence?.dueAt) myStatus.append(el('small', 'Fecha límite: ' + formatDate(evidence.dueAt) + (evidence.deadlineCustomized ? ' · Plazo individual' : '')));
          if (!evidence || !evidence.id) {
            myStatus.append(el('small', evidence?.status === 'no_entregada' ? 'No registramos una entrega y el plazo ya venció.' : 'Aún no has enviado tu trabajo.', 'course-empty'));
            return;
          }
          const statusText = evidence.status === 'aprobada' ? 'Actividad aprobada' : evidence.status === 'reprobada' ? 'Actividad reprobada · Perdida' : evidence.status === 'requiere_cambios' ? 'Tu entrega está por corregir. Consulta directamente con el docente los ajustes necesarios.' : 'Tu entrega está pendiente de revisión';
          myStatus.append(el('b', statusText), el('small', evidence.originalName + ' · ' + formatDate(evidence.submittedAt) + (evidence.late ? ' · Entrega tardía' : '')));
          if (evidence.score !== null) {
            myStatus.append(el('p', 'Calificación: ' + evidence.score + ' / ' + evidence.maxScore));
            const outcome = gradeOutcome(evidence);
            if (outcome) myStatus.append(el('b', outcome.label, 'course-grade-outcome ' + outcome.className));
          }
          if (evidence.status === 'requiere_cambios') myStatus.append(el('small', 'Puedes volver a enviar una versión corregida.', 'course-empty'));
        } catch (error) { myStatus.replaceChildren(el('small', error.message, 'course-empty')); }
      })();
      item.append(delivery);
    }

    if (state.role === 'tutor') {
      const inbox = el('section', null, 'course-evidence-inbox');
      inbox.append(el('b', 'Entregas de estudiantes'));
      const inboxBody = el('div', null, 'course-evidence-list');
      inboxBody.append(el('p', 'Cargando entregas…', 'course-empty'));
      inbox.append(inboxBody); item.append(inbox);
      (async () => {
        try {
          const result = await api('/api/organization/courses/' + course.id + '/activities/' + activity.id + '/evidences');
          inboxBody.replaceChildren();
          const evidences = result.evidences || [];
          if (!evidences.length) { inboxBody.append(el('p', 'Todavía no hay entregas.', 'course-empty')); return; }
          const counts = evidences.reduce((total, evidence) => {
            total[evidence.status] = (total[evidence.status] || 0) + 1;
            return total;
          }, {});
          const summary = el('p', null, 'course-evidence-summary');
          summary.append(
            el('span', evidences.length + ' estudiantes', ''),
            el('span', (counts.pendiente || 0) + ' por revisar', 'is-pending'),
            el('span', (counts.aprobada || 0) + ' aprobadas', 'is-approved'),
            el('span', (counts.reprobada || 0) + ' reprobadas', 'is-failed'),
            el('span', (counts.requiere_cambios || 0) + ' por corregir', 'is-changes'),
            el('span', (counts.no_entregada || 0) + ' no entregadas', 'is-missing')
          );
          inbox.insertBefore(summary, inboxBody);
          evidences.forEach(evidence => {
            const card = el('article', null, 'course-evidence-card');
            const head = el('div', null, 'course-evidence-head');
            if (!evidence.id) {
              const missing = evidence.status === 'no_entregada';
              head.append(
                el('b', evidence.studentName || 'Estudiante'),
                el('span', missing ? 'No entregó' : 'Pendiente', 'course-activity-status course-evidence-status ' + (missing ? 'is-missing' : 'is-pending'))
              );
              card.append(head, el('small', (evidence.studentCode || '') + ' · Fecha límite: ' + (evidence.dueAt ? formatDate(evidence.dueAt) : 'Sin fecha límite')));
              renderIndividualDeadline(course, activity, evidence, card);
              inboxBody.append(card);
              return;
            }
            const statusClass = evidence.status === 'aprobada' ? 'is-approved' : evidence.status === 'reprobada' ? 'is-failed' : evidence.status === 'requiere_cambios' ? 'is-changes' : 'is-pending';
            head.append(el('b', evidence.studentName || 'Estudiante'), el('span', evidence.status === 'aprobada' ? 'Revisada · Aprobada' : evidence.status === 'reprobada' ? 'Revisada · Reprobada' : evidence.status === 'requiere_cambios' ? 'Por corregir' : 'Enviada · Por revisar', 'course-activity-status course-evidence-status ' + statusClass));
            card.append(head, el('small', (evidence.studentCode || '') + ' · ' + evidence.originalName + ' · ' + formatDate(evidence.submittedAt) + (evidence.late ? ' · Entrega tardía' : '')));
            renderIndividualDeadline(course, activity, evidence, card);
            const evidenceUrl = evidence.downloadUrl || ('/api/organization/courses/' + course.id + '/activities/' + activity.id + '/evidences/' + evidence.id + '/download');
            if (String(evidence.mimeType || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(evidence.originalName || '')) {
              const view = el('a', 'Ver entrega'); view.href = evidenceUrl + '?view=1'; view.target = '_blank'; view.rel = 'noopener noreferrer'; card.append(view);
            }
            const download = el('a', 'Descargar entrega'); download.href = evidenceUrl; download.setAttribute('download', evidence.originalName || 'entrega'); card.append(download);
            const review = el('div', null, 'course-evidence-review-form');
            const reviewActions = el('div', null, 'course-evidence-actions');
            const changes = el('button', 'Marcar por corregir', 'btn btn-secundario btn-sm'); changes.type = 'button';
            changes.addEventListener('click', async () => {
              changes.disabled = true;
              try {
                await mutate('/api/organization/courses/' + course.id + '/activities/' + activity.id + '/evidences/' + evidence.id + '/review', 'PATCH', { status: 'requiere_cambios' });
                note('Entrega marcada por corregir. El docente explicará los ajustes directamente al estudiante.', 'success');
                await loadCourses();
              } catch (error) { note(error.message, 'error'); changes.disabled = false; }
            });
            reviewActions.append(changes); review.append(reviewActions); card.append(review);
            const grade = el('form', null, 'course-evidence-grade-form');
            const score = el('input'); score.type = 'number'; score.min = '0'; score.max = '5'; score.step = '0.1'; score.required = true; score.placeholder = 'Nota / 5'; score.value = evidence.score === null ? '' : evidence.score;
            const saveGrade = el('button', 'Guardar nota', 'btn btn-secundario btn-sm'); saveGrade.type = 'submit';
            grade.append(score, saveGrade);
            grade.addEventListener('submit', async event => {
              event.preventDefault(); saveGrade.disabled = true;
              try {
                await mutate('/api/organization/courses/' + course.id + '/activities/' + activity.id + '/evidences/' + evidence.id + '/grade', 'PUT', { score: Number(score.value), maxScore: 5 });
                note('Nota guardada. La entrega quedó revisada automáticamente.', 'success'); await loadCourses();
              } catch (error) { note(error.message, 'error'); saveGrade.disabled = false; }
            });
            card.append(grade);
            const outcome = gradeOutcome(evidence);
            if (outcome) card.append(el('strong', outcome.label + ' · Nota: ' + evidence.score + ' / ' + evidence.maxScore, 'course-grade-outcome ' + outcome.className));
            inboxBody.append(card);
          });
        } catch (error) { inboxBody.replaceChildren(el('p', error.message, 'course-empty')); }
      })();
    }

    if (state.role === 'tutor') {
      const actions = el('div', null, 'course-activity-actions');
      const edit = el('button', 'Editar', 'btn btn-secundario btn-sm');
      edit.type = 'button';
      edit.addEventListener('click', () => {
        const existing = item.querySelector('.course-activity-edit-form');
        if (existing) { existing.remove(); edit.textContent = 'Editar'; return; }
        const form = el('form', null, 'course-activity-form course-activity-edit-form');
        const fields = el('div', null, 'course-activity-fields');
        const moduleSelect = el('select'); moduleSelect.required = true;
        (course.modules || []).forEach(unit => moduleSelect.add(new Option(unit.number + '. ' + (unit.title || 'Unidad ' + unit.number), unit.id)));
        moduleSelect.value = activity.moduleId;
        const titleInput = el('input'); titleInput.required = true; titleInput.minLength = 3; titleInput.maxLength = 160; titleInput.value = activity.title || '';
        const descriptionInput = el('textarea'); descriptionInput.rows = 2; descriptionInput.maxLength = 4000; descriptionInput.value = activity.description || '';
        const instructionsInput = el('textarea'); instructionsInput.rows = 3; instructionsInput.maxLength = 10000; instructionsInput.value = activity.instructions || '';
        const opensAtInput = el('input'); opensAtInput.type = 'datetime-local'; opensAtInput.value = dateInput(activity.opensAt);
        const dueAtInput = el('input'); dueAtInput.type = 'datetime-local'; dueAtInput.value = dateInput(activity.dueAt);
        const statusInput = el('select');
        [['borrador','Borrador'],['publicada','Publicada'],['cerrada','Cerrada'],['archivada','Archivada']].forEach(([value,label]) => statusInput.add(new Option(label,value)));
        statusInput.value = activity.status || 'borrador';
        const reasonInput = el('textarea'); reasonInput.rows = 2; reasonInput.maxLength = 500; reasonInput.placeholder = 'Motivo del cambio (opcional)';
        [[moduleSelect,'Unidad'],[titleInput,'Título'],[descriptionInput,'Descripción'],[instructionsInput,'Instrucciones'],[opensAtInput,'Fecha de apertura'],[dueAtInput,'Fecha de entrega'],[statusInput,'Visibilidad'],[reasonInput,'Motivo de la modificación']].forEach(([control,label]) => {
          const wrap = el('label', null, 'course-form-field'); wrap.append(el('span',label),control); fields.append(wrap);
        });
        const actions = el('div', null, 'course-activity-actions');
        const save = el('button','Guardar cambios','btn btn-primario btn-sm'); save.type='submit';
        const cancel = el('button','Cancelar','btn btn-secundario btn-sm'); cancel.type='button';
        cancel.addEventListener('click', () => { form.remove(); edit.textContent='Editar'; });
        actions.append(save,cancel); form.append(fields,actions);
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (opensAtInput.value && dueAtInput.value && new Date(dueAtInput.value) < new Date(opensAtInput.value)) {
            note('La fecha de entrega no puede ser anterior a la fecha de apertura.','error'); return;
          }
          save.disabled=true;
          try {
            await mutate('/api/organization/courses/' + course.id + '/activities/' + activity.id, 'PATCH', {
              moduleId: moduleSelect.value, title: titleInput.value.trim(), description: descriptionInput.value.trim(),
              instructions: instructionsInput.value.trim(), opensAt: opensAtInput.value || null,
              dueAt: dueAtInput.value || null, status: statusInput.value, reason: reasonInput.value.trim()
            });
            await loadCourses();
            note('Actividad y fechas actualizadas dentro de ' + course.name + '.', 'success');
          } catch (error) { note(error.message, 'error'); save.disabled=false; }
        });
        item.append(form); edit.textContent='Cerrar edición';
        form.scrollIntoView({behavior:'smooth',block:'nearest'});
      });
      const remove = el('button', 'Eliminar', 'btn btn-secundario btn-sm');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar esta actividad del curso?')) return;
        try {
          await mutate('/api/organization/courses/' + course.id + '/activities/' + activity.id, 'DELETE');
          await loadCourses();
          note('Actividad eliminada del curso.', 'success');
        } catch (error) { note(error.message, 'error'); }
      });
      actions.append(edit, remove); item.append(actions);
    }
    return item;
  }
  function renderModuleEditor(course, card) {
    const section = el('section', null, 'course-module-editor');
    const modules = [...(course.modules || [])].sort((a, b) => Number(a.number) - Number(b.number)).slice(0, 4);
    const heading = el('div', null, 'course-module-editor-heading');
    const headingCopy = el('div');
    headingCopy.append(el('h3', 'Plan de las cuatro unidades'), el('p', 'Las cuatro unidades ya están creadas para todas las materias. Edita sus nombres y explica al estudiante qué aprenderá, cómo trabajará, qué debe investigar y qué recursos utilizar. Las actividades y sus archivos se agregan libremente dentro de cada unidad.', 'course-module-editor-help'));
    heading.append(headingCopy, el('span', '4 unidades fijas', 'course-module-count'));
    const editorDetails = el('details', null, 'course-module-editor-details');
    const editorSummary = el('summary', 'Editar nombres y descripciones de las unidades');
    editorDetails.append(editorSummary, heading);
    const form = el('form', null, 'course-modules-form');
    const rows = el('div', null, 'course-module-rows');
    modules.forEach((module, index) => {
      const row = el('div', null, 'course-module-row course-module-row-fixed');
      row.dataset.id = module.id;
      const title = el('input'); title.type = 'text'; title.required = true; title.minLength = 2; title.maxLength = 160;
      title.placeholder = 'Nombre de la unidad ' + (index + 1); title.value = displayUnitTitle(module);
      const description = el('textarea'); description.rows = 3; description.maxLength = 2000;
      description.placeholder = 'Explica qué se trabajará, cómo desarrollarlo, qué investigar y qué materiales usar.';
      description.value = module.description || '';
      const label = el('label', null, 'course-module-description');
      label.append(el('span', 'Descripción para los estudiantes'), description);
      row.append(el('strong', 'Unidad ' + (index + 1), 'course-module-number'), title, label);
      rows.append(row);
    });
    const save = el('button', 'Guardar las cuatro unidades', 'btn btn-primario btn-sm course-save-modules');
    save.type = 'submit';
    form.append(rows, save);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const payload = [...rows.children].map(row => ({
        id: row.dataset.id,
        title: row.querySelector('input').value.trim(),
        description: row.querySelector('textarea').value.trim()
      }));
      if (payload.length !== 4 || payload.some(item => item.title.length < 2)) {
        note('Completa los nombres de las cuatro unidades.', 'error'); return;
      }
      save.disabled = true;
      const originalLabel = save.textContent;
      save.textContent = 'Guardando…';
      try {
        await mutate('/api/organization/courses/' + course.id + '/modules', 'PUT', { modules: payload });
        await loadCourses();
        const refreshed = state.courses.find(item => String(item.id) === String(course.id));
        const saved = refreshed?.modules || [];
        const persisted = saved.length === 4 && payload.every(item => saved.some(unit => unit.id === item.id && unit.title === item.title && (unit.description || '') === item.description));
        if (!persisted) throw new Error('No se pudieron verificar las cuatro unidades guardadas.');
        note('Las cuatro unidades de ' + course.name + ' quedaron guardadas correctamente.', 'success');
      } catch (error) {
        note('No se pudieron guardar las unidades: ' + error.message, 'error');
      } finally { save.disabled = false; save.textContent = originalLabel; }
    });
    editorDetails.append(form);
    section.append(editorDetails);
    card.append(section);
  }
  function renderActivityForm(course, selectedModule) {
    const section = el('section', null, 'course-create-activity');
    section.append(el('h3', selectedModule ? 'Nueva actividad · ' + displayUnitTitle(selectedModule) : 'Crear actividad para este curso'));
    const form = el('form', null, 'course-activity-form');
    const module = el('select'); module.required = true; module.name = 'moduleId';
    module.add(new Option('Selecciona la unidad', ''));
    (course.modules || []).filter(item => item.status === 'activo').forEach(item => module.add(new Option(item.number + '. ' + displayUnitTitle(item), item.id)));
    if (selectedModule) { module.value = selectedModule.id; module.disabled = true; }
    const title = el('input'); title.required = true; title.minLength = 3; title.maxLength = 160; title.placeholder = 'Nombre de la actividad';
    const description = el('textarea'); description.rows = 2; description.maxLength = 4000; description.placeholder = 'Descripción';
    const instructions = el('textarea'); instructions.rows = 3; instructions.maxLength = 10000; instructions.placeholder = 'Instrucciones para los estudiantes';
    const opensAt = el('input'); opensAt.type = 'datetime-local';
    const dueAt = el('input'); dueAt.type = 'datetime-local';
    const status = el('select'); status.add(new Option('Guardar como borrador', 'borrador')); status.add(new Option('Publicar para estudiantes', 'publicada'));
    const fields = el('div', null, 'course-activity-fields');
    const unitControl = selectedModule ? el('input') : module;
    if (selectedModule) { unitControl.value = selectedModule.number + '. ' + displayUnitTitle(selectedModule); unitControl.readOnly = true; unitControl.setAttribute('aria-label', 'Unidad de esta actividad'); }
    [[unitControl, 'Unidad'], [title, 'Título'], [description, 'Descripción'], [instructions, 'Instrucciones'], [opensAt, 'Fecha de apertura'], [dueAt, 'Fecha de entrega'], [status, 'Visibilidad']].forEach(([input, label]) => {
      const wrap = el('label', null, 'course-form-field'); wrap.append(el('span', label), input); fields.append(wrap);
    });
    const submit = el('button', 'Crear actividad en ' + course.name, 'btn btn-primario'); submit.type = 'submit';
    form.append(fields, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const moduleId = selectedModule ? selectedModule.id : module.value;
      if (!moduleId) { note('Selecciona la unidad a la que pertenece la actividad.', 'error'); return; }
      submit.disabled = true;
      try {
        await mutate('/api/organization/courses/' + course.id + '/activities', 'POST', {
          moduleId, title: title.value.trim(), description: description.value.trim(),
          instructions: instructions.value.trim(), opensAt: opensAt.value || null,
          dueAt: dueAt.value || null, status: status.value
        });
        await loadCourses();
        note('Actividad creada dentro de ' + course.name + ', en la unidad seleccionada.', 'success');
      } catch (error) { note(error.message, 'error'); }
      finally { submit.disabled = false; }
    });
    section.append(form);
    return section;
  }
  function displayUnitTitle(module) {
    const title = String(module.title || '').trim();
    const legacy = title.match(/^módulo\s+(\d+)$/i);
    return legacy ? 'Unidad ' + legacy[1] : (title || 'Unidad ' + module.number);
  }
  function renderCourseWorkspace(course) {
    const summary = $('#courses-summary');
    const listRoot = $('#courses-list');
    const workspace = $('#course-workspace');
    summary.hidden = true; listRoot.hidden = true; workspace.hidden = false;
    workspace.replaceChildren();

    const heading = el('div', null, 'course-workspace-heading');
    const back = el('button', '← Volver a Mis cursos', 'btn btn-secundario btn-sm');
    back.type = 'button'; back.addEventListener('click', () => { location.href = 'courses.html'; });
    const intro = el('div', null, 'course-workspace-intro');
    intro.append(el('span', course.code || 'CURSO', 'course-code'), el('h2', course.name), el('p', course.description || 'Espacio académico de esta asignatura.'));
    const metrics = el('div', null, 'course-counts');
    metrics.append(el('span', (course.modules || []).length + ' unidades'), el('span', course.counts.activities + ' actividades'), el('span', course.counts.students + ' estudiantes'));
    if (state.role === 'estudiante') metrics.append(el('span', 'Entregadas: ' + Number(course.progress?.submitted || 0) + '/' + Number(course.progress?.total || 0) + ' · Aprobadas: ' + Number(course.progress?.approved || 0) + ' · Calificadas: ' + Number(course.progress?.graded || 0) + ' · Avance: ' + Number(course.progress?.percent || 0) + '%'));
    if (state.role === 'tutor') metrics.append(el('span', 'Por revisar: ' + Number(course.progress?.pendingReviews || 0) + ' · Entregas: ' + Number(course.progress?.submissions || 0) + ' · Aprobadas: ' + Number(course.progress?.approved || 0)));
    heading.append(back, intro, metrics); workspace.append(heading);

    if (state.role === 'tutor') {
      const teacherTools = el('div', null, 'course-teacher-tools course-teacher-tools-units');
      renderModuleEditor(course, teacherTools);
      workspace.append(teacherTools);
    }

    const modules = [...(course.modules || [])].sort((a, b) => Number(a.number) - Number(b.number)).slice(0, 4);
    const activitySection = el('section', null, 'course-activities-by-module');
    const activityHeading = el('div', null, 'course-activities-heading');
    activityHeading.append(el('h3', 'Contenido y actividades', 'course-subheading'));
    const unitNav = el('nav', null, 'course-unit-nav');
    unitNav.setAttribute('aria-label', 'Seleccionar unidad del curso');
    const unitPanels = [];
    if (!modules.length) activitySection.append(el('p', 'Este curso todavía no tiene unidades configuradas.', 'course-empty'));
    modules.forEach((module, index) => {
      const tab = el('button', 'Unidad ' + (index + 1), 'course-unit-tab');
      tab.type = 'button';
      tab.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      const group = el('section', null, 'course-module-group');
      group.hidden = index !== 0;
      group.append(el('h4', module.number + '. ' + displayUnitTitle(module)));
      if (module.description) group.append(el('p', module.description, 'course-unit-description'));
      const activities = (course.activities || []).filter(item => String(item.moduleId) === String(module.id));
      if (!activities.length) group.append(el('p', 'Todavía no hay actividades en esta unidad.', 'course-empty'));
      activities.forEach(activity => group.append(renderActivity(activity, course, module)));
      if (state.role === 'tutor' && module.status === 'activo') {
        const addActivity = el('button', '+ Agregar actividad', 'btn btn-primario btn-sm course-add-unit-activity');
        addActivity.type = 'button';
        addActivity.addEventListener('click', () => {
          const existing = group.querySelector('.course-create-activity');
          if (existing) { existing.remove(); addActivity.textContent = '+ Agregar actividad'; return; }
          const formSection = renderActivityForm(course, module);
          group.append(formSection);
          addActivity.textContent = 'Cerrar formulario';
          formSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        group.append(addActivity);
      }
      tab.addEventListener('click', () => {
        unitPanels.forEach((panel, panelIndex) => {
          panel.hidden = panelIndex !== index;
          panel.tab.setAttribute('aria-pressed', panelIndex === index ? 'true' : 'false');
        });
      });
      unitNav.append(tab);
      group.tab = tab;
      unitPanels.push(group);
      activitySection.append(group);
    });
    activityHeading.append(unitNav);
    activitySection.prepend(activityHeading);
    workspace.append(activitySection);

    const resourceSection = el('section', null, 'course-general-resources');
    resourceSection.append(el('h3', 'Materiales generales del curso', 'course-subheading'));
    const resources = el('div', null, 'course-resource-list');
    if (!(course.resources || []).length) resources.append(el('p', 'No hay recursos generales adjuntos.', 'course-empty'));
    (course.resources || []).forEach(resource => {
      const row = el('div', null, 'course-resource'); const info = el('div');
      info.append(el('b', resource.title), el('small', (resource.description || '') + ' · ' + (resource.sizeBytes / 1024).toFixed(1) + ' KB'));
      const link = el('a', 'Descargar PDF'); link.href = resource.downloadUrl; link.setAttribute('download', resource.fileName);
      row.append(info, link); resources.append(row);
    });
    resourceSection.append(resources); workspace.append(resourceSection);
  }
  function renderCourses(list) {
    const root = $('#courses-list'); root.replaceChildren();
    const workspace = $('#course-workspace');
    const selectedId = new URLSearchParams(location.search).get('course');
    if (selectedId) {
      const selected = list.find(course => String(course.id) === selectedId);
      if (selected) { renderCourseWorkspace(selected); return; }
      $('#courses-summary').hidden = false; root.hidden = false; workspace.hidden = true;
      note('Ese curso no está asignado a tu perfil o ya no está disponible.', 'error');
    } else {
      $('#courses-summary').hidden = false; root.hidden = false; workspace.hidden = true;
    }
    const activityCount = list.reduce((total, course) => total + Number(course.counts?.activities || 0), 0);
    const resourceCount = list.reduce((total, course) => total + Number(course.counts?.resources || 0), 0);
    $('#courses-summary').replaceChildren(
      el('span', list.length + ' cursos'),
      el('span', activityCount + ' actividades'),
      el('span', resourceCount + ' recursos PDF')
    );
    if (!list.length) { root.append(el('p', 'No tienes cursos asignados en este espacio.', 'course-empty')); return; }
    list.forEach(course => {
      const card = el('article', null, 'course-card course-card-overview');
      card.append(el('span', course.code, 'course-code'), el('h2', course.name), el('p', course.description, 'course-description'));
      const counts = el('div', null, 'course-counts');
      counts.append(el('span', (course.modules || []).length + ' unidades'), el('span', course.counts.activities + ' actividades'), el('span', course.counts.students + ' estudiantes'));
      if (state.role === 'estudiante') counts.append(el('span', 'Entregadas: ' + Number(course.progress?.submitted || 0) + '/' + Number(course.progress?.total || 0) + ' · Aprobadas: ' + Number(course.progress?.approved || 0) + ' · Calificadas: ' + Number(course.progress?.graded || 0) + ' · Avance: ' + Number(course.progress?.percent || 0) + '%'));
      if (state.role === 'tutor') counts.append(el('span', 'Por revisar: ' + Number(course.progress?.pendingReviews || 0) + ' · Entregas: ' + Number(course.progress?.submissions || 0) + ' · Aprobadas: ' + Number(course.progress?.approved || 0)));
      const open = el('a', 'Abrir curso →', 'course-open-link');
      open.href = 'courses.html?course=' + encodeURIComponent(course.id);
      card.append(counts, open); root.append(card);
    });
  }
  async function loadCourses() {
    const result = await api('/api/organization/courses');
    state.courses = result.courses || [];
    renderCourses(state.courses);
  }
  async function logout() {
    const button = $('#btn-logout'); button.disabled = true;
    try {
      const token = (await api('/api/auth/csrf-token')).csrfToken;
      await api('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: '{}' });
      location.replace('/login.html');
    } catch (error) { button.disabled = false; note('No se pudo cerrar la sesión. ' + error.message, 'error'); }
  }
  async function init() {
    try {
      const session = await api('/api/auth/me');
      $('#course-user').textContent = session.usuario?.nombre || 'Usuario';
      const organizations = await api('/api/auth/organizations');
      const active = organizations.organizacionActiva;
      if (!active) { note('Selecciona primero un espacio institucional.'); return; }
      if (!['tutor', 'estudiante'].includes(active.role)) { note('Este apartado es para docentes y estudiantes.', 'error'); return; }
      state.role = active.role;
      $('#home-link').href = active.role === 'tutor' ? 'teacher-home.html' : 'dashboard.html';
      if (state.role === 'tutor') {
        $('.courses-hero p:last-child').textContent = 'Abre cada asignatura para consultar sus unidades y organizar actividades dentro del curso correspondiente.';
      } else {
        $('.courses-hero p:last-child').textContent = 'Consulta las actividades publicadas y materiales de cada uno de tus cursos.';
      }
      await loadCourses();
      message.hidden = true;
    } catch (error) { note(error.message || 'No fue posible cargar tus cursos.', 'error'); }
  }
  $('#btn-logout').addEventListener('click', logout);
  init();
})();