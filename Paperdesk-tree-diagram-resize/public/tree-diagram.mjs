const campGroups = 'Science: 2\nEnglish: 3\nMath: 4';

export function buildTrees(text, mode = 'pairs') {
  const lines = text.trim().split(/\n/).filter(line => line.trim());
  if (lines.length < 2 || lines.length > 8) {
    throw new Error('Enter 2–8 groups, one per line.');
  }
  const names = new Set();
  const prefixes = new Set();
  const groups = lines.map(line => {
    const match = /^([^:]{1,36}):\s*(\d+)\s*$/.exec(line.trim());
    if (!match || !match[1].trim() || Number(match[2]) < 1 || Number(match[2]) > 24) {
      throw new Error('Use a name and a count from 1 to 24, such as Science: 2.');
    }
    const name = match[1].trim();
    const key = name.toLowerCase();
    if (names.has(key)) throw new Error('Give each group a distinct name.');
    names.add(key);
    const initial = name[0].toUpperCase();
    let prefix = initial;
    for (let suffix = 2; prefixes.has(prefix); suffix++) prefix = initial + suffix + '-';
    prefixes.add(prefix);
    return {name, prefix, count: Number(match[2])};
  });

  const sets = mode === 'stages'
    ? [groups]
    : groups.flatMap((group, index) => groups.slice(index + 1).map(other => [group, other]));
  const trees = sets.map(stages => ({
    stages,
    count: stages.reduce((count, stage) => count * stage.count, 1)
  }));
  const total = trees.reduce((sum, tree) => sum + tree.count, 0);
  if (total > 600) throw new Error('This would draw more than 600 outcomes. Reduce the group counts.');
  return {trees, total};
}

function treeGraphic({stages, count}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const width = 142 * stages.length + Math.max(196, 60 + stages.length * 37);
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
  const xAt = depth => 32 + depth * 142;
  const yAt = row => 49 + row * 25;
  const heading = {fill: '#344a62', 'font-size': 12, 'font-weight': 700};
  stages.forEach((stage, index) => add('text', {...heading, x: xAt(index + 1), y: 22, 'text-anchor': 'middle'},
    stage.name.length > 19 ? stage.name.slice(0, 18) + '…' : stage.name));
  add('text', {...heading, x: xAt(stages.length) + 46, y: 22}, 'Outcome');

  function branch(depth, start, span, path) {
    const x = xAt(depth);
    const y = yAt(start + (span - 1) / 2);
    if (depth < stages.length) {
      const stage = stages[depth];
      const childSpan = span / stage.count;
      for (let index = 0; index < stage.count; index++) {
        const childStart = start + index * childSpan;
        const childY = yAt(childStart + (childSpan - 1) / 2);
        add('line', {x1: x, y1: y, x2: xAt(depth + 1), y2: childY, stroke: '#a3b5c6', 'stroke-width': 1.3});
        branch(depth + 1, childStart, childSpan, [...path, stage.prefix + (index + 1)]);
      }
    } else {
      add('text', {x: x + 46, y: y + 4, fill: '#344a62', 'font-size': 12}, path.join(' + '));
    }
    const label = path.at(-1) || 'Start';
    add('rect', {x: x - 25, y: y - 10, width: 50, height: 20, rx: 6, fill: depth ? colors[(depth - 1) % colors.length] : '#24384e'});
    add('text', {x, y: y + 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#fff'}, label);
  }

  branch(0, 0, count, []);
  return svg;
}

export function mountTreeDiagram(bar, body) {
  const panel = body.parentElement;
  panel.classList.add('tree-diagram-panel', 'fit-clean-screen');
  panel.style.left = '6px';
  panel.style.top = '12px';
  bar.innerHTML = `
    <label>Groups and counts<textarea rows="3" aria-label="Group names and counts"></textarea></label>
    <label>Choices <select data-mode>
      <option value="pairs">Two from different groups</option>
      <option value="stages">One from each group</option>
    </select></label>
    <button type="button" data-generate>Generate trees</button>
    <button type="button" data-preset>Camp example</button>
    <label>Display <select data-view aria-label="Tree to display"></select></label>
    <label><input type="checkbox" data-counts> Show counts</label>
    <label>Diagram zoom <input type="range" min="50" max="200" step="10" value="100" data-zoom> <output data-zoom-value>100%</output></label>
    <label><input type="checkbox" data-fit checked> Fit clean screen</label>
    <p class="widget-error" role="status"></p>`;
  const input = bar.querySelector('textarea');
  const mode = bar.querySelector('[data-mode]');
  const view = bar.querySelector('[data-view]');
  const counts = bar.querySelector('[data-counts]');
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
        count.textContent = tree.stages.map(stage => stage.count).join(' × ') + ' = ' + tree.count + ' outcomes';
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
      diagram = buildTrees(input.value, mode.value);
      view.replaceChildren(...diagram.trees.map((tree, index) =>
        new Option(tree.stages.map(stage => stage.name).join(' + '), String(index))));
      if (diagram.trees.length > 1) view.add(new Option('All trees', 'all'));
      error.textContent = '';
      render();
    } catch (problem) {
      error.textContent = problem.message;
    }
  }

  function preset() {
    input.value = campGroups;
    mode.value = 'pairs';
    counts.checked = false;
    generate();
  }

  bar.querySelector('[data-generate]').onclick = generate;
  bar.querySelector('[data-preset]').onclick = preset;
  view.onchange = counts.onchange = render;
  zoom.oninput = applyZoom;
  fit.onchange = () => panel.classList.toggle('fit-clean-screen', fit.checked);
  preset();
}
