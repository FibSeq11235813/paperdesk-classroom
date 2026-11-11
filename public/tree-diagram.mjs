const campGroups = 'Science: 2\nEnglish: 3\nMath: 4';

const outfitGroups = ['Shirt', 'Pants', 'Tie']
  .map(name => name + ': Red, Orange, Yellow, Green, Blue').join('\n');
const choiceKey = label => label.toLowerCase();

// A remaining stage needs its own available choice. Matching also lets us
// skip dead ends before enumerating their possible prefixes.
function canComplete(stages, depth, used) {
  const assignments = new Map();
  function assign(stageIndex, visited) {
    for (const label of stages[stageIndex].choices) {
      const key = choiceKey(label);
      if (used.has(key) || visited.has(key)) continue;
      visited.add(key);
      if (!assignments.has(key) || assign(assignments.get(key), visited)) {
        assignments.set(key, stageIndex);
        return true;
      }
    }
    return false;
  }

  for (let index = depth; index < stages.length; index++) {
    if (!assign(index, new Set())) return false;
  }
  return true;
}

export function buildTrees(text, mode = 'pairs', noRepeats = false) {
  const lines = text.trim().split(/\n/).filter(line => line.trim());
  if (lines.length < 2 || lines.length > 8) {
    throw new Error('Enter 2–8 groups, one per line.');
  }
  const names = new Set();
  const prefixes = new Set();
  const groups = lines.map(line => {
    const match = /^([^:]{1,36}):\s*(.+)$/.exec(line.trim());
    if (!match || !match[1].trim()) {
      throw new Error('Enter a group followed by a count or comma-separated choices.');
    }
    const name = match[1].trim();
    const key = choiceKey(name);
    if (names.has(key)) throw new Error('Give each group a distinct name.');
    names.add(key);
    const initial = name[0].toUpperCase();
    let prefix = initial;
    for (let suffix = 2; prefixes.has(prefix); suffix++) prefix = initial + suffix + '-';
    prefixes.add(prefix);

    const value = match[2].trim();
    let choices;
    if (/^\d+$/.test(value)) {
      const count = Number(value);
      if (count < 1 || count > 24) throw new Error('Use a count from 1 to 24.');
      choices = Array.from({length: count}, (_, index) => prefix + (index + 1));
    } else {
      choices = value.split(',').map(label => label.trim());
      if (choices.length > 24 || choices.some(label => !label || label.length > 24)) {
        throw new Error('Enter up to 24 nonempty choices per group, each at most 24 characters.');
      }
      if (new Set(choices.map(choiceKey)).size !== choices.length) {
        throw new Error('List each choice only once within a group.');
      }
    }
    return {name, choices};
  });

  const sets = mode === 'stages'
    ? [groups]
    : groups.flatMap((group, index) => groups.slice(index + 1).map(other => [group, other]));
  let total = 0;
  const trees = sets.map(stages => {
    const used = new Set();
    function branch(depth, label) {
      if (depth === stages.length) {
        total++;
        if (total > 600) throw new Error('This would draw more than 600 outcomes. Reduce the group counts.');
        return {label, count: 1, children: []};
      }
      if (noRepeats && !canComplete(stages, depth, used)) return null;
      const children = [];
      for (const choice of stages[depth].choices) {
        const key = choiceKey(choice);
        if (noRepeats && used.has(key)) continue;
        if (noRepeats) used.add(key);
        const child = branch(depth + 1, choice);
        if (noRepeats) used.delete(key);
        if (child) children.push(child);
      }
      return {label, count: children.reduce((sum, child) => sum + child.count, 0), children};
    }

    const root = branch(0, 'Start');
    return {stages, root, count: root?.count ?? 0};
  });
  return {trees, total};
}

function countLabel(tree) {
  let level = tree.root ? [tree.root] : [];
  const factors = [];
  for (const stage of tree.stages) {
    if (!level.length || level.some(node => node.children.length !== level[0].children.length)) {
      return tree.count + ' outcomes';
    }
    factors.push(level[0].children.length);
    level = level.flatMap(node => node.children);
  }
  return (factors.length > 1 ? factors.join(' × ') + ' = ' : '') + tree.count + ' outcomes';
}

