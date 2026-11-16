// Draws the nf-core meta-omics SIG metro map in draw.io (app.diagrams.net) and exports it.
// Paste this whole file into Claude in Chrome's javascript_tool on an open draw.io page (once per
// page load). It defines window.MM; the steps are in ../SKILL.md. Needs no other file.
//
// Two things in here are the source of truth for what the map shows:
//  - EDGES (pipeline -> pipeline): read by scripts/check_map.py and compared with docs/data.json.
//  - the routes in build(): the lines actually drawn. Keep the two in step.
//
// Layout rules the routes follow (keep them when you edit):
//  - One polyline per route, drawn with rounded corners (arcSize 80 = 40 px radius). A branch
//    starts INSIDE its trunk (see `br`), so a fork is an overlap, never a butt-joint: no seams.
//  - Lanes are 10 px apart and touch. A lane may only cross another lane on a straight segment:
//    keep corners >= 40 px away from any lane they would cross (otherwise the crossing lands in
//    the arc and looks like a kink). Two adjacent lanes arriving at a station is fine.
//  - Rows are y values, channels are x values: change one number, not the whole route.
(function (root) {
  // edges:begin (JSON, read by scripts/check_map.py; `reference-genomes` is the FASTA input icon)
  const EDGES = [
    ["ampliseq", "differentialabundance"], ["createtaxdb", "metatdenovo"], ["createtaxdb", "taxprofiler"],
    ["detaxizer", "ampliseq"], ["detaxizer", "eager"], ["detaxizer", "funcprofiler"], ["detaxizer", "mag"],
    ["detaxizer", "magmap"], ["detaxizer", "metatdenovo"], ["detaxizer", "taxprofiler"], ["detaxizer", "viralmetagenome"],
    ["fetchngs", "ampliseq"], ["fetchngs", "detaxizer"], ["fetchngs", "eager"], ["fetchngs", "funcprofiler"],
    ["fetchngs", "mag"], ["fetchngs", "magmap"], ["fetchngs", "metatdenovo"], ["fetchngs", "taxprofiler"], ["fetchngs", "viralmetagenome"],
    ["funcprofiler", "differentialabundance"], ["mag", "bacmodel"], ["mag", "funcscan"], ["mag", "magmap"],
    ["mag", "metapep"], ["mag", "phyloplace"], ["mag", "proteinfamilies"], ["mag", "seqsubmit"],
    ["magmap", "differentialabundance"], ["metatdenovo", "differentialabundance"], ["metatdenovo", "proteinfamilies"],
    ["metatdenovo", "seqsubmit"], ["reference-genomes", "createtaxdb"], ["taxprofiler", "differentialabundance"],
    ["viralmetagenome", "phyloplace"]
  ];
  // edges:end

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

  // 8-bit palette PNG with alpha: median cut on a 5-bit RGBA histogram, in PREMULTIPLIED colour so
  // nearly transparent pixels cluster with transparent, not with opaque ones; palette entries are
  // true pixel averages; no dithering. Same pixels, far fewer bytes: the logos are embedded three
  // times (visible copy plus the editable diagram in PNG and SVG), so this keeps the exports small.
  // Returns {uri, err, kept}: if the 256-colour palette misses the original by more than `tol`
  // (mean error over visible pixels, 0-255) the original PNG is kept (kept = true).
  function quant(canvas, K = 256, tol = 2.5) {
    const w = canvas.width, h = canvas.height, px = canvas.getContext('2d').getImageData(0, 0, w, h).data, n = w * h;
    const key = i => { const a = px[4 * i + 3]; return a < 6 ? 0 : (((px[4 * i] >> 3) << 15) | ((px[4 * i + 1] >> 3) << 10) | ((px[4 * i + 2] >> 3) << 5) | (a >> 3)) + 1; };
    const CH = ['r', 'g', 'b', 'a'], hist = new Map(); // key -> sums of premultiplied colour
    for (let i = 0; i < n; i++) { const k = key(i); if (!k) continue; const a = px[4 * i + 3], f = a / 255; let e = hist.get(k); if (!e) hist.set(k, e = { c: 0, r: 0, g: 0, b: 0, a: 0, k }); e.c++; e.r += px[4 * i] * f; e.g += px[4 * i + 1] * f; e.b += px[4 * i + 2] * f; e.a += a; }
    const ent = [...hist.values()].map(e => ({ c: e.c, k: e.k, r: e.r / e.c, g: e.g / e.c, b: e.b / e.c, a: e.a / e.c }));
    const sse = b => { let t = 0; const s = [0, 0, 0, 0], s2 = [0, 0, 0, 0]; for (const e of b) { t += e.c; CH.forEach((ch, j) => { s[j] += e[ch] * e.c; s2[j] += e[ch] * e[ch] * e.c; }); } const v = CH.map((_, j) => s2[j] - s[j] * s[j] / t); return { t, v, tot: v.reduce((x, y) => x + y, 0) }; };
    const boxes = [{ b: ent, ...sse(ent) }], pp = [[0, 0, 0, 0]]; // pp: premultiplied palette; entry 0 = fully transparent
    while (boxes.length < K - 1) { // split the box with the largest squared error, at its weighted median
      let bi = -1, bs = 0; boxes.forEach((x, i) => { if (x.b.length > 1 && x.tot > bs) { bs = x.tot; bi = i; } });
      if (bi < 0) break;
      const { b, v, t } = boxes[bi], ch = CH[v.indexOf(Math.max(...v))]; b.sort((x, y) => x[ch] - y[ch]);
      let acc = 0, cut = 1; for (let i = 0; i < b.length - 1; i++) { acc += b[i].c; if (acc >= t / 2) { cut = i + 1; break; } }
      const l = b.slice(0, cut), r = b.slice(cut); boxes.splice(bi, 1, { b: l, ...sse(l) }, { b: r, ...sse(r) });
    }
    const map = new Map([[0, 0]]);
    for (const { b } of boxes) { let t = 0, r = 0, g = 0, bl = 0, a = 0; for (const e of b) { t += e.c; r += e.r * e.c; g += e.g * e.c; bl += e.b * e.c; a += e.a * e.c; } const idx = pp.push([r / t, g / t, bl / t, a / t]) - 1; for (const e of b) map.set(e.k, idx); }
    let err = 0, vis = 0; for (let i = 0; i < n; i++) { const a = px[4 * i + 3]; if (a < 6) continue; const p = pp[map.get(key(i))], f = a / 255; vis++; err += (Math.abs(px[4 * i] * f - p[0]) + Math.abs(px[4 * i + 1] * f - p[1]) + Math.abs(px[4 * i + 2] * f - p[2]) + Math.abs(a - p[3])) / 4; }
    if (err / vis > tol) return { uri: canvas.toDataURL('image/png'), err: err / vis, kept: true };
    const pal = pp.map(([r, g, b, a]) => a < 1 ? [0, 0, 0, 0] : [Math.min(255, Math.round(r * 255 / a)), Math.min(255, Math.round(g * 255 / a)), Math.min(255, Math.round(b * 255 / a)), Math.round(a)]); // un-premultiply for the PNG
    const raw = new Uint8Array((w + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = map.get(key(y * w + x));
    const crcT = Array.from({ length: 256 }, (_, i) => { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = u => { let c = 0xFFFFFFFF; for (const v of u) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const chunk = (t, d) => { const o = new Uint8Array(12 + d.length), dv = new DataView(o.buffer); dv.setUint32(0, d.length); for (let i = 0; i < 4; i++) o[4 + i] = t.charCodeAt(i); o.set(d, 8); dv.setUint32(8 + d.length, crc(o.subarray(4, 8 + d.length))); return o; };
    const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer); dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 3; // 8-bit, palette
    const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', ihdr), chunk('PLTE', Uint8Array.from(pal.flatMap(p => p.slice(0, 3)))), chunk('tRNS', Uint8Array.from(pal.map(p => p[3]))), chunk('IDAT', pako.deflate(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))]; // pako ships with draw.io
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.subarray(i, i + 8192));
    return { uri: 'data:image/png;base64,' + btoa(s), err: err / vis, kept: false };
  }

  // ---- logos: loaded from nf-core GitHub inside the page (crossOrigin lets the canvas read them) ----
  const PIPELINES = 'fetchngs detaxizer createtaxdb ampliseq taxprofiler funcprofiler eager mag metatdenovo viralmetagenome magmap differentialabundance metapep funcscan phyloplace proteinfamilies bacmodel seqsubmit'.split(' ');
  const D = 'HEAD/docs/images/';
  // pipelines whose repo has a custom-art logo: [light file, dark file] (names are not uniform:
  // eager's "flat_black" is the one for LIGHT backgrounds and "flat_light" is for dark ones)
  const CUSTOM = {
    createtaxdb: ['createtaxdb/' + D + 'nf-core-createtaxdb_logo_light_tax.png', 'createtaxdb/' + D + 'nf-core-createtaxdb_logo_dark_tax.png'],
    taxprofiler: ['taxprofiler/' + D + 'nf-core-taxprofiler_logo_custom_light.png', 'taxprofiler/' + D + 'nf-core-taxprofiler_logo_custom_dark.png'],
    eager: ['eager/' + D + 'nf-core_eager_logo_flat_black.png', 'eager/' + D + 'nf-core_eager_logo_flat_light.png'],
    mag: ['mag/' + D + 'mag_logo_mascot_light.png', 'mag/' + D + 'mag_logo_mascot_dark.png'],
    viralmetagenome: ['viralmetagenome/' + D + 'nf-core-viralmetagenome_logo_custom_light.png', 'viralmetagenome/' + D + 'nf-core-viralmetagenome_logo_custom_dark.png'],
  };
  // Fills MM.logos[name] = {light:{uri,w,h}, dark:{uri,w,h}} (PNG data URIs (palette PNGs where that is lossless enough), 360 px wide).
  async function loadLogos(W = 360) {
    const B = 'https://raw.githubusercontent.com/nf-core/';
    const load = u => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('cannot load ' + u)); i.src = B + u; });
    const shrink = (i, fix) => { const h = Math.round(i.naturalHeight * W / i.naturalWidth), c = document.createElement('canvas'); c.width = W; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, W, h); if (fix) fix(x, W, h); return { uri: quant(c).uri, w: W, h }; };
    MM.logos = {};
    for (const p of PIPELINES) {
      const [l, d] = CUSTOM[p] || ['light', 'dark'].map(t => `${p}/${p === 'eager' ? 'dev' : 'HEAD'}/docs/images/nf-core-${p}_logo_${t}.png`);
      MM.logos[p] = { light: shrink(await load(l)), dark: shrink(await load(d)) };
    }
    // bacmodel ships a mascot logo for light only: keep the mascot, recolour the text white
    const bl = await load('bacmodel/' + D + 'nf-core-bacmodel_logo_light.png');
    const whiten = (x, w, h) => { const im = x.getImageData(0, 0, w, h), a = im.data; for (let y = 0; y < h; y++) for (let xx = Math.round(w * 0.31); xx < w; xx++) { const k = (y * w + xx) * 4; if (Math.max(a[k], a[k + 1], a[k + 2]) - Math.min(a[k], a[k + 1], a[k + 2]) < 50) a[k] = a[k + 1] = a[k + 2] = 255; } x.putImageData(im, 0, 0); };
    // funcscan: its flat logo carries the mascot (a dotted disc) as a tiny corner, which reads blurry. Draw the
    // disc big beside the plain logo instead, from the full-size icon (the repo's funcscan_icon.png)
    const disc = await load('funcscan/' + D + 'funcscan_icon.png');
    const withDisc = (lg, dark) => { const dh = 250, dw = Math.round(disc.naturalWidth * dh / disc.naturalHeight), c = document.createElement('canvas'); c.width = dw + 12 + lg.naturalWidth; c.height = lg.naturalHeight; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; if (dark) x.filter = 'brightness(1.7)'; x.drawImage(disc, 0, (c.height - dh) / 2, dw, dh); x.filter = 'none'; x.drawImage(lg, dw + 12, 0); if (dark) { const x0 = dw + 12, im = x.getImageData(x0, 0, lg.naturalWidth, c.height), a = im.data; for (let k = 0; k < a.length; k += 4) if (a[k + 3] > 0 && Math.max(a[k], a[k + 1], a[k + 2]) - Math.min(a[k], a[k + 1], a[k + 2]) < 50 && a[k] > 120) a[k] = a[k + 1] = a[k + 2] = 255; x.putImageData(im, x0, 0); } return { uri: quant(c).uri, w: c.width, h: c.height }; };
    MM.logos.funcscan = { light: withDisc(await load('funcscan/' + D + 'nf-core-funcscan_logo_light.png')), dark: withDisc(await load('funcscan/' + D + 'nf-core-funcscan_logo_dark.png'), true) };
    MM.logos.bacmodel = { light: shrink(bl), dark: shrink(bl, whiten) };
    return Object.keys(MM.logos).length;
  }

  // ---- the map ----
  // Wipes the page and redraws it. Never run it after the page was edited by hand. An nf-core
  // library file icon already on the page (a "group", see useAssetIcons) is kept and reused.
  async function build() {
    const ui = await getUi(), g = ui.editor.graph, M = g.model, P = g.getDefaultParent();
    if (!MM.logos) throw new Error('run await MM.loadLogos() first');
    const C = { viral: PIN('#d0453a'), shot: PIN('#24b064'), mag: 'light-dark(#3e2f2f,#d6c7bd)', mt: PIN('#7b4fa0'), amp: PIN('#e8c547'), db: PIN('#7a7a7a') };
    const V = (val, x, y, w, h, st) => g.insertVertex(P, null, val, x, y, w, h, st);
    const E = (c, dash, pts, jump) => { // jump: hop (arc) over every line this one crosses; draw such a route last
      const e = g.insertEdge(P, null, '', null, null, `endArrow=none;startArrow=none;html=1;rounded=1;arcSize=80;strokeWidth=10;strokeColor=${C[c]};` + (dash ? 'dashed=1;dashPattern=1 1;' : '') + (jump ? 'jumpStyle=arc;jumpSize=20;' : ''));
      e.geometry.setTerminalPoint(new mxPoint(pts[0][0], pts[0][1]), true);
      e.geometry.setTerminalPoint(new mxPoint(pts[pts.length - 1][0], pts[pts.length - 1][1]), false);
      e.geometry.points = pts.slice(1, -1).map(p => new mxPoint(p[0], p[1]));
    };
    const TXT = 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;fontColor=light-dark(#000000,#FFFFFF);' + FONT;
    const XD = 1760, XR = 1760, XM = 980, XG = 1150, XT = 1620, YP = 495, YS = 1235; // x of differentialabundance (same column as the secondary stations), the secondary stations, mag, magmap, the metatdenovo -> seqsubmit channel; y of metapep (the secondary rows follow, 125 apart), seqsubmit
    M.beginUpdate();
    try {
      // getChildCells skips hidden cells (the dark logos), so clear with getChildren
      const icon = M.getChildren(P).find(c => c.style === 'group');
      g.clearSelection(); g.removeCells(M.getChildren(P).filter(c => c !== icon), true);
      const BOX = 'rounded=1;absoluteArcSize=1;arcSize=20;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=#E6E6E6;fillColor=#BDBDBD;align=left;verticalAlign=top;fontSize=38;spacing=0;fillStyle=solid;spacingTop=8;spacingLeft=16;fontStyle=1;fontColor=light-dark(#333333,#CCCCCC);' + FONT;
      [['1. Data input', 20, 110, 580, 590], ['2. Primary analysis', 830, 110, 500, 1270], ['3. Secondary analysis', 1440, 110, 700, 940], ['4. Data upload', 1710, 1080, 340, 270]].forEach(b => V(b[0], b[1], b[2], b[3], b[4], BOX));

      // routes. Rows (y): 300 amplicon/entry, 450 taxprofiler, 600 funcprofiler, 750 metatdenovo,
      // 900 eager, 1050 mag, 1150 magmap, 1290 viralmetagenome; secondary 495 metapep, 620 funcscan, 745 proteinfamilies,
      // 870 bacmodel, 995 phyloplace, 1235 seqsubmit. Channels (x): 680 db, 760 shotgun fan, 1200 shotgun profiles, 1250 mt,
      // 1300 magmap -> diffabund, 1390 MAG trunk, 1500 viral, 1620 mt -> seqsubmit.
      const br = (xc, y, x2) => [[xc, y - 90], [xc, y], [x2, y]]; // branch off a vertical trunk
      E('amp', 0, [[150, 295], [XD, 295]]);
      E('shot', 0, [[150, 305], [760, 305], [760, 1290], [1050, 1290]]);
      [450, 600, 750, 900].forEach(y => E('shot', 0, br(760, y, 1050)));
      E('shot', 0, br(760, 1050, XM));
      E('shot', 0, [[1050, 450], [1200, 450], [1200, 305], [XD, 305]]);
      E('shot', 0, [[1050, 600], [1200, 600], [1200, 380]]);
      E('mt', 0, [[1050, 750], [XR, 750]]);                  // metatdenovo -> proteinfamilies, ends at its pill
      E('mt', 0, [[1050, 750], [1250, 750], [1250, 315], [XD, 315]]);
      E('db', 1, [[190, 600], [680, 600], [680, 460], [1050, 460]]);
      E('db', 1, [[190, 600], [680, 600], [680, 760], [1050, 760]]);
      E('mag', 0, [[XM, 1050], [1390, 1050], [1390, YP + 50]]); // MAG trunk north; its branches (below) start inside it, and the top one turns at YP
      [YP, YP + 125, YP + 375].forEach(y => E('mag', 0, [[1390, y + 90], [1390, y], [XR, y]])); // branches that leave the trunk going up
      [YP + 250, YP + 500].forEach(y => E('mag', 0, [[1390, y - 90], [1390, y - 5], [XR, y - 5]])); // proteinfamilies and phyloplace: from above, so the lane under them (metatdenovo, viral) never crosses them
      E('mag', 0, [[XM, 1050], [1390, 1050], [1390, YS + 5], [XR, YS + 5]]); // mag -> seqsubmit, directly
      E('mt', 0, [[1050, 750], [XT, 750], [XT, YS - 5], [XR, YS - 5]]);      // metatdenovo -> seqsubmit, directly: down channel XT, right of the MAG branches
      E('viral', 0, [[1050, 1290], [1500, 1290], [1500, YP + 505], [XR, YP + 505]]);
      // magmap (an alternative to metatdenovo, so in the primary box), a little right of mag: reads off the
      // shotgun fan (lower lane), MAGs from mag as an optional dashed input (upper lane; it also runs on public
      // or the user's own genomes), abundances north to differentialabundance on channel 1300, nested after the
      // shotgun (1200) and metatranscriptome (1250) lanes
      E('shot', 0, br(760, 1155, XG));
      E('mag', 1, [[XM, 1050], [XM, 1145], [XG, 1145]]);
      E('mag', 0, [[XG, 1150], [1300, 1150], [1300, 325], [XD, 325]]);
      [['viral', 0, 'viral contigs'], ['shot', 0, 'shotgun reads'], ['mag', 0, 'MAGs / genome bins'], ['mt', 0, 'metatranscriptome contigs'], ['amp', 0, 'amplicon reads'], ['db', 1, 'reference database'], ['mag', 1, 'optional MAGs']].forEach(([c, d, t], i) => {
        const y = 800 + i * 50; E(c, d, [[50, y], [130, y]]);
        V(t, 150, y - 18, 400, 36, TXT + 'align=left;verticalAlign=middle;fontSize=24;');
      });

      // stations [pipeline, x, y, pill height, label side a=above r=right b=below]; a pill is 40
      // or 60 px tall where two or four lanes arrive together
      const LW = { differentialabundance: 320, viralmetagenome: 380, proteinfamilies: 240, metatdenovo: 220, createtaxdb: 290, taxprofiler: 270, eager: 175, magmap: 170, mag: 212, funcscan: 250, funcprofiler: 220, bacmodel: 230, seqsubmit: 230 }; // default 200
      const S = [['fetchngs', 150, 300, 30, 'a'], ['detaxizer', 420, 300, 30, 'a'], ['createtaxdb', 420, 600, 30, 'a'], ['ampliseq', 1050, 300, 30, 'a'], ['taxprofiler', 1050, 455, 40, 'a'], ['funcprofiler', 1050, 600, 30, 'a'], ['metatdenovo', 1050, 755, 40, 'a'], ['eager', 1050, 900, 30, 'a'], ['mag', XM, 1050, 30, 'a'], ['magmap', XG, 1150, 40, 'a'], ['viralmetagenome', 1050, 1290, 30, 'a'],
        ['differentialabundance', XD, 310, 50, 'r'], ['metapep', XR, YP, 30, 'r'], ['funcscan', XR, YP + 125, 30, 'r'], ['proteinfamilies', XR, YP + 250, 40, 'r'], ['bacmodel', XR, YP + 375, 30, 'r'], ['phyloplace', XR, YP + 500, 40, 'r'], ['seqsubmit', XR, YS, 40, 'r']];
      // light logo visible, dark copy hidden: exportAll() swaps them per theme (in memory only)
      const IMG = (uri, x, y, w, h, theme) => {
        const c = V('', x, y, w, h, `shape=image;aspect=fixed;imageAspect=0;image=${uri.replace(';base64,', ',')};metromapTheme=${theme};`);
        if (theme === 'dark') c.visible = false;
      };
      for (const [n, x, y, h, pos] of S) {
        V('', x - 15, y - h / 2, 30, h, `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=${PIN('#FFFFFF')};strokeColor=${PIN('#000000')};strokeWidth=4;`);
        const L = MM.logos[n], lw = LW[n] || 200, lh = Math.round(lw * L.light.h / L.light.w);
        const lx = pos === 'r' ? x + 27 : x - lw / 2,
           ly = pos === 'a' ? y - h / 2 - 8 - lh : pos === 'b' ? y + h / 2 + 8 : y - lh / 2;
        IMG(L.light.uri, lx, ly, lw, lh, 'light'); IMG(L.dark.uri, lx, ly, lw, lh, 'dark');
      }

      // FASTA input icon: the library asset if one is on the page, else a plain stand-in
      if (icon) { const gm = icon.geometry.clone(); gm.x = 40; gm.y = 556; M.setGeometry(icon, gm); g.orderCells(false, [icon]); } // to the front: the boxes were drawn after it
      else V('FASTA', 40, 556, 80, 89, `shape=note;size=22;backgroundOutline=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#FFFFFF);strokeColor=none;fontColor=light-dark(#FFFFFF,#000000);fontStyle=1;fontSize=18;verticalAlign=bottom;spacingBottom=14;` + FONT);
      V('reference<br>genomes', 20, 648, 120, 44, TXT + 'align=center;verticalAlign=top;fontStyle=1;fontSize=16;');
      V('', 130, 585, 26, 30, 'triangle;html=1;fillColor=light-dark(#000000,#FFFFFF);strokeColor=none;direction=east;');
      V('nf-core meta-omics pipelines', 20, 20, 1100, 70, TXT + 'align=left;verticalAlign=middle;fontStyle=1;fontSize=52;');
    } finally { M.endUpdate(); }
    return M.getChildCount(P);
  }

  // Use the nf-core_components library's file icon for the FASTA input: drag it onto the page
  // (it is a "group": image + label), pass its cell id, then run build() again (it keeps the group).
  async function useAssetIcon(groupId) {
    const ui = await getUi(), g = ui.editor.graph, M = g.model, grp = M.cells[groupId];
    if (!grp || grp.style !== 'group') throw new Error('not a group cell');
    const t = M.getChildren(grp)[1]; // the label: set it, and pin its colour (a plain #FFFFFF is inverted in the dark export)
    M.beginUpdate();
    try { t.value = '<b>fasta</b>'; M.setStyle(t, (t.style || '').replace(/(fontColor|fontSize|fontFamily|fontSource)=[^;]*;?/g, '').replace(/;?$/, ';') + 'fontColor=light-dark(#FFFFFF,#FFFFFF);fontSize=20;' + FONT); } finally { M.endUpdate(); }
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

  root.MM = { EDGES, getUi, view, quant, loadLogos, build, useAssetIcon, exportAll, preview, downloadButton, waitSaved, logos: null, files: {} };
})(typeof window !== 'undefined' ? window : globalThis);
