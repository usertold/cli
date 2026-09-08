import assert from 'node:assert/strict';
import test from 'node:test';
import { validateKnowledgeActionInput } from './knowledge-action';

test('validateKnowledgeActionInput accepts and normalizes the public shape', () => {
  assert.deepEqual(validateKnowledgeActionInput({
    name: 'Lookup docs',
    when_to_use: 'When product documentation is needed',
    method: 'GET',
    url: 'https://example.com/search',
    headers: { authorization: null },
    response_path: 'results',
    ignored: true,
  }), {
    success: true,
    data: {
      name: 'Lookup docs',
      when_to_use: 'When product documentation is needed',
      method: 'GET',
      url: 'https://example.com/search',
      headers: { authorization: null },
      response_path: 'results',
    },
  });
});

test('validateKnowledgeActionInput rejects malformed boundary values', () => {
  const result = validateKnowledgeActionInput({
    name: '',
    when_to_use: 'Use it',
    method: 'DELETE',
    url: 'https://example.com',
    headers: { authorization: 42 },
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.issues.join('; '), /name/);
    assert.match(result.issues.join('; '), /method/);
    assert.match(result.issues.join('; '), /headers\.authorization/);
  }
});
