import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/group-drag.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
const {reorderGroups, findGroupDropTarget, groupPosition} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const groups = ['a', 'b', 'c'].map((id, index) => ({id, name: id, color: '#dbeafe', x: index * 330, y: 0}));
const ids = array => array.map(group => group.id);
const row = groups.map((group, index) => ({id: group.id, left: index * 240, top: 100, width: 220, height: 300}));

test('moves a group to the beginning, middle and end without changing its contents or coordinates', () => {
  const before = JSON.stringify(groups);
  assert.deepEqual(ids(reorderGroups(groups, 'c', 0)), ['c', 'a', 'b']);
  assert.deepEqual(ids(reorderGroups(groups, 'a', 2)), ['b', 'c', 'a']);
  assert.deepEqual(ids(reorderGroups(groups, 'a', 1)), ['b', 'a', 'c']);
  assert.equal(reorderGroups(groups, 'a', 2)[2], groups[0]);
  assert.equal(JSON.stringify(groups), before);
});

test('ignores no-op and missing-group drops, and clamps an out-of-range destination', () => {
  assert.equal(reorderGroups(groups, 'b', 1), groups);
  assert.equal(reorderGroups(groups, 'missing', 0), groups);
  assert.equal(reorderGroups(groups, 'b', NaN), groups);
  assert.deepEqual(ids(reorderGroups(groups, 'a', 999)), ['b', 'c', 'a']);
  assert.deepEqual(ids(reorderGroups(groups, 'c', -10)), ['c', 'a', 'b']);
});

test('horizontal drops distinguish the before and after halves, including the final slot', () => {
  const before = findGroupDropTarget(row, 'a', 250, 150, 'horizontal');
  const after = findGroupDropTarget(row, 'a', 450, 150, 'horizontal');
  assert.equal(before.edge, 'before'); assert.equal(before.index, 0);
  assert.equal(after.edge, 'after'); assert.equal(after.index, 1);
  assert.deepEqual(ids(reorderGroups(groups, 'a', after.index)), ['b', 'a', 'c']);
  assert.equal(findGroupDropTarget(row, 'a', 730, 150, 'horizontal').index, 2);
});

test('vertical drops use y position even when the group contains many tasks', () => {
  const column = groups.map((group, index) => ({id: group.id, left: 20, top: index * 420, width: 800, height: 400}));
  const target = findGroupDropTarget(column, 'a', 30, 800, 'vertical');
  assert.equal(target.axis, 'y'); assert.equal(target.edge, 'after'); assert.equal(target.index, 1);
  assert.deepEqual(ids(reorderGroups(groups, 'a', target.index)), ['b', 'a', 'c']);
});

test('grid drops work across rows and when responsive layout becomes a single column', () => {
  const grid = [{id: 'a', left: 0, top: 0, width: 200, height: 200}, {id: 'b', left: 220, top: 0, width: 200, height: 200},
    {id: 'c', left: 0, top: 220, width: 200, height: 200}];
  const target = findGroupDropTarget(grid, 'a', 190, 250, 'grid');
  assert.equal(target.id, 'c'); assert.equal(target.edge, 'after'); assert.equal(target.index, 2);
  const column = grid.map((rect, index) => ({...rect, left: 0, top: index * 220}));
  assert.equal(findGroupDropTarget(column, 'a', 20, 400, 'grid').axis, 'y');
});

test('dropping in the original group or dragging the only group does not reorder anything', () => {
  assert.equal(findGroupDropTarget(row, 'a', 30, 130, 'horizontal'), null);
  assert.equal(findGroupDropTarget(row.slice(0, 1), 'a', 800, 100, 'horizontal'), null);
});

test('free placement retains pixel coordinates and clamps top and left edges', () => {
  assert.deepEqual(groupPosition(330, 100, 45.3, 20.8), {x: 375, y: 121});
  assert.deepEqual(groupPosition(330, 100, -900, -900), {x: 0, y: 0});
});
