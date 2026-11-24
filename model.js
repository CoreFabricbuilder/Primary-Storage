export const kinds = ['Capability', 'Application', 'Data', 'Technology'];
export const lifecycles = ['Planned', 'Active', 'Retiring'];
export const relationTypes = ['supports', 'uses', 'stores', 'runs on', 'integrates with'];
export const storageKey = 'ea-workspace-v1';

export const starter = {
  name: 'Northstar Enterprise',
  elements: [
    { id: 'cap-1', kind: 'Capability', name: 'Customer management', owner: 'Customer Experience', lifecycle: 'Active', description: 'Manage customer profiles, service requests, and relationships.' },
    { id: 'cap-2', kind: 'Capability', name: 'Order fulfillment', owner: 'Operations', lifecycle: 'Active', description: 'Coordinate orders from capture through delivery.' },
    { id: 'cap-3', kind: 'Capability', name: 'Analytics & insight', owner: 'Strategy', lifecycle: 'Planned', description: 'Turn operational data into decisions and forecasts.' },
    { id: 'app-1', kind: 'Application', name: 'Customer Portal', owner: 'Digital Products', lifecycle: 'Active', description: 'Self-service experience for customers.' },
    { id: 'app-2', kind: 'Application', name: 'Order Hub', owner: 'Operations IT', lifecycle: 'Active', description: 'Order orchestration and status tracking.' },
    { id: 'app-3', kind: 'Application', name: 'Legacy CRM', owner: 'Customer Experience', lifecycle: 'Retiring', description: 'Existing customer record system.' },
    { id: 'data-1', kind: 'Data', name: 'Customer records', owner: 'Data Office', lifecycle: 'Active', description: 'Customer identity and contact information.' },
    { id: 'data-2', kind: 'Data', name: 'Order events', owner: 'Operations', lifecycle: 'Active', description: 'Order activity and status history.' },
    { id: 'tech-1', kind: 'Technology', name: 'Cloud platform', owner: 'Platform Engineering', lifecycle: 'Active', description: 'Managed runtime and deployment services.' },
    { id: 'tech-2', kind: 'Technology', name: 'Data warehouse', owner: 'Data Platform', lifecycle: 'Planned', description: 'Consolidated analytical storage.' }
  ],
  relations: [
    { id: 'rel-1', from: 'app-1', to: 'cap-1', type: 'supports' },
    { id: 'rel-2', from: 'app-2', to: 'cap-2', type: 'supports' },
    { id: 'rel-3', from: 'app-3', to: 'cap-1', type: 'supports' },
    { id: 'rel-4', from: 'app-1', to: 'data-1', type: 'uses' },
    { id: 'rel-5', from: 'app-2', to: 'data-2', type: 'stores' },
    { id: 'rel-6', from: 'app-1', to: 'tech-1', type: 'runs on' },
    { id: 'rel-7', from: 'app-2', to: 'tech-1', type: 'runs on' },
    { id: 'rel-8', from: 'app-1', to: 'app-2', type: 'integrates with' }
  ]
};

export function copy(value) { return structuredClone(value); }

export function validateModel(value) {
  if (!value || typeof value !== 'object' || typeof value.name !== 'string' || !Array.isArray(value.elements) || !Array.isArray(value.relations)) throw new Error('Expected a workspace with name, elements, and relations.');
  const ids = new Set();
  for (const item of value.elements) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !kinds.includes(item.kind) || typeof item.name !== 'string' || !item.name.trim() || typeof item.owner !== 'string' || !lifecycles.includes(item.lifecycle) || typeof item.description !== 'string') throw new Error('An element has missing or invalid fields.');
    ids.add(item.id);
  }
  const relationIds = new Set();
  for (const relation of value.relations) {
    if (!relation || typeof relation.id !== 'string' || !relation.id || relationIds.has(relation.id) || !ids.has(relation.from) || !ids.has(relation.to) || relation.from === relation.to || !relationTypes.includes(relation.type)) throw new Error('A relationship is invalid or refers to a missing element.');
    relationIds.add(relation.id);
  }
  return value;
}

export function addElement(model, fields) {
  const next = copy(model);
  next.elements.push({ id: crypto.randomUUID(), ...fields });
  return validateModel(next);
}

export function updateElement(model, id, fields) {
  const next = copy(model);
  const index = next.elements.findIndex(item => item.id === id);
  if (index < 0) throw new Error('Element not found.');
  next.elements[index] = { ...next.elements[index], ...fields, id };
  return validateModel(next);
}

export function removeElement(model, id) {
  const next = copy(model);
  next.elements = next.elements.filter(item => item.id !== id);
  next.relations = next.relations.filter(item => item.from !== id && item.to !== id);
  return next;
}

export function addRelation(model, fields) {
  const next = copy(model);
  if (next.relations.some(item => item.from === fields.from && item.to === fields.to && item.type === fields.type)) throw new Error('This relationship already exists.');
  next.relations.push({ id: crypto.randomUUID(), ...fields });
  return validateModel(next);
}

export function removeRelation(model, id) {
  return { ...model, relations: model.relations.filter(item => item.id !== id) };
}

export function metrics(model) {
  const count = kind => model.elements.filter(item => item.kind === kind).length;
  const capabilities = model.elements.filter(item => item.kind === 'Capability');
  const covered = capabilities.filter(cap => model.relations.some(relation => relation.to === cap.id && relation.type === 'supports' && model.elements.some(item => item.id === relation.from && item.kind === 'Application' && item.lifecycle === 'Active'))).length;
  return { capabilities: count('Capability'), applications: count('Application'), data: count('Data'), technology: count('Technology'), relations: model.relations.length, covered, totalCapabilities: capabilities.length, retiring: model.elements.filter(item => item.lifecycle === 'Retiring').length };
}
