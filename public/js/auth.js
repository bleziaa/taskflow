(function () {
  'use strict';

  const { qs, qsa, mostrarMensaje, ocultarMensaje, validarEmail } = window.TaskFlow;

  const CSRF_URL = '/api/auth/csrf-token';
  const MENSAJE_CONEXION =
    'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  const MENSAJE_GENERICO = 'No se pudo completar la solicitud. Inténtalo de nuevo.';

  const MENSAJES_ERROR = {
    INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
    EMAIL_IN_USE: 'Ya existe una cuenta con ese correo electrónico.',
    CSRF_INVALID: 'La sesión del formulario expiró. Recarga la página e inténtalo de nuevo.',
    RATE_LIMITED: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    VALIDATION_ERROR: 'Revisa los campos marcados e inténtalo de nuevo.',
    UNAUTHORIZED: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  };

  function mensajeDeError(input, form) {
    const valor = input.type === 'checkbox' ? input.checked : input.value.trim();

    if (input.required) {
      if (input.type === 'checkbox' && !input.checked) {
        return 'Debes aceptar esta opción para continuar.';
      }
      if (input.type !== 'checkbox' && !valor) {
        return 'Este campo es obligatorio.';
      }
    }

    if (input.type === 'email' && valor && !validarEmail(valor)) {
      return 'Escribe un correo electrónico válido.';
    }

    const minimo = Number(input.getAttribute('minlength'));
    if (minimo && String(valor).length < minimo) {
      return `Debe tener al menos ${minimo} caracteres.`;
    }

    const igualA = input.dataset.igualA;
    if (igualA) {
      const original = form.elements.namedItem(igualA);
      if (original && input.value !== original.value) {
        return 'Las contraseñas no coinciden.';
      }
    }

    return '';
  }

  function mostrarError(input, texto) {
    if (!input || typeof input.closest !== 'function') return;

    input.setAttribute('aria-invalid', 'true');
    const contenedor = input.closest('.campo');
    if (contenedor) contenedor.classList.add('campo-error');

    const error = document.querySelector(`[data-error-for="${input.name}"]`);
    if (error) error.textContent = texto;
  }

  function limpiarError(input) {
    if (!input || typeof input.closest !== 'function') return;

    input.removeAttribute('aria-invalid');
    const contenedor = input.closest('.campo');
    if (contenedor) contenedor.classList.remove('campo-error');

    const error = document.querySelector(`[data-error-for="${input.name}"]`);
    if (error) error.textContent = '';
  }

  function aplicarErroresDeCampo(details, form) {
    if (!Array.isArray(details)) return;

    details.forEach((detalle) => {
      if (!detalle || !detalle.campo) return;

      const input = form.elements.namedItem(detalle.campo);
      if (input && typeof input.setAttribute === 'function') {
        mostrarError(input, detalle.mensaje || 'Valor no válido.');
      }
    });
  }

  function mensajeDeRespuesta(datos, status) {
    const error = datos && datos.error;

    if (error && MENSAJES_ERROR[error.code]) return MENSAJES_ERROR[error.code];
    if (status === 429) return MENSAJES_ERROR.RATE_LIMITED;
    if (error && typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }

    return MENSAJE_GENERICO;
  }

  async function obtenerCsrfToken() {
    const respuesta = await fetch(CSRF_URL, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!respuesta.ok) throw new Error('csrf');

    const datos = await respuesta.json();
    const token = datos && datos.data && datos.data.csrfToken;
    if (!token) throw new Error('csrf');

    return token;
  }

  async function enviarFormulario(endpoint, payload, csrfToken) {
    const respuesta = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(payload),
    });

    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (error) {
      datos = null;
    }

    return { respuesta, datos };
  }

  function construirPayload(form) {
    const datos = new FormData(form);
    const payload = {
      email: String(datos.get('email') || '').trim(),
      password: String(datos.get('password') || ''),
    };

    if (form.id === 'form-registro') {
      payload.nombre = String(datos.get('nombre') || '').trim();
    }

    return payload;
  }

  function mensajeDeExito(form) {
    return form.id === 'form-registro'
      ? 'Cuenta creada correctamente. Abriendo tu panel…'
      : 'Sesión iniciada correctamente. Abriendo tu panel…';
  }

  function inicializarFormulario(form) {
    const campos = qsa('input, select, textarea', form);
    const mensajeGlobal = qs('.form-mensaje', form);
    const boton = qs('button[type="submit"]', form);
    const textoBoton = boton ? boton.textContent : '';
    const endpoint = form.dataset.endpoint;

    if (!endpoint) return;

    campos.forEach((campo) => {
      const evento =
        campo.type === 'checkbox' || campo.tagName === 'SELECT' ? 'change' : 'input';
      campo.addEventListener(evento, () => {
        limpiarError(campo);
        ocultarMensaje(mensajeGlobal);
      });
    });

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      if (form.dataset.enviando === 'true') return;

      let primerInvalido = null;

      campos.forEach((campo) => {
        limpiarError(campo);
        const error = mensajeDeError(campo, form);
        if (error) {
          mostrarError(campo, error);
          if (!primerInvalido) primerInvalido = campo;
        }
      });

      if (primerInvalido) {
        primerInvalido.focus();
        mostrarMensaje(mensajeGlobal, 'Revisa los campos marcados antes de continuar.', 'error');
        return;
      }

      form.dataset.enviando = 'true';
      form.setAttribute('aria-busy', 'true');
      if (boton) {
        boton.disabled = true;
        boton.textContent = 'Procesando…';
      }
      ocultarMensaje(mensajeGlobal);

      try {
        const token = await obtenerCsrfToken();
        const { respuesta, datos } = await enviarFormulario(
          endpoint,
          construirPayload(form),
          token
        );

        if (respuesta.ok) {
          mostrarMensaje(mensajeGlobal, mensajeDeExito(form), 'exito');

          // La consola general y el espacio de trabajo no comparten tablero.
          // El rol viene de la sesión del servidor, no del formulario.
          const usuario = datos && datos.data && datos.data.usuario;
          const destino = usuario && usuario.debeCambiarPassword
            ? '/cambiar-password.html'
            : usuario && usuario.role === 'administrador' ? '/admin.html' : '/dashboard.html';

          window.location.assign(destino);
          return;
        }

        aplicarErroresDeCampo(datos && datos.error && datos.error.details, form);
        mostrarMensaje(mensajeGlobal, mensajeDeRespuesta(datos, respuesta.status), 'error');
      } catch (error) {
        mostrarMensaje(mensajeGlobal, MENSAJE_CONEXION, 'error');
      } finally {
        form.dataset.enviando = 'false';
        form.removeAttribute('aria-busy');
        if (boton) {
          boton.disabled = false;
          boton.textContent = textoBoton;
        }
      }
    });
  }

  qsa('form[data-endpoint]').forEach(inicializarFormulario);
})();
