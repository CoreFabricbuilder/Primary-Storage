/* Dependency-free SVG topology: pan, zoom and keyboard-selectable nodes. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const palette = {
    'Teraco Core': '#58c5dd', 'SD-WAN': '#b09afa', Branch: '#72d6ab',
    'Campus LAN': '#efc877', Security: '#ee938c', Internet: '#82aef9',
    AWS: '#d9a5f4', 'Shared Services': '#8cd1c9',
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function labelLines(name) {
    const words = name.split(/\s+/);
    const lines = [''];
    for (const word of words) {
      const last = lines.length - 1;
      if ((lines[last] + ' ' + word).trim().length > 17 && lines[last] && lines.length < 3) lines.push(word);
      else lines[last] = `${lines[last]} ${word}`.trim();
    }
    return lines.map((line, index) => `<tspan x="0" dy="${index ? 16 : 0}">${escape(line)}</tspan>`).join('');
  }
  function mount(svg, data, state, domainId, selectedId, onSelect, initialCamera = null, affectedIds = []) {
    const components = C.model.visibleComponents(data, state, domainId);
    const links = C.model.visibleLinks(data, state, components);
    const byId = new Map(components.map(item => [item.id, item]));
    const domainById = new Map(data.domains.map(item => [item.id, item.name]));
    svg.innerHTML = `<defs><pattern id="topology-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#51708a" opacity=".45"/></pattern><marker id="topology-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#7e98ac"/></marker></defs><rect class="topology-background" x="-1000" y="-1000" width="4000" height="3000" fill="url(#topology-grid)"/>` +
      links.map(link => {
        const from = byId.get(link.fromId), to = byId.get(link.toId);
        return `<line class="topology-edge" x1="${from.x + 62}" y1="${from.y + 25}" x2="${to.x + 62}" y2="${to.y + 25}" marker-end="url(#topology-arrow)"><title>${escape(link.label)}</title></line>`;
      }).join('') +
      components.map(item => {
        const color = palette[domainById.get(item.domainId)] || '#a3b7c8';
        return `<g class="topology-node${item.id === selectedId ? ' selected' : ''}${affectedIds.includes(item.id) ? ' affected' : ''}" data-node="${escape(item.id)}" tabindex="0" role="button" aria-label="Select ${escape(item.name)}" transform="translate(${Number(item.x) || 0},${Number(item.y) || 0})"><rect width="124" height="50" rx="11" fill="#172d41" stroke="${color}" stroke-width="2"/><text x="62" y="${item.name.length > 17 ? 18 : 30}" text-anchor="middle" fill="#eef8fd">${labelLines(item.name)}</text></g>`;
      }).join('');

    let camera = initialCamera ? { ...initialCamera } : { x: -15, y: -40, w: 1210, h: 640 };
    function applyCamera() { svg.setAttribute('viewBox', `${camera.x} ${camera.y} ${camera.w} ${camera.h}`); }
    function zoom(factor, clientX = null, clientY = null) {
      const rect = svg.getBoundingClientRect();
      const px = clientX === null ? .5 : (clientX - rect.left) / rect.width;
      const py = clientY === null ? .5 : (clientY - rect.top) / rect.height;
      const nextW = Math.max(430, Math.min(2200, camera.w * factor));
      const nextH = nextW * (camera.h / camera.w);
      camera = { x: camera.x + (camera.w - nextW) * px, y: camera.y + (camera.h - nextH) * py, w: nextW, h: nextH };
      applyCamera();
    }
    function fit() { camera = { x: -15, y: -40, w: 1210, h: 640 }; applyCamera(); }
    function select(id) {
      svg.querySelectorAll('.topology-node').forEach(node => node.classList.toggle('selected', node.dataset.node === id));
      onSelect(id);
    }
    svg.addEventListener('click', event => {
      const node = event.target.closest('[data-node]');
      if (node) select(node.dataset.node);
    });
    svg.addEventListener('keydown', event => {
      const node = event.target.closest('[data-node]');
      if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(node.dataset.node); }
    });
    svg.addEventListener('wheel', event => { event.preventDefault(); zoom(event.deltaY < 0 ? .88 : 1.12, event.clientX, event.clientY); }, { passive: false });
    let drag = null;
    svg.addEventListener('pointerdown', event => {
      if (event.target.closest('[data-node]')) return;
      drag = { clientX: event.clientX, clientY: event.clientY, x: camera.x, y: camera.y };
      svg.setPointerCapture(event.pointerId);
      svg.classList.add('panning');
    });
    svg.addEventListener('pointermove', event => {
      if (!drag) return;
      camera.x = drag.x - (event.clientX - drag.clientX) * camera.w / svg.clientWidth;
      camera.y = drag.y - (event.clientY - drag.clientY) * camera.h / svg.clientHeight;
      applyCamera();
    });
    function stopDrag() { drag = null; svg.classList.remove('panning'); }
    svg.addEventListener('pointerup', stopDrag);
    svg.addEventListener('pointercancel', stopDrag);
    applyCamera();
    return { zoomIn: () => zoom(.8), zoomOut: () => zoom(1.25), fit, getCamera: () => ({ ...camera }), count: components.length, linkCount: links.length };
  }
  C.topology = Object.freeze({ mount });
})();
