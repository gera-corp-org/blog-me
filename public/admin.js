// Delete confirmation lives here, not in a form attribute: the security
// policy forbids inline handlers, and in the attribute it silently
// failed to work — the record was deleted without asking.
for (const form of document.querySelectorAll('[data-confirm]')) {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
}
