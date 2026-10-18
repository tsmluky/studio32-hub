'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePlan } = require('./asistente-policy.cjs');
const call = (name, args) => ({ function: { name, arguments: args } });
const visit = { business_id: 'olivo', starts_at: '2026-10-22T11:00:00+02:00', timezone: 'Europe/Madrid' };
const context = { businessId: 'olivo', visitStartsAt: visit.starts_at, timezone: visit.timezone };

test('bloquea la eleccion de un restaurante ambiguo aunque el modelo envie un id valido', () => {
    const result = validatePlan([call('schedule_visit', visit)], {});
    assert.equal(result.code, 'business_unresolved');
    assert.deepEqual(result.actions, []);
});
test('bloquea una hora inventada si el usuario no ha elegido ninguna', () => {
    const result = validatePlan([call('schedule_visit', visit)], { businessId: 'olivo' });
    assert.equal(result.code, 'visit_time_unverified');
    assert.deepEqual(result.actions, []);
});
test('bloquea negocio, instante o zona distintos del contexto verificado', () => {
    for (const args of [{ ...visit, business_id: 'otro' }, { ...visit, starts_at: '2026-10-22T10:00:00+02:00' },
        { ...visit, timezone: 'UTC' }, { ...visit, starts_at: '2026-10-22T10:00:00' }]) {
        assert.equal(validatePlan([call('schedule_visit', args)], context).ok, false);
    }
});
test('normaliza una hora local solo cuando coincide con el instante y zona ya verificados', () => {
    const result = validatePlan([call('schedule_visit', { ...visit, starts_at: '2026-10-22T11:00:00' })], context);
    assert.equal(result.ok, true);
    assert.equal(result.actions[0].arguments.starts_at, visit.starts_at);
    assert.equal(validatePlan([call('schedule_visit', { ...visit, timezone: undefined })],
        { ...context, timezone: undefined }).ok, false);
});
test('permite la visita exacta, con argumentos nativos o del proveedor canonico', () => {
    assert.equal(validatePlan([call('schedule_visit', visit)], context).ok, true);
    assert.equal(validatePlan([call('schedule_visit', JSON.stringify(visit))], context).ok, true);
});
test('valida el plan entero antes de devolver acciones autorizadas', () => {
    const result = validatePlan([call('add_note', { business_id: 'olivo', note: 'Ana esta interesada' }),
        call('schedule_visit', visit)], { businessId: 'olivo' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.actions, []);
});
test('rechaza herramientas desconocidas y argumentos incompletos', () => {
    for (const proposal of [call('send_email', {}), call('add_note', '{'), call('add_note', {}),
        call('get_report', { business_id: 'olivo', report_type: 'inventado' })]) {
        assert.equal(validatePlan([proposal], context).ok, false);
    }
});
test('puede buscar antes de tener una ficha resuelta, sin autorizar escrituras', () => {
    const result = validatePlan([call('find_business', { query: 'Brisa' })], {});
    assert.equal(result.ok, true);
    assert.deepEqual(result.actions.map(a => a.name), ['find_business']);
});
