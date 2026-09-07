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
