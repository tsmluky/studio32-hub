'use strict';

// Valida propuestas; NO ejecuta herramientas. El contexto debe venir del servidor,
// una seleccion explicita o una confirmacion del usuario, nunca del propio modelo.
const BUSINESS_ACTIONS = new Set(['get_report', 'request_report', 'add_note', 'schedule_visit']);
const OTHER_ACTIONS = new Set(['find_business', 'get_job_status']);

function validatePlan(calls, trustedContext = {}) {
    const actions = [];
    for (const call of calls || []) {
        const name = call.function?.name;
        let args = call.function?.arguments;
        try { if (typeof args === 'string') args = JSON.parse(args); } catch (_) { args = null; }
        const reject = code => ({ ok: false, code, tool: name, actions: [] });
        if (!BUSINESS_ACTIONS.has(name) && !OTHER_ACTIONS.has(name)) return reject('tool_not_allowed');
        if (!args || typeof args !== 'object' || Array.isArray(args)) return reject('invalid_arguments');
        if (BUSINESS_ACTIONS.has(name)) {
            if (!trustedContext.businessId) return reject('business_unresolved');
            if (args.business_id !== trustedContext.businessId) return reject('business_mismatch');
        }
        if (name === 'schedule_visit') {
            if (!trustedContext.visitStartsAt) return reject('visit_time_unverified');
            if (!trustedContext.timezone || args.timezone !== trustedContext.timezone) return reject('visit_time_mismatch');
            const verified = Date.parse(trustedContext.visitStartsAt);
            if (!Number.isFinite(verified) || !/(?:[+-]\d{2}:\d{2}|Z)$/.test(trustedContext.visitStartsAt)) {
                return reject('visit_time_mismatch');
            }
            let sameTime = false;
            if (/(?:[+-]\d{2}:\d{2}|Z)$/.test(args.starts_at || '')) {
                sameTime = Date.parse(args.starts_at) === verified;
            } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(args.starts_at || '')) {
                // Hora local sin offset: se compara con el instante ya verificado,
                // nunca se interpreta usando la zona horaria del proceso Node.
                try {
                    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
                        timeZone: trustedContext.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
                    }).formatToParts(new Date(verified)).map(p => [p.type, p.value]));
                    const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
                    sameTime = local === (args.starts_at.length === 16 ? args.starts_at + ':00' : args.starts_at);
                } catch (_) { sameTime = false; }
            }
            if (!sameTime) return reject('visit_time_mismatch');
            args = { ...args, starts_at: trustedContext.visitStartsAt };
        }
        if (name === 'get_report' || name === 'request_report') {
            if (!['diagnostico', 'completo'].includes(args.report_type)) return reject('invalid_report_type');
        }
        if (name === 'add_note' && (typeof args.note !== 'string' || !args.note.trim())) return reject('empty_note');
        if (name === 'find_business' && (typeof args.query !== 'string' || !args.query.trim())) return reject('empty_query');
        if (name === 'get_job_status' && (typeof args.job_id !== 'string' || !args.job_id.trim())) return reject('empty_job');
        actions.push({ name, arguments: { ...args } });
    }
    return { ok: true, actions };
}

module.exports = { validatePlan };
