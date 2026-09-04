import test from 'node:test';
import assert from 'node:assert/strict';
import { isJsonOutput, printOutput, printTable, printObject } from './output';
import type { ParsedArgs } from './types';

function parsed(options: Record<string, string> = {}, positionals: string[] = []): ParsedArgs {
  return { raw: [], options, multiOptions: {}, positionals };
}

function withPatchedTTY(value: boolean, fn: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value });
  try {
    fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(process.stdout, 'isTTY', descriptor);
    }
  }
}

function captureLogs(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(' '));
  };

  try {
    fn();
    return lines;
  } finally {
    console.log = original;
  }
}

test('isJsonOutput respects --json, --format json, and non-tty fallback', () => {
  assert.equal(isJsonOutput(parsed({ json: 'true' })), true);
  assert.equal(isJsonOutput(parsed({ format: 'json' })), true);

  withPatchedTTY(false, () => {
    assert.equal(isJsonOutput(parsed()), true);
  });

  withPatchedTTY(true, () => {
    assert.equal(isJsonOutput(parsed()), false);
  });
});

test('printOutput renders json/table/object/scalar/empty branches', () => {
  withPatchedTTY(true, () => {
    const objectLines = captureLogs(() => {
      printOutput({ id: 'p1', count: 3, nested: { a: 1 }, items: [1, 2] }, parsed());
    });
    assert.ok(objectLines.some((l) => l.includes('items:')));
    assert.ok(objectLines.some((l) => l.includes('value')));
    assert.ok(objectLines.some((l) => l.includes('id: p1')));
    assert.ok(objectLines.some((l) => l.includes('count: 3')));
    assert.ok(objectLines.some((l) => l.includes('nested: {"a":1}')));

    const arrayLines = captureLogs(() => {
      printOutput([{ id: 'a' }, { id: 'b' }], parsed());
    });
    assert.ok(arrayLines.some((l) => l.includes('id')));
    assert.ok(arrayLines.some((l) => l.includes('a')));

    const scalarLines = captureLogs(() => {
      printOutput('hello', parsed());
      printOutput(null, parsed());
    });
    assert.ok(scalarLines.some((l) => l.includes('hello')));
    assert.ok(scalarLines.some((l) => l.includes('(empty)')));
  });

  const jsonLines = captureLogs(() => {
    printOutput({ ok: true }, parsed({ json: 'true' }));
  });
  assert.ok(jsonLines[0].includes('"ok": true'));
});

test('printOutput redacts sensitive project fields from json and table output', () => {
  const payload = {
    projects: [{
      id: 'prj_1',
      public_key: 'ut_pub_visible',
      secret_key: 'ut_sec_hidden',
      nested: { settings_json: '{"private":true}', ok: true },
    }],
  };

  const jsonLines = captureLogs(() => {
    printOutput(payload, parsed({ json: 'true' }));
  });
  const json = jsonLines.join('\n');
  assert.match(json, /ut_pub_visible/);
  assert.doesNotMatch(json, /secret_key|ut_sec_hidden|settings_json/);

  withPatchedTTY(true, () => {
    const tableLines = captureLogs(() => {
      printOutput(payload, parsed());
    });
    const table = tableLines.join('\n');
    assert.match(table, /ut_pub_visible/);
    assert.doesNotMatch(table, /secret_key|ut_sec_hidden|settings_json/);
  });
});

test('printOutput remaps only deliberate top-level task keys to Findings vocabulary', () => {
  const payload = {
    task: { id: 'tsk_1', task_counts: { nested: 1 } },
    tasks: [{ id: 'tsk_2', related_task: { id: 'tsk_1' } }],
    top_tasks: [{ id: 'tsk_1' }],
    task_counts: { ready: 2 },
  };

  const lines = captureLogs(() => printOutput(payload, parsed({ json: 'true' })));
  const output = JSON.parse(lines.join('\n')) as Record<string, unknown>;
  assert.deepEqual(Object.keys(output), ['finding', 'findings', 'top_findings', 'finding_counts']);
  assert.equal((output.finding as { id: string }).id, 'tsk_1');
  assert.ok('task_counts' in (output.finding as Record<string, unknown>));
  assert.ok('related_task' in (output.findings as Array<Record<string, unknown>>)[0]);
});

test('printOutput can preserve literal task-shaped output for raw boundary callers', () => {
  const lines = captureLogs(() => {
    printOutput({ task: { id: 'tsk_1' }, tasks: [] }, parsed({ json: 'true' }), { remapVocab: false });
  });
  const output = JSON.parse(lines.join('\n')) as Record<string, unknown>;
  assert.deepEqual(Object.keys(output), ['task', 'tasks']);
});

test('printTable and printObject handle edge cases', () => {
  withPatchedTTY(true, () => {
    const lines = captureLogs(() => {
      printTable([]);
      printObject({});
      printTable([{ id: '1', text: 'x'.repeat(120) }]);
    });

    assert.ok(lines.some((l) => l.includes('(no results)')));
    assert.ok(lines.some((l) => l.includes('{}')));
    assert.ok(lines.some((l) => l.includes('...')));
  });
});
