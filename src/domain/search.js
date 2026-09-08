const MAX_TERMS = 8;

export function toMatchQuery(input) {
  const terms = String(input ?? '').toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  return terms.slice(0, MAX_TERMS).map((term) => `"${term}"*`).join(' ');
}
