(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { students: [], companies: [], tutors: [], courses: [], organization: null };
  const message = $('#institution-message');

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) location.replace('/login.html');
      throw new Error(body?.error?.message || 'No se pudo completar la solicitud.');
    }
    return body.data || {};
  }
  async function mutate(url, method, data) {
    const token = (await api('/api/auth/csrf-token')).csrfToken;
    return api(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(data || {}) });
  }
  function notify(text, type = 'info') {
    message.textContent = text;
    message.hidden = !text;
    message.className = 'institution-message is-' + type;
  }
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined && text !== null) el.textContent = String(text);
    if (className) el.className = className;
    return el;
  }
  function action(label, type, id) {
    const button = node('button', label, 'btn btn-secundario btn-sm');
    button.type = 'button'; button.dataset.action = type; button.dataset.id = id;
    return button;
  }
  function fillSelect(select, items, label, value) {
    const current = value ?? select.value;
    select.replaceChildren(new Option('Sin asignar', ''));
    items.forEach(item => select.add(new Option(label(item), item._id)));
    select.value = current;
  }
  function renderStudents() {
    const q = $('#search-students').value.trim().toLocaleLowerCase('es');
    const rows = state.students.filter(s => [s.nombre,s.codigo,s.email,s.programa,s.empresa?.razonSocial,s.tutor?.nombre].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(q));
    const body = $('#students-rows'); body.replaceChildren();
    if (!rows.length) {
      const tr = node('tr'); const td = node('td', q ? 'No hay estudiantes que coincidan con la búsqueda.' : 'Todavía no hay estudiantes registrados.');
      td.colSpan = 6; tr.append(td); body.append(tr);
    }
    rows.forEach(s => {
      const tr = node('tr'); const identity = node('td');
      identity.append(node('strong',s.nombre),node('small',(s.codigo || 'Sin código')+' · '+(s.email || 'Sin correo')));
      tr.append(identity,node('td',s.programa || '—'),node('td',s.empresa?.razonSocial || 'Sin asignar'),
        node('td',s.tutor?.nombre || 'Sin asignar'),node('td',s.estado === 'inactivo' ? 'Inactivo' : 'Activo'));
      const actions = node('td'); actions.append(action('Editar','edit-student',s._id),action('Eliminar','delete-student',s._id));
      tr.append(actions); body.append(tr);
    });
    const cards = $('#students-cards'); cards.replaceChildren();
    rows.forEach(s => {
      const card = node('article',null,'institution-card'); const top = node('div',null,'institution-card-top');
      top.append(node('strong',s.nombre),node('span',s.estado==='inactivo'?'Inactivo':'Activo','institution-state'));
      card.append(top,node('p',(s.codigo||'')+' · '+(s.programa||'')),node('p','Empresa: '+(s.empresa?.razonSocial||'Sin asignar')),
        node('p','Tutor: '+(s.tutor?.nombre||'Sin asignar')));
      const actions = node('div',null,'institution-card-actions');
      actions.append(action('Editar','edit-student',s._id),action('Eliminar','delete-student',s._id));
      card.append(actions); cards.append(card);
    });
    $('#kpi-students').textContent = state.students.length;
  }
  function renderCompanies() {
    const q = $('#search-companies').value.trim().toLocaleLowerCase('es');
    const rows = state.companies.filter(c => [c.razonSocial,c.nit,c.ciudad,c.contactoNombre,c.contactoEmail].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(q));
    const body = $('#companies-rows'); body.replaceChildren();
    if (!rows.length) {
      const tr=node('tr'); const td=node('td',q?'No hay empresas que coincidan.':'Todavía no hay empresas registradas.');
      td.colSpan=6; tr.append(td); body.append(tr);
    }
    rows.forEach(c => {
      const tr=node('tr'); const identity=node('td'); identity.append(node('strong',c.razonSocial),node('small',c.sector||'Sector no especificado'));
      tr.append(identity,node('td',c.nit),node('td',c.ciudad),node('td',c.contactoNombre||c.contactoEmail||'Sin contacto'),
        node('td',c.estado==='inactiva'?'Inactiva':'Activa'));
      const actions=node('td'); actions.append(action('Editar','edit-company',c._id),action('Eliminar','delete-company',c._id));
      tr.append(actions); body.append(tr);
    });
    const cards=$('#companies-cards'); cards.replaceChildren();
    rows.forEach(c => {
      const card=node('article',null,'institution-card'); const top=node('div',null,'institution-card-top');
      top.append(node('strong',c.razonSocial),node('span',c.estado==='inactiva'?'Inactiva':'Activa','institution-state'));
      card.append(top,node('p','NIT: '+c.nit+' · '+c.ciudad),node('p',c.contactoNombre||c.contactoEmail||'Sin contacto'));
      const actions=node('div',null,'institution-card-actions');
      actions.append(action('Editar','edit-company',c._id),action('Eliminar','delete-company',c._id));
      card.append(actions); cards.append(card);
    });
    $('#kpi-companies').textContent=state.companies.length;
  }
  function renderCourses() {
    const root = $('#courses-admin-list'); if (!root) return;
    root.replaceChildren();
    if (!state.courses.length) { root.append(node('p','Esta institución todavía no tiene cursos. Usa «Crear curso» para configurar la oferta académica.','institution-empty')); return; }
    state.courses.forEach(course => {
      const modules = (course.modules || []).map((item, index) => ({
        id: item.id, number: Number(item.module_number ?? item.number ?? index + 1),
        title: item.title || ('Módulo ' + (index + 1)), description: item.description || ''
      }));
      const card = node('article',null,'institution-course-card');
      const head = node('div',null,'institution-course-card-head');
      head.append(node('span',course.code,'institution-course-code'),node('span',course.status==='activo'?'Activo':course.status,'institution-state'));
      card.append(head,node('h3',course.name),node('p',course.description||'Sin descripción.'));
      card.append(node('p',modules.length+' módulos configurados','institution-course-meta'));
      const moduleList = node('div',null,'institution-course-modules');
      modules.forEach(module => moduleList.append(node('span',module.number+'. '+module.title)));
      card.append(moduleList);
      const teachers = (course.teachers||[]).filter(item=>item.status==='activo').map(item=>item.user?.nombre||item.userId);
      card.append(node('p','Docentes: '+(teachers.join(', ')||'Sin asignar'),'institution-course-teachers'));
      const actions = node('div',null,'institution-course-actions');
      actions.append(action('Editar estructura','edit-course',course.id));
      card.append(actions);
      root.append(card);
    });
  }
  function openCourseEditor(courseId) {
    const course = state.courses.find(item => String(item.id) === String(courseId));
    if (!course) return;
    $('#courses-admin-list').querySelectorAll('.course-editor').forEach(item => item.remove());
    const editor = node('section',null,'course-editor institution-form');
    editor.dataset.courseId = course.id;
    editor.append(node('h3','Editar estructura académica · '+course.name));
    const fields = node('div',null,'institution-form-grid');
    const addField = (labelText, name, value, type='text') => {
      const label=node('label',labelText); const input=node('input'); input.name=name; input.type=type; input.value=value ?? '';
      if(name==='name') input.required=true;
      if(name==='code'){input.required=true;input.maxLength=40;input.pattern='[A-Za-z0-9_-]+';}
      label.append(input); fields.append(label);
    };
    addField('Código del curso','code',course.code);
    addField('Nombre del curso','name',course.name);
    const statusLabel=node('label','Estado del curso'); const status=node('select'); status.name='status';
    [['activo','Activo'],['inactivo','Inactivo'],['archivado','Archivado']].forEach(([value,label])=>status.add(new Option(label,value)));
    status.value=course.status||'activo'; statusLabel.append(status); fields.append(statusLabel);
    const descLabel=node('label','Descripción'); const desc=node('textarea'); desc.name='description'; desc.rows=3; desc.maxLength=4000; desc.value=course.description||''; descLabel.append(desc); fields.append(descLabel);
    editor.append(fields);
    const moduleHeading=node('div',null,'course-editor-heading'); moduleHeading.append(node('h4','Módulos del curso'),node('span',(course.modules||[]).length+' en total'));
    editor.append(moduleHeading);
    const moduleRows=node('div',null,'course-editor-modules');
    (course.modules||[]).forEach((item,index)=>moduleRows.append(createModuleEditorRow(item,index)));
    editor.append(moduleRows);
    const addModule=node('button','＋ Añadir módulo','btn btn-secundario btn-sm'); addModule.type='button';
    addModule.addEventListener('click',()=>{ if(moduleRows.children.length>=50)return; moduleRows.append(createModuleEditorRow({},moduleRows.children.length)); moduleHeading.lastChild.textContent=moduleRows.children.length+' en total'; });
    editor.append(addModule);
    const teacherBox=node('div',null,'course-editor-teachers');
    teacherBox.append(node('h4','Asignar otro docente'));
    const teacherSelect=node('select'); teacherSelect.name='teacherUserId'; teacherSelect.add(new Option('Selecciona un docente',''));
    state.tutors.forEach(t=>teacherSelect.add(new Option(t.nombre+' · '+t.email,t._id)));
    const assigned=new Set((course.teachers||[]).filter(t=>t.status==='activo').map(t=>String(t.userId)));
    [...teacherSelect.options].forEach(option=>{if(assigned.has(option.value))option.disabled=true;});
    const assign=node('button','Asignar docente','btn btn-secundario btn-sm'); assign.type='button';
    assign.addEventListener('click',async()=>{ if(!teacherSelect.value){notify('Selecciona un docente.','error');return;} assign.disabled=true; try{await mutate('/api/organization/courses/'+course.id+'/teachers','POST',{teacherUserId:teacherSelect.value});await loadAll();notify('Docente asignado al curso.','success');openCourseEditor(course.id);}catch(error){notify(error.message,'error');}finally{assign.disabled=false;} });
    teacherBox.append(teacherSelect,assign); editor.append(teacherBox);
    const actions=node('div',null,'institution-form-actions');
    const save=node('button','Guardar cambios','btn btn-primario'); save.type='button';
    save.addEventListener('click',async()=>{ 
      const data={
        code:editor.querySelector('[name=code]').value.trim(),
        name:editor.querySelector('[name=name]').value.trim(),
        description:editor.querySelector('[name=description]').value.trim(),
        status:editor.querySelector('[name=status]').value
      };
      const moduleData=[...moduleRows.querySelectorAll('.course-editor-module')].map(row=>({id:row.dataset.id||undefined,title:row.querySelector('[name=moduleTitle]').value.trim(),description:row.querySelector('[name=moduleDescription]').value.trim()}));
      if(!moduleData.length||moduleData.some(item=>item.title.length<2)){notify('Cada curso debe conservar al menos un módulo y todos deben tener nombre.','error');return;}
      save.disabled=true;
      try{
        await mutate('/api/organization/courses/'+course.id,'PATCH',{code:data.code,name:data.name,description:data.description,status:data.status});
        await mutate('/api/organization/courses/'+course.id+'/modules','PUT',{modules:moduleData});
        await loadAll();notify('Curso y estructura de módulos actualizados.','success');
      }catch(error){notify(error.message,'error');}
      finally{save.disabled=false;}
    });
    const cancel=node('button','Cerrar','btn btn-secundario'); cancel.type='button'; cancel.addEventListener('click',()=>editor.remove());
    actions.append(save,cancel); editor.append(actions);
    $('#courses-admin-list').append(editor); editor.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function createModuleEditorRow(module,index) {
    const row=node('div',null,'course-editor-module'); row.dataset.id=module.id||'';
    const number=node('span','Módulo '+(index+1),'course-editor-module-number');
    const title=node('input'); title.name='moduleTitle'; title.value=module.title||('Módulo '+(index+1)); title.required=true; title.maxLength=160; title.placeholder='Nombre del módulo';
    const description=node('input'); description.name='moduleDescription'; description.value=module.description||''; description.maxLength=2000; description.placeholder='Descripción breve (opcional)';
    const remove=node('button','Quitar','btn btn-secundario btn-sm'); remove.type='button';
    remove.addEventListener('click',()=>{row.remove();[...row.parentElement.children].forEach((item,i)=>{item.querySelector('.course-editor-module-number').textContent='Módulo '+(i+1);});});
    row.append(number,title,description,remove); return row;
  }
  async function loadAll() {
    const [students,companies,tutors,courses] = await Promise.all([
      api('/api/organization/students'),api('/api/organization/companies'),
      api('/api/organization/tutors'),api('/api/organization/courses/manage')
    ]);
    state.students=students.estudiantes||[]; state.companies=companies.empresas||[];
    state.tutors=tutors.usuarios||[]; state.courses=courses.courses||[];
    fillSelect($('#student-company'),state.companies.filter(c=>c.estado!=='inactiva'),c=>c.razonSocial);
    fillSelect($('#student-tutor'),state.tutors,t=>t.nombre+' · '+t.email);
    const teacherSelect=$('#course-teachers');
    teacherSelect.replaceChildren();
    state.tutors.forEach(t=>teacherSelect.add(new Option(t.nombre+' · '+t.email,t._id)));
    $('#kpi-tutors').textContent=state.tutors.length;
    renderStudents(); renderCompanies(); renderCourses();
  }
  function openForm(form,title,text) {
    form.reset(); form.elements.id.value=''; $(title).textContent=text;
    form.hidden=false; form.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function closeForm(form) { form.reset(); form.elements.id.value=''; form.hidden=true; }

  $('#new-student').addEventListener('click',()=>{
    openForm($('#student-form'),'#student-form-title','Registrar estudiante');
    $('#student-form').elements.programa.value='Ingeniería de Software';
    $('#student-form').elements.semestre.value='1';
    fillSelect($('#student-company'),state.companies.filter(c=>c.estado!=='inactiva'),c=>c.razonSocial);
    fillSelect($('#student-tutor'),state.tutors,t=>t.nombre+' · '+t.email);
  });
  $('#new-company').addEventListener('click',()=>openForm($('#company-form'),'#company-form-title','Registrar empresa'));
  $('#cancel-student').addEventListener('click',()=>closeForm($('#student-form')));
  $('#cancel-company').addEventListener('click',()=>closeForm($('#company-form')));
  $('#search-students').addEventListener('input',renderStudents);
  $('#search-companies').addEventListener('input',renderCompanies);

  $('#student-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget; const id=form.elements.id.value;
    const data=Object.fromEntries(new FormData(form).entries()); delete data.id;
    data.semestre=Number(data.semestre); data.empresa=data.empresa||null; data.tutor=data.tutor||null;
    const button=form.querySelector('[type=submit]'); button.disabled=true;
    try {
      await mutate(id?'/api/organization/students/'+encodeURIComponent(id):'/api/organization/students',id?'PATCH':'POST',data);
      closeForm(form); await loadAll(); notify(id?'Ficha del estudiante actualizada.':'Estudiante registrado correctamente.','success');
    } catch(error) { notify(error.message,'error'); }
    finally { button.disabled=false; }
  });
  $('#company-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget; const id=form.elements.id.value;
    const data=Object.fromEntries(new FormData(form).entries()); delete data.id;
    const button=form.querySelector('[type=submit]'); button.disabled=true;
    try {
      await mutate(id?'/api/organization/companies/'+encodeURIComponent(id):'/api/organization/companies',id?'PATCH':'POST',data);
      closeForm(form); await loadAll(); notify(id?'Empresa actualizada.':'Empresa registrada correctamente.','success');
    } catch(error) { notify(error.message,'error'); }
    finally { button.disabled=false; }
  });
  $('#new-course').addEventListener('click',()=>{ $('#course-form').reset(); $('#course-form').hidden=false; $('#course-form').scrollIntoView({behavior:'smooth',block:'center'}); });
  $('#cancel-course').addEventListener('click',()=>{ $('#course-form').reset(); $('#course-form').hidden=true; });
  $('#course-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const data=Object.fromEntries(new FormData(form).entries());
    data.moduleCount=Number(data.moduleCount);
    data.teacherUserIds=[...$('#course-teachers').selectedOptions].map(option=>option.value).filter(Boolean);
    const button=form.querySelector('[type=submit]'); button.disabled=true;
    try {
      await mutate('/api/organization/courses','POST',data);
      form.reset(); form.hidden=true; await loadAll();
      notify('Curso creado con '+data.moduleCount+' módulos y sus docentes asignados.','success');
    } catch(error) { notify(error.message,'error'); }
    finally { button.disabled=false; }
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]'); if(!button)return;
    const id=button.dataset.id;
    try {
      if(button.dataset.action==='edit-course'){
        openCourseEditor(id);
      } else if(button.dataset.action==='edit-student'){
        const student=state.students.find(item=>item._id===id); if(!student)return;
        const form=$('#student-form'); openForm(form,'#student-form-title','Editar estudiante');
        Object.entries({...student,empresa:student.empresa?._id||'',tutor:student.tutor?._id||''}).forEach(([key,value])=>{
          const field=form.elements.namedItem(key); if(field)field.value=value??'';
        });
        fillSelect($('#student-company'),state.companies.filter(c=>c.estado!=='inactiva'),c=>c.razonSocial,student.empresa?._id||'');
        fillSelect($('#student-tutor'),state.tutors,t=>t.nombre+' · '+t.email,student.tutor?._id||'');
      } else if(button.dataset.action==='edit-company'){
        const company=state.companies.find(item=>item._id===id); if(!company)return;
        const form=$('#company-form'); openForm(form,'#company-form-title','Editar empresa');
        Object.entries(company).forEach(([key,value])=>{const field=form.elements.namedItem(key);if(field)field.value=value??'';});
      } else if(button.dataset.action==='delete-student'){
        if(!confirm('¿Eliminar el registro? Si tiene historial de prácticas, TaskFlow impedirá borrarlo para conservar la trazabilidad.'))return;
        await mutate('/api/organization/students/'+encodeURIComponent(id),'DELETE'); await loadAll(); notify('Registro eliminado.','success');
      } else if(button.dataset.action==='delete-company'){
        if(!confirm('¿Eliminar esta empresa? No se puede borrar mientras tenga estudiantes vinculados.'))return;
        await mutate('/api/organization/companies/'+encodeURIComponent(id),'DELETE'); await loadAll(); notify('Empresa eliminada.','success');
      }
    } catch(error) { notify(error.message,'error'); }
  });
  $('#btn-logout').addEventListener('click',async()=>{
    const button=$('#btn-logout'); button.disabled=true;
    try {
      const token=(await api('/api/auth/csrf-token')).csrfToken;
      await api('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:'{}'});
      location.replace('/login.html');
    } catch(error) { button.disabled=false; notify(error.message,'error'); }
  });
  async function init(){
    try {
      const [session,organizations]=await Promise.all([api('/api/auth/me'),api('/api/auth/organizations')]);
      $('#admin-institution-name').textContent=session.usuario?.nombre||'Administrador';
      state.organization=organizations.organizacionActiva;
      if(!state.organization||state.organization.role!=='administrador'){
        notify('Selecciona una institución donde tengas rol de administrador para acceder a este módulo.','error');
        document.querySelectorAll('main button,main input,main select').forEach(el=>el.disabled=true);
        return;
      }
      $('#admin-institution-name').textContent=state.organization.nombre||'Administración institucional';
      await loadAll(); notify('Información institucional cargada correctamente.','success');
    } catch(error) { notify(error.message,'error'); }
  }
  init();
})();