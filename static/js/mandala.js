(() => {
  const state = { data: null, currentId: 'root', undoStack: [], redoStack: [] };

  function pushHistory() {
    state.undoStack.push(JSON.stringify(state.data));
    state.redoStack.length = 0;
  }

  let saveTimer = null;
  function saveNow() {
    const base = (window.APP_BASE || '');
    fetch(base + '/api/mandala', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data)
    });
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }

  function render() {
    const wrap = document.getElementById('mandala-app');
    wrap.innerHTML = '';
    const node = state.data.nodes[state.currentId];
    const cells = [0,1,2,3,'center',4,5,6,7];
    cells.forEach(pos => {
      const div = document.createElement('div');
      let klass = 'cell';
      if (pos === 'center') {
        klass += ' theme';
      } else if (typeof pos === 'number') {
        // 0-3: 成果(青), 4-7: 成長(緑)
        klass += (pos <= 3 ? ' cat-outcome' : ' cat-growth');
      }
      div.className = klass;
      if (pos === 'center') {
        const input = document.createElement('textarea');
        input.value = node.title || '';
        input.rows = 1; input.style.height = 'auto';
        const autoresize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 300) + 'px'; };
        input.oninput = () => { node.title = input.value; autoresize(); save(); };
        setTimeout(autoresize, 0);
        div.appendChild(input);
      } else {
        const idx = pos;
        const cell = node.cells[idx];
        const input = document.createElement('textarea');
        const textValue = (typeof cell === 'string') ? cell : (cell?.text || '');
        input.value = textValue;
        input.rows = 1; input.style.height = 'auto';
        const autoresize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 220) + 'px'; };
        input.oninput = () => {
          const current = node.cells[idx];
          if (typeof current === 'string') {
            node.cells[idx] = { text: input.value };
          } else {
            current.text = input.value;
          }
          autoresize(); save();
        };
        setTimeout(autoresize, 0);
        input.onchange = () => ensureChild(idx);
        div.appendChild(input);

        // 1クリックで拡大表示ボタン
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'open-btn';
        openBtn.title = 'この9マスを開く';
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          ensureChild(idx);
          navigateToChild(idx);
        });
        div.appendChild(openBtn);

        div.draggable = true;
        div.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', String(idx));
        });
        div.addEventListener('dragover', e => e.preventDefault());
        div.addEventListener('drop', e => {
          e.preventDefault();
          const from = Number(e.dataTransfer.getData('text/plain'));
          const tmp = node.cells[from];
          node.cells[from] = node.cells[idx];
          node.cells[idx] = tmp;
          pushHistory();
          render();
          save();
        });
      }
      wrap.appendChild(div);
    });

    // Breadcrumbs
    const backBtn = document.createElement('button');
    backBtn.textContent = '戻る';
    backBtn.onclick = () => navigateBack();
    wrap.appendChild(backBtn);
  }

  function render81() {
    const wrap = document.getElementById('mandala-app');
    wrap.innerHTML = '';
    wrap.classList.add('view-81');
    
    const root = state.data.nodes['root'];
    const editBtn = document.getElementById('toggle-81-edit');
    if (editBtn) {
      editBtn.style.display = '';
      if (!editBtn.dataset.mode) {
        editBtn.dataset.mode = 'OFF';
        editBtn.textContent = '編集モード: OFF';
      }
    }
    
    // 9x9=81マスの曼荼羅構造
    const chapterMap = [
      [0,0,0, 1,1,1, 2,2,2],
      [0,0,0, 1,1,1, 2,2,2], 
      [0,0,0, 1,1,1, 2,2,2],
      [3,3,3, -1,-1,-1, 4,4,4],  // -1は中央テーマ
      [3,3,3, -1,-1,-1, 4,4,4],
      [3,3,3, -1,-1,-1, 4,4,4],
      [5,5,5, 6,6,6, 7,7,7],
      [5,5,5, 6,6,6, 7,7,7],
      [5,5,5, 6,6,6, 7,7,7]
    ];
    
    function ensureObjectInArray(arr, index) {
      if (typeof arr[index] === 'string') arr[index] = { text: arr[index] };
      if (!arr[index]) arr[index] = { text: '' };
      return arr[index];
    }

    function applyStageClass(div, stage) {
      div.classList.remove('stage-1','stage-2','stage-3');
      if (stage === 1) div.classList.add('stage-1');
      if (stage === 2) div.classList.add('stage-2');
      if (stage === 3) div.classList.add('stage-3');
    }

    function addStageBadge(div, refObj, prop) {
      const stage = Number(refObj[prop] || 0);
      applyStageClass(div, stage);
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'stage-dot';
      dot.title = '進捗トグル';
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = Number(refObj[prop] || 0);
        const next = (current + 1) % 4; // 0→1→2→3→0
        refObj[prop] = next;
        applyStageClass(div, next);
        save();
      });
      div.appendChild(dot);
    }

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const div = document.createElement('div');
        div.className = 'cell';
        div.style.gridColumn = String(col + 1);
        div.style.gridRow = String(row + 1);
        
        const input = document.createElement('textarea');
        input.style.height = '100%';
        input.style.resize = 'none';
        
        const chapterIdx = chapterMap[row][col];
        let stageRefObj = null; let stageProp = 'stage';

        if (chapterIdx === -1) {
          // 中央テーマエリア
          if (row === 4 && col === 4) {
            div.className += ' theme';
            input.value = root.title || '';
            input.readOnly = (document.getElementById('toggle-81-edit')?.dataset.mode !== 'ON');
            // センターにも任意でステージを持てるように
            stageRefObj = root; stageProp = 'centerStage';
          } else {
            // 中央エリアの周囲8マスに章タイトルを表示
            const centerPositions = [
              [3,3], [3,4], [3,5], // 上段: ①②③
              [4,5],        [5,5], // 右段: ④⑤
              [5,4], [5,3], [4,3]  // 下段+左段: ⑥⑦⑧
            ];
            const chapterTitles = [
              '明確なKPI設定',
              '業務プロセス最適化', 
              '優先順位とリソース配分',
              '成果の見える化と共有',
              '個別成長プラン策定',
              'フィードバック文化の醸成',
              'スキル習得支援',
              '自律性と責任感の育成'
            ];
            const posIdx = centerPositions.findIndex(([r,c]) => r === row && c === col);
            if (posIdx !== -1) {
              const chapterCell = ensureObjectInArray(root.cells, posIdx);
              input.value = (typeof chapterCell === 'string') ? chapterCell : (chapterCell?.text || '');
              div.className += ' theme';
              input.readOnly = (document.getElementById('toggle-81-edit')?.dataset.mode !== 'ON');
              stageRefObj = chapterCell; stageProp = 'stage';
            } else {
              input.value = '';
              input.style.opacity = '0.3';
            }
          }
        } else if (typeof chapterIdx === 'number') {
          // 各章のブロック
          const localRow = row % 3;
          const localCol = col % 3;
          
          if (localRow === 1 && localCol === 1) {
            // 章の中央マス（章タイトル）
            const cell = ensureObjectInArray(root.cells, chapterIdx);
            input.value = (typeof cell === 'string') ? cell : (cell?.text || '');
            div.className += ' theme chapter-center ' + (chapterIdx <= 3 ? 'cat-outcome' : 'cat-growth');
            input.readOnly = (document.getElementById('toggle-81-edit')?.dataset.mode !== 'ON');
            stageRefObj = cell; stageProp = 'stage';
          } else {
            // 章の周囲8マス
            const childId = `root-${chapterIdx}`;
            if (!state.data.nodes[childId]) {
              const parentCell = root.cells[chapterIdx];
              const title = (typeof parentCell === 'string') ? parentCell : (parentCell?.text || '');
              state.data.nodes[childId] = {
                title,
                cells: new Array(8).fill(0).map(() => ({ text: '' }))
              };
            }
            const child = state.data.nodes[childId];
            const posMap = [0,1,2, 3,-1,4, 5,6,7];
            const childIdx = posMap[localRow * 3 + localCol];
            if (childIdx !== -1 && child.cells[childIdx]) {
              const cc = ensureObjectInArray(child.cells, childIdx);
              input.value = (typeof cc === 'string') ? cc : (cc?.text || '');
              input.readOnly = (document.getElementById('toggle-81-edit')?.dataset.mode !== 'ON');
              div.className += ' ' + (chapterIdx <= 3 ? 'cat-outcome' : 'cat-growth');
              stageRefObj = cc; stageProp = 'stage';
            }
          }
        }
        
        div.appendChild(input);
        if (stageRefObj) addStageBadge(div, stageRefObj, stageProp);
        wrap.appendChild(div);
      }
    }
  }

  function ensureChild(idx) {
    const parent = state.data.nodes[state.currentId];
    const key = `${state.currentId}-${idx}`;
    if (!state.data.nodes[key]) {
      const title = (typeof parent.cells[idx] === 'string') ? (parent.cells[idx] || '') : (parent.cells[idx]?.text || '');
      state.data.nodes[key] = {
        title,
        cells: new Array(8).fill(0).map(() => ({ text: '' }))
      };
    }
  }

  function navigateToChild(idx) {
    const key = `${state.currentId}-${idx}`;
    pushHistory();
    const overlay = document.getElementById('mandala-overlay');
    const expanded = document.getElementById('mandala-expanded');
    if (overlay && expanded) {
      overlay.classList.add('active');
      // Render the selected 9-cells directly into the modal
      const idxNum = Number(String(idx));
      renderNodeInto(expanded, key, idxNum);
    } else {
      state.currentId = key;
      render();
    }
  }

  function renderNodeInto(container, nodeId, chapterIdx) {
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'mandala';
    container.appendChild(grid);
    const node = state.data.nodes[nodeId];
    const cells = [0,1,2,3,'center',4,5,6,7];
    const categoryClass = (typeof chapterIdx === 'number') ? (chapterIdx <= 3 ? ' cat-outcome' : ' cat-growth') : '';
    cells.forEach(pos => {
      const div = document.createElement('div');
      let klass = 'cell' + categoryClass;
      if (pos === 'center') klass += ' theme';
      div.className = klass;
      if (pos === 'center') {
        const input = document.createElement('textarea');
        input.value = node.title || '';
        input.rows = 1; input.style.height = 'auto';
        const autoresize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 300) + 'px'; };
        input.oninput = () => { node.title = input.value; autoresize(); save(); };
        setTimeout(autoresize, 0);
        div.appendChild(input);
      } else {
        const idx = pos;
        const cell = node.cells[idx];
        const input = document.createElement('textarea');
        const textValue = (typeof cell === 'string') ? cell : (cell?.text || '');
        input.value = textValue;
        input.rows = 1; input.style.height = 'auto';
        const autoresize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 220) + 'px'; };
        input.oninput = () => {
          const current = node.cells[idx];
          if (typeof current === 'string') {
            node.cells[idx] = { text: input.value };
          } else {
            current.text = input.value;
          }
          autoresize(); save();
        };
        setTimeout(autoresize, 0);
        div.appendChild(input);
      }
      grid.appendChild(div);
    });
  }

  function navigateBack() {
    if (state.currentId === 'root') return;
    const parts = state.currentId.split('-');
    parts.pop();
    state.currentId = parts.join('-') || 'root';
    render();
  }

  function setupUndoRedo() {
    window.addEventListener('keydown', e => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const prev = state.undoStack.pop();
        if (prev) {
          state.redoStack.push(JSON.stringify(state.data));
          state.data = JSON.parse(prev);
          render();
          save();
        }
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        const next = state.redoStack.pop();
        if (next) {
          state.undoStack.push(JSON.stringify(state.data));
          state.data = JSON.parse(next);
          render();
          save();
        }
      }
    });
  }

  function init() {
    const base = (window.APP_BASE || '');
    fetch(base + '/api/mandala').then(r => r.json()).then(data => {
      state.data = data;
      render();
    });
    setupUndoRedo();

    const toggle81 = document.getElementById('toggle-81-view');
    if (toggle81) {
      toggle81.addEventListener('click', () => {
        const wrap = document.getElementById('mandala-app');
        const willEnable81 = !wrap.classList.contains('view-81');
        if (willEnable81) {
          wrap.classList.add('view-81');
          render81();
          toggle81.textContent = '9マス表示に戻る';
        } else {
          wrap.classList.remove('view-81');
          render();
          toggle81.textContent = '81マス表示切替';
        }
      });
    }

    const exportBtn = document.getElementById('export-md');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const md = buildMarkdown(state.data);
        const prev = document.getElementById('md-preview');
        if (prev) prev.textContent = md;
        try { await navigator.clipboard.writeText(md); exportBtn.textContent = 'コピーしました'; setTimeout(()=>exportBtn.textContent='Markdown出力をコピー',1500);} catch {}
      });
    }

    const overlay = document.getElementById('mandala-overlay');
    const closeBtn = document.getElementById('close-overlay');
    if (closeBtn) closeBtn.onclick = () => { overlay?.classList.remove('active'); };

    const editBtn = document.getElementById('toggle-81-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const cur = editBtn.dataset.mode === 'ON' ? 'OFF' : 'ON';
        editBtn.dataset.mode = cur;
        editBtn.textContent = `編集モード: ${cur}`;
        const wrap = document.getElementById('mandala-app');
        if (wrap.classList.contains('view-81')) {
          // Re-render 81 view to apply readOnly toggle
          render81();
        }
      });
    }
  }

  function buildMarkdown(data) {
    const lines = [];
    const walk = (id) => {
      const node = data.nodes[id];
      lines.push(`### ${node.title || ''}`);
      (node.cells||[]).forEach((c, i) => {
        if (typeof c !== 'object') return;
        lines.push(`- マス${i+1}：${c.text||''}`);
      });
      (node.cells||[]).forEach((_, i) => {
        const cid = `${id}-${i}`;
        if (data.nodes[cid]) { lines.push(''); walk(cid); }
      });
    };
    walk(data.rootId);
    return lines.join('\n');
  }

  document.addEventListener('DOMContentLoaded', init);
})();