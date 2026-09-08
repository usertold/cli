import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCliApiPath } from './api-routes';

test('buildCliApiPath resolves parameters and omits empty query values', () => {
  assert.equal(
    buildCliApiPath(
      'sessionGet',
      { orgHandle: 'acme corp', projectHandle: 'checkout', sessionId: 'int/1' },
      { include: 'events', empty: '', missing: undefined },
    ),
    '/api/orgs/acme%20corp/projects/checkout/sessions/int%2F1?include=events',
  );
  assert.throws(
    () => buildCliApiPath('sessionGet', { orgHandle: 'acme', projectHandle: 'checkout' }),
    /Missing path param sessionId/,
  );
});
