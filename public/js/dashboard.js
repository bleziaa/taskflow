/* ============================================================
   TaskFlow - Dashboard autenticado
   ------------------------------------------------------------
   Verifica la sesion contra /api/auth/me, muestra el usuario
   autenticado y permite cerrar sesion. Las tareas y miembros
   siguen guardandose en localStorage (taskflow-tareas y
   taskflow-miembros) hasta la fase de datos reales.
   Todo el contenido dinamico se pinta con createElement +
   textContent (sin innerHTML).
   ============================================================ */
(function () {
  'use strict';

  const {
    qs,
    qsa,
    crear,
    leerStorage,
    guardarStorage,
    formatearFecha,
    mostrarMensaje,
    ocultarMensaje,
    abrirModal,
    cerrarModal,
  } = window.TaskFlow;

  const CLAVE_TAREAS = 'taskflow-tareas';
  const CLAVE_MIEMBROS = 'taskflow-miembros';
  const API_ME = '/api/auth/me';
  const API_CSRF = '/api/auth/csrf-token';
  const API_LOGOUT = '/api/auth/logout';
  const MENSAJE_ERROR_SESION =
    'No se pudo verificar tu sesión. Revisa tu conexión e inténtalo de nuevo.';
  const MENSAJE_ERROR_LOGOUT = 'No se pudo cerrar la sesión. Inténtalo de nuevo.';

  const ESTADOS = ['pendiente', 'progreso', 'completada'];
  const PRIORIDADES = ['alta', 'media', 'baja'];
  const NOMBRE_ESTADO = {
    pendiente: 'Pendiente',
    progreso: 'En progreso',
    completada: 'Completada',
  };

  let tareas = leerStorage(CLAVE_TAREAS);
  let miembros = leerStorage(CLAVE_MIEMBROS);
  let temporizadorCierre = null;
  let verificandoSesion = false;

  /* ---------- Sesion del usuario ---------- */

  function redirigirALogin() {
    window.location.replace('/login.html');
  }

  function mostrarUsuario(usuario) {
    const nombre = qs('#usuario-nombre');
    const email = qs('#usuario-email');
    const botonLogout = qs('#btn-logout');

    if (nombre) nombre.textContent = usuario.nombre || 'Usuario';
    if (email) email.textContent = usuario.email || '';
    const adminLink = qs('#admin-link');
    if (adminLink) adminLink.hidden = usuario.role !== 'administrador';
    if (botonLogout) botonLogout.disabled = false;
  }

  function limpiarUsuario() {
    const nombre = qs('#usuario-nombre');
    const email = qs('#usuario-email');
    const botonLogout = qs('#btn-logout');

    if (nombre) nombre.textContent = '';
    if (email) email.textContent = '';
    if (botonLogout) botonLogout.disabled = true;
  }

  async function obtenerSesion() {
    const respuesta = await fetch(API_ME, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (respuesta.status === 401) return { noAutenticado: true };
    if (!respuesta.ok) throw new Error('sesion');

    const datos = await respuesta.json();
    const usuario = datos && datos.data && datos.data.usuario;
    if (!usuario) throw new Error('sesion');

    return { usuario };
  }

  async function verificarSesion() {
    if (verificandoSesion) return;
    verificandoSesion = true;

    try {
      const resultado = await obtenerSesion();

      if (resultado.noAutenticado) {
        limpiarUsuario();
        redirigirALogin();
        return;
      }

      mostrarUsuario(resultado.usuario);
      ocultarMensaje(qs('#mensaje-sesion'));
    } catch (error) {
      limpiarUsuario();
      mostrarMensaje(qs('#mensaje-sesion'), MENSAJE_ERROR_SESION, 'error');
    } finally {
      verificandoSesion = false;
    }
  }

  async function cerrarSesion(boton) {
    if (!boton || boton.disabled) return;

    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Cerrando…';

    try {
      const csrfRespuesta = await fetch(API_CSRF, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (!csrfRespuesta.ok) throw new Error('csrf');

      const csrfDatos = await csrfRespuesta.json();
      const token = csrfDatos && csrfDatos.data && csrfDatos.data.csrfToken;
      if (!token) throw new Error('csrf');

      const respuesta = await fetch(API_LOGOUT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({}),
      });

      if (!respuesta.ok) throw new Error('logout');

      limpiarUsuario();
      window.location.replace('/login.html');
    } catch (error) {
      mostrarMensaje(qs('#mensaje-sesion'), MENSAJE_ERROR_LOGOUT, 'error');
      boton.disabled = false;
      boton.textContent = texto;
    }
  }

  /* ---------- Normalizacion segura de datos ---------- */

  function texto(valor) {
    return valor === undefined || valor === null ? '' : String(valor).trim();
  }

  function normalizarTarea(tarea) {
    const datos = tarea && typeof tarea === 'object' ? tarea : {};
    return {
      nombre: texto(datos.nombre),
      proyecto: texto(datos.proyecto),
      tarea: texto(datos.tarea),
      fecha: texto(datos.fecha),
      prioridad: PRIORIDADES.includes(datos.prioridad) ? datos.prioridad : 'media',
      estado: ESTADOS.includes(datos.estado) ? datos.estado : 'pendiente',
    };
  }

  function normalizarMiembro(miembro) {
    const datos = miembro && typeof miembro === 'object' ? miembro : {};
    return {
      nombre: texto(datos.nombre),
      rol: texto(datos.rol),
    };
  }

  function listaTareas() {
    return tareas.map(normalizarTarea);
  }

  /* ---------- Render: resumen ---------- */

  function renderResumen() {
    const datos = listaTareas();
    const completadas = datos.filter((tarea) => tarea.estado === 'completada').length;
    const proyectos = new Set(datos.map((tarea) => tarea.proyecto).filter(Boolean)).size;
    const porcentaje = datos.length ? Math.round((completadas / datos.length) * 100) : 0;

    const statCompletadas = qs('#stat-completadas');
    const statEquipos = qs('#stat-equipos');
    const statPorcentaje = qs('#stat-porcentaje');
    const textoResumen = qs('#resumen-texto');

    if (statCompletadas) statCompletadas.textContent = String(completadas);
    if (statEquipos) statEquipos.textContent = String(proyectos);
    if (statPorcentaje) statPorcentaje.textContent = `${porcentaje}%`;

    if (textoResumen) {
      textoResumen.textContent = datos.length
        ? `${datos.length} tarea${datos.length === 1 ? '' : 's'} registrada${
            datos.length === 1 ? '' : 's'
          } en este navegador.`
        : 'Todavía no hay tareas de demostración. Crea la primera con el botón "Nueva tarea".';
    }
  }

  /* ---------- Render: tablero Kanban ---------- */

  function crearTarjetaTarea(tarea) {
    const tarjeta = crear('article', { className: 'tarjeta-tarea' });

    tarjeta.appendChild(
      crear('h4', { text: tarea.tarea || 'Tarea sin título' })
    );

    const meta = crear('div', { className: 'meta' });
    meta.appendChild(crear('span', { text: tarea.proyecto || 'Sin proyecto' }));
    meta.appendChild(crear('span', { text: `Entrega: ${formatearFecha(tarea.fecha)}` }));
    if (tarea.nombre) {
      meta.appendChild(crear('span', { text: `Responsable: ${tarea.nombre}` }));
    }
    tarjeta.appendChild(meta);

    const badges = crear('div', { className: 'badges' });
    badges.appendChild(
      crear('span', {
        className: `etiqueta-prioridad prioridad-${tarea.prioridad}`,
        text: tarea.prioridad,
      })
    );
    tarjeta.appendChild(badges);

    return tarjeta;
  }

  function renderTablero() {
    const columnas = qsa('.kanban-columna');
    const datos = listaTareas();

    columnas.forEach((columna) => {
      const estado = columna.dataset.estado;
      if (!ESTADOS.includes(estado)) return;

      const lista = qs('[data-lista]', columna);
      const contador = qs('[data-contador]', columna);
      if (!lista) return;

      const tareasEstado = datos.filter((tarea) => tarea.estado === estado);
      if (contador) contador.textContent = String(tareasEstado.length);

      if (!tareasEstado.length) {
        lista.replaceChildren(
          crear('p', { className: 'tabla-vacia', text: 'Sin tareas en esta columna.' })
        );
        return;
      }

      lista.replaceChildren(...tareasEstado.map(crearTarjetaTarea));
    });
  }

  /* ---------- Render: equipo ---------- */

  function renderEquipo() {
    const tbody = qs('#tabla-miembros');
    if (!tbody) return;

    const datos = miembros.map(normalizarMiembro);

    if (!datos.length) {
      tbody.replaceChildren(
        crear('tr', {
          children: [
            crear('td', {
              className: 'tabla-vacia',
              text: 'Aún no hay miembros. Usa "Invitar miembro" para agregar uno.',
              attrs: { colspan: '2' },
            }),
          ],
        })
      );
      return;
    }

    const filas = datos.map((miembro) =>
      crear('tr', {
        children: [
          crear('td', { text: miembro.nombre || 'Sin nombre' }),
          crear('td', { text: miembro.rol || 'Sin rol' }),
        ],
      })
    );

    tbody.replaceChildren(...filas);
  }

  /* ---------- Render: recordatorios ---------- */

  function renderRecordatorios() {
    const tbody = qs('#tabla-recordatorios');
    if (!tbody) return;

    const datos = listaTareas().sort((a, b) => {
      const fechaA = a.fecha ? new Date(a.fecha).getTime() : Infinity;
      const fechaB = b.fecha ? new Date(b.fecha).getTime() : Infinity;
      return fechaA - fechaB;
    });

    if (!datos.length) {
      tbody.replaceChildren(
        crear('tr', {
          children: [
            crear('td', {
              className: 'tabla-vacia',
              text: 'No hay fechas registradas todavía.',
              attrs: { colspan: '3' },
            }),
          ],
        })
      );
      return;
    }

    const filas = datos.map((tarea) =>
      crear('tr', {
        children: [
          crear('td', { text: tarea.tarea || 'Tarea sin título' }),
          crear('td', { text: formatearFecha(tarea.fecha) }),
          crear('td', {
            children: [
              crear('span', {
                className: `etiqueta-prioridad prioridad-${tarea.prioridad}`,
                text: tarea.prioridad,
              }),
            ],
          }),
        ],
      })
    );

    tbody.replaceChildren(...filas);
  }

  /* ---------- Render general ---------- */

  function actualizarVista() {
    renderResumen();
    renderTablero();
    renderEquipo();
    renderRecordatorios();
  }

  /* ---------- Modal: nueva tarea ---------- */

  function abrirFormularioTarea(disparador) {
    const plantilla = qs('#tpl-tarea');
    if (!plantilla) return;

    const contenido = plantilla.content.cloneNode(true);
    const form = qs('#form-tarea', contenido);
    const mensaje = qs('#mensaje-tarea', contenido);

    form.addEventListener('submit', (evento) => {
      evento.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const datos = new FormData(form);
      const nueva = normalizarTarea({
        nombre: datos.get('nombre'),
        proyecto: datos.get('proyecto'),
        tarea: datos.get('tarea'),
        fecha: datos.get('fecha'),
        prioridad: datos.get('prioridad'),
        estado: datos.get('estado'),
      });

      if (!nueva.tarea || !nueva.proyecto) {
        mostrarMensaje(mensaje, 'Completa el proyecto y el título de la tarea.', 'error');
        return;
      }

      tareas.push(nueva);
      if (!guardarStorage(CLAVE_TAREAS, tareas)) {
        tareas.pop();
        mostrarMensaje(
          mensaje,
          'No se pudo guardar en este navegador. Revisa el almacenamiento disponible.',
          'error'
        );
        return;
      }

      mostrarMensaje(
        mensaje,
        'Tarea guardada en este navegador (modo demostración).',
        'exito'
      );
      actualizarVista();

      temporizadorCierre = window.setTimeout(() => {
        const overlay = qs('#overlay');
        if (overlay && overlay.classList.contains('activo')) cerrarModal();
      }, 800);
    });

    abrirModal(contenido, disparador);
  }

  /* ---------- Modal: invitar miembro ---------- */

  function abrirFormularioMiembro(disparador) {
    const plantilla = qs('#tpl-miembro');
    if (!plantilla) return;

    const contenido = plantilla.content.cloneNode(true);
    const form = qs('#form-miembro', contenido);
    const mensaje = qs('#mensaje-miembro', contenido);

    form.addEventListener('submit', (evento) => {
      evento.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const datos = new FormData(form);
      const nuevo = normalizarMiembro({
        nombre: datos.get('nombre'),
        rol: datos.get('rol'),
      });

      if (!nuevo.nombre || !nuevo.rol) {
        mostrarMensaje(mensaje, 'Completa el nombre y el rol del integrante.', 'error');
        return;
      }

      miembros.push(nuevo);
      if (!guardarStorage(CLAVE_MIEMBROS, miembros)) {
        miembros.pop();
        mostrarMensaje(
          mensaje,
          'No se pudo guardar en este navegador. Revisa el almacenamiento disponible.',
          'error'
        );
        return;
      }

      mostrarMensaje(
        mensaje,
        'Integrante agregado en este navegador (modo demostración).',
        'exito'
      );
      actualizarVista();

      temporizadorCierre = window.setTimeout(() => {
        const overlay = qs('#overlay');
        if (overlay && overlay.classList.contains('activo')) cerrarModal();
      }, 800);
    });

    abrirModal(contenido, disparador);
  }

  /* ---------- Conexion de botones ---------- */

  function conectarBotones() {
    qsa('[data-abrir-modal]').forEach((boton) => {
      boton.addEventListener('click', () => {
        if (temporizadorCierre) {
          window.clearTimeout(temporizadorCierre);
          temporizadorCierre = null;
        }

        if (boton.dataset.abrirModal === 'tarea') {
          abrirFormularioTarea(boton);
        } else if (boton.dataset.abrirModal === 'miembro') {
          abrirFormularioMiembro(boton);
        }
      });
    });

    const botonLogout = qs('#btn-logout');
    if (botonLogout) {
      botonLogout.addEventListener('click', () => cerrarSesion(botonLogout));
    }

    const botonBorrar = qs('#btn-borrar-datos');
    if (botonBorrar) {
      botonBorrar.addEventListener('click', () => {
        const confirmado = window.confirm(
          'Se borrarán las tareas y miembros guardados en este navegador. Esta acción no se puede deshacer. ¿Continuar?'
        );
        if (!confirmado) return;

        tareas = [];
        miembros = [];
        guardarStorage(CLAVE_TAREAS, tareas);
        guardarStorage(CLAVE_MIEMBROS, miembros);
        actualizarVista();

        mostrarMensaje(
          qs('#mensaje-ajustes'),
          'Datos de demostración borrados de este navegador.',
          'exito'
        );
      });
    }
  }

  /* ---------- Navegacion lateral activa ---------- */

  function conectarNavegacionLateral() {
    const enlaces = qsa('.sidebar-nav a[href^="#"]');
    if (!enlaces.length) return;

    function activar(id) {
      enlaces.forEach((enlace) => {
        const activo = enlace.getAttribute('href') === `#${id}`;
        enlace.classList.toggle('activo', activo);
        if (activo) {
          enlace.setAttribute('aria-current', 'true');
        } else {
          enlace.removeAttribute('aria-current');
        }
      });
    }

    enlaces.forEach((enlace) => {
      enlace.addEventListener('click', () => {
        activar(enlace.getAttribute('href').slice(1));
      });
    });

    if (!('IntersectionObserver' in window)) return;

    const secciones = enlaces
      .map((enlace) => document.getElementById(enlace.getAttribute('href').slice(1)))
      .filter(Boolean);

    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) activar(visible.target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.4] }
    );

    secciones.forEach((seccion) => observador.observe(seccion));
  }

  /* ---------- Inicio ---------- */

  actualizarVista();
  conectarBotones();
  conectarNavegacionLateral();
  verificarSesion();

  window.addEventListener('pageshow', (evento) => {
    if (evento.persisted) verificarSesion();
  });
})();
