/* Architect-owned intervention records and read-only plan signals. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const categories = Object.freeze(['Architecture gap', 'LLD input', 'Dependency', 'Decision', 'Validation', 'Escalation', 'Other']);
  const levels = Object.freeze(['Low', 'Medium', 'High']);
  const impacts = Object.freeze(['Low', 'Medium', 'High', 'Critical']);
  const statuses = Object.freeze(['Open', 'Monitoring', 'Escalated', 'Resolved']);
  const fail = message => { throw new Error(message); };
  const text = (value, max, field) => {
    if (typeof value !== 'string' || value.length > max) fail(`Invalid ${field}.`);
  };
  const date = value => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value) && C.transformation.parseDate(value) === value;
  const owner = (data, kind, id) => (kind === 'Stream' ? data.transStreams : kind === 'Activity' ? data.transActivities : []).find(item => item.id === id);
  function validate(data) {
    if (!Array.isArray(data.architectureRisks)) fail('Missing architecture risk records.');
    for (const item of data.architectureRisks) {
      if (!owner(data, item.ownerKind, item.ownerId) || !categories.includes(item.category) || !levels.includes(item.likelihood) || !impacts.includes(item.impact) || !statuses.includes(item.status)) fail('Invalid architecture risk association or assessment.');
      for (const [field, max] of [['title', 200], ['intervention', 1000], ['escalationTo', 200], ['source', 300], ['notes', 1000], ['createdAt', 40], ['updatedAt', 40]]) text(item[field], max, `risk ${field}`);
      if (!item.title.trim() || !item.intervention.trim() || !item.source.trim() || !date(item.neededBy) || (item.status === 'Escalated' && !item.escalationTo.trim())) fail('Risk needs a title, intervention, source and valid escalation details.');
      if (item.decisionId !== null && !data.decisions.some(decision => decision.id === item.decisionId)) fail('Risk decision is missing.');
    }
  }
  function upsert(data, fields) {
    const next = C.model.copy(data);
    const current = fields.id ? next.architectureRisks.find(item => item.id === fields.id) : null;
    if (fields.id && !current) fail('Architecture risk not found.');
    const now = new Date().toISOString();
    const item = { id: current?.id || C.model.newId(), ownerKind: String(fields.ownerKind || ''), ownerId: String(fields.ownerId || ''),
      title: String(fields.title || '').trim(), category: String(fields.category || ''), likelihood: String(fields.likelihood || ''), impact: String(fields.impact || ''),
      status: String(fields.status || ''), intervention: String(fields.intervention || '').trim(), escalationTo: String(fields.escalationTo || '').trim(),
      neededBy: String(fields.neededBy || ''), decisionId: String(fields.decisionId || '') || null, source: String(fields.source || '').trim(),
      notes: String(fields.notes || '').trim(), createdAt: current?.createdAt || now, updatedAt: now };
    if (current) Object.assign(current, item); else next.architectureRisks.push(item);
    return { data: C.model.validateWorkspace(next), id: item.id };
  }
  function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function signals(data, asOf = todayLocal()) {
    if (!date(asOf) || !asOf) fail('Invalid analysis date.');
    const day = Date.parse(`${asOf}T00:00:00Z`), latest = data.planImports.at(-1);
    const changed = new Set(data.importChanges.filter(item => item.importId === latest?.id && item.entityKind === 'Stream' && item.dateChange).map(item => item.entityId));
    const from = data.transStreams.filter(item => !item.removed);
    return from.map(stream => {
      const start = stream.source.plannedStart, end = stream.source.plannedEnd;
      const daysToStart = start ? Math.round((Date.parse(`${start}T00:00:00Z`) - day) / 86400000) : null;
      const gate = C.transformation.gateOf(data, 'Stream', stream.id);
      const mappings = data.transMappings.filter(item => item.ownerKind === 'Stream' && item.ownerId === stream.id);
      const dependencies = data.transDependencies.filter(item => item.streamId === stream.id && !item.removed);
      const detailed = data.transActivities.filter(item => item.streamId === stream.id && !item.removed);
      const findings = [];
      const add = (code, label, detail) => findings.push({ code, label, detail });
      if (daysToStart !== null && daysToStart <= 90 && C.transformation.GATES.indexOf(gate) < (daysToStart < 0 ? 2 : 1)) add('GATE', 'Architecture gate needs review', `Planned start ${start}; architect gate is ${gate}.`);
      if (daysToStart !== null && daysToStart <= 90 && !mappings.some(item => item.targetKind === 'LLD' || item.targetKind === 'Source' && data.sources.some(source => source.id === item.targetId && source.type === 'LLD'))) add('LLD', 'No LLD reference linked', 'Confirm whether a usable LLD exists before the planned window.');
      if (!mappings.some(item => item.targetKind === 'Domain')) add('DOMAIN', 'No architect domain mapping', 'The source category is context until an architect links a domain.');
      if (dependencies.some(item => !item.targetStreamId)) add('DEPENDENCY', 'Source dependency not linked', 'Review the source dependency and link its target stream.');
      if (stream.source.originalSheet === 'Details' && !detailed.length) add('DETAIL', 'Detailed activities not supplied', 'The overlapping deployment view provides workstreams, not a detailed task plan.');
      if (changed.has(stream.id)) add('DATE_CHANGE', 'Planned window changed', 'Review the latest workbook import change and its architecture impact.');
      if (end && end < asOf && C.transformation.GATES.indexOf(gate) < C.transformation.GATES.indexOf('Deployed')) add('PAST_WINDOW', 'Planned end passed', 'Confirm actual deployment state; the source date alone does not prove delay.');
      const window = daysToStart === null ? 'Undated' : daysToStart < 0 ? 'Started window' : daysToStart <= 30 ? 'Next 30 days' : daysToStart <= 90 ? 'Next 90 days' : 'Later';
      return { stream, gate, daysToStart, window, findings, riskCount: data.architectureRisks.filter(item => item.ownerKind === 'Stream' && item.ownerId === stream.id && item.status !== 'Resolved').length };
    }).sort((a, b) => (a.daysToStart ?? Infinity) - (b.daysToStart ?? Infinity) || b.findings.length - a.findings.length);
  }
  function monthLoad(data) {
    const streams = data.transStreams.filter(item => !item.removed && item.source.plannedStart && item.source.plannedEnd);
    if (!streams.length) return [];
    const start = streams.map(item => item.source.plannedStart.slice(0, 7)).sort()[0];
    const end = streams.map(item => item.source.plannedEnd.slice(0, 7)).sort().at(-1);
    const result = [], cursor = new Date(`${start}-01T00:00:00Z`);
    while (result.length < 48) {
      const month = cursor.toISOString().slice(0, 7);
      const current = streams.filter(item => item.source.plannedStart.slice(0, 7) <= month && item.source.plannedEnd.slice(0, 7) >= month);
      result.push({ month, count: current.length, plannedGate: current.filter(item => C.transformation.gateOf(data, 'Stream', item.id) === 'Planned').length,
        unmapped: current.filter(item => !data.transMappings.some(map => map.ownerKind === 'Stream' && map.ownerId === item.id && map.targetKind === 'Domain')).length,
        escalated: current.filter(item => data.architectureRisks.some(risk => risk.ownerKind === 'Stream' && risk.ownerId === item.id && risk.status === 'Escalated')).length });
      if (month >= end) break;
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return result;
  }
  C.risk = Object.freeze({ categories, levels, impacts, statuses, validate, upsert, signals, monthLoad, todayLocal });
})();
