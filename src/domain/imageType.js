const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TYPES = [
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    matches: (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    ext: 'png',
    mime: 'image/png',
    matches: (buffer) => buffer.length > 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE),
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    matches: (buffer) => buffer.length > 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('latin1')),
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    matches: (buffer) =>
      buffer.length > 12 &&
      buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buffer.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export function detectImageType(buffer) {
  const found = TYPES.find((type) => type.matches(buffer));
  return found ? { ext: found.ext, mime: found.mime } : null;
}
