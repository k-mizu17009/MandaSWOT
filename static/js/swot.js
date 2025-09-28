(() => {
  const state = {
    swot: { strengths: [], weaknesses: [], opportunities: [], threats: [], crossNotes: { SO: [], WO: [], ST: [], WT: [] }, priorities: [], actionPlan90: '' },
    undoStack: [],
    redoStack: [],
  };

  const quadrants = ["strengths", "weaknesses", "opportunities", "threats"];

  function pushHistory() {
    state.undoStack.push(JSON.stringify(state.swot));
    state.redoStack.length = 0;
  }

  function save() {
    const base = (window.APP_BASE || '');
    fetch(base + '/api/swot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.swot)
    });
  }

  function buildPromptFromItems(items, type) {
    const instruction = [
      'あなたは経営コーチです。以下の優先度リストを基に、90日アクションプランを提案してください。',
      '- 30日/60日/90日の3フェーズに分ける',
      '- 各フェーズのマイルストーン、担当（仮）、必要リソース、KPIを含める',
      '- 依存関係とリスク/軽減策も併記する',
      '- 日本語で簡潔に、箇条書きで',
    ].join('\n');

    if (type === 'json') {
      return JSON.stringify({ instruction, priorities: items }, null, 2);
    }

    const bullets = items.map((p,i)=>{
      const note = p.comment ? `｜備考:${p.comment}` : '';
      return `- ${p.title} (重要性:${p.impact}/緊急性:${p.urgency}/解決可能性:${p.feasibility}${note})`;
    }).join('\n');

    return `${instruction}\n\n優先度リスト:\n${bullets}`;
  }

  function render() {
    for (const key of quadrants) {
      const container = document.getElementById(`q-${key}`);
      container.innerHTML = '';
      state.swot[key].forEach((card, idx) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.draggable = true;
        el.dataset.key = key;
        el.dataset.index = String(idx);

        const input = document.createElement('textarea');
        input.value = card.text || '';
        input.rows = 1;
        input.style.height = 'auto';
        const autoresize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 200) + 'px'; };
        input.addEventListener('input', () => { card.text = input.value; autoresize(); pushHistory(); save(); });
        input.addEventListener('focus', () => el.classList.add('editing'));
        input.addEventListener('blur', () => el.classList.remove('editing'));
        setTimeout(autoresize, 0);

        const del = document.createElement('button');
        del.textContent = '削除';
        del.onclick = () => {
          pushHistory();
          state.swot[key].splice(idx, 1);
          render();
          save();
        };

        el.appendChild(input);
        el.appendChild(del);

        // DnD events
        el.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ key, idx }));
        });

        container.appendChild(el);
      });

      // Allow drop on container
      container.addEventListener('dragover', e => e.preventDefault());
      container.addEventListener('drop', e => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const targetKey = key;
        const fromList = state.swot[data.key];
        const toList = state.swot[targetKey];
        const [moved] = fromList.splice(data.idx, 1);
        toList.push(moved);
        pushHistory();
        render();
        save();
      });
    }

    // Strategies
    const base = (window.APP_BASE || '');
    fetch(base + '/api/swot/strategies').then(r => r.json()).then(strats => {
      const wrap = document.getElementById('strategies');
      wrap.innerHTML = '';
      const activeTab = document.querySelector('.tabs button.active')?.dataset.tab || 'SO';
      const list = document.createElement('ul');
      (strats[activeTab] || []).forEach(s => {
        const li = document.createElement('li');
        li.textContent = s;
        list.appendChild(li);
      });
      wrap.appendChild(list);
    });

    // Cross notes list bind
    const map = { SO: 'list-so', WO: 'list-wo', ST: 'list-st', WT: 'list-wt' };
    Object.entries(map).forEach(([k, id]) => {
      const list = document.getElementById(id);
      if (!list) return;
      list.innerHTML = '';
      const arr = state.swot.crossNotes?.[k] || [];
      arr.forEach((text, idx) => {
        const row = document.createElement('div'); row.className = 'note-row';
        const ta = document.createElement('textarea'); ta.value = text;
        ta.oninput = () => { state.swot.crossNotes[k][idx] = ta.value; save(); };
        const del = document.createElement('button'); del.className = 'del'; del.textContent = '削除';
        del.onclick = () => { pushHistory(); state.swot.crossNotes[k].splice(idx,1); render(); save(); };
        row.appendChild(ta); row.appendChild(del); list.appendChild(row);
      });
    });

    // Priorities render
    const listEl = document.getElementById('priority-list');
    if (listEl) {
      const sort = document.getElementById('sort-priority')?.value || 'none';
      const items = (state.swot.priorities || []).map((p, idx) => ({...p, _i: idx}));
      items.forEach(it => { it.sum = (Number(it.impact||0)+Number(it.urgency||0)+Number(it.feasibility||0)); });
      if (sort !== 'none') {
        items.sort((a,b) => sort === 'asc' ? a.sum - b.sum : b.sum - a.sum);
      }
      listEl.innerHTML = '';
      items.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'priority-item';
        const left = document.createElement('div');
        if (p.locked) {
          const titleStatic = document.createElement('div');
          titleStatic.className = 'title readonly';
          titleStatic.textContent = p.title || '';
          left.appendChild(titleStatic);
        } else {
          const title = document.createElement('textarea');
          title.className = 'title';
          title.value = p.title || '';
          title.oninput = () => { state.swot.priorities[p._i].title = title.value; pushHistory(); save(); };
          left.appendChild(title);
        }

        const right = document.createElement('div');
        right.className = 'scores';
        const makeNum = (label, key) => {
          const wrap = document.createElement('label');
          wrap.textContent = label+' ';
          const input = document.createElement('input');
          input.type = 'number'; input.min = '1'; input.max = '5';
          input.value = String(p[key] ?? 3);
          input.oninput = () => { state.swot.priorities[p._i][key] = Number(input.value || 0); render(); save(); };
          wrap.appendChild(input);
          return wrap;
        };
        right.appendChild(makeNum('重要性', 'impact'));
        right.appendChild(makeNum('緊急性', 'urgency'));
        right.appendChild(makeNum('解決可能性', 'feasibility'));
        const sum = document.createElement('div'); sum.className = 'sum'; sum.textContent = String(p.sum || 0); sum.title = '合計点(優先順位)'; right.appendChild(sum);
        const comment = document.createElement('textarea');
        comment.className = 'comment';
        comment.placeholder = '備考';
        comment.value = p.comment || '';
        comment.oninput = () => { state.swot.priorities[p._i].comment = comment.value; save(); };
        right.appendChild(comment);
        const del = document.createElement('button'); del.className = 'del'; del.textContent = '削除';
        del.onclick = () => { pushHistory(); state.swot.priorities.splice(p._i, 1); render(); save(); };
        right.appendChild(del);

        row.appendChild(left); row.appendChild(right);
        listEl.appendChild(row);
      });

      // Export preview
      const preview = document.getElementById('export-preview');
      if (preview) {
        const text = items.map((p,i)=>`- ${p.title} (効果:${p.impact??''}/緊急:${p.urgency??''}/実現:${p.feasibility??''}${p.comment?`｜備考:${p.comment}`:''})`).join('\n');
        preview.textContent = text;
        preview.dataset.json = JSON.stringify(items.map(({title, impact, urgency, feasibility, comment, locked})=>({title, impact, urgency, feasibility, comment, locked})), null, 2);
      }
    }

    // 90-day plan bind
    const planEl = document.getElementById('plan-90d');
    if (planEl) {
      planEl.value = state.swot.actionPlan90 || '';
      const modeSel = document.getElementById('plan-mode');
      if (modeSel) modeSel.value = state.swot.actionPlan90Mode || 'md';
      const preview = document.getElementById('plan-90d-preview');
      const renderMd = () => { if (preview && window.marked) { preview.innerHTML = window.marked.parse(planEl.value || ''); } };
      const applyMode = () => {
        const mode = modeSel ? modeSel.value : 'md';
        state.swot.actionPlan90Mode = mode; save();
        if (mode === 'md') { renderMd(); preview.style.display = ''; }
        else { preview.style.display = 'none'; }
      };
      planEl.oninput = () => { state.swot.actionPlan90 = planEl.value; save(); if ((modeSel?.value||'md')==='md') renderMd(); };
      if (modeSel) modeSel.addEventListener('change', applyMode);
      applyMode();
    }
  }

  function addCard(key) {
    pushHistory();
    state.swot[key].push({ text: '' });
    render();
    save();
  }

  function setupTabs() {
    document.querySelectorAll('.tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });
  }

  function setupAddButtons() {
    document.querySelectorAll('.add-card').forEach(btn => {
      btn.addEventListener('click', () => addCard(btn.dataset.target));
    });
    const addPriority = document.getElementById('add-priority');
    if (addPriority) {
      addPriority.addEventListener('click', () => {
        pushHistory();
        state.swot.priorities = state.swot.priorities || [];
        state.swot.priorities.push({ title: '', impact: 5, urgency: 5, feasibility: 5, comment: '', locked: false });
        render();
        save();
      });
    }
    const sortSel = document.getElementById('sort-priority');
    if (sortSel) sortSel.addEventListener('change', render);

    const syncBtn = document.getElementById('sync-priority');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        const cn = state.swot.crossNotes || { SO: [], WO: [], ST: [], WT: [] };
        const lines = [ ...cn.SO, ...cn.WO, ...cn.ST, ...cn.WT ]
          .map(s => (s || '').trim())
          .filter(s => s.length > 0);
        if (lines.length === 0) return;
        pushHistory();
        state.swot.priorities = state.swot.priorities || [];
        lines.forEach(txt => {
          if (!state.swot.priorities.some(p => (p.title || '').trim() === txt)) {
            state.swot.priorities.push({ title: txt, impact: 5, urgency: 5, feasibility: 5, comment: '', locked: true });
          }
        });
        render();
        save();
      });
    }

    // add row buttons for cross notes
    document.querySelectorAll('[data-note-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-note-add');
        state.swot.crossNotes = state.swot.crossNotes || { SO: [], WO: [], ST: [], WT: [] };
        pushHistory();
        state.swot.crossNotes[k].push('');
        render();
        save();
      });
    });

    // copy actions for export
    const copyText = document.getElementById('copy-text');
    const copyJson = document.getElementById('copy-json');
    if (copyText) copyText.addEventListener('click', async () => {
      const preview = document.getElementById('export-preview');
      if (!preview) return;
      const items = (() => { try { return JSON.parse(preview.dataset.json || '[]'); } catch { return []; } })();
      const payload = buildPromptFromItems(items, 'text');
      try { await navigator.clipboard.writeText(payload); copyText.textContent = 'コピーしました'; setTimeout(()=>copyText.textContent='テキストをコピー',1500); } catch {}
    });
    if (copyJson) copyJson.addEventListener('click', async () => {
      const preview = document.getElementById('export-preview');
      if (!preview) return;
      const items = (() => { try { return JSON.parse(preview.dataset.json || '[]'); } catch { return []; } })();
      const payload = buildPromptFromItems(items, 'json');
      try { await navigator.clipboard.writeText(payload); copyJson.textContent = 'コピーしました'; setTimeout(()=>copyJson.textContent='JSONをコピー',1500); } catch {}
    });

    // plan toolbar actions
    const tmplBtn = document.getElementById('plan-insert-template');
    const planEl = document.getElementById('plan-90d');
    if (tmplBtn && planEl) {
      tmplBtn.addEventListener('click', () => {
        const tmpl = `## 30日目標\n- [ ] \n\n## 60日目標\n- [ ] \n\n## 90日目標\n- [ ] `;
        planEl.value = tmpl; state.swot.actionPlan90 = tmpl; save();
        const e = new Event('input'); planEl.dispatchEvent(e);
      });
    }
    document.querySelectorAll('[data-md-insert]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!planEl) return; const token = btn.getAttribute('data-md-insert');
        const start = planEl.selectionStart || 0; const end = planEl.selectionEnd || 0;
        const v = planEl.value; planEl.value = v.slice(0,start) + token + v.slice(end);
        state.swot.actionPlan90 = planEl.value; save();
        const pos = start + token.length; planEl.selectionStart = planEl.selectionEnd = pos;
        const e = new Event('input'); planEl.dispatchEvent(e);
      });
    });
    document.querySelectorAll('[data-md-surround]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!planEl) return; const sym = btn.getAttribute('data-md-surround');
        const start = planEl.selectionStart || 0; const end = planEl.selectionEnd || 0;
        const v = planEl.value; const sel = v.slice(start,end);
        planEl.value = v.slice(0,start) + sym + sel + sym + v.slice(end);
        state.swot.actionPlan90 = planEl.value; save();
        const pos = end + sym.length*2; planEl.selectionStart = planEl.selectionEnd = pos;
        const e = new Event('input'); planEl.dispatchEvent(e);
      });
    });

    const copyPlan = document.getElementById('copy-plan-preview');
    if (copyPlan && planEl) {
      copyPlan.addEventListener('click', async () => {
        const mode = (document.getElementById('plan-mode')?.value) || 'md';
        if (mode === 'md') {
          // copy rendered HTML converted to markdown-ish text
          const text = planEl.value || '';
          try { await navigator.clipboard.writeText(text); copyPlan.textContent = 'コピーしました'; setTimeout(()=>copyPlan.textContent='プレビューをコピー',1500);} catch {}
        } else {
          try { await navigator.clipboard.writeText(planEl.value || ''); copyPlan.textContent = 'コピーしました'; setTimeout(()=>copyPlan.textContent='プレビューをコピー',1500);} catch {}
        }
      });
    }
  }

  function setupUndoRedo() {
    window.addEventListener('keydown', e => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const prev = state.undoStack.pop();
        if (prev) {
          state.redoStack.push(JSON.stringify(state.swot));
          state.swot = JSON.parse(prev);
          render();
          save();
        }
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        const next = state.redoStack.pop();
        if (next) {
          state.undoStack.push(JSON.stringify(state.swot));
          state.swot = JSON.parse(next);
          render();
          save();
        }
      }
    });
  }

  function init() {
    const base = (window.APP_BASE || '');
    fetch(base + '/api/swot').then(r => r.json()).then(data => {
      // migrate old crossNotes string format to arrays if needed
      if (data.crossNotes && typeof data.crossNotes.SO === 'string') {
        data.crossNotes = {
          SO: data.crossNotes.SO ? data.crossNotes.SO.split(/\r?\n/).filter(Boolean) : [],
          WO: data.crossNotes.WO ? data.crossNotes.WO.split(/\r?\n/).filter(Boolean) : [],
          ST: data.crossNotes.ST ? data.crossNotes.ST.split(/\r?\n/).filter(Boolean) : [],
          WT: data.crossNotes.WT ? data.crossNotes.WT.split(/\r?\n/).filter(Boolean) : [],
        };
      }
      state.swot = data;
      if (typeof state.swot.actionPlan90 !== 'string') state.swot.actionPlan90 = '';
      render();
    });
    setupAddButtons();
    setupTabs();
    setupUndoRedo();
  }

  document.addEventListener('DOMContentLoaded', init);
})();


