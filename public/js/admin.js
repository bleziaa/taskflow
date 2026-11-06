(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { students: [], companies: [], users: [], csrf: '' };
  const message = $('#admin-mensaje');

  function showMessage(text, type = 'error') {
    message.textContent = text;
    message.className = 'form-mensaje ' + (type === 'success' ? 'exito' : 'error');
  }
  async function api(url, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) window.location.replace('/login.html');
      throw new Error(result?.error?.message || 'No se pudo completar la operación.');
    }
    return result.data || {};
  }
  async function tokenCsrf() {
    const result = await api('/api/auth/csrf-token');
    state.csrf = result.csrfToken;
    return state.csrf;
  }
  async function mutate(url, method, body) {
    const token = await tokenCsrf();
    return api(url, { method, headers: { 'X-CSRF-Token': token }, body: body ? JSON.stringify(body) : undefined });
  }
  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text || '';
    return node;
  }
  function actionButton(label, action, id) {
    const button = element('button', label);
    button.type = 'button';
    button.className = 'btn btn-secundario btn-sm';
    button.dataset.action = action;
    button.dataset.id = id;
    return button;
  }
  function updatePlatformSummary(usuarios = state.users) {
    const total = usuarios.length;
    const activos = usuarios.filter((user) => user.activo !== false).length;
    const inactivos = total - activos;
    const porcentajeActivas = total ? Math.round((activos / total) * 100) : 0;
    $('#metrica-usuarios-total').textContent = String(total);
    $('#metrica-cuentas-activas').textContent = String(activos);
    $('#metrica-cuentas-inactivas').textContent = String(inactivos);
    $('#grafica-total-cuentas').textContent = total + (total === 1 ? ' cuenta' : ' cuentas');
    $('#barra-cuentas-activas').style.width = porcentajeActivas + '%';
    $('#barra-cuentas-activas').setAttribute('aria-label', porcentajeActivas + '% de cuentas activas');
    $('#leyenda-activas').textContent = String(activos);
    $('#leyenda-inactivas').textContent = String(inactivos);
    $('#resumen-actualizado').textContent = 'Actualizado: ' + new Date().toLocaleString('es-CO');
  }

  async function checkSession() {
    const data = await api('/api/auth/me');
    const user = data.usuario;
    if (!user || user.role !== 'administrador') {
      showMessage('Tu cuenta no tiene permisos de administrador.');
      window.setTimeout(() => window.location.replace('/dashboard.html'), 1200);
      return false;
    }
    $('#admin-nombre').textContent = user.nombre;
    return true;
  }
  async function loadUsers(query = '') {
    const suffix = query.trim() ? '?q=' + encodeURIComponent(query.trim()) : '';
    const data = await api('/api/admin/users' + suffix);
    const usuarios = data.usuarios || [];
    renderUsers(usuarios);
    if (!query.trim()) {
      state.users = usuarios;
      updatePlatformSummary(usuarios);
    }
  }
  async function loadCompanies(query = '') {
    const suffix = query.trim() ? '?q=' + encodeURIComponent(query.trim()) : '';
    const data = await api('/api/admin/companies' + suffix);
    const empresas = data.empresas || [];
    renderCompanies(empresas);
    if (!query.trim()) {
      state.companies = empresas;
      const select = $('#est-empresa');
      const selected = select.value;
      select.replaceChildren(new Option('Sin asignar', ''));
      state.companies.filter((company) => company.estado !== 'inactiva')
        .forEach((company) => select.add(new Option(company.razonSocial, company._id)));
      select.value = selected;
    }
  }
  async function loadStudents(query = '') {
    const suffix = query.trim() ? '?q=' + encodeURIComponent(query.trim()) : '';
    const data = await api('/api/admin/students' + suffix);
    state.students = data.estudiantes || [];
    renderStudents();
  }
  function renderUsers(usuarios = state.users) {
    const tbody = $('#tabla-cuentas');
    if (!usuarios.length) {
      const row = element('tr'); const cell = element('td', 'No hay cuentas de tutor o estudiante.');
      cell.colSpan = 5; row.append(cell); tbody.replaceChildren(row); return;
    }
    tbody.replaceChildren(...usuarios.map((user) => {
      const row = element('tr');
      row.append(element('td', user.nombre), element('td', user.email),
        element('td', user.role === 'tutor' ? 'Docente / tutor' : 'Estudiante'),
        element('td', user.activo === false ? 'Desactivada' : 'Activa'));
      const actions = element('td');
      actions.append(actionButton('Editar', 'edit-user', user._id),
        actionButton(user.activo === false ? 'Activar' : 'Desactivar', 'toggle-user', user._id),
        actionButton('Eliminar', 'delete-user', user._id));
      row.append(actions); return row;
    }));
  }
  function renderStudents() {
    const tbody = $('#tabla-estudiantes');
    if (!state.students.length) {
      const row = element('tr'); const cell = element('td', 'No hay estudiantes registrados.');
      cell.colSpan = 7; row.append(cell); tbody.replaceChildren(row); return;
    }
    tbody.replaceChildren(...state.students.map((student) => {
      const row = element('tr');
      row.append(element('td', student.codigo), element('td', student.nombre), element('td', student.email),
        element('td', student.empresa?.razonSocial || 'Sin asignar'),
        element('td', student.tutor?.nombre || 'Sin asignar'), element('td', student.estado));
      const actions = element('td');
      actions.append(actionButton('Editar', 'edit-student', student._id), actionButton('Eliminar', 'delete-student', student._id));
      row.append(actions); return row;
    }));
  }
  function renderCompanies(empresas = state.companies) {
    const tbody = $('#tabla-empresas');
    if (!empresas.length) {
      const row = element('tr'); const cell = element('td', 'No hay empresas registradas.');
      cell.colSpan = 6; row.append(cell); tbody.replaceChildren(row); return;
    }
    tbody.replaceChildren(...empresas.map((company) => {
      const row = element('tr');
      row.append(element('td', company.razonSocial), element('td', company.nit), element('td', company.ciudad),
        element('td', company.contactoNombre || company.contactoEmail || 'Sin contacto'), element('td', company.estado));
      const actions = element('td');
      actions.append(actionButton('Editar', 'edit-company', company._id), actionButton('Eliminar', 'delete-company', company._id));
      row.append(actions); return row;
    }));
  }
  function resetForm(form) {
    form.reset();
    if (form.elements.id) form.elements.id.value = '';
    form.hidden = true;
  }
  function fillForm(form, data) {
    Object.entries(data).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (input) input.value = value == null ? '' : String(value);
    });
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function studentPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.id;
    data.semestre = Number(data.semestre);
    data.empresa = data.empresa || null;
    data.tutor = data.tutor || null;
    return data;
  }
  function companyPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.id; return data;
  }
  function accountPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.id;
    if (!data.password) delete data.password;
    if (data.activo !== undefined) data.activo = data.activo === 'true';
    return data;
  }

  $('#nueva-cuenta').addEventListener('click', () => {
    const form = $('#form-cuenta'); resetForm(form);
    $('#titulo-form-cuenta').textContent = 'Crear cuenta de acceso';
    $('#campo-password').hidden = false; $('#usr-password').required = true;
    $('#campo-activo').hidden = true; $('#usr-role').disabled = false;
    form.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#nuevo-estudiante').addEventListener('click', () => {
    const form = $('#form-estudiante'); resetForm(form);
    $('#titulo-form-estudiante').textContent = 'Registrar estudiante';
    form.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#nueva-empresa').addEventListener('click', () => {
    const form = $('#form-empresa'); resetForm(form);
    $('#titulo-form-empresa').textContent = 'Registrar empresa';
    form.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#cancelar-cuenta').addEventListener('click', () => resetForm($('#form-cuenta')));
  $('#cancelar-estudiante').addEventListener('click', () => resetForm($('#form-estudiante')));
  $('#cancelar-empresa').addEventListener('click', () => resetForm($('#form-empresa')));

  function buscarConPausa(selector, cargar) {
    let temporizador;
    $(selector).addEventListener('input', (event) => {
      window.clearTimeout(temporizador);
      const consulta = event.currentTarget.value;
      temporizador = window.setTimeout(() => {
        cargar(consulta).catch((error) => showMessage(error.message));
      }, 250);
    });
  }
  buscarConPausa('#buscar-cuentas', loadUsers);
  buscarConPausa('#buscar-estudiantes', loadStudents);
  buscarConPausa('#buscar-empresas', loadCompanies);

  $('#form-cuenta').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try {
      const id = form.elements.id.value; const data = accountPayload(form);
      await mutate(id ? '/api/admin/users/' + encodeURIComponent(id) : '/api/admin/users', id ? 'PATCH' : 'POST', data);
      resetForm(form); await loadUsers();
      showMessage(id ? 'Cuenta actualizada.' : 'Cuenta creada correctamente.', 'success');
    } catch (error) { showMessage(error.message); }
  });
  $('#form-estudiante').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try {
      const id = form.elements.id.value;
      await mutate(id ? '/api/admin/students/' + encodeURIComponent(id) : '/api/admin/students', id ? 'PATCH' : 'POST', studentPayload(form));
      resetForm(form); await loadStudents();
      showMessage(id ? 'Estudiante actualizado.' : 'Estudiante registrado correctamente.', 'success');
    } catch (error) { showMessage(error.message); }
  });
  $('#form-empresa').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try {
      const id = form.elements.id.value;
      await mutate(id ? '/api/admin/companies/' + encodeURIComponent(id) : '/api/admin/companies', id ? 'PATCH' : 'POST', companyPayload(form));
      resetForm(form); await loadCompanies(); await loadStudents();
      showMessage(id ? 'Empresa actualizada.' : 'Empresa registrada correctamente.', 'success');
    } catch (error) { showMessage(error.message); }
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    try {
      if (action === 'edit-user') {
        const user = state.users.find((item) => item._id === id); if (!user) return;
        const form = $('#form-cuenta'); resetForm(form);
        fillForm(form, { ...user, activo: user.activo === false ? 'false' : 'true' });
        $('#titulo-form-cuenta').textContent = 'Editar cuenta';
        $('#campo-password').hidden = false; $('#usr-password').required = false; $('#usr-password').value = '';
        $('#campo-activo').hidden = false; $('#usr-role').disabled = true;
      } else if (action === 'toggle-user') {
        const user = state.users.find((item) => item._id === id); if (!user) return;
        await mutate('/api/admin/users/' + encodeURIComponent(id), 'PATCH', { activo: user.activo === false });
        await loadUsers(); showMessage('Estado de la cuenta actualizado.', 'success');
      } else if (action === 'delete-user') {
        if (!window.confirm('¿Eliminar esta cuenta? Si está vinculada a estudiantes, primero debes retirar la vinculación.')) return;
        await mutate('/api/admin/users/' + encodeURIComponent(id), 'DELETE');
        await loadUsers(); showMessage('Cuenta eliminada.', 'success');
      } else if (action === 'edit-student') {
        const item = state.students.find((student) => student._id === id); if (!item) return;
        fillForm($('#form-estudiante'), { ...item, empresa: item.empresa?._id || '', tutor: item.tutor?._id || '' });
        $('#titulo-form-estudiante').textContent = 'Editar estudiante';
      } else if (action === 'edit-company') {
        const item = state.companies.find((company) => company._id === id); if (!item) return;
        fillForm($('#form-empresa'), item); $('#titulo-form-empresa').textContent = 'Editar empresa';
      } else if (action === 'delete-student') {
        if (!window.confirm('¿Eliminar este registro de estudiante?')) return;
        await mutate('/api/admin/students/' + encodeURIComponent(id), 'DELETE');
        await loadStudents(); showMessage('Estudiante eliminado.', 'success');
      } else if (action === 'delete-company') {
        if (!window.confirm('¿Eliminar esta empresa?')) return;
        await mutate('/api/admin/companies/' + encodeURIComponent(id), 'DELETE');
        await loadCompanies(); await loadStudents(); showMessage('Empresa eliminada.', 'success');
      }
    } catch (error) { showMessage(error.message); }
  });

  $('#btn-logout').addEventListener('click', async () => {
    try { await mutate('/api/auth/logout', 'POST', {}); window.location.replace('/login.html'); }
    catch (error) { showMessage(error.message); }
  });
  (async function init() {
    try {
      if (!(await checkSession())) return;
      await loadUsers();
    } catch (error) { showMessage(error.message); }
  })();
})();
