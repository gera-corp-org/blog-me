// Подтверждение удаления живёт здесь, а не в атрибуте формы: политика
// безопасности запрещает встроенные обработчики, и в атрибуте оно молча
// не срабатывало — запись удалялась без вопроса.
for (const form of document.querySelectorAll('[data-confirm]')) {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
}