function treeGraphic({stages, count, root, prefix = [], branchPath = []}, onFocus) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const longest = stages.map(stage => Math.max(...stage.choices.map(choice => choice.length)));
  const nodeWidth = Math.max(50, 7 * Math.max(root?.label.length || 0, ...longest) + 14);
  const spacing = Math.max(142, nodeWidth + 40);
  const outcomeWidth = 7 * (longest.reduce((sum, length) => sum + length, 0) + prefix.join(' + ').length + 3 * stages.length);
  const width = spacing * stages.length + nodeWidth + Math.max(146, outcomeWidth + 32);
  const height = 62 + count * 25;
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-label', 'Outcome tree for ' + stages.map(stage => stage.name).join(' and '));
  function add(tag, attrs, label, parent = svg) {
    const element = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    if (label !== undefined) element.textContent = label;
    parent.append(element);
    return element;
  }
  const colors = ['#176d80', '#5942a5', '#985128', '#31683f'];
  const xAt = depth => nodeWidth / 2 + 7 + depth * spacing;
  const yAt = row => 49 + row * 25;
  const heading = {fill: '#344a62', 'font-size': 12, 'font-weight': 700};
  stages.forEach((stage, index) => add('text', {...heading, x: xAt(index + 1), y: 22, 'text-anchor': 'middle'},
    stage.name.length > 19 ? stage.name.slice(0, 18) + '…' : stage.name));
  add('text', {...heading, x: xAt(stages.length) + nodeWidth / 2 + 21, y: 22}, 'Outcome');

  function branch(node, depth, start, path, indices) {
    const x = xAt(depth);
    const y = yAt(start + (node.count - 1) / 2);
    let childStart = start;
    for (const [index, child] of node.children.entries()) {
      const childY = yAt(childStart + (child.count - 1) / 2);
      add('line', {x1: x, y1: y, x2: xAt(depth + 1), y2: childY, stroke: '#a3b5c6', 'stroke-width': 1.3});
      branch(child, depth + 1, childStart, [...path, child.label], [...indices, index]);
      childStart += child.count;
    }
    if (!node.children.length) {
      add('text', {x: x + nodeWidth / 2 + 21, y: y + 4, fill: '#344a62', 'font-size': 12}, path.join(' + '));
    }
    let target = svg;
    if (onFocus && depth && node.children.length) {
      target = add('g', {class: 'tree-branch-focus', tabindex: 0, role: 'button',
        'aria-label': 'Focus branch ' + path.join(' + ')});
      target.onclick = () => onFocus(indices);
      target.onkeydown = event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        onFocus(indices);
      };
    }
    const width = Math.max(50, node.label.length * 7 + 14);
    add('rect', {x: x - width / 2, y: y - 10, width, height: 20, rx: 6, fill: depth ? colors[(depth - 1) % colors.length] : '#24384e'}, undefined, target);
    add('text', {x, y: y + 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#fff'}, node.label, target);
  }

  if (root) branch(root, 0, 0, prefix, branchPath);
  else add('text', {...heading, x: 18, y: 47}, 'No valid outcomes under these rules.');
  return svg;
}

function setTreeBounds(card, bounds) {
  for (const [key, value] of Object.entries(bounds)) card.style[key] = value * 100 + '%';
}

export function arrangeTrees(sizes, width, height) {
  let best = {columns: 1, rows: sizes.length, scale: 0};
  const gap = .016;
  for (let columns = 1; columns <= sizes.length; columns++) {
    const rows = Math.ceil(sizes.length / columns);
    const cellWidth = width * (1 / columns - gap);
    const cellHeight = height * (1 / rows - gap);
    const scale = Math.min(...sizes.map(size =>
      Math.min((cellWidth - 16) / size.width, (cellHeight - 58) / size.height)));
    if (columns === 1 || scale > best.scale) best = {columns, rows, scale};
  }
  const {columns, rows} = best;
  return sizes.map((_, index) => ({
    left: (index % columns) / columns + gap / 2,
    top: Math.floor(index / columns) / rows + gap / 2,
    width: 1 / columns - gap,
    height: 1 / rows - gap
  }));
}

