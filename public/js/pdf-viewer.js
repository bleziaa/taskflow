import { getDocument, GlobalWorkerOptions } from '/vendor/pdfjs/pdf.mjs';
GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
const status = document.getElementById('status');
const canvas = document.getElementById('document');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
let pdf, pageNumber = 1, rendering = false;
async function render() {
  if (rendering) return;
  rendering = true; previous.disabled = next.disabled = true;
  try {
    const page = await pdf.getPage(pageNumber);
    const original = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, Math.max(0.25, (document.documentElement.clientWidth - 40) / original.width));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    document.getElementById('page-number').textContent = `Página ${pageNumber} de ${pdf.numPages}`;
    canvas.setAttribute('aria-label', `Página ${pageNumber} de ${pdf.numPages} del documento PDF`);
    status.textContent = 'Documento listo para leer.';
  } catch { status.textContent = 'No se pudo mostrar esta página. Puedes descargar el documento.'; }
  finally { rendering = false; previous.disabled = pageNumber === 1; next.disabled = pageNumber === pdf.numPages; }
}
previous.addEventListener('click', () => { if (!rendering && pageNumber > 1) { pageNumber--; render(); } });
next.addEventListener('click', () => { if (!rendering && pageNumber < pdf.numPages) { pageNumber++; render(); } });
try {
  const file = new URL(new URLSearchParams(location.search).get('file') || '', location.origin);
  if (file.origin !== location.origin || !/^\/api\/organization\/.+\/download$/.test(file.pathname)) throw new Error('invalid');
  const courseId = file.pathname.match(/^\/api\/organization\/courses\/([a-f0-9]{24})\//)?.[1];
  if (courseId) { const back = document.getElementById('back'); back.href = '/courses.html?course=' + courseId; back.textContent = '← Volver al curso'; }
  const download = document.getElementById('download'); download.href = file.pathname; download.hidden = false;
  file.search = '?view=1';
  pdf = await getDocument({url:file.href,isEvalSupported:false,standardFontDataUrl:'/vendor/pdfjs-fonts/'}).promise;
  document.getElementById('pagination').hidden = false;
  await render();
} catch { status.textContent = 'No se pudo abrir el PDF. Comprueba tu sesión y tus permisos sobre este documento.'; }
