import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMarkdownH2Section, listMarkdownH2Headings } from './study-guide';

const markdown = [
  '# Study Design Guide',
  '',
  '## Script Structure',
  'Use clear segment transitions.',
  '',
  '## Goals',
  'Start from decisions, not questions.',
  '',
].join('\n');

test('listMarkdownH2Headings returns all H2 headings in order', () => {
  assert.deepEqual(listMarkdownH2Headings(markdown), ['Script Structure', 'Goals']);
});

test('extractMarkdownH2Section returns matching section content and headings', () => {
  const section = extractMarkdownH2Section(markdown, 'script structure');
  assert.ok(section);
  assert.match(section.content, /^## Script Structure/m);
  assert.deepEqual(section.headings, ['Script Structure', 'Goals']);
});

test('extractMarkdownH2Section returns null for missing section', () => {
  assert.equal(extractMarkdownH2Section(markdown, 'missing'), null);
});
