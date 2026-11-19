import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/board-image.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
const {buildBoardImage, wrapImageText} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const now = new Date('2026-11-19T00:00:00+09:00');
const measure = (text, size) => Array.from(text).reduce((sum, char) => sum + (char.codePointAt(0) > 255 ? size : size * .6), 0);
const group = (id, name = id) => ({id, name, color: '#dbeafe'});
const task = (title, groupId = 'g1') => ({title, groupId, description: '', color: '#ffffff'});

test('includes every group and task beyond the visible scroll area, including empty groups', () => {
  const groups = Array.from({length: 7}, (_, i) => group('g' + i, 'Group-' + i));
  const tasks = Array.from({length: 240}, (_, i) => task('Task-' + String(i).padStart(3, '0'), 'g' + i % 6));
  const result = buildBoardImage({name: '進捗', data: {groups, tasks}}, now, measure);
  assert.equal(result.groupCount, 7); assert.equal(result.taskCount, 240);
  for (const group of groups) assert.ok(result.svg.includes(group.name));
  for (const task of tasks) assert.ok(result.svg.includes(task.title));
  assert.ok(result.svg.includes('タスクなし'));
  assert.ok(result.height > 4096, 'large boards retain all content instead of truncating to a canvas limit');
});

test('does not change saved layout, positions, colors, or order while making a readable export', () => {
  const data = {layout: 'free', groups: [{...group('g1'), x: 0, y: 0}, {...group('g2'), x: 0, y: 0}], tasks: [task('First'), task('Second')]};
  const before = JSON.stringify(data);
  const result = buildBoardImage({name: '確認', data}, now, measure);
  assert.equal(JSON.stringify(data), before);
  assert.ok(result.svg.indexOf('First') < result.svg.indexOf('Second'));
  assert.equal(result.svg, buildBoardImage({name: '確認', data: {...data, layout: 'horizontal'}}, now, measure).svg);
});

test('wraps long Japanese names and emoji without losing text or splitting a grapheme', () => {
  const text = '長いタスク名👨‍👩‍👧‍👦の後半も必ず保存する';
  const lines = wrapImageText(text, 60, 16, true, measure);
  assert.ok(lines.length > 1); assert.equal(lines.join(''), text);
  assert.ok(lines.some(line => line.includes('👨‍👩‍👧‍👦')));
  assert.deepEqual(wrapImageText('1行目\r\n\r\n3行目', 300, 16, false, measure), ['1行目', '', '3行目']);
});

test('escapes user text and rejects colors that could inject SVG markup or remote resources', () => {
  const result = buildBoardImage({name: '../<script>&"', data: {
    groups: [{...group('g1', '<script>alert(1)</script>'), color: 'url(https://invalid.test/image)'}],
    tasks: [{...task('A & B < C > D'), description: '<image href="https://invalid.test"/>', color: '#000000'}]
  }}, now, measure);
  assert.ok(!result.svg.includes('<script>')); assert.ok(!result.svg.includes('<image'));
  assert.ok(!result.svg.includes('url(')); assert.ok(result.svg.includes('A &amp; B &lt; C &gt; D'));
  assert.ok(result.svg.includes('fill="#f1f5ff"')); assert.ok(!result.fileBaseName.includes('/'));
});

test('keeps a task with a missing group visible in an ungrouped section', () => {
  const result = buildBoardImage({name: '確認', data: {groups: [group('g1')], tasks: [task('Lost-task', 'missing')]}}, now, measure);
  assert.equal(result.groupCount, 2); assert.equal(result.taskCount, 1);
  assert.ok(result.svg.includes('未分類')); assert.ok(result.svg.includes('Lost-task'));
});

test('handles an empty project and multiline names without zero-size images', () => {
  const result = buildBoardImage({name: '', data: {groups: [], tasks: []}}, now, measure);
  assert.ok(result.width > 0 && result.height > 0);
  assert.ok(result.svg.includes('グループはまだありません')); assert.ok(result.fileBaseName.startsWith('TaskBox_'));
  assert.equal(result.groupCount, 0); assert.equal(result.taskCount, 0);
});
