import { Readable } from 'stream';

import { discardStreamBody, isReadableStream } from '@/teamcity/utils/stream';

describe('stream utils', () => {
  it('detects readable streams', () => {
    expect(isReadableStream(Readable.from(['a']))).toBe(true);
    expect(isReadableStream({ message: 'not a stream' })).toBe(false);
    expect(isReadableStream(null)).toBe(false);
  });

  it('drains a readable stream body', async () => {
    const body = Readable.from(['chunk-1', 'chunk-2']);
    const ended = new Promise<void>((resolve) => body.once('end', resolve));

    discardStreamBody(body);

    await expect(ended).resolves.toBeUndefined();
  });

  it('ignores non-stream bodies', () => {
    expect(() => discardStreamBody({ message: 'plain' })).not.toThrow();
    expect(() => discardStreamBody(undefined)).not.toThrow();
  });
});
