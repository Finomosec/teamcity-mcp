import { createLogger, safeStringify } from './index';

/**
 * Regression test: log metadata can contain values with circular references
 * (e.g. an Axios streaming response whose body is a Node socket with
 * `_httpMessage -> ClientRequest -> Agent` back-references). The dev formatter
 * must never throw while serializing such metadata, because logging runs
 * synchronously inside Axios interceptors and a throw would abort the request.
 */
describe('TeamCityLogger circular-safe metadata', () => {
  const createCircular = (): Record<string, unknown> => {
    const circular: Record<string, unknown> = { host: 'ci.example.com' };
    circular['self'] = circular;
    return circular;
  };

  it('serializes circular metadata without throwing', () => {
    const output = safeStringify({ socket: createCircular() });

    expect(output).toContain('ci.example.com');
    expect(output).toContain('[Circular *1]');
  });

  it('bounds long strings in metadata', () => {
    const output = safeStringify({ body: 'x'.repeat(5000) });

    expect(output.length).toBeLessThan(1200);
    expect(output).toContain('more characters');
  });

  it('does not throw when logging circular metadata', () => {
    const logger = createLogger({ enableConsole: false, enableFile: false, level: 'info' });

    expect(() =>
      logger.info('streaming response completed', { socket: createCircular() })
    ).not.toThrow();
  });
});
