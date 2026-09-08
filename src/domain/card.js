const IMAGE_SOURCE = /<img[^>]+src="([^"]+)"/i;
const TONES = 8;

// Обложку берём из самой записи: первая картинка текста и есть её лицо.
// Отдельного поля обложки нет намеренно — иначе его пришлось бы заполнять
// руками для каждой записи.
export function coverImage(html) {
  const found = IMAGE_SOURCE.exec(String(html ?? ''));
  return found ? found[1] : null;
}

// Цвет заглушки выводим из адреса записи, а не выбираем случайно: у одной
// записи плашка всегда одного цвета, иначе лента мигала бы при каждой
// перезагрузке. Возвращаем номер, а не цвет: политика безопасности
// запрещает встроенные стили, поэтому цвета живут в таблице стилей.
export function placeholderTone(slug) {
  let hash = 0;
  for (const character of String(slug ?? '')) {
    hash = (hash * 31 + character.codePointAt(0)) % 1000003;
  }
  return hash % TONES;
}

export function toCard(post, tags = []) {
  return {
    ...post,
    tags,
    cover: coverImage(post.body_html),
    tone: placeholderTone(post.slug),
    letter: String(post.title ?? '').trim().charAt(0).toUpperCase(),
  };
}
