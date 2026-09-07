const formatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(iso) {
  return iso ? formatter.format(new Date(iso)) : '';
}