function bindTreeHandle(handle, stage, card, resize, onLayout) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function move(dx, dy, start) {
    const next = {...start};
    if (resize) {
      next.width = clamp(start.width + dx, Math.min(.06, 1 - start.left), 1 - start.left);
      next.height = clamp(start.height + dy, Math.min(.08, 1 - start.top), 1 - start.top);
    } else {
      next.left = clamp(start.left + dx, 0, 1 - start.width);
      next.top = clamp(start.top + dy, 0, 1 - start.height);
    }
    card.treeBounds = next;
    setTreeBounds(card, next);
    onLayout(next);
  }

  handle.onpointerdown = event => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.focus({preventScroll: true});
    handle.setPointerCapture(event.pointerId);
    const start = card.treeBounds;
    const {clientX, clientY, pointerId} = event;
    const {width, height} = stage.getBoundingClientRect();
    handle.onpointermove = next => {
      if (next.pointerId === pointerId) move((next.clientX - clientX) / width, (next.clientY - clientY) / height, start);
    };
    handle.onlostpointercapture = () => { handle.onpointermove = null; };
  };
  handle.onkeydown = event => {
    const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction[0] * .02, direction[1] * .02, card.treeBounds);
  };
}

// Both windows use this renderer. Only the teacher attaches editing handles.
function focusBranch(tree, path) {
  let root = tree.root;
  const prefix = [];
  for (const index of path) {
    root = root.children[index];
    prefix.push(root.label);
  }
  return {root, prefix, branchPath: path, stages: tree.stages.slice(path.length), count: root.count};
}

