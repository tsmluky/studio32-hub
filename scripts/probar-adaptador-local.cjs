'use strict';

// Ida y vuelta real con el proveedor canonico y una herramienta ficticia.
// No carga orchestrator, store, .env, Supabase ni las herramientas de reservas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const repoRoot = path.join(__dirname, '..');
const create = require(path.join(repoRoot, '..', 'studio32-agent', 'src', 'providers', 'ollama'));
const model = process.argv[2] || 'qwen3.5:4b';
if (!['qwen3.5:4b', 'qwen3:4b'].includes(model)) throw new Error('Modelo fuera de los candidatos de esta prueba.');
const provider = create({ baseURL: 'http://127.0.0.1:11435', model, timeoutMs: 180000 });
const multiple = process.argv.includes('--multiple');
const output = path.join(repoRoot, '.local', 'asistente', model.replace(':', '-') + (multiple ? '-adaptador-multiple.json' : '-adaptador.json'));
const report = { date: new Date().toISOString(), model,
    scope: 'Proveedor canonico con resultado ficticio de herramienta; no se ejecutan acciones del negocio' };

(async () => {
    const started = performance.now();
    try {
        if (multiple) {
            const { validatePlan } = require('./asistente-policy.cjs');
            const system = 'Eres el asistente de Studio32. Fecha actual: domingo 18/10/2026. '
                + 'El restaurante ficticio El Olivo tiene business_id olivo. El proximo jueves es 22/10/2026. '
                + 'Horario Europe/Madrid, desplazamiento +02:00. Guarda notas con add_note y programa visitas con schedule_visit. '
                + 'Una nota no sustituye crear una visita. Completa todas las acciones solicitadas usando sus herramientas '
                + 'y confirma solo despues de sus resultados. No repitas escrituras ya realizadas.';
            const tools = [{ type: 'function', function: { name: 'add_note', description: 'Guardar una nota de visita',
                parameters: { type: 'object', properties: { business_id: { type: 'string' }, note: { type: 'string' } },
                    required: ['business_id', 'note'] } } }, { type: 'function', function: {
                name: 'schedule_visit', description: 'Crear una visita con fecha y hora verificadas',
                parameters: { type: 'object', properties: { business_id: { type: 'string' }, starts_at: { type: 'string' },
                    timezone: { type: 'string', enum: ['Europe/Madrid'] } }, required: ['business_id', 'starts_at', 'timezone'] } } }];
            const messages = [{ role: 'user', content: 'Guarda en El Olivo que Ana esta interesada y apunta visita el jueves a las 11.' }];
            const completed = new Set();
            report.turns = [];
            report.authorizedPlans = [];
            for (let turn = 0; turn < 4; turn++) {
                const answer = await provider.chat({ system, messages, tools });
                report.turns.push(answer);
                if (!answer.tool_calls?.length) {
                    assert.deepEqual([...completed].sort(), ['add_note', 'schedule_visit']);
                    assert.ok(answer.content.trim());
                    report.pass = true;
                    return;
                }
                const allowed = validatePlan(answer.tool_calls, { businessId: 'olivo',
                    visitStartsAt: '2026-10-22T11:00:00+02:00', timezone: 'Europe/Madrid' });
                assert.equal(allowed.ok, true, 'La politica rechazo la propuesta: ' + allowed.code);
                report.authorizedPlans.push(allowed.actions);
                messages.push(answer);
                for (const call of answer.tool_calls) {
                    const name = call.function.name;
                    assert.ok(['add_note', 'schedule_visit'].includes(name));
                    assert.ok(!completed.has(name), 'Intento de escritura repetida');
                    completed.add(name);
                    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({
                        status: name === 'add_note' ? 'saved' : 'created', simulated: true }) });
                }
            }
            throw new Error('No completo el plan en cuatro vueltas');
        }
        const system = 'Eres el asistente de Studio32. El restaurante ficticio El Olivo tiene business_id olivo. '
            + 'Para mostrar su informe usa get_report. No afirmes tener el documento hasta recibir el resultado. '
            + 'Despues muestra el enlace recibido en una frase breve en espanol.';
        const tools = [{ type: 'function', function: { name: 'get_report', description: 'Obtener un informe guardado',
            parameters: { type: 'object', properties: { business_id: { type: 'string' }, report_type: {
                type: 'string', enum: ['diagnostico', 'completo'] } }, required: ['business_id', 'report_type'] } } }];
        const messages = [{ role: 'user', content: 'Abre el diagnostico guardado de El Olivo.' }];
        const first = await provider.chat({ system, messages, tools });
        report.first = first;
        assert.equal(first.tool_calls?.length, 1, 'Debe pedir exactamente un informe');
        const call = first.tool_calls[0];
        assert.equal(call.function.name, 'get_report');
        assert.deepEqual(JSON.parse(call.function.arguments), { business_id: 'olivo', report_type: 'diagnostico' });
        messages.push(first, { role: 'tool', tool_call_id: call.id,
            content: JSON.stringify({ status: 'ready', url: '/informes/ficticio/diagnostico.pdf' }) });
        const second = await provider.chat({ system, messages, tools });
        report.second = second;
        assert.ok(!second.tool_calls?.length, 'Debe responder despues de recibir el resultado');
        assert.ok(second.content.includes('/informes/ficticio/diagnostico.pdf'), 'Debe devolver el enlace recibido');
        report.pass = true;
    } catch (error) {
        report.pass = false;
        report.error = error.message;
        process.exitCode = 1;
    } finally {
        report.seconds = Number(((performance.now() - started) / 1000).toFixed(2));
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ pass: report.pass, seconds: report.seconds, error: report.error, output }));
    }
})();
