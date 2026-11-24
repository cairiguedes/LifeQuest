/* LifeQuest V1.6.1 — schedule.js
 * Código organizado por seções; lógica original preservada.
 */

(() => {
    'use strict';

    // 01 — Configuração e utilitários

    const api = window.LifeQuest;
    if (!api)
        return;
    const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const state = () => api.getState(), today = () => api.today(), localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let selected = today(), editing = null, notified = new Set();

    // 02 — Dados dos agendamentos

    function ensure() { const s = state(); if (!Array.isArray(s.schedules))
        s.schedules = []; return s.schedules; }
    function formatDate(v) { return new Date(v + 'T12:00:00').toLocaleDateString('pt-BR'); }

    // 03 — Exibição das missões e ícones dos botões

    function render() {
        const items = ensure(), day = items.filter(x => x.date === selected).sort((a, b) => a.time.localeCompare(b.time));
        const el = $('#cal-scheduled-list');
        if (!el)
            return;
        el.innerHTML = day.length ? day.map(x => `<div class="schedule-item ${x.done ? 'schedule-done' : ''}"><div><strong>${esc(x.time)} · ${esc(x.title)}</strong><small>${esc(x.category)} · ${x.xp} XP ${x.done ? '· Concluída' : '· Pendente'}${x.remind ? ' · 🔔' : ''}</small></div><div class="schedule-actions"><button class="ghost" data-schedule-toggle="${esc(x.id)}">${x.done ? 'Desfazer' : 'Concluir'}</button><button class="icon-btn" data-schedule-edit="${esc(x.id)}" title="Editar">✎</button><button class="icon-btn" data-schedule-delete="${esc(x.id)}" title="Excluir">×</button></div></div>`).join('') : '<p class="muted">Nenhuma missão agendada para este dia.</p>';
        // Add schedule markers to the existing calendar without changing its XP history.
        items.forEach(x => { const cell = document.querySelector(`[data-cal-date="${x.date}"]`); if (cell) {
            cell.classList.add('has-schedule');
            cell.title = 'Há missões agendadas';
        } });
    }

    // 04 — Formulário de agendamento

    function open(item) { editing = item?.id || null; const f = $('#schedule-form'); f.reset(); f.elements.title.value = item?.title || ''; f.elements.date.value = item?.date || selected; f.elements.time.value = item?.time || '09:00'; f.elements.xp.value = item?.xp || 30; f.elements.remind.checked = item?.remind ?? true; const sel = $('#schedule-category'); sel.replaceChildren(); state().categories.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; sel.add(opt); }); sel.value = item?.category || state().categories[0]; $('#schedule-dialog-title').textContent = item ? 'Editar agendamento' : 'Agendar missão'; $('#schedule-dialog').showModal(); }
    $('#schedule-add').onclick = () => open();
    $('#schedule-close').onclick = $('#schedule-cancel').onclick = () => $('#schedule-dialog').close();
    $('#schedule-form').onsubmit = e => { e.preventDefault(); const f = e.target, title = f.elements.title.value.trim(), date = f.elements.date.value, time = f.elements.time.value, xp = Number(f.elements.xp.value), category = f.elements.category.value; if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !Number.isInteger(xp) || xp < 5 || xp > 500 || !state().categories.includes(category))
        return api.toast('Confira os campos do agendamento.'); const items = ensure(); if (editing) {
        const old = items.find(x => x.id === editing);
        if (old) {
            Object.assign(old, { title, date, time, xp, category, remind: f.elements.remind.checked });
            notified.delete(old.id);
        }
    }
    else
        items.push({ id: api.uid(), title, date, time, xp, category, remind: f.elements.remind.checked, done: false, created: today() }); api.save(); api.render(); $('#schedule-dialog').close(); api.toast('Agendamento salvo!'); };
    document.addEventListener('click', e => { const cell = e.target.closest('[data-cal-date]'); if (cell) {
        selected = cell.dataset.calDate;
        render();
        return;
    } const prev = e.target.closest('#cal-prev,#cal-next'); if (prev) {
        selected = localDay(new Date());
        render();
        return;
    } let btn = e.target.closest('[data-schedule-toggle]'); if (btn) {
        const item = ensure().find(x => x.id === btn.dataset.scheduleToggle);
        if (!item)
            return;
        if (item.done) {
            state().events = state().events.filter(x => x.scheduleId !== item.id);
            item.done = false;
        }
        else {
            item.done = true;
            state().events.push({ id: api.uid(), scheduleId: item.id, goalId: item.id, title: item.title, xp: item.xp, period: 'scheduled', date: today(), timestamp: Date.now() });
        }
        api.save();
        api.render();
        api.toast(item.done ? `Missão concluída! +${item.xp} XP` : 'Conclusão desfeita.');
        return;
    } btn = e.target.closest('[data-schedule-edit]'); if (btn) {
        const item = ensure().find(x => x.id === btn.dataset.scheduleEdit);
        if (item)
            open(item);
        return;
    } btn = e.target.closest('[data-schedule-delete]'); if (btn) {
        const item = ensure().find(x => x.id === btn.dataset.scheduleDelete);
        if (item && confirm('Excluir agendamento? O XP de uma missão já concluída será mantido.')) {
            state().schedules = ensure().filter(x => x.id !== item.id);
            api.save();
            api.render();
        }
        return;
    } });
    $('#notify-enable').onclick = async () => { if (!('Notification' in window))
        return api.toast('Seu navegador não oferece notificações.'); if (!window.isSecureContext)
        return api.toast('Notificações exigem HTTPS ou localhost.'); try {
        const result = await Notification.requestPermission();
        api.toast(result === 'granted' ? 'Notificações ativadas!' : 'Permissão não concedida.');
    }
    catch {
        api.toast('Não foi possível ativar notificações.');
    } };

    // 05 — Verificação de lembretes locais

    function checkReminders() { const now = new Date(), stamp = localDay(now) + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); ensure().forEach(item => { if (item.done || !item.remind || notified.has(item.id) || item.date + 'T' + item.time > stamp)
        return; notified.add(item.id); const msg = `${item.title} · ${formatDate(item.date)} às ${item.time}`; api.toast('🔔 Missão agendada: ' + item.title); if ('Notification' in window && Notification.permission === 'granted' && window.isSecureContext) {
        try {
            new Notification('LifeQuest · Lembrete', { body: msg, tag: 'lifequest-' + item.id });
        }
        catch { }
    } }); }
    window.addEventListener('lifequest:updated', () => { render(); checkReminders(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden)
        checkReminders(); });
    setInterval(checkReminders, 30000);
    render();
    checkReminders();
})();