export function createTreeScene(body, onLayout, onFocus) {
  const stage = document.createElement('div');
  stage.className = 'tree-diagram-stage';
  const total = document.createElement('strong');
  total.className = 'tree-diagram-total';
  total.hidden = true;
  body.replaceChildren(stage, total);
  let contentKey;
  let cards = [];
  let sizes = [];

  function render(state) {
    const key = JSON.stringify([state.text, state.mode, state.noRepeats, state.view, state.counts, state.focus]);
    if (key !== contentKey) {
      const diagram = buildTrees(state.text, state.mode, state.noRepeats);
      const selected = state.focus ? [diagram.trees[state.focus.tree]]
        : state.view === 'all' ? diagram.trees : [diagram.trees[Number(state.view)]];
      cards = selected.map((tree, index) => {
        const card = document.createElement('section');
        card.className = 'tree-diagram-card';
        const editable = onLayout && !state.focus;
        const title = document.createElement(editable ? 'button' : 'strong');
        title.className = 'tree-card-title';
        const branch = state.focus?.path.length ? focusBranch(tree, state.focus.path) : tree;
        const treeIndex = state.focus?.tree ?? (state.view === 'all' ? index : Number(state.view));
        title.textContent = tree.stages.map(stage => stage.name).join(' + ');
        if (branch.prefix) title.textContent += ' · ' + branch.prefix.join(' → ');
        const graphic = treeGraphic(branch, onFocus && (path => onFocus({tree: treeIndex, path})));
        card.append(title, graphic);
        if (state.counts) {
          const count = document.createElement('p');
          count.textContent = countLabel(branch);
          card.append(count);
        }
        if (onFocus && !state.focus) {
          const focus = document.createElement('button');
          focus.type = 'button';
          focus.className = 'tree-card-focus';
          focus.textContent = 'Focus';
          focus.setAttribute('aria-label', 'Focus ' + title.textContent);
          focus.onclick = () => onFocus({tree: treeIndex, path: []});
          card.classList.add('tree-card-can-focus');
          card.append(focus);
        }
        if (editable) {
          const resize = document.createElement('button');
          resize.type = title.type = 'button';
          resize.className = 'tree-card-resize';
          resize.textContent = '↘';
          title.setAttribute('aria-label', 'Move ' + title.textContent);
          resize.setAttribute('aria-label', 'Resize ' + title.textContent);
          card.append(resize);
          const update = bounds => onLayout(index, bounds);
          bindTreeHandle(title, stage, card, false, update);
          bindTreeHandle(resize, stage, card, true, update);
        }
        return card;
      });
      sizes = cards.map(card => {
        const svg = card.querySelector('svg');
        return {width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height'))};
      });
      stage.replaceChildren(...cards);
      total.hidden = !state.counts || selected.length < 2;
      total.textContent = total.hidden ? '' : selected.map(tree => tree.count).join(' + ') + ' = ' + diagram.total + ' total outcomes';
      contentKey = key;
    }
    const layout = (!state.focus && state.layout) || arrangeTrees(sizes, stage.clientWidth || 800, stage.clientHeight || 500);
    cards.forEach((card, index) => {
      card.treeBounds = layout[index];
      setTreeBounds(card, layout[index]);
    });
    return layout;
  }
  return {render};
}

export function mountTreeDiagram(bar, body) {
  const panel = body.parentElement;
  panel.classList.add('tree-diagram-panel');
  panel.style.left = '6px';
  panel.style.top = '12px';
  bar.innerHTML = `
    <label>Groups and choices<textarea rows="3" aria-label="Groups and choices" placeholder="Shirt: Red, Blue, Green"></textarea></label>
    <label>Choices <select data-mode>
      <option value="pairs">Two from different groups</option>
      <option value="stages">One from each group</option>
    </select></label>
    <label><input type="checkbox" data-no-repeats> No repeated choices</label>
    <button type="button" data-generate>Generate trees</button>
    <button type="button" data-preset>Camp example</button>
    <button type="button" data-outfit>Outfit example</button>
    <label>Display <select data-view aria-label="Tree to display"></select></label>
    <label><input type="checkbox" data-counts> Show counts</label>
    <button type="button" data-arrange>Arrange trees</button>
    <button type="button" data-focus-back hidden>Back</button>
    <label><input type="checkbox" data-fit checked> Fit clean screen</label>
    <p class="widget-error" role="status"></p>`;
  const input = bar.querySelector('textarea');
  const mode = bar.querySelector('[data-mode]');
  const view = bar.querySelector('[data-view]');
  const counts = bar.querySelector('[data-counts]');
  const noRepeats = bar.querySelector('[data-no-repeats]');
  const error = bar.querySelector('[role=status]');
  const fit = bar.querySelector('[data-fit]');
  const layouts = new Map();
  const back = bar.querySelector('[data-focus-back]');
  let committed;
  let focus = null;

  const scene = createTreeScene(body, (index, bounds) => {
    layouts.get(view.value)[index] = bounds;
    publish();
  }, next => {
    focus = next;
    render();
    back.focus();
  });

  function publish() {
    if (!committed) return;
    panel.dataset.treeState = JSON.stringify({
      ...committed, view: view.value, counts: counts.checked, layout: layouts.get(view.value), fit: fit.checked, focus
    });
  }

  function render() {
    const layout = scene.render({
      ...committed, view: view.value, counts: counts.checked, layout: layouts.get(view.value), focus
    });
    if (!focus) layouts.set(view.value, layout);
    back.hidden = !focus;
    publish();
  }

  function generate() {
    try {
      const next = {text: input.value, mode: mode.value, noRepeats: noRepeats.checked};
      const diagram = buildTrees(next.text, next.mode, next.noRepeats);
      committed = next;
      focus = null;
      layouts.clear();
      view.replaceChildren(...diagram.trees.map((tree, index) =>
        new Option(tree.stages.map(stage => stage.name).join(' + '), String(index))));
      if (diagram.trees.length > 1) {
        view.add(new Option('All trees', 'all'));
        view.value = 'all';
      }
      error.textContent = '';
      render();
    } catch (problem) {
      error.textContent = problem.message;
    }
  }

  function preset(groups, choices, distinct) {
    input.value = groups;
    mode.value = choices;
    noRepeats.checked = distinct;
    counts.checked = false;
    generate();
  }

  bar.querySelector('[data-generate]').onclick = generate;
  bar.querySelector('[data-preset]').onclick = () => preset(campGroups, 'pairs', false);
  bar.querySelector('[data-outfit]').onclick = () => preset(outfitGroups, 'stages', true);
  bar.querySelector('[data-arrange]').onclick = () => {
    focus = null;
    layouts.delete(view.value);
    render();
  };
  back.onclick = () => {
    focus = focus.path.length ? {...focus, path: focus.path.slice(0, -1)} : null;
    render();
    if (!focus) view.focus();
  };
  view.onchange = () => {
    focus = null;
    render();
  };
  counts.onchange = render;
  fit.onchange = publish;
  const resizeObserver = new ResizeObserver(() => {
    panel.dataset.treeSize = panel.offsetWidth + 'x' + panel.offsetHeight;
  });
  resizeObserver.observe(panel);
  preset(campGroups, 'pairs', false);
}
