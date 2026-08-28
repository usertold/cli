import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectApiPath,
  buildProjectApiPathFromRef,
  parseProjectRef,
  requireCanonicalProjectRef,
} from './project-ref';
import { CliError, EXIT_ARGS } from './errors';

test('parseProjectRef parses canonical org/project refs', () => {
  const parsed = parseProjectRef('acme/checkout');

  assert.equal(parsed.kind, 'canonical');
  if (parsed.kind === 'canonical') {
    assert.deepEqual(parsed.value, { orgHandle: 'acme', projectHandle: 'checkout' });
  }
});

test('requireCanonicalProjectRef rejects prj_* with actionable error', () => {
  assert.throws(
    () => requireCanonicalProjectRef('prj_123', '<projectRef>'),
    (error: unknown) => {
      assert.ok(error instanceof CliError);
      assert.equal(error.exitCode, EXIT_ARGS);
      assert.match(error.message, /requires canonical project refs/i);
      assert.match(error.message, /org\/project/i);
      return true;
    },
  );
});

test('parseProjectRef rejects invalid formats', () => {
  assert.throws(
    () => parseProjectRef('acme-only'),
    (error: unknown) => {
      assert.ok(error instanceof CliError);
      assert.equal(error.exitCode, EXIT_ARGS);
      assert.match(error.message, /expected format: org\/project/i);
      return true;
    },
  );
});

test('buildProjectApiPath and buildProjectApiPathFromRef build canonical routes', () => {
  assert.equal(
    buildProjectApiPath({ orgHandle: 'acme', projectHandle: 'checkout' }),
    '/api/orgs/acme/projects/checkout',
  );

  assert.equal(
    buildProjectApiPath({ orgHandle: 'acme', projectHandle: 'checkout' }, '/tasks'),
    '/api/orgs/acme/projects/checkout/tasks',
  );

  assert.equal(
    buildProjectApiPathFromRef('acme/checkout', '/tasks/tsk_1', '<projectRef>'),
    '/api/orgs/acme/projects/checkout/tasks/tsk_1',
  );
});
