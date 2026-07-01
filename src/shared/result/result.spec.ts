import { describe, it, expect } from '@jest/globals';

import { err, isErr, isOk, mapResult, ok, unwrap } from './result.js';

describe('Result', () => {
  it('ok carries a value', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(r.value).toBe(42);
  });

  it('err carries an error', () => {
    const r = err(new Error('boom'));
    expect(isErr(r)).toBe(true);
    expect(r.error.message).toBe('boom');
  });

  it('unwrap returns value or throws', () => {
    expect(unwrap(ok('x'))).toBe('x');
    expect(() => unwrap(err('nope'))).toThrow('nope');
  });

  it('mapResult transforms ok values and passes through errors', () => {
    expect(mapResult(ok(2), (n) => n * 2)).toEqual(ok(4));
    const e = err('fail');
    expect(mapResult(e, (n: number) => n * 2)).toBe(e);
  });
});
