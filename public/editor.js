const form = document.querySelector('[data-editor]');
const preview = document.querySelector('[data-preview]');

/* ── Markdown toolbar ──────────────────────────────────────────── */

const TOOLBAR = [
  { label: 'B',   title: 'Жирный (Ctrl+B)',   wrap: ['**', '**'] },
  { label: 'I',   title: 'Курсив (Ctrl+I)',   wrap: ['*', '*'] },
  { label: 'H2',  title: 'Заголовок',         prefix: '## ' },
  { label: 'H3',  title: 'Подзаголовок',      prefix: '### ' },
  { label: '🔗',  title: 'Ссылка',            wrap: ['[', '](url)'] },
  { label: '</>',  title: 'Код',              wrap: ['`', '`'] },
  { label: '❝',   title: 'Цитата',            prefix: '> ' },
  { label: '•',   title: 'Список',            prefix: '- ' },
  { label: '1.',  title: 'Нумерованный',       prefix: '1. ' },
];

function insertMarkdown(textarea, action) {
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const sel   = textarea.value.slice(start, end);

  let before, after, cursor;

  if (action.wrap) {
    [before, after] = action.wrap;
    if (sel) {
      textarea.value =
        textarea.value.slice(0, start) + before + sel + after + textarea.value.slice(end);
      cursor = start + before.length + sel.length + after.length;
    } else {
      const placeholder = 'текст';
      textarea.value =
        textarea.value.slice(0, start) + before + placeholder + after + textarea.value.slice(end);
      cursor = start + before.length;
      textarea.setSelectionRange(cursor, cursor + placeholder.length);
    }
  } else {
    // prefix (heading, list, quote)
    before = action.prefix;
    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    if (sel.includes('\n')) {
      // multiple lines: prefix each
      const lines = sel.split('\n').map(l => before + l);
      textarea.value =
        textarea.value.slice(0, start) + lines.join('\n') + textarea.value.slice(end);
      cursor = start + lines.join('\n').length;
    } else {
      textarea.value =
        textarea.value.slice(0, lineStart) + before + textarea.value.slice(lineStart);
      cursor = start + before.length;
    }
  }

  textarea.focus();
  if (!action.wrap || sel) textarea.setSelectionRange(cursor, cursor);
  textarea.dispatchEvent(new Event('input'));
}

function buildToolbar(textarea) {
  const bar = document.createElement('div');
  bar.className = 'md-toolbar';
  for (const item of TOOLBAR) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.label;
    btn.title = item.title;
    btn.className = 'md-toolbar-btn';
    btn.addEventListener('click', () => insertMarkdown(textarea, item));
    bar.appendChild(btn);
  }
  textarea.parentNode.insertBefore(bar, textarea);
}

/* ── Keyboard shortcuts on textarea ────────────────────────────── */

function handleShortcut(e, textarea) {
  if (!e.ctrlKey && !e.metaKey) return;
  const map = { b: TOOLBAR[0], i: TOOLBAR[1], k: TOOLBAR[4] };
  const action = map[e.key.toLowerCase()];
  if (!action) return;
  e.preventDefault();
  insertMarkdown(textarea, action);
}

/* ── Init ──────────────────────────────────────────────────────── */

if (form && preview) {
  const body  = form.querySelector('[name="body"]');
  const token = form.querySelector('[name="_csrf"]').value;

  buildToolbar(body);
  body.addEventListener('keydown', e => handleShortcut(e, body));

  let timer = null;
  const update = async () => {
    const response = await fetch('/admin/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({ body: body.value }),
    });
    if (!response.ok) return;
    const data = await response.json();
    preview.innerHTML = data.html;
  };

  body.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(update, 400);
  });

  update();
}

/* ── Image upload ──────────────────────────────────────────────── */

const uploadInput = document.querySelector('[data-upload]');

if (form && uploadInput) {
  const body  = form.querySelector('[name="body"]');
  const token = form.querySelector('[name="_csrf"]').value;

  uploadInput.addEventListener('change', async () => {
    const [file] = uploadInput.files;
    if (!file) return;

    const data = new FormData();
    data.append('file', file);

    const response = await fetch('/admin/upload', {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      body: data,
    });

    if (!response.ok) {
      const problem = await response.json().catch(() => ({ error: 'Не удалось загрузить' }));
      window.alert(problem.error);
      return;
    }

    const { markdown } = await response.json();
    const at = body.selectionStart ?? body.value.length;
    body.value = `${body.value.slice(0, at)}\n\n${markdown}\n\n${body.value.slice(at)}`;
    body.dispatchEvent(new Event('input'));
    uploadInput.value = '';
  });
}
