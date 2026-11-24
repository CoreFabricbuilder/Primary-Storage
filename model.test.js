import test from 'node:test';
import assert from 'node:assert/strict';
import { starter, copy, validateModel, addElement, updateElement, removeElement, addRelation, metrics } from './model.js';

test('starter architecture has valid references and measurable coverage', () => {
  const model = validateModel(copy(starter));
  assert.equal(metrics(model).covered, 2);
  assert.equal(metrics(model).totalCapabilities, 3);
  assert.equal(metrics(model).retiring, 1);
});

test('removing an element removes dependent relationships', () => {
  const result = removeElement(starter, 'app-1');
  assert.equal(result.elements.some(item => item.id === 'app-1'), false);
  assert.equal(result.relations.some(rel => rel.from === 'app-1' || rel.to === 'app-1'), false);
  assert.equal(starter.elements.some(item => item.id === 'app-1'), true);
  validateModel(result);
});

test('new elements can be related and edited', () => {
  const added = addElement(starter, { kind: 'Application', name: 'Insight Studio', owner: 'Strategy', lifecycle: 'Planned', description: 'Reporting' });
  const item = added.elements.at(-1);
  const related = addRelation(added, { from: item.id, to: 'cap-3', type: 'supports' });
  const updated = updateElement(related, item.id, { lifecycle: 'Active' });
  assert.equal(metrics(updated).covered, 3);
  assert.equal(updated.elements.find(element => element.id === item.id).lifecycle, 'Active');
});

test('imports reject broken relationships and duplicate identifiers', () => {
  const missing = copy(starter); missing.relations[0].to = 'missing';
  assert.throws(() => validateModel(missing), /relationship/i);
  const duplicate = copy(starter); duplicate.elements[1].id = duplicate.elements[0].id;
  assert.throws(() => validateModel(duplicate), /element/i);
});

test('duplicate and self relationships are rejected', () => {
  assert.throws(() => addRelation(starter, { from: 'app-1', to: 'cap-1', type: 'supports' }), /already exists/i);
  assert.throws(() => addRelation(starter, { from: 'app-1', to: 'app-1', type: 'uses' }), /relationship/i);
});
