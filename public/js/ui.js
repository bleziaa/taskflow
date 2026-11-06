/* ============================================================
   TaskFlow - Utilidades compartidas de interfaz (Fase 1)
   ------------------------------------------------------------
   Menu movil accesible, modal reutilizable, mensajes de formulario
   y utilidades de DOM seguro. No se usa innerHTML con datos del
   usuario: todo el contenido dinamico se crea con textContent.
   ============================================================ */
(function () {
  'use strict';

  const TaskFlow = (window.TaskFlow = window.TaskFlow || {});

  /* ---------- Utilidades de DOM ---------- */

  function qs(selector, contexto = document) {
    return contexto.querySelector(selector);
  }

  function qsa(selector, contexto = document) {
    return Array.from(contexto.querySelectorAll(selector));
  }

  /**
   * Crea un elemento de forma segura.
   * @param {string} etiqueta Nombre de la etiqueta HTML.
   * @param {{className?: string, text?: string, attrs?: Object, children?: Array}} opciones
   */
  function crear(etiqueta, { className, text, attrs, children } = {}) {
    const elemento = document.createElement(etiqueta);

    if (className) elemento.className = className;
    if (text !== undefined && text !== null) elemento.textContent = String(text);

    if (attrs) {
      Object.entries(attrs).forEach(([nombre, valor]) => {
        if (valor === undefined || valor === null || valor === false) return;
        elemento.setAttribute(nombre, valor === true ? '' : String(valor));
      });
    }

    if (children) {
      children.forEach((hijo) => {
        if (hijo) elemento.appendChild(hijo);
      });
    }

    return elemento;
  }

  /* ---------- Almacenamiento local (solo demo de Fase 1) ---------- */

  function leerStorage(clave) {
    try {
      const valor = JSON.parse(localStorage.getItem(clave));
      return Array.isArray(valor) ? valor : [];
    } catch (error) {
      console.warn(`No se pudo leer "${clave}" de localStorage:`, error);
      return [];
    }
  }

  function guardarStorage(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (error) {
      console.warn(`No se pudo guardar "${clave}" en localStorage:`, error);
      return false;
    }
  }

  /* ---------- Mensajes de formulario ---------- */

  function mostrarMensaje(elemento, texto, tipo = 'info') {
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.classList.remove('exito', 'error', 'info');
    elemento.classList.add(tipo, 'mostrar');
  }

  function ocultarMensaje(elemento) {
    if (!elemento) return;
    elemento.textContent = '';
    elemento.classList.remove('mostrar', 'exito', 'error', 'info');
  }

  /* ---------- Validaciones basicas ---------- */

  const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validarEmail(valor) {
    return REGEX_EMAIL.test(String(valor || '').trim());
  }

  /**
   * Formatea una fecha YYYY-MM-DD sin desfase de zona horaria.
   * @param {string} valor
   * @returns {string}
   */
  function formatearFecha(valor) {
    if (!valor) return 'Sin fecha';

    const partes = String(valor).split('-');
    if (partes.length === 3) {
      const [anio, mes, dia] = partes;
      if (anio && mes && dia) return `${dia}/${mes}/${anio}`;
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
    return fecha.toLocaleDateString('es-CO');
  }

  /* ---------- Menu de navegacion movil ---------- */

  function inicializarMenu() {
    const boton = qs('.nav-toggle');
    const menu = qs('.nav-main');
    if (!boton || !menu) return;

    function cerrar() {
      menu.classList.remove('abierto');
      boton.setAttribute('aria-expanded', 'false');
      boton.setAttribute('aria-label', 'Abrir menú de navegación');
    }

    function abrir() {
      menu.classList.add('abierto');
      boton.setAttribute('aria-expanded', 'true');
      boton.setAttribute('aria-label', 'Cerrar menú de navegación');
    }

    boton.addEventListener('click', () => {
      if (boton.getAttribute('aria-expanded') === 'true') {
        cerrar();
      } else {
        abrir();
      }
    });

    qsa('a', menu).forEach((enlace) => {
      enlace.addEventListener('click', cerrar);
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && menu.classList.contains('abierto')) {
        cerrar();
        boton.focus();
      }
    });

    const escritorio = window.matchMedia('(min-width: 861px)');
    if (escritorio.addEventListener) {
      escritorio.addEventListener('change', (evento) => {
        if (evento.matches) cerrar();
      });
    }
  }

  /* ---------- Botones para mostrar u ocultar contrasena ---------- */

  function inicializarVerPassword() {
    qsa('[data-ver-password]').forEach((boton) => {
      const input = document.getElementById(boton.dataset.verPassword);
      if (!input) return;

      boton.addEventListener('click', () => {
        const oculta = input.type === 'password';
        input.type = oculta ? 'text' : 'password';
        boton.textContent = oculta ? 'Ocultar' : 'Ver';
        boton.setAttribute('aria-pressed', String(oculta));
        boton.setAttribute(
          'aria-label',
          oculta ? 'Ocultar contraseña' : 'Mostrar contraseña'
        );
      });
    });
  }

  /* ---------- Modal reutilizable y accesible ---------- */

  const modal = {
    overlay: null,
    contenido: null,
    botonCerrar: null,
    disparador: null,
  };

  function elementosEnfocables() {
    if (!modal.overlay) return [];
    return qsa(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      modal.overlay
    ).filter((elemento) => !elemento.disabled && elemento.offsetParent !== null);
  }

  function abrirModal(nodo, disparador) {
    if (!modal.overlay || !modal.contenido) return;

    modal.disparador = disparador || document.activeElement;
    modal.contenido.replaceChildren(nodo || document.createTextNode(''));

    modal.overlay.classList.add('activo');
    modal.overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const primerCampo = qs('input, select, textarea', modal.contenido);
    const destino = primerCampo || modal.botonCerrar;
    if (destino) destino.focus();
  }

  function cerrarModal() {
    if (!modal.overlay) return;

    modal.overlay.classList.remove('activo');
    modal.overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (modal.disparador && typeof modal.disparador.focus === 'function') {
      modal.disparador.focus();
    }
    modal.disparador = null;
  }

  function atraparFoco(evento) {
    const enfocables = elementosEnfocables();
    if (!enfocables.length) return;

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  function inicializarModal() {
    modal.overlay = document.getElementById('overlay');
    modal.contenido = document.getElementById('modal-contenido');
    modal.botonCerrar = document.getElementById('modal-cerrar-boton');

    if (!modal.overlay || !modal.contenido || !modal.botonCerrar) return;

    modal.overlay.setAttribute('aria-hidden', 'true');
    modal.botonCerrar.addEventListener('click', cerrarModal);

    modal.overlay.addEventListener('click', (evento) => {
      if (evento.target === modal.overlay) cerrarModal();
    });

    document.addEventListener('keydown', (evento) => {
      if (!modal.overlay.classList.contains('activo')) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrarModal();
      }
      if (evento.key === 'Tab') atraparFoco(evento);
    });
  }

  function inicializar() {
    inicializarMenu();
    inicializarVerPassword();
    inicializarModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

  TaskFlow.qs = qs;
  TaskFlow.qsa = qsa;
  TaskFlow.crear = crear;
  TaskFlow.leerStorage = leerStorage;
  TaskFlow.guardarStorage = guardarStorage;
  TaskFlow.mostrarMensaje = mostrarMensaje;
  TaskFlow.ocultarMensaje = ocultarMensaje;
  TaskFlow.validarEmail = validarEmail;
  TaskFlow.formatearFecha = formatearFecha;
  TaskFlow.abrirModal = abrirModal;
  TaskFlow.cerrarModal = cerrarModal;
})();
