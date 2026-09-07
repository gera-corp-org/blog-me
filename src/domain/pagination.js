export function paginate({ total, perPage, requested }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const parsed = Number.parseInt(requested ?? '', 10);
  const page = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 1, 1), pages);

  return { page, pages, limit: perPage, offset: (page - 1) * perPage };
}
