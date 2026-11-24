/* LifeQuest V1.6.1 — app.js
 * Código organizado por seções; lógica original preservada.
 */

(() => {
    'use strict';

    // 01 — Configurações e armazenamento local

    const KEY = 'lifequest-v1', THEME = 'lifequest-theme', DEFAULT_CATEGORIES = ['Pessoal', 'Saúde', 'Estudos', 'Financeira', 'Trabalho'];
    const $ = s => document.querySelector(s);
    const $$ = s => [...document.querySelectorAll(s)];

    // 02 — Datas e períodos

    const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const weekKey = () => { const d = new Date(); d.setHours(0, 0, 0, 0); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return todayFor(d); };
    const todayFor = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    // 03 — Dados iniciais

    const seed = () => ({ goals: [{ id: uid(), title: 'Estudar por 1 hora', category: 'Estudos', frequency: 'daily', xp: 50, created: today() }, { id: uid(), title: 'Praticar atividade física', category: 'Saúde', frequency: 'daily', xp: 40, created: today() }, { id: uid(), title: 'Revisar meu orçamento', category: 'Financeira', frequency: 'weekly', xp: 60, created: today() }], events: [] });
    let state;
    try {
        state = JSON.parse(localStorage.getItem(KEY)) || seed();
        if (!Array.isArray(state.goals) || !Array.isArray(state.events))
            throw Error('invalid');
    }
    catch {
        state = seed();
    }
    state.categories = Array.isArray(state.categories) ? state.categories.filter(c => typeof c === 'string' && c.trim() && c.length <= 40) : [];
    state.categories = [...new Set([...DEFAULT_CATEGORIES, ...state.categories, ...state.goals.map(g => g.category).filter(c => typeof c === 'string' && c.trim() && c.length <= 40)])];

    // 04 — Ícones e cores das categorias

    const ICONS = ['🎯', '📚', '💰', '🏃', '💪', '💼', '🧘', '🎨', '🎮', '⛪', '🧠', '🏠', '⭐', '📅', '🚀'];
    const PALETTE = ['#6478dd', '#16a085', '#d97706', '#db5376', '#8b5cf6', '#0891b2', '#65a30d'];
    const validColor = v => /^#[0-9a-fA-F]{6}$/.test(v);
    const normalizeMeta = () => { const old = state.categoryMeta && typeof state.categoryMeta === 'object' ? state.categoryMeta : {}; state.categoryMeta = {}; state.categories.forEach((name, i) => { const meta = old[name] || {}; state.categoryMeta[name] = { icon: ICONS.includes(meta.icon) ? meta.icon : ICONS[i % ICONS.length], color: validColor(meta.color) ? meta.color : PALETTE[i % PALETTE.length] }; }); };
    normalizeMeta();
    let editing = null, editingCategory = null;
    const catMeta = name => state.categoryMeta[name] || { icon: '🎯', color: '#6478dd' };
    const catBadge = name => { const m = catMeta(name); return `<span class="category-chip"><span class="category-dot" style="background:${m.color}"></span>${esc(m.icon)} ${esc(name)}</span>`; };

    // 05 — Persistência e mensagens

    const save = () => { try {
        localStorage.setItem(KEY, JSON.stringify(state));
        window.dispatchEvent(new CustomEvent('lifequest:local-save'));
    }
    catch {
        toast('Não foi possível salvar neste navegador.');
    } };
    const toast = msg => { const e = $('#toast'); e.textContent = msg; e.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => e.classList.remove('show'), 2500); };

    // 06 — Missões, XP e níveis

    const period = (goal, date = new Date()) => goal.frequency === 'daily' ? todayFor(date) : goal.frequency === 'weekly' ? (() => { const d = new Date(date); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return todayFor(d); })() : 'once';
    const eventFor = g => state.events.find(e => e.goalId === g.id && e.period === period(g));
    const completed = g => !!eventFor(g);
    const xpTotal = () => state.events.reduce((n, e) => n + e.xp, 0);
    const levelInfo = () => { let left = xpTotal(), level = 1, required = 500; while (left >= required) {
        left -= required;
        level++;
        required = 500 + (level - 1) * 250;
    } return { level, left, required }; };
    const streak = () => { const days = new Set(state.events.map(e => e.date)); let d = new Date(); d.setHours(12, 0, 0, 0); if (!days.has(todayFor(d)))
        d.setDate(d.getDate() - 1); let count = 0; while (days.has(todayFor(d))) {
        count++;
        d.setDate(d.getDate() - 1);
    } return count; };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const freq = { daily: 'Diária', weekly: 'Semanal', once: 'Única' };

    // 07 — HTML das missões e ícones dos botões

    function goalHTML(g, editable) { const done = completed(g); return `<article class="goal ${done ? 'done' : ''}"><div class="goal-main"><input class="goal-check" type="checkbox" data-check="${esc(g.id)}" ${done ? 'checked' : ''} aria-label="Concluir ${esc(g.title)}"><div><div class="goal-title">${esc(g.title)}</div><div class="goal-meta">${catBadge(g.category)} · ${freq[g.frequency]}</div></div></div><div class="goal-right"><span class="xp">+${g.xp} XP</span>${editable ? `<button class="icon-btn" data-edit="${esc(g.id)}" title="Editar meta">✎</button><button class="icon-btn" data-delete="${esc(g.id)}" title="Excluir meta">×</button>` : ''}</div></article>`; }

    // 08 — Atualização da interface

    function render() { const info = levelInfo(); $('#xp-total').textContent = xpTotal().toLocaleString('pt-BR'); $('#level').textContent = info.level; $('#level-label').textContent = info.level < 3 ? 'Iniciante' : info.level < 6 ? 'Explorador' : 'Veterano'; $('#done-today').textContent = state.events.filter(e => e.date === today()).length; $('#streak').textContent = `${streak()} dias`; $('#level-pill').textContent = `Nível ${info.level}`; $('#progress-caption').textContent = `${info.left} / ${info.required} XP para o próximo nível`; $('#level-bar').style.width = `${100 * info.left / info.required}%`; const current = state.goals.filter(g => g.frequency !== 'once' || !completed(g)); $('#today-list').innerHTML = current.length ? current.map(g => goalHTML(g, false)).join('') : '<div class="empty">Nenhuma missão pendente. Você está em dia! ✨</div>'; const filter = $('#goal-filter').value; const goals = state.goals.filter(g => filter === 'all' || g.frequency === filter); $('#all-list').innerHTML = goals.length ? goals.map(g => goalHTML(g, true)).join('') : '<div class="empty">Nenhuma meta nesta categoria. Crie sua primeira meta!</div>'; const events = [...state.events].sort((a, b) => b.timestamp - a.timestamp); renderCategories(); $('#history-list').innerHTML = events.length ? events.map(e => `<article class="history-item"><div><strong>${esc(e.title)}</strong><small>${new Date(e.timestamp).toLocaleString('pt-BR')}</small></div><span class="xp">+${e.xp} XP</span></article>`).join('') : '<div class="empty">Seu histórico aparecerá aqui depois da primeira conclusão.</div>'; queueMicrotask(() => window.dispatchEvent(new Event('lifequest:updated'))); }

    // 09 — Formulário de metas

    function categories(selected) { const sel = $('#category-select'); sel.innerHTML = ''; state.categories.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.append(o); }); sel.value = selected && state.categories.includes(selected) ? selected : state.categories[0]; }
    function openGoal(g) { categories(g?.category); editing = g?.id || null; $('#dialog-title').textContent = g ? 'Editar meta' : 'Nova meta'; const f = $('#goal-form'); f.reset(); f.elements.title.value = g?.title || ''; f.elements.category.value = g?.category || state.categories[0]; $('#new-category').value = ''; f.elements.frequency.value = g?.frequency || 'daily'; f.elements.xp.value = g?.xp || 30; $('#goal-dialog').showModal(); f.elements.title.focus(); }

    // 10 — Navegação e eventos

    function page(name) { $$('.page').forEach(e => e.classList.toggle('hidden', e.id !== name)); $$('.nav').forEach(e => e.classList.toggle('active', e.dataset.page === name)); $('#page-title').textContent = ({ dashboard: 'Visão geral', goals: 'Minhas metas', history: 'Histórico', categories: 'Categorias', calendar: 'Calendário', finance: 'Finanças', achievements: 'Conquistas' })[name]; }
    document.addEventListener('click', e => { const nav = e.target.closest('[data-page],[data-go]'); if (nav) {
        page(nav.dataset.page || nav.dataset.go);
        return;
    } const edit = e.target.closest('[data-edit]'); if (edit) {
        openGoal(state.goals.find(g => g.id === edit.dataset.edit));
        return;
    } const del = e.target.closest('[data-delete]'); if (del) {
        const g = state.goals.find(g => g.id === del.dataset.delete);
        if (g && confirm(`Excluir a meta "${g.title}"? O XP já conquistado será mantido.`)) {
            state.goals = state.goals.filter(x => x.id !== g.id);
            save();
            render();
            toast('Meta excluída.');
        }
        return;
    } });
    document.addEventListener('change', e => { if (e.target.matches('[data-check]')) {
        const g = state.goals.find(x => x.id === e.target.dataset.check);
        if (!g)
            return;
        const old = eventFor(g);
        if (old) {
            state.events = state.events.filter(x => x.id !== old.id);
            toast('Conclusão desfeita; XP removido.');
        }
        else {
            state.events.push({ id: uid(), goalId: g.id, title: g.title, xp: g.xp, period: period(g), date: today(), timestamp: Date.now() });
            toast(`Missão concluída! +${g.xp} XP`);
        }
        save();
        render();
    } if (e.target.id === 'goal-filter')
        render(); });
    $('#add-btn').onclick = () => openGoal();
    $('#add-category').onclick = () => { const input = $('#new-category'); const name = input.value.trim().replace(/\s+/g, ' '); if (!name)
        return toast('Digite o nome da categoria.'); if (name.length > 40)
        return toast('Máximo de 40 caracteres.'); const existing = state.categories.find(c => c.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR')); if (existing) {
        categories(existing);
        toast('Categoria já existente.');
        return;
    } state.categories.push(name); normalizeMeta(); categories(name); save(); render(); input.value = ''; toast('Categoria criada!'); };

    // 11 — Gerenciamento de categorias

    function renderCategories() { const el = $('#categories-list'); el.innerHTML = state.categories.map(name => { const m = catMeta(name), count = state.goals.filter(g => g.category === name).length; return `<article class="panel category-card"><div class="category-symbol" style="background:${m.color}22;border-color:${m.color}">${esc(m.icon)}</div><div class="category-details"><strong>${esc(name)}</strong><small>${count} ${count === 1 ? 'meta' : 'metas'}</small></div><button class="ghost" data-cat-edit="${esc(name)}" aria-label="Editar ${esc(name)}">Editar</button><button class="icon-btn" data-cat-delete="${esc(name)}" aria-label="Excluir ${esc(name)}" title="Excluir categoria">×</button></article>`; }).join(''); }

    // 12 — Formulário de categorias

    function openCategory(name = null) { editingCategory = name; const f = $('#category-form'); f.reset(); $('#category-dialog-title').textContent = name ? 'Editar categoria' : 'Nova categoria'; f.elements.name.value = name || ''; f.elements.icon.innerHTML = ICONS.map(i => `<option value="${i}">${i}</option>`).join(''); f.elements.icon.value = name ? catMeta(name).icon : '🎯'; f.elements.color.value = name ? catMeta(name).color : '#6478dd'; $('#category-dialog').showModal(); f.elements.name.focus(); }
    $('#new-category-btn').onclick = () => openCategory();
    $('#close-category').onclick = $('#cancel-category').onclick = () => $('#category-dialog').close();
    $('#category-form').onsubmit = e => { e.preventDefault(); const f = e.target, name = f.elements.name.value.trim().replace(/\s+/g, ' '), icon = f.elements.icon.value, color = f.elements.color.value; if (!name || name.length > 40 || !ICONS.includes(icon) || !validColor(color))
        return toast('Revise os dados da categoria.'); const duplicate = state.categories.some(c => c.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR') && c !== editingCategory); if (duplicate)
        return toast('Já existe uma categoria com esse nome.'); if (editingCategory) {
        const idx = state.categories.indexOf(editingCategory);
        if (idx < 0)
            return;
        state.categories[idx] = name;
        state.goals.forEach(g => { if (g.category === editingCategory)
            g.category = name; });
        delete state.categoryMeta[editingCategory];
    }
    else
        state.categories.push(name); state.categoryMeta[name] = { icon, color }; save(); render(); $('#category-dialog').close(); toast('Categoria salva!'); };
    document.addEventListener('click', e => { const edit = e.target.closest('[data-cat-edit]'); if (edit) {
        openCategory(edit.dataset.catEdit);
        return;
    } const del = e.target.closest('[data-cat-delete]'); if (!del)
        return; const name = del.dataset.catDelete; const count = state.goals.filter(g => g.category === name).length; if (count) {
        toast(`Categoria em uso por ${count} meta(s). Mova ou exclua essas metas primeiro.`);
        return;
    } if (state.categories.length <= 1) {
        toast('Mantenha ao menos uma categoria.');
        return;
    } if (confirm(`Excluir a categoria "${name}"?`)) {
        state.categories = state.categories.filter(c => c !== name);
        delete state.categoryMeta[name];
        save();
        render();
        toast('Categoria excluída.');
    } });
    $('#close-dialog').onclick = $('#cancel-dialog').onclick = () => $('#goal-dialog').close();
    $('#goal-form').onsubmit = e => { e.preventDefault(); const f = e.target; const title = f.elements.title.value.trim(), xp = Number(f.elements.xp.value), frequency = f.elements.frequency.value; if (!title || !Number.isInteger(xp) || xp < 5 || xp > 500 || !['daily', 'weekly', 'once'].includes(frequency))
        return toast('Revise os dados da meta.'); const category = f.elements.category.value; if (!state.categories.includes(category))
        return toast('Selecione uma categoria válida.'); const data = { title, category, frequency, xp }; if (editing) {
        const g = state.goals.find(g => g.id === editing);
        if (g)
            Object.assign(g, data);
    }
    else
        state.goals.push({ id: uid(), created: today(), ...data }); save(); render(); $('#goal-dialog').close(); toast('Meta salva com sucesso!'); };
    $('#theme-btn').onclick = () => { document.body.classList.toggle('dark'); localStorage.setItem(THEME, document.body.classList.contains('dark') ? 'dark' : 'light'); };
    $('#export-btn').onclick = () => { const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `lifequest-backup-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    $('#export-csv').onclick = () => { const rows = [['Tipo', 'Meta', 'Categoria', 'Frequência', 'XP', 'Data', 'Status']]; state.goals.forEach(g => rows.push(['Meta', g.title, g.category, freq[g.frequency], g.xp, g.created || '', completed(g) ? 'Concluída no período' : 'Pendente'])); state.events.forEach(e => { const g = state.goals.find(g => g.id === e.goalId); rows.push(['Conclusão', e.title, g?.category || '', g ? freq[g.frequency] : '', e.xp, e.date, 'Concluída']); }); (state.financialEntries || []).forEach(e => { const g = (state.financialGoals || []).find(g => g.id === e.goalId); rows.push(['Movimentação financeira', g?.title || 'Meta excluída', 'Financeira', e.type === 'deposit' ? 'Depósito' : 'Retirada', '', e.date, (e.type === 'deposit' ? '+' : '-') + Number(e.amount).toFixed(2)]); }); const quote = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'; const csv = '\uFEFF' + rows.map(r => r.map(quote).join(';')).join('\r\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `lifequest-relatorio-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    $('#import-file').onchange = async (e) => { const file = e.target.files[0]; if (!file)
        return; try {
        const obj = JSON.parse(await file.text());
        if (!Array.isArray(obj.goals) || !Array.isArray(obj.events) || obj.goals.some(g => typeof g.id !== 'string' || typeof g.title !== 'string' || !['daily', 'weekly', 'once'].includes(g.frequency) || !Number.isInteger(g.xp) || g.xp < 5 || g.xp > 500) || obj.events.some(v => typeof v.id !== 'string' || typeof v.goalId !== 'string' || typeof v.title !== 'string' || !Number.isFinite(v.xp) || v.xp < 0 || typeof v.date !== 'string' || !Number.isFinite(v.timestamp)))
            throw Error('Formato inválido');
        if (confirm('Substituir todos os dados locais pelo backup?')) {
            state = { categoryMeta: obj.categoryMeta, goals: obj.goals, events: obj.events, financialGoals: Array.isArray(obj.financialGoals) ? obj.financialGoals : [], financialEntries: Array.isArray(obj.financialEntries) ? obj.financialEntries : [], schedules: Array.isArray(obj.schedules) ? obj.schedules : [], categories: [...new Set([...DEFAULT_CATEGORIES, ...(Array.isArray(obj.categories) ? obj.categories.filter(c => typeof c === 'string' && c.trim() && c.length <= 40) : []), ...obj.goals.map(g => g.category).filter(c => typeof c === 'string' && c.trim() && c.length <= 40)])] };
            normalizeMeta();
            save();
            render();
            toast('Backup importado.');
        }
    }
    catch {
        toast('Arquivo de backup inválido.');
    } e.target.value = ''; };
    window.LifeQuest = { getState: () => state, replaceState: (data) => { if (!data || !Array.isArray(data.goals) || !Array.isArray(data.events))
            throw Error('Dados inválidos'); state = data; state.categories = Array.isArray(state.categories) ? state.categories : []; state.categories = [...new Set([...DEFAULT_CATEGORIES, ...state.categories, ...state.goals.map(g => g.category).filter(Boolean)])]; normalizeMeta(); save(); render(); }, save, render, uid, today, toast };
    if (localStorage.getItem(THEME) === 'dark')
        document.body.classList.add('dark');
    save();
    render();
    // Atualiza as missões quando o calendário local muda, mesmo com a aba aberta.

    // 13 — Atualização automática dos períodos

    let lastRenderedDay = today(), lastRenderedWeek = weekKey();
    function refreshForNewPeriod() { const currentDay = today(), currentWeek = weekKey(); if (currentDay !== lastRenderedDay || currentWeek !== lastRenderedWeek) {
        lastRenderedDay = currentDay;
        lastRenderedWeek = currentWeek;
        render();
    } }
    window.addEventListener('focus', refreshForNewPeriod);
    document.addEventListener('visibilitychange', () => { if (!document.hidden)
        refreshForNewPeriod(); });
    window.addEventListener('pageshow', refreshForNewPeriod);
    setInterval(refreshForNewPeriod, 15000);
})();
