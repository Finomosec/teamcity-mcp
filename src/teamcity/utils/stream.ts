import { Readable } from 'stream';

/**
 * Detect an (unconsumed) Node readable stream, e.g. an Axios response body
 * obtained with `responseType: 'stream'`. Such a value is a socket with
 * circular references and must never be stored as error details or serialized.
 */
export const isReadableStream = (value: unknown): value is NodeJS.ReadableStream =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { pipe?: unknown }).pipe === 'function' &&
  typeof (value as { on?: unknown }).on === 'function';

export const discardStreamBody = (value: unknown): void => {
  if (isReadableStream(value)) {
    // Without a listener, an error while draining would be unhandled and crash the process.
    value.on('error', () => undefined);
    value.resume();
  }
};

async function* sliceLines(
  source: NodeJS.ReadableStream,
  startLine: number,
  endLine: number | undefined
): AsyncGenerator<Buffer> {
  if (endLine !== undefined && endLine <= startLine) {
    return;
  }
  let line = 0;
  for await (const raw of source) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
    let pos = 0;
    while (pos < chunk.length) {
      const newline = chunk.indexOf(0x0a, pos);
      const stop = newline === -1 ? chunk.length : newline + 1;
      if (line >= startLine) {
        yield chunk.subarray(pos, stop);
      }
      if (newline === -1) {
        break;
      }
      line += 1;
      pos = stop;
      if (endLine !== undefined && line >= endLine) {
        return;
      }
    }
  }
}

/**
 * Restrict a line-oriented byte stream to `lineCount` lines from the zero-based
 * `startLine`. Leaving the range early destroys the source, aborting the download.
 */
export const sliceStreamLines = (
  source: NodeJS.ReadableStream,
  startLine: number,
  lineCount?: number
): Readable =>
  Readable.from(
    sliceLines(source, startLine, lineCount === undefined ? undefined : startLine + lineCount),
    { objectMode: false }
  );
