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
  return factors.join(' × ') + ' = ' + tree.count + ' outcomes';
}

function treeGraphic({stages, count, root}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const longest = stages.map(stage => Math.max(...stage.choices.map(choice => choice.length)));
  const nodeWidth = Math.max(50, 7 * Math.max(...longest) + 14);
  const spacing = Math.max(142, nodeWidth + 40);
  const outcomeWidth = 7 * (longest.reduce((sum, length) => sum + length, 0) + 3 * (stages.length - 1));
  const width = spacing * stages.length + nodeWidth + Math.max(146, outcomeWidth + 32);
  const height = 62 + count * 25;
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-label', 'Outcome tree for ' + stages.map(stage => stage.name).join(' and '));
  function add(tag, attrs, label) {
    const element = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    if (label !== undefined) element.textContent = label;
    svg.append(element);
  }
  const colors = ['#176d80', '#5942a5', '#985128', '#31683f'];
  const xAt = depth => nodeWidth / 2 + 7 + depth * spacing;
  const yAt = row => 49 + row * 25;
  const heading = {fill: '#344a62', 'font-size': 12, 'font-weight': 700};
  stages.forEach((stage, index) => add('text', {...heading, x: xAt(index + 1), y: 22, 'text-anchor': 'middle'},
    stage.name.length > 19 ? stage.name.slice(0, 18) + '…' : stage.name));
  add('text', {...heading, x: xAt(stages.length) + nodeWidth / 2 + 21, y: 22}, 'Outcome');

  function branch(node, depth, start, path) {
    const x = xAt(depth);
    const y = yAt(start + (node.count - 1) / 2);
    let childStart = start;
    for (const child of node.children) {
      const childY = yAt(childStart + (child.count - 1) / 2);
      add('line', {x1: x, y1: y, x2: xAt(depth + 1), y2: childY, stroke: '#a3b5c6', 'stroke-width': 1.3});
      branch(child, depth + 1, childStart, [...path, child.label]);
      childStart += child.count;
    }
    if (!node.children.length) {
      add('text', {x: x + nodeWidth / 2 + 21, y: y + 4, fill: '#344a62', 'font-size': 12}, path.join(' + '));
    }
    const width = depth ? Math.max(50, node.label.length * 7 + 14) : 50;
    add('rect', {x: x - width / 2, y: y - 10, width, height: 20, rx: 6, fill: depth ? colors[(depth - 1) % colors.length] : '#24384e'});
    add('text', {x, y: y + 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#fff'}, node.label);
  }

  if (root) branch(root, 0, 0, []);
  else add('text', {...heading, x: 18, y: 47}, 'No valid outcomes under these rules.');
  return svg;
}

export function mountTreeDiagram(bar, body) {
  const panel = body.parentElement;
  panel.classList.add('tree-diagram-panel', 'fit-clean-screen');
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
    <label>Diagram zoom <input type="range" min="50" max="200" step="10" value="100" data-zoom> <output data-zoom-value>100%</output></label>
    <label><input type="checkbox" data-fit checked> Fit clean screen</label>
    <p class="widget-error" role="status"></p>`;
  const input = bar.querySelector('textarea');
  const mode = bar.querySelector('[data-mode]');
  const view = bar.querySelector('[data-view]');
  const counts = bar.querySelector('[data-counts]');
  const noRepeats = bar.querySelector('[data-no-repeats]');
  const error = bar.querySelector('[role=status]');
  const zoom = bar.querySelector('[data-zoom]');
  const zoomValue = bar.querySelector('[data-zoom-value]');
  const fit = bar.querySelector('[data-fit]');
  let diagram;

  function applyZoom() {
    const scale = Number(zoom.value) / 100;
    zoomValue.textContent = zoom.value + '%';
    for (const svg of body.querySelectorAll('svg')) {
      const {width, height} = svg.viewBox.baseVal;
      svg.setAttribute('width', width * scale);
      svg.setAttribute('height', height * scale);
    }
  }

  function render() {
    const selected = view.value === 'all' ? diagram.trees : [diagram.trees[Number(view.value)]];
    const cards = selected.map(tree => {
      const card = document.createElement('section');
      card.className = 'tree-diagram-card';
      const title = document.createElement('strong');
      title.textContent = tree.stages.map(stage => stage.name).join(' + ');
      const graphic = treeGraphic(tree);
      card.style.flexGrow = graphic.getAttribute('height');
      card.append(title, graphic);
      if (counts.checked) {
        const count = document.createElement('p');
        count.textContent = countLabel(tree);
        card.append(count);
      }
      return card;
    });
    if (counts.checked && selected.length > 1) {
      const total = document.createElement('strong');
      total.className = 'tree-diagram-total';
      total.textContent = selected.map(tree => tree.count).join(' + ') + ' = ' + diagram.total + ' total outcomes';
      cards.push(total);
    }
    body.replaceChildren(...cards);
    applyZoom();
    panel.scrollTop = 0;
  }

  function generate() {
    try {
      diagram = buildTrees(input.value, mode.value, noRepeats.checked);
      view.replaceChildren(...diagram.trees.map((tree, index) =>
        new Option(tree.stages.map(stage => stage.name).join(' + '), String(index))));
      if (diagram.trees.length > 1) view.add(new Option('All trees', 'all'));
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
  view.onchange = counts.onchange = render;
  zoom.oninput = applyZoom;
  fit.onchange = () => panel.classList.toggle('fit-clean-screen', fit.checked);
  preset(campGroups, 'pairs', false);
}
