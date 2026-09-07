const form = document.querySelector('[data-editor]');
const preview = document.querySelector('[data-preview]');

if (form && preview) {
  const body = form.querySelector('[name="body"]');
  const token = form.querySelector('[name="_csrf"]').value;
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

const uploadInput = document.querySelector('[data-upload]');

if (form && uploadInput) {
  const body = form.querySelector('[name="body"]');
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
