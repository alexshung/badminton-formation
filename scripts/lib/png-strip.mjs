// PNG post-processing for deterministic exports: keep only the chunks needed
// to decode the image (IHDR, PLTE, tRNS, IDAT, IEND) and drop every other
// ancillary chunk — tEXt/zTXt/iTXt text, tIME timestamps, eXIf, pHYs, colour
// metadata — so files carry no metadata and identical pixels give identical
// bytes. Chunks are copied verbatim (their CRCs stay valid).

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);

export function stripPngMetadata(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('not a PNG file');
  }
  const parts = [SIGNATURE];
  const removed = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const end = off + 12 + len;
    if (end > buf.length) throw new Error('truncated PNG chunk ' + type);
    if (KEEP.has(type)) parts.push(buf.subarray(off, end));
    else removed.push(type);
    off = end;
    if (type === 'IEND') break;
  }
  return { png: Buffer.concat(parts), removed };
}
