// Draws the nf-core meta-omics SIG metro map in draw.io (app.diagrams.net) and exports it.
// Paste this whole file into Claude in Chrome's javascript_tool on an open draw.io page (once per
// page load). It defines window.MM; the steps are in ../SKILL.md. Needs no other file.
//
// Layout rules the routes below follow (keep them when you edit):
//  - One polyline per route, drawn with rounded corners (arcSize 80 = 40 px radius). A branch
//    starts INSIDE its trunk (see `br`), so a fork is an overlap, never a butt-joint: no seams.
//  - Lanes are 10 px apart and touch. A lane may only cross another lane on a straight segment:
//    keep corners >= 40 px away from any lane they would cross (otherwise the crossing lands in
//    the arc and looks like a kink). Two adjacent lanes arriving at a station is fine.
//  - Rows are y values, channels are x values: change one number, not the whole route.
(function (root) {
  const PIN = c => `light-dark(${c},${c})`; // plain #FFF/#000 would be inverted in the dark export
  const FONT = 'fontFamily=Maven Pro;fontSource=https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DMaven%2BPro;';

  // draw.io keeps its EditorUi private: catch it in methods that synthetic events reach
  async function getUi() {
    if (root.__ui) return root.__ui;
    const proto = EditorUi.prototype, names = ['windowResized', 'getCurrentFile'], orig = {};
    for (const n of names) { orig[n] = proto[n]; proto[n] = function () { root.__ui = this; return orig[n].apply(this, arguments); }; }
    root.dispatchEvent(new Event('resize')); root.dispatchEvent(new Event('focus'));
    await new Promise(r => setTimeout(r, 500));
    for (const n of names) proto[n] = orig[n];
    if (!root.__ui) throw new Error('draw.io editor not found');
    return root.__ui;
  }

  async function view(scale = 0.5, dx = 0, dy = 0) {
    const g = (await getUi()).editor.graph;
    g.view.setScale(scale);
    const b = g.getGraphBounds();
    g.container.scrollLeft = b.x - 5 + dx * scale;
    g.container.scrollTop = b.y - 5 + dy * scale;
  }

  // ---- logos: loaded from nf-core GitHub inside the page (crossOrigin lets the canvas read them) ----
  const PIPELINES = 'fetchngs detaxizer createtaxdb ampliseq taxprofiler funcprofiler eager mag metatdenovo viralmetagenome magmap differentialabundance metapep phageannotator funcscan phyloplace proteinfamilies bacmodel seqsubmit'.split(' ');
  const D = 'HEAD/docs/images/';
  // pipelines whose repo has a custom-art logo: [light file, dark file] (names are not uniform:
  // eager's "flat_black" is the one for LIGHT backgrounds and "flat_light" is for dark ones)
  const CUSTOM = {
    createtaxdb: ['createtaxdb/' + D + 'nf-core-createtaxdb_logo_light_tax.png', 'createtaxdb/' + D + 'nf-core-createtaxdb_logo_dark_tax.png'],
    taxprofiler: ['taxprofiler/' + D + 'nf-core-taxprofiler_logo_custom_light.png', 'taxprofiler/' + D + 'nf-core-taxprofiler_logo_custom_dark.png'],
    eager: ['eager/' + D + 'nf-core_eager_logo_flat_black.png', 'eager/' + D + 'nf-core_eager_logo_flat_light.png'],
    mag: ['mag/' + D + 'mag_logo_mascot_light.png', 'mag/' + D + 'mag_logo_mascot_dark.png'],
    viralmetagenome: ['viralmetagenome/' + D + 'nf-core-viralmetagenome_logo_custom_light.png', 'viralmetagenome/' + D + 'nf-core-viralmetagenome_logo_custom_dark.png'],
    funcscan: ['funcscan/' + D + 'nf-core-funcscan_logo_flat_light.png', 'funcscan/' + D + 'nf-core-funcscan_logo_flat_dark.png'],
  };
  // Fills MM.logos[name] = {light:{uri,w,h}, dark:{uri,w,h}} (PNG data URIs, 360 px wide).
  async function loadLogos(W = 360) {
    const B = 'https://raw.githubusercontent.com/nf-core/';
    const load = u => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('cannot load ' + u)); i.src = B + u; });
    const shrink = (i, fix) => { const h = Math.round(i.naturalHeight * W / i.naturalWidth), c = document.createElement('canvas'); c.width = W; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, W, h); if (fix) fix(x, W, h); return { uri: c.toDataURL('image/png'), w: W, h }; };
    MM.logos = {};
    for (const p of PIPELINES) {
      const [l, d] = CUSTOM[p] || ['light', 'dark'].map(t => `${p}/${p === 'eager' ? 'dev' : 'HEAD'}/docs/images/nf-core-${p}_logo_${t}.png`);
      MM.logos[p] = { light: shrink(await load(l)), dark: shrink(await load(d)) };
    }
    // bacmodel ships a mascot logo for light only: keep the mascot, recolour the text white
    const bl = await load('bacmodel/' + D + 'nf-core-bacmodel_logo_light.png');
    const whiten = (x, w, h) => { const im = x.getImageData(0, 0, w, h), a = im.data; for (let y = 0; y < h; y++) for (let xx = Math.round(w * 0.31); xx < w; xx++) { const k = (y * w + xx) * 4; if (Math.max(a[k], a[k + 1], a[k + 2]) - Math.min(a[k], a[k + 1], a[k + 2]) < 50) a[k] = a[k + 1] = a[k + 2] = 255; } x.putImageData(im, 0, 0); };
    MM.logos.bacmodel = { light: shrink(bl), dark: shrink(bl, whiten) };
    return Object.keys(MM.logos).length;
  }

  // ---- the map ----
  // Wipes the page and redraws it. Never run it after the page was edited by hand.
  async function build() {
    const ui = await getUi(), g = ui.editor.graph, M = g.model, P = g.getDefaultParent();
    if (!MM.logos) throw new Error('run await MM.loadLogos() first');
    const C = { viral: PIN('#d0453a'), shot: PIN('#24b064'), mag: 'light-dark(#3e2f2f,#d6c7bd)', mt: PIN('#7b4fa0'), amp: PIN('#e8c547'), db: PIN('#7a7a7a') };
    const V = (val, x, y, w, h, st) => g.insertVertex(P, null, val, x, y, w, h, st);
    const E = (c, dash, pts) => {
      const e = g.insertEdge(P, null, '', null, null, `endArrow=none;startArrow=none;html=1;rounded=1;arcSize=80;strokeWidth=10;strokeColor=${C[c]};` + (dash ? 'dashed=1;dashPattern=1 1;' : ''));
      e.geometry.setTerminalPoint(new mxPoint(pts[0][0], pts[0][1]), true);
      e.geometry.setTerminalPoint(new mxPoint(pts[pts.length - 1][0], pts[pts.length - 1][1]), false);
      e.geometry.points = pts.slice(1, -1).map(p => new mxPoint(p[0], p[1]));
    };
    const TXT = 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;fontColor=light-dark(#000000,#FFFFFF);' + FONT;
    M.beginUpdate();
    try {
      // getChildCells skips hidden cells (the dark logos), so clear with getChildren
      g.clearSelection(); g.removeCells(M.getChildren(P).slice(), true);
      const BOX = 'rounded=1;arcSize=4;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=#E6E6E6;fillColor=#BDBDBD;align=left;verticalAlign=top;fontSize=38;spacing=0;fillStyle=solid;spacingTop=8;spacingLeft=16;fontStyle=1;fontColor=light-dark(#333333,#CCCCCC);' + FONT;
      [['1. Data input', 20, 110, 580, 590], ['2. Primary analysis', 830, 110, 500, 1270], ['3. Secondary analysis', 1440, 110, 1100, 1230], ['4. Data upload', 2600, 640, 320, 260]].forEach(b => V(b[0], b[1], b[2], b[3], b[4], BOX));

      // routes. Rows (y): 300 amplicon/entry, 450 taxprofiler, 600 funcprofiler, 750 metatdenovo,
      // 900 eager, 1050 mag, 1290 viralmetagenome. Channels (x): 680 db, 760 shotgun fan,
      // 1200 shotgun profiles, 1250 mt, 1390 MAG trunk, 1500 viral.
      const br = (xc, y, x2) => [[xc, y - 90], [xc, y], [x2, y]]; // branch off a vertical trunk
      E('amp', 0, [[150, 295], [2330, 295]]);
      E('shot', 0, [[150, 305], [760, 305], [760, 1290], [1050, 1290]]);
      [450, 600, 750, 900, 1050].forEach(y => E('shot', 0, br(760, y, 1050)));
      E('shot', 0, [[1050, 450], [1200, 450], [1200, 305], [2330, 305]]);
      E('shot', 0, [[1050, 600], [1200, 600], [1200, 380]]);
      E('mt', 0, [[1050, 750], [2760, 750]]);
      E('mt', 0, [[1050, 750], [1250, 750], [1250, 315], [2330, 315]]);
      E('db', 1, [[190, 600], [680, 600], [680, 460], [1050, 460]]);
      E('db', 1, [[190, 600], [680, 600], [680, 760], [1050, 760]]);
      E('mag', 0, [[1050, 1050], [1960, 1050]]);
      E('mag', 0, [[1050, 1050], [1390, 1050], [1390, 525], [2160, 525], [2160, 325], [2330, 325]]);
      [[590, 1960], [760, 2760], [830, 1960], [950, 1960]].forEach(([y, x2]) => E('mag', 0, [[1390, Math.min(y + 90, 1005)], [1390, y], [x2, y]]));
      E('mag', 0, [[1050, 1050], [1390, 1050], [1390, 1190], [1960, 1190]]);
      E('viral', 0, [[1050, 1290], [1500, 1290], [1500, 1060], [1960, 1060]]);
      E('viral', 0, [[1500, 1245], [1500, 1200], [1960, 1200]]);
      E('shot', 0, [[1690, 425], [1800, 425], [1800, 515], [1960, 515]]); // FASTQ icon -> magmap
      [['viral', 0, 'viral contigs'], ['shot', 0, 'shotgun reads'], ['mag', 0, 'MAGs / genome bins'], ['mt', 0, 'metatranscriptome contigs'], ['amp', 0, 'amplicon reads'], ['db', 1, 'reference database']].forEach(([c, d, t], i) => {
        const y = 800 + i * 50; E(c, d, [[50, y], [130, y]]);
        V(t, 150, y - 18, 400, 36, TXT + 'align=left;verticalAlign=middle;fontSize=24;');
      });

      // stations [pipeline, x, y, pill height, label side a=above r=right b=below]; a pill is 40
      // or 60 px tall where two or four lanes arrive together
      const LW = { differentialabundance: 320, viralmetagenome: 380, phageannotator: 240, proteinfamilies: 240, metatdenovo: 220, createtaxdb: 290, taxprofiler: 270, eager: 175, mag: 212, funcscan: 180, funcprofiler: 220, bacmodel: 230, seqsubmit: 230 }; // default 200
      const S = [['fetchngs', 150, 300, 30, 'a'], ['detaxizer', 420, 300, 30, 'a'], ['createtaxdb', 420, 600, 30, 'a'], ['ampliseq', 1050, 300, 30, 'a'], ['taxprofiler', 1050, 455, 40, 'a'], ['funcprofiler', 1050, 600, 30, 'a'], ['metatdenovo', 1050, 755, 40, 'a'], ['eager', 1050, 900, 30, 'a'], ['mag', 1050, 1050, 30, 'a'], ['viralmetagenome', 1050, 1290, 30, 'a'],
        ['magmap', 1960, 520, 40, 'a'], ['differentialabundance', 2330, 310, 60, 'a'], ['metapep', 1960, 590, 30, 'r'], ['proteinfamilies', 1960, 755, 40, 'a'], ['funcscan', 1960, 830, 30, 'r'], ['bacmodel', 1960, 950, 30, 'r'], ['phageannotator', 1960, 1055, 40, 'r'], ['phyloplace', 1960, 1195, 40, 'r'], ['seqsubmit', 2760, 755, 40, 'b']];
      // light logo visible, dark copy hidden: exportAll() swaps them per theme (in memory only)
      const IMG = (uri, x, y, w, h, theme) => {
        const c = V('', x, y, w, h, `shape=image;aspect=fixed;imageAspect=0;image=${uri.replace(';base64,', ',')};metromapTheme=${theme};`);
        if (theme === 'dark') c.visible = false;
      };
      for (const [n, x, y, h, pos] of S) {
        V('', x - 15, y - h / 2, 30, h, `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=${PIN('#FFFFFF')};strokeColor=${PIN('#000000')};strokeWidth=4;`);
        const L = MM.logos[n], lw = LW[n] || 200, lh = Math.round(lw * L.light.h / L.light.w);
        const lx = pos === 'r' ? x + 27 : x - lw / 2, ly = pos === 'a' ? y - h / 2 - (n === 'proteinfamilies' ? 38 : 8) - lh : pos === 'b' ? y + h / 2 + 8 : y - lh / 2;
        IMG(L.light.uri, lx, ly, lw, lh, 'light'); IMG(L.dark.uri, lx, ly, lw, lh, 'dark');
      }

      // file icons (plain stand-ins: MM.useAssetIcons swaps in the nf-core library asset) + input triangles
      const FILE = `shape=note;size=22;backgroundOutline=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#FFFFFF);strokeColor=none;fontColor=light-dark(#FFFFFF,#000000);fontStyle=1;fontSize=18;verticalAlign=bottom;spacingBottom=14;` + FONT;
      const TRI = 'triangle;html=1;fillColor=light-dark(#000000,#FFFFFF);strokeColor=none;direction=east;';
      V('FASTA', 40, 556, 80, 89, FILE);
      V('reference<br>genomes', 20, 648, 120, 44, TXT + 'align=center;verticalAlign=top;fontStyle=1;fontSize=16;');
      V('', 130, 585, 26, 30, TRI);
      V('FASTQ', 1570, 380, 80, 89, FILE);
      V('MG / MT reads', 1540, 472, 140, 24, TXT + 'align=center;verticalAlign=top;fontStyle=1;fontSize=16;');
      V('', 1660, 410, 26, 30, TRI);
      V('nf-core meta-omics pipelines', 20, 20, 1100, 70, TXT + 'align=left;verticalAlign=middle;fontStyle=1;fontSize=52;');
    } finally { M.endUpdate(); }
    return M.getChildCount(P);
  }

  // Swap the two plain file icons for the nf-core_components library asset. First drag the asset
  // (a "group": image + label) from the library panel onto the page, then pass its cell id.
  async function useAssetIcons(groupId) {
    const ui = await getUi(), g = ui.editor.graph, M = g.model, P = g.getDefaultParent();
    const grp = M.cells[groupId], notes = M.getChildren(P).filter(c => /^shape=note/.test(c.style || ''));
    if (!grp || grp.style !== 'group' || notes.length !== 2) throw new Error('need the dropped group and the two stand-in icons');
    const put = (cell, x, y, word) => {
      const gm = cell.geometry.clone(); gm.x = x; gm.y = y; M.setGeometry(cell, gm);
      const t = M.getChildren(cell)[1]; t.value = `<b>${word}</b>`;
      // pin the label colour: a plain #FFFFFF would be inverted in the dark export
      M.setStyle(t, (t.style || '').replace(/(fontColor|fontSize|fontFamily|fontSource)=[^;]*;?/g, '').replace(/;?$/, ';') + 'fontColor=light-dark(#FFFFFF,#FFFFFF);fontSize=20;' + FONT);
    };
    g.clearSelection(); M.beginUpdate();
    try {
      const fasta = g.cloneCells([grp])[0]; fasta.geometry = grp.geometry.clone(); M.add(P, fasta);
      put(fasta, 40, 556, 'fasta'); put(grp, 1570, 380, 'fastq');
      g.removeCells(notes, false);
    } finally { M.endUpdate(); }
    return 'ok';
  }

  // ---- export: light + dark PNG and SVG (transparent, editable diagram + fonts embedded) ----
  async function exportAll(base) {
    const ui = await getUi(), graph = ui.editor.graph, logos = { light: [], dark: [] };
    for (const cell of Object.values(graph.model.cells)) { const m = /metromapTheme=(light|dark)/.exec(cell.style || ''); if (m) logos[m[1]].push(cell); }
    const before = new Map([...logos.light, ...logos.dark].map(c => [c, c.visible]));
    const show = theme => { for (const t of ['light', 'dark']) logos[t].forEach(c => { c.visible = t === theme; }); graph.refresh(); };
    const svgOf = theme => new Promise(resolve => ui.exportSvg(1, true, true, false, true, true, 0, false, true, null, theme, 'diagram', true, resolve));
    const pngOf = theme => new Promise((resolve, reject) =>
      ui.editor.exportToCanvas(canvas => {
        const xml = ui.getFileData(true, null, null, null, true, true, null, null, null, null, null, 1, 0);
        const uri = ui.createImageDataUri(canvas, xml, 'png');
        resolve(Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), ch => ch.charCodeAt(0)));
      }, null, ui.thumbImageCache || (ui.thumbImageCache = {}), null, reject, null, true, 1, true, false, null, null, 0, false, false, theme, 'diagram'));
    const files = {};
    try { for (const theme of ['light', 'dark']) { show(theme); files[`${base}_${theme}.svg`] = await svgOf(theme); files[`${base}_${theme}.png`] = await pngOf(theme); } }
    finally { before.forEach((v, c) => { c.visible = v; }); graph.refresh(); }
    MM.files = files;
    return Object.fromEntries(Object.entries(files).map(([n, d]) => [n, d.length]));
  }

  // overlay one exported PNG at natural size (null removes it); scroll the overlay to inspect
  function preview(name, background = '#0d1117') {
    document.getElementById('__mmPreview')?.remove();
    if (!name) return 'removed';
    const ov = document.createElement('div');
    ov.id = '__mmPreview'; ov.style.cssText = `position:fixed;inset:0;z-index:999999;background:${background};overflow:auto`;
    const img = new Image(); img.src = URL.createObjectURL(new Blob([MM.files[name]], { type: 'image/png' }));
    ov.appendChild(img); document.body.appendChild(ov); return 'shown';
  }

  // a script-only download is silently dropped: put a button on the page and click it with the
  // computer tool; Chrome may then ask the user to press Save
  async function downloadButton(zipName) {
    const zip = new JSZip(); // bundled with draw.io
    for (const [n, d] of Object.entries(MM.files)) zip.file(n, d);
    document.getElementById('__mmDownload')?.remove();
    const a = Object.assign(document.createElement('a'), { id: '__mmDownload', download: zipName, textContent: 'Download metro maps' });
    a.href = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
    a.style.cssText = 'position:fixed;top:200px;left:600px;z-index:999999;padding:20px 30px;background:#24b064;color:#fff;font:bold 20px sans-serif;border-radius:8px';
    a.addEventListener('click', () => setTimeout(() => a.remove(), 1000));
    document.body.appendChild(a); return 'click the "Download metro maps" link';
  }

  // wait for draw.io's Drive autosave
  async function waitSaved(seconds = 40) {
    const f = (await getUi()).getCurrentFile();
    for (let i = 0; i < seconds / 2 && (f.savingFile || f.isModified()); i++) await new Promise(r => setTimeout(r, 2000));
    return document.querySelector('.geStatus')?.innerText || '';
  }

  root.MM = { getUi, view, loadLogos, build, useAssetIcons, exportAll, preview, downloadButton, waitSaved, logos: null, files: {} };
})(typeof window !== 'undefined' ? window : globalThis);
