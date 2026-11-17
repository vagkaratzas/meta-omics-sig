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
  // logo width on the map (default 200); each logo is stored at 2x that width, so all are equally sharp
  const LW = { differentialabundance: 320, viralmetagenome: 380, proteinfamilies: 240, metatdenovo: 220, createtaxdb: 290, taxprofiler: 270, eager: 175, magmap: 160, mag: 212, funcscan: 250, funcprofiler: 220, bacmodel: 230, seqsubmit: 230 };
  const lwOf = p => LW[p] || 200;
  // pipelines whose repo has a custom-art logo: [light file, dark file] (names are not uniform:
  // eager's "flat_black" is the one for LIGHT backgrounds and "flat_light" is for dark ones)
  const CUSTOM = {
    createtaxdb: ['createtaxdb/' + D + 'nf-core-createtaxdb_logo_light_tax.png', 'createtaxdb/' + D + 'nf-core-createtaxdb_logo_dark_tax.png'],
    taxprofiler: ['taxprofiler/' + D + 'nf-core-taxprofiler_logo_custom_light.png', 'taxprofiler/' + D + 'nf-core-taxprofiler_logo_custom_dark.png'],
    eager: ['eager/' + D + 'nf-core_eager_logo_flat_black.png', 'eager/' + D + 'nf-core_eager_logo_flat_light.png'],
    mag: ['mag/' + D + 'mag_logo_mascot_light.png', 'mag/' + D + 'mag_logo_mascot_dark.png'],
    viralmetagenome: ['viralmetagenome/' + D + 'nf-core-viralmetagenome_logo_custom_light.png', 'viralmetagenome/' + D + 'nf-core-viralmetagenome_logo_custom_dark.png'],
  };
  // Fills MM.logos[name] = {light:{uri,w,h}, dark:{uri,w,h}} (PNG data URIs (palette PNGs where that is lossless enough), 2x the drawn width).
  async function loadLogos() {
    const B = 'https://raw.githubusercontent.com/nf-core/';
    const load = u => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('cannot load ' + u)); i.src = B + u; });
    // crop transparent margins (logos ship with uneven padding, so the label-to-pill gaps varied 8-21 px)
    const trim = i => { const w = i.naturalWidth || i.width, h = i.naturalHeight || i.height, c = Object.assign(document.createElement('canvas'), { width: w, height: h }), x = c.getContext('2d'); x.drawImage(i, 0, 0); const a = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let k = 0; k < w; k++) if (a[4 * (y * w + k) + 3] > 8) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; } const o = Object.assign(document.createElement('canvas'), { width: x1 - x0 + 1, height: y1 - y0 + 1 }); o.getContext('2d').drawImage(c, -x0, -y0); o.x0 = x0; return o; };
    const shrink = (i, fix, W) => { const h = Math.round((i.naturalHeight || i.height) * W / (i.naturalWidth || i.width)), c = document.createElement('canvas'); c.width = W; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, W, h); if (fix) fix(x, W, h); return { uri: quant(c).uri, w: W, h }; };
    MM.logos = {};
    for (const p of PIPELINES) {
      const [l, d] = CUSTOM[p] || ['light', 'dark'].map(t => `${p}/${p === 'eager' ? 'dev' : 'HEAD'}/docs/images/nf-core-${p}_logo_${t}.png`);
      MM.logos[p] = { light: shrink(trim(await load(l)), null, 2 * lwOf(p)), dark: shrink(trim(await load(d)), null, 2 * lwOf(p)) };
    }
    // bacmodel ships a mascot logo for light only: keep the mascot, recolour the text white
    const bl = trim(await load('bacmodel/' + D + 'nf-core-bacmodel_logo_light.png')); // light logo only: its black text is whitened right of the mascot, below
    // funcscan: its flat logo carries the mascot (a dotted disc) as a tiny corner, which reads blurry. Draw the
    // disc big beside the plain logo instead, from the full-size icon (the repo's funcscan_icon.png)
    const whitenFrom = (f, lo = 120) => (x, w, h) => { const x0 = Math.round(w * f), im = x.getImageData(x0, 0, w - x0, h), a = im.data; for (let k = 0; k < a.length; k += 4) if (a[k + 3] > 0 && Math.max(a[k], a[k + 1], a[k + 2]) - Math.min(a[k], a[k + 1], a[k + 2]) < 50 && a[k] > lo) a[k] = a[k + 1] = a[k + 2] = 255; x.putImageData(im, x0, 0); }; // neutral text brighter than lo (right of fraction f) to white
    const disc = await load('funcscan/' + D + 'funcscan_icon.png');
    const withDisc = (lg, dark) => { const dh = 250, dw = Math.round(disc.naturalWidth * dh / disc.naturalHeight), c = document.createElement('canvas'); c.width = dw + 12 + lg.naturalWidth; c.height = lg.naturalHeight; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; if (dark) x.filter = 'brightness(1.7)'; x.drawImage(disc, 0, (c.height - dh) / 2, dw, dh); x.filter = 'none'; x.drawImage(lg, dw + 12, 0); const t = trim(c); return shrink(t, dark ? whitenFrom((dw + 12 - t.x0) / t.width) : null, 2 * lwOf('funcscan')); }; // composed at full size, then shrunk like the others; dark text whitened after the shrink
    MM.logos.funcscan = { light: withDisc(await load('funcscan/' + D + 'nf-core-funcscan_logo_light.png')), dark: withDisc(await load('funcscan/' + D + 'nf-core-funcscan_logo_dark.png'), true) };
    MM.logos.bacmodel = { light: shrink(bl, null, 2 * lwOf('bacmodel')), dark: shrink(bl, whitenFrom(0.31, -1), 2 * lwOf('bacmodel')) };
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
    const E = (c, dash, pts, jump, arc = 80) => { // jump: hop (arc) over every line this one crosses; draw such a route last
      const e = g.insertEdge(P, null, '', null, null, `endArrow=none;startArrow=none;html=1;rounded=1;arcSize=${arc};strokeWidth=10;strokeColor=${C[c]};` + (dash ? 'dashed=1;dashPattern=1 1;' : '') + (jump ? 'jumpStyle=arc;jumpSize=20;' : ''));
      e.geometry.setTerminalPoint(new mxPoint(pts[0][0], pts[0][1]), true);
      e.geometry.setTerminalPoint(new mxPoint(pts[pts.length - 1][0], pts[pts.length - 1][1]), false);
      e.geometry.points = pts.slice(1, -1).map(p => new mxPoint(p[0], p[1]));
    };
    const TXT = 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;fontColor=light-dark(#000000,#FFFFFF);' + FONT;
    const XD = 1570, XR = 1570, XS = 1230, XM = 980, XG = 1150, YG = 1165, XT = 1350, XK = 1400, XV = 1450, YP = 455, ST = 145, YS = 1340; // x of differentialabundance (same column as the secondary stations), the secondary stations (100 px into box 3), the first of the three touching lanes up to differentialabundance (shotgun XS, mt XS+10, magmap XS+20: clear of the magmap label), mag, magmap; y of magmap (its label must clear the MAG row 1050 above and the viralmetagenome label below); y of metapep, the step between secondary rows (differentialabundance 310 and proteinfamilies 745 are fixed by their lanes, so 145), y of seqsubmit (its MAG lane corner must stay >= 40 px below the viral row 1290); XT, XK, XV: the mt -> seqsubmit, MAG trunk and viral verticals, 50 apart and centred in the gap between boxes 2 and 3. They cannot touch: purple crosses the MAG row just before its corner into the trunk (so XT <= XK - 50), and red crosses purple and the trunk just before its own corner up (so XV >= XK + 50)
    M.beginUpdate();
    try {
      // getChildCells skips hidden cells (the dark logos), so clear with getChildren
      const icon = M.getChildren(P).find(c => c.style === 'group');
      g.clearSelection(); g.removeCells(M.getChildren(P).filter(c => c !== icon), true);
      const BOX = 'rounded=1;absoluteArcSize=1;arcSize=20;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=#E6E6E6;fillColor=#BDBDBD;align=left;verticalAlign=top;fontSize=38;spacing=0;fillStyle=solid;spacingTop=8;spacingLeft=16;fontStyle=1;fontColor=light-dark(#333333,#CCCCCC);' + FONT;

      // routes. Rows (y): 300 amplicon/entry, 450 taxprofiler, 600 funcprofiler, 740/750 metatdenovo (mt out / reads in),
      // 900 eager, 1050 mag, 1165 magmap, 1290 viralmetagenome; secondary 310 differentialabundance, then every 145:
      // 455 metapep, 600 funcscan, 745 proteinfamilies, 890 bacmodel, 1035 phyloplace; 1340 seqsubmit. Channels (x): 680 db, 760 shotgun fan, 1230/1240/1250 shotgun profiles,
      // mt and magmap -> diffabund (touching, concentric corners 50/40/30), 1350 mt -> seqsubmit, 1400 MAG trunk, 1450 viral.
      // A vertical lane can touch its neighbour only if neither crosses the other's lanes inside a corner: so mt -> seqsubmit
      // (crosses the MAG row by the trunk) and viral (crosses mt and the trunk at 1290) keep a corner's width of space.
      // Every MAG branch leaves the trunk the same way (up, then right); so at proteinfamilies the mt lane runs above it (740)
      const br = (xc, y, x2) => [[xc, y - 90], [xc, y], [x2, y]]; // branch off a vertical trunk
      E('amp', 0, [[150, 295], [XD, 295]]);
      E('shot', 0, [[150, 305], [760, 305], [760, 1290], [1050, 1290]]);
      [450, 600, 750, 900].forEach(y => E('shot', 0, br(760, y, 1050)));
      E('shot', 0, br(760, 1050, XM));
      E('shot', 0, [[1050, 450], [XS, 450], [XS, 305], [XD, 305]], false, 100);
      E('shot', 0, [[1050, 600], [XS, 600], [XS, 380]], false, 100);
      E('mt', 0, [[1050, 740], [XR, 740]]);                  // metatdenovo -> proteinfamilies, ends at its pill
      E('mt', 0, [[1050, 740], [XS + 10, 740], [XS + 10, 315], [XD, 315]]);
      E('db', 1, [[190, 600], [680, 600], [680, 460], [1050, 460]]);
      E('db', 1, [[190, 600], [680, 600], [680, 760], [1050, 760]]);
      E('mag', 0, [[XM, 1050], [XK, 1050], [XK, YP + 50]]); // MAG trunk north; its branches (below) start inside it, and the top one turns at YP
      // branches all leave the trunk going up, then right (lane y = row, or row + 5 / - 5 where a second lane shares the pill);
      // phyloplace's starts inside the mag -> seqsubmit line, which runs down the trunk below 1050
      [[YP, 0], [YP + ST, 0], [YP + 2 * ST, 5], [YP + 3 * ST, 0], [YP + 4 * ST, -5]].forEach(([y, o]) => E('mag', 0, [[XK, y + o + 90], [XK, y + o], [XR, y + o]]));
      E('mag', 0, [[XM, 1050], [XK, 1050], [XK, YS - 5], [XR, YS - 5]]); // mag -> seqsubmit, directly
      E('mt', 0, [[1050, 740], [XT, 740], [XT, YS + 5], [XR, YS + 5]], false, 60); // metatdenovo -> seqsubmit: down channel XT, under the MAG lane at the end (30 px corners)
      E('viral', 0, [[1050, 1290], [XV, 1290], [XV, YP + 4 * ST + 5], [XR, YP + 4 * ST + 5]]);
      // magmap (an alternative to metatdenovo, so in the primary box), a little right of mag: reads off the
      // shotgun fan (lower lane), MAGs from mag as an optional dashed input (upper lane; it also runs on public
      // or the user's own genomes), abundances north to differentialabundance on channel XS + 20, touching the
      // shotgun (XS) and metatranscriptome (XS + 10) lanes
      E('shot', 0, br(760, YG + 5, XG));
      E('mag', 1, [[XM, 1050], [XM, YG - 5], [XG, YG - 5]]);
      E('mag', 0, [[XG, YG], [XS + 20, YG], [XS + 20, 325], [XD, 325]], false, 60);
      [['viral', 0, 'viral contigs'], ['shot', 0, 'shotgun reads'], ['mag', 0, 'MAGs / genome bins'], ['mt', 0, 'metatranscriptome contigs'], ['amp', 0, 'amplicon reads'], ['db', 1, 'reference database'], ['mag', 1, 'optional MAGs']].forEach(([c, d, t], i) => {
        const y = 800 + i * 50; E(c, d, [[50, y], [130, y]]);
        V(t, 150, y - 18, 400, 36, TXT + 'align=left;verticalAlign=middle;fontSize=24;');
      });

      // stations [pipeline, x, y, pill height, label side a=above r=right b=below]; a pill is 40
      // or 60 px tall where two or four lanes arrive together
      const S = [['fetchngs', 150, 300, 30, 'a'], ['detaxizer', 420, 300, 30, 'a'], ['createtaxdb', 420, 600, 30, 'a'], ['ampliseq', 1050, 300, 30, 'a'], ['taxprofiler', 1050, 455, 40, 'a'], ['funcprofiler', 1050, 600, 30, 'a'], ['metatdenovo', 1050, 750, 40, 'a'], ['eager', 1050, 900, 30, 'a'], ['mag', XM, 1050, 30, 'a'], ['magmap', XG, YG, 40, 'a'], ['viralmetagenome', 1050, 1290, 30, 'a'],
        ['differentialabundance', XD, 310, 50, 'r'], ['metapep', XR, YP, 30, 'r'], ['funcscan', XR, YP + ST, 30, 'r'], ['proteinfamilies', XR, YP + 2 * ST, 40, 'r'], ['bacmodel', XR, YP + 3 * ST, 30, 'r'], ['phyloplace', XR, YP + 4 * ST, 40, 'r'], ['seqsubmit', XR, YS, 40, 'r']];
      // light logo visible, dark copy hidden: exportAll() swaps them per theme (in memory only)
      const IMG = (uri, x, y, w, h, theme) => {
        const c = V('', x, y, w, h, `shape=image;aspect=fixed;imageAspect=0;image=${uri.replace(';base64,', ',')};metromapTheme=${theme};`);
        if (theme === 'dark') c.visible = false;
      };
      const BOXOF = n => ({ fetchngs: 0, detaxizer: 0, createtaxdb: 0, differentialabundance: 2, metapep: 2, funcscan: 2, proteinfamilies: 2, bacmodel: 2, phyloplace: 2, seqsubmit: 3 })[n] ?? 1;
      const bottom = [692, 0, 0, 0], right = [0, 0, 0, 0]; // lowest content per box (box 1: the "reference genomes" label)
      for (const [n, x, y, h, pos] of S) {
        V('', x - 15, y - h / 2, 30, h, `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=${PIN('#FFFFFF')};strokeColor=${PIN('#000000')};strokeWidth=4;`);
        const L = MM.logos[n], lw = LW[n] || 200, lh = Math.round(lw * L.light.h / L.light.w);
        const lx = pos === 'r' ? x + 27 : x - lw / 2,
           ly = pos === 'a' ? y - h / 2 - 8 - lh : pos === 'b' ? y + h / 2 + 8 : y - lh / 2;
        IMG(L.light.uri, lx, ly, lw, lh, 'light'); IMG(L.dark.uri, lx, ly, lw, lh, 'dark');
        bottom[BOXOF(n)] = Math.max(bottom[BOXOF(n)], y + h / 2, ly + lh); right[BOXOF(n)] = Math.max(right[BOXOF(n)], lx + lw);
      }
      // boxes: equal gaps (GAP) side by side, each PAD below its lowest content
      // box 2 is centred on its station column (1050); box 4's top sits HEAD above seqsubmit's logo, so the box is no taller than it needs
      const PAD = 40, GAP = 140, HEAD = 75, sq = MM.logos.seqsubmit.light, top4 = YS - Math.round(lwOf('seqsubmit') * sq.h / sq.w / 2) - HEAD;
      if (top4 < bottom[2] + PAD + 30) throw new Error('box 4 overlaps box 3: lower YS');
      const boxes = [['1. Data input', 20, 110, 610], ['2. Primary analysis', 630 + GAP, 110, 560], ['3. Secondary analysis', 1330 + GAP, 110, right[2] + PAD - 1330 - GAP], ['4. Data upload', XR - 50, top4, right[3] + PAD - XR + 50]]
        .map((b, i) => V(b[0], b[1], b[2], b[3], bottom[i] + PAD - b[2], BOX));
      g.orderCells(true, boxes);

      // FASTA input icon: the library asset if one is on the page, else a plain stand-in
      if (icon) { const gm = icon.geometry.clone(); gm.x = 40; gm.y = 556; M.setGeometry(icon, gm); g.orderCells(false, [icon]); } // to the front: the boxes were drawn after it
      else V('FASTA', 40, 556, 80, 89, `shape=note;size=22;backgroundOutline=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#FFFFFF);strokeColor=none;fontColor=light-dark(#FFFFFF,#000000);fontStyle=1;fontSize=18;verticalAlign=bottom;spacingBottom=14;` + FONT);
      V('reference<br>genomes', 20, 648, 120, 44, TXT + 'align=center;verticalAlign=top;fontStyle=1;fontSize=16;');
      V('', 130, 585, 26, 30, 'triangle;html=1;fillColor=light-dark(#000000,#FFFFFF);strokeColor=none;direction=east;');
      V('nf-core meta-omics pipelines', 20, 20, 1100, 70, TXT + 'align=left;verticalAlign=middle;fontStyle=1;fontSize=52;');
    } finally { M.endUpdate(); }
    return M.getChildCount(P);
  }

  // Layout check, run before every export (also after hand edits): returns 'ok' or the problems found.
  // Each rule is a review comment the map once got: equal gaps between the boxes, equal bottom padding,
  // one corner radius, evenly spaced stations in a single-column box, a station column centred in its box, logos clear of lines, white logo text in dark mode,
  // every logo stored at >= 1.9x its drawn width (else it looks blurry next to the others).
  async function check(tol = 2) {
    const g = (await getUi()).editor.graph, M = g.model, P = g.getDefaultParent(), cells = M.getChildren(P).filter(c => c.vertex), out = [];
    const isBox = c => /absoluteArcSize=1/.test(c.style || ''), boxes = cells.filter(isBox), G = c => c.geometry;
    const name = b => String(b.value).slice(0, 2), inside = (c, b) => G(c).x >= G(b).x && G(c).y >= G(b).y && G(c).x + G(c).width <= G(b).x + G(b).width && G(c).y + G(c).height <= G(b).y + G(b).height;
    const arcs = new Set(boxes.map(b => /arcSize=(\d+)/.exec(b.style)[1])); if (arcs.size > 1) out.push('box corner radii differ: ' + [...arcs]);
    const row = boxes.filter(b => G(b).y === Math.min(...boxes.map(x => G(x).y))).sort((a, b) => G(a).x - G(b).x);
    const gaps = row.slice(1).map((b, i) => G(b).x - G(row[i]).x - G(row[i]).width); if (Math.max(...gaps) - Math.min(...gaps) > tol) out.push('gaps between boxes differ: ' + gaps);
    const pads = boxes.map(b => { const inner = cells.filter(c => c !== b && !isBox(c) && inside(c, b)); return [name(b), Math.round(G(b).y + G(b).height - Math.max(...inner.map(c => G(c).y + G(c).height)))]; });
    if (Math.max(...pads.map(p => p[1])) - Math.min(...pads.map(p => p[1])) > tol) out.push('bottom padding differs: ' + pads.map(p => p.join(' ')).join(', '));
    for (const b of boxes) {
      const st = cells.filter(c => /arcSize=50/.test(c.style || '') && inside(c, b)).map(c => [G(c).x, G(c).y + G(c).height / 2]).sort((u, v) => u[1] - v[1]);
      if (st.length < 3 || new Set(st.map(s => s[0])).size > 1) continue;
      const d = st.slice(1).map((s, i) => Math.round(s[1] - st[i][1])); if (Math.max(...d) - Math.min(...d) > tol) out.push(`box ${name(b)} stations unevenly spaced: ` + d);
    }
    for (const b of boxes) { // a column of >= 3 stations with their logos centred above them is centred in its box
      const xs = cells.filter(c => /arcSize=50/.test(c.style || '') && inside(c, b)).map(c => G(c).x + G(c).width / 2), cnt = {};
      xs.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
      const col = Object.keys(cnt).map(Number).find(x => cnt[x] >= 3), logos = cells.filter(c => /metromapTheme=light/.test(c.style || '') && Math.abs(G(c).x + G(c).width / 2 - col) < 1);
      if (col !== undefined && logos.length >= 3 && Math.abs(G(b).x + G(b).width / 2 - col) > tol) out.push(`box ${name(b)}: station column ${col} not centred (box centre ${G(b).x + G(b).width / 2})`);
    }
    // every logo clears every line by >= 8 px (lines are 10 px wide, segments axis-aligned)
    const segs = M.getChildren(P).filter(e => e.edge).flatMap(e => { const g0 = e.geometry, p = [g0.sourcePoint, ...(g0.points || []), g0.targetPoint]; return p.slice(1).map((q, i) => [Math.min(p[i].x, q.x) - 5, Math.min(p[i].y, q.y) - 5, Math.max(p[i].x, q.x) + 5, Math.max(p[i].y, q.y) + 5]); });
    for (const c of cells.filter(c => /metromapTheme=light/.test(c.style || ''))) {
      const r = G(c), hit = segs.find(([x0, y0, x1, y1]) => x0 < r.x + r.width + 8 && x1 > r.x - 8 && y0 < r.y + r.height + 8 && y1 > r.y - 8);
      if (hit) out.push(`logo at ${Math.round(r.x)},${Math.round(r.y)} within 8 px of a line`);
    }
    for (const c of cells.filter(c => /metromapTheme=/.test(c.style || ''))) {
      const uri = /image=([^;]+)/.exec(c.style)[1].replace(/^data:image\/png,/, 'data:image/png;base64,'), im = new Image();
      await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = uri; });
      const tag = `${/metromapTheme=(\w+)/.exec(c.style)[1]} logo at ${Math.round(G(c).x)},${Math.round(G(c).y)}`;
      if (im.naturalWidth < 1.9 * G(c).width) out.push(`${tag} stored at only ${(im.naturalWidth / G(c).width).toFixed(1)}x`);
      if (!/metromapTheme=dark/.test(c.style)) continue;
      const cv = Object.assign(document.createElement('canvas'), { width: im.naturalWidth, height: im.naturalHeight }), x = cv.getContext('2d'); x.drawImage(im, 0, 0);
      const a = x.getImageData(0, 0, cv.width, cv.height).data, v = [];
      for (let k = 0; k < a.length; k += 4) if (a[k + 3] > 250 && Math.max(a[k], a[k + 1], a[k + 2]) - Math.min(a[k], a[k + 1], a[k + 2]) < 30 && a[k] > 150) v.push(a[k]);
      v.sort((p, q) => p - q); const p90 = v[Math.floor(v.length * 0.9)];
      if (v.length > 50 && p90 < 245) out.push(`${tag}: text not white (${p90})`);
    }
    return out.length ? out.join(' | ') : 'ok';
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

  root.MM = { EDGES, getUi, view, quant, loadLogos, build, check, useAssetIcon, exportAll, preview, downloadButton, waitSaved, logos: null, files: {} };
})(typeof window !== 'undefined' ? window : globalThis);
