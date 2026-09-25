import { inspect } from 'util';
import type { Logger } from 'winston';

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

  it('falls back when a custom inspect hook throws', () => {
    const hostile = {
      [inspect.custom]: () => {
        throw new Error('boom');
      },
    };

    expect(safeStringify(hostile)).toBe('[Uninspectable value]');
  });

  it('formats circular metadata through the console transport', () => {
    const logger = createLogger({ enableConsole: true, enableFile: false, level: 'info' });
    const [consoleTransport] = (logger as unknown as { winston: Logger }).winston.transports;
    const info = {
      level: 'info',
      message: 'streaming response completed',
      service: 'teamcity-mcp',
      socket: createCircular(),
      [Symbol.for('level')]: 'info',
    };

    expect(() =>
      logger.info('streaming response completed', { socket: createCircular() })
    ).not.toThrow();
    const formatted = consoleTransport?.format?.transform(info) as
      | Record<symbol, unknown>
      | false
      | undefined;
    const output =
      formatted !== false && formatted !== undefined
        ? String(formatted[Symbol.for('message')])
        : '';

    expect(output).toContain('streaming response completed');
    expect(output).toContain('[Circular *1]');
  });
});
