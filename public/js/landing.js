/* ============================================================
   TaskFlow - Logica de la pagina de inicio (Fase 1)
   ------------------------------------------------------------
   Animacion de tarjetas al hacer scroll y estadisticas calculadas
   a partir de los datos de demostracion guardados en este
   navegador. Estos numeros NO vienen de MongoDB: son locales.
   ============================================================ */
(function () {
  'use strict';

  const { qs, qsa, leerStorage } = window.TaskFlow;
  const CLAVE_TAREAS = 'taskflow-tareas';
  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Aparicion progresiva de tarjetas ---------- */
  function animarTarjetas() {
    const grid = qs('.tarjetas-grid');
    if (!grid) return;

    if (!('IntersectionObserver' in window) || movimientoReducido) {
      qsa('.tarjeta', grid).forEach((tarjeta) => tarjeta.classList.add('visible'));
      return;
    }

    grid.classList.add('revelar');

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('visible');
            observador.unobserve(entrada.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    qsa('.tarjeta', grid).forEach((tarjeta) => observador.observe(tarjeta));
  }

  /* ---------- Aparicion progresiva de la seccion Como funciona ---------- */
  function animarPasos() {
    const seccion = qs('#como-funciona');
    if (!seccion) return;

    const elementos = [seccion.querySelector('.seccion-encabezado'), ...qsa('.paso', seccion)].filter(Boolean);
    if (!('IntersectionObserver' in window) || movimientoReducido) {
      elementos.forEach((elemento) => elemento.classList.add('paso-visible'));
      return;
    }

    seccion.classList.add('pasos-animados');
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add('paso-visible');
        observador.unobserve(entrada.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -35px 0px' });

    elementos.forEach((elemento) => observador.observe(elemento));
  }

  /* ---------- Estadisticas locales de demostracion ---------- */
  function calcularEstadisticas() {
    const tareas = leerStorage(CLAVE_TAREAS);

    const completadas = tareas.filter((tarea) => tarea && tarea.estado === 'completada').length;
    const proyectos = new Set(
      tareas.map((tarea) => (tarea && tarea.proyecto ? String(tarea.proyecto).trim() : '')).filter(Boolean)
    ).size;
    const porcentaje = tareas.length ? Math.round((completadas / tareas.length) * 100) : 0;

    return [
      { valor: completadas, sufijo: '' },
      { valor: proyectos, sufijo: '' },
      { valor: porcentaje, sufijo: '%' },
    ];
  }

  function pintarNumero(elemento, valor, sufijo) {
    elemento.textContent = `${valor}${sufijo}`;
  }

  function animarNumero(elemento, valor, sufijo) {
    if (movimientoReducido || valor <= 0) {
      pintarNumero(elemento, valor, sufijo);
      return;
    }

    const duracion = 700;
    const inicio = performance.now();

    function paso(ahora) {
      const progreso = Math.min((ahora - inicio) / duracion, 1);
      const actual = Math.round(valor * progreso);
      pintarNumero(elemento, actual, sufijo);
      if (progreso < 1) requestAnimationFrame(paso);
    }

    requestAnimationFrame(paso);
  }

  function inicializarEstadisticas() {
    const seccion = qs('#estadisticas');
    if (!seccion) return;

    const numeros = qsa('.numero', seccion);
    if (!numeros.length) return;

    const datos = calcularEstadisticas();

    numeros.forEach((numero, indice) => {
      const dato = datos[indice];
      if (!dato) return;
      numero.setAttribute('data-objetivo', String(dato.valor));
      numero.setAttribute('data-sufijo', dato.sufijo);
    });

    function ejecutar() {
      numeros.forEach((numero, indice) => {
        const dato = datos[indice];
        if (!dato) return;
        animarNumero(numero, dato.valor, dato.sufijo);
      });
    }

    if (!('IntersectionObserver' in window)) {
      ejecutar();
      return;
    }

    let yaAnimado = false;
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting && !yaAnimado) {
            yaAnimado = true;
            ejecutar();
            observador.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );

    observador.observe(seccion);
  }

  animarTarjetas();
  animarPasos();
  inicializarEstadisticas();
})();
