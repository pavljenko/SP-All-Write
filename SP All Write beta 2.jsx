#target illustrator
/*
  All Glyphs.jsx — FULL SCRIPT (working)

  Added (2026-01):
  - Preflight compatibility check BEFORE main dialog:
    * shows small palette: “Проверка совместимости…”
    * runs OS/Illustrator heuristics + capability tests on minimal sample:
        - read tf.lines.length (area text)
        - read tf.overflows/tf.overflow
        - run createOutline() once on one glyph
    * if any check fails => SAFE MODE

  SAFE MODE UI:
  - No “Select all” button
  - Next to “Optional sets” toggle shows: “Ошибка совместимости. Включен базовый режим”
  - Optional checkboxes are limited to 4 selected at once (unchecked become disabled)
  - Diacritics allowed, BUT in safe mode they are added “as is” (NO outline-based filtering)

  FULL MODE UI:
  - “Select all” present
  - Next to it shows: “Может работать нестабильно”
*/

(function () {
  if (app.documents.length === 0) { alert("Open a document first."); return; }
  var doc = app.activeDocument;

  // ---------------- UI language (RU/EN) ----------------
  function isRussianUI() {
    try {
      if (app.locale && typeof app.locale === "string") {
        return app.locale.toLowerCase().indexOf("ru") === 0;
      }
    } catch (e) {}
    return false;
  }
  var RU = isRussianUI();
  function t(ru, en) { return RU ? ru : en; }
  function trim(s){ return (s||"").replace(/^\s+|\s+$/g,""); }

  // =====================================================
  // PRE-FLIGHT COMPATIBILITY CHECK (BEFORE MAIN DIALOG)
  // =====================================================
  var SAFE_MODE = false;

  function CompatUI() {
    var w = new Window("palette", t("Проверка", "Checking"));
    w.orientation = "column";
    w.alignChildren = ["fill","fill"];
    var txt = w.add("statictext", undefined, t("Проверка совместимости…", "Checking compatibility…"), {multiline:true});
    txt.justification = "center";
    txt.preferredSize.width = 360;
    this.show = function(){ try{ w.show(); }catch(e){} try{ w.update(); }catch(e2){} try{ app.redraw(); }catch(e3){} };
    this.close = function(){ try{ w.close(); }catch(e){} };
  }

  function parseOSInfo() {
    var osRaw = "";
    try { osRaw = String($.os || ""); } catch(e){ osRaw = ""; }
    var isMac = /mac/i.test(osRaw);
    var isWin = /win/i.test(osRaw);

    // Try to extract version numbers if present
    // mac examples: "Macintosh OS 10.15.7", "Mac OS 14.2.1"
    // win examples: "Windows 10.0", sometimes "Windows 10.0 (build ...)"
    var major = null, minor = null, patch = null;

    var m = osRaw.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (m) {
      major = parseInt(m[1], 10);
      minor = parseInt(m[2], 10);
      patch = (typeof m[3] !== "undefined") ? parseInt(m[3], 10) : 0;
    }

    return { raw: osRaw, isMac: isMac, isWin: isWin, major: major, minor: minor, patch: patch };
  }

  function parseAiMajor() {
    try {
      var v = String(app.version || "");
      var maj = parseInt(v, 10);
      if (!isNaN(maj)) return maj;
      var f = parseFloat(v);
      if (!isNaN(f)) return Math.floor(f);
    } catch(e){}
    return null;
  }

  function getOrCreateTempLayer(name) {
    var lay = null;
    try {
      for (var i=0; i<doc.layers.length; i++){
        if (doc.layers[i].name === name) { lay = doc.layers[i]; break; }
      }
      if (!lay) {
        lay = doc.layers.add();
        lay.name = name;
      }
      lay.visible = true;
      lay.locked = false;
    } catch(e){}
    return lay;
  }

function removeLayerIfEmpty(lay){
  try {
    if (!lay) return;
    var hasItems = false;
    try { hasItems = (lay.pageItems && lay.pageItems.length > 0); } catch(e1){}
    try { hasItems = hasItems || (lay.textFrames && lay.textFrames.length > 0); } catch(e2){}
    if (!hasItems) lay.remove();
  } catch(e){}
}

  function runCompatibilityCheck(){
    var ui = new CompatUI();
    ui.show();

    var ok = true;

    // --- A: OS heuristic (conservative, avoid false positives) ---
    var os = parseOSInfo();

    // Older macOS than Sierra (10.12) => safe
    if (os.isMac && os.major !== null) {
      // macOS 10.x
      if (os.major === 10 && os.minor !== null && os.minor < 12) ok = false;
      // very old macOS (<10)
      if (os.major < 10) ok = false;
    }

    // Very old Windows (7/8 era) => safe
    if (os.isWin && os.major !== null) {
      // Windows 6.x corresponds to Vista/7/8/8.1
      if (os.major <= 6) ok = false;
      // NOTE: Windows 11 often reports 10.0, so we do NOT force safe on 10.0 here.
    }

    // --- B: Illustrator major heuristic ---
    var aiMaj = parseAiMajor();
    if (aiMaj !== null && aiMaj < 28) ok = false;

    // --- C: Capability tests on minimal sample ---
    // Create minimal area text, read lines, read overflows, do one outline
    var layName = "__AllGlyphs_COMPAT__";
    var lay = null;
    var tfArea = null, rect = null, tfPoint = null, outlined = null;

    try {
      lay = getOrCreateTempLayer(layName);
      if (!lay) throw new Error("No temp layer");

      // Area text test (tf.lines.length)
      rect = lay.pathItems.rectangle(0, 0, 200, 120);
      rect.stroked = false; rect.filled = false;
      tfArea = lay.textFrames.areaText(rect);
      tfArea.contents = "A A A";

      var linesOk = false;
      try {
        tfArea.contents = "A A A";
        try { app.redraw(); } catch(e){}
        var nLines = tfArea.lines.length;
        linesOk = (typeof nLines === "number");
      } catch(eLines){
        linesOk = false;
      }
      if (!linesOk) ok = false;

      // overflows/overflow test
      var ovOk = false;
      try { var a = tfArea.overflows; ovOk = true; } catch(eO1){}
      if (!ovOk) { try { var b = tfArea.overflow; ovOk = true; } catch(eO2){} }
      // If neither property can be read, mark not-ok (but script can still run in safe mode)
      if (!ovOk) ok = false;

      // createOutline test once (on point text to keep it trivial)
      tfPoint = lay.textFrames.pointText([0, 0]);
      tfPoint.contents = "A";
      var outOk = false;
      try {
        outlined = tfPoint.createOutline();
        outOk = !!outlined;
      } catch(eOut){
        outOk = false;
      }
      if (!outOk) ok = false;

    } catch(eMain) {
      ok = false;
    } finally {
      // cleanup
      try { if (outlined) outlined.remove(); } catch(e1){}
      try { if (tfPoint) tfPoint.remove(); } catch(e2){}
      try { if (tfArea) tfArea.remove(); } catch(e3){}
      try { if (rect) rect.remove(); } catch(e4){}
      try { if (lay) removeLayerIfEmpty(lay); } catch(e5){}
    }

    ui.close();
    return ok;
  }

  // Run preflight now
var preflightOK = runCompatibilityCheck();
SAFE_MODE = !preflightOK;

  // ---------------- STATUS PALETTE (non-modal) ----------------
  var busy = null;

  function BusyUI() {
    var w = new Window("palette", t("Выполнение...", "Working..."));
    w.orientation = "column";
    w.alignChildren = ["fill","fill"];

    var txt = w.add("statictext", undefined, t("Запуск", "Starting"), {multiline: true});
    txt.justification = "center";
    txt.alignment = ["fill","top"];
    txt.preferredSize.width = 420;

    var base = t("Выполняется", "Working");
    var stage = t("Подготовка", "Preparing");
    var dots = 0;
    var lastTick = (new Date()).getTime();

    function render() {
      var d = "";
      if (dots === 1) d = ".";
      else if (dots === 2) d = "..";
      else if (dots === 3) d = "...";
      txt.text = stage + "\n" + base + d;

      txt.justification = "center";
      try { w.layout.layout(true); } catch(e1){}
      try { w.update(); } catch(e2){}
      try { app.redraw(); } catch(e3){}
      try { $.sleep(15); } catch(e4){}
    }

    this.show = function() {
      try { w.show(); } catch(e){}
      render();
    };

    this.setStage = function(msg) {
      stage = msg || stage;
      dots = 0;
      lastTick = (new Date()).getTime();
      render();
    };

    this.pulse = function(force) {
      var now = (new Date()).getTime();
      if (!force && (now - lastTick) < 2000) return;
      lastTick = now;

      dots++;
      if (dots > 3) dots = 1;

      render();
    };

    this.close = function() {
      try { w.close(); } catch(e){}
    };
  }

  // ---------------- Helpers ----------------
  function makeRGB(hex){
  var c = new RGBColor();
  c.red   = (hex >> 16) & 255;
  c.green = (hex >> 8) & 255;
  c.blue  = hex & 255;
  return c;
}

// кислотно-салатовый (можешь поменять hex)
var SCAN_NEON = makeRGB(0x96E354);

  function mmToPt(mm) { return mm * 72 / 25.4; }
  function chr(cp) { return String.fromCharCode(cp); } // BMP only

  // считает "сравнимые" символы без переносов строк (\r и \n)
  function countComparableChars(tf){
    try{
      var ch = tf.textRange.characters;
      var n = 0;
      for (var i=0; i<ch.length; i++){
        var s = ch[i].contents;
        if (s === "\r" || s === "\n") continue;
        n++;
      }
      return n;
    }catch(e){
      return null;
    }
  }

  function collapseEmptyParagraphs(s){
    try{
      if (!s) return s;
      s = s.replace(/\r{2,}/g, "\r");
      s = s.replace(/^\r+|\r+$/g, "");
      return s;
    }catch(e){
      return s;
    }
  }

  function isControl(cp) {
    if (cp >= 0x0000 && cp <= 0x001F) return true;
    if (cp === 0x007F) return true;
    if (cp >= 0x0080 && cp <= 0x009F) return true;
    return false;
  }
  function isSurrogate(cp) { return (cp >= 0xD800 && cp <= 0xDFFF); }
  function isNonCharacter(cp) {
    if (cp >= 0xFDD0 && cp <= 0xFDEF) return true;
    if ((cp & 0xFFFF) === 0xFFFE) return true;
    if ((cp & 0xFFFF) === 0xFFFF) return true;
    return false;
  }
  function isUselessForGlyphShowcase(cp) {
    if (cp >= 0xFE00 && cp <= 0xFE0F) return true;
    if (cp >= 0xFE20 && cp <= 0xFE2F) return true;
    if (cp >= 0x2000 && cp <= 0x200F) return true;
    if (cp >= 0x2028 && cp <= 0x202F) return true;
    if (cp >= 0x2060 && cp <= 0x206F) return true;
    if (cp === 0x200B || cp === 0x200C || cp === 0x200D) return true;
    if (cp === 0xFEFF) return true;
    if (cp === 0x0F0B) return true;
    if (cp === 0x1361) return true;
    if (cp === 0x3000) return true;
    return false;
  }

  function setAllFont(tf, fontObj) { try { tf.textRange.characterAttributes.textFont = fontObj; } catch (e) {} }
  function setAllSize(tf, pt)     { try { tf.textRange.characterAttributes.size = pt; } catch (e) {} }

  function isUppercaseLetterChar(s){
    try {
      if (!s || s.length !== 1) return false;
      var up = s.toUpperCase();
      var lo = s.toLowerCase();
      return (s === up) && (up !== lo);
    } catch(e){ return false; }
  }
  function isLowercaseLetterChar(s){
    try {
      if (!s || s.length !== 1) return false;
      var up = s.toUpperCase();
      var lo = s.toLowerCase();
      return (s === lo) && (up !== lo);
    } catch(e){ return false; }
  }

  // ---------------- Viewport bounds helper ----------------
  function getViewBounds() {
    try {
      var view = (doc.views && doc.views.length) ? doc.views[0] : null;
      if (view && view.bounds && view.bounds.length === 4) return view.bounds;
    } catch (e) {}
    var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
    return ab.artboardRect;
  }

// ---------------- SCAN SPREAD (viewport scatter) ----------------
var SCATTER_SCAN = true;          // можно выключать
if (SAFE_MODE) SCATTER_SCAN = false;
var SCATTER_GRID_COLS = 18;
var SCATTER_GRID_ROWS = 10;

var _scatterPts = null;
var _scatterIdx = 0;
var _scatterLast = -1;

function buildScatterPoints(){
  var vb = getViewBounds(); // [L,T,R,B]
  var L=vb[0], T=vb[1], R=vb[2], B=vb[3];
  var W = Math.max(1, R - L);
  var H = Math.max(1, T - B);

  var cols = Math.max(3, SCATTER_GRID_COLS);
  var rows = Math.max(3, SCATTER_GRID_ROWS);

  var cellW = W / cols;
  var cellH = H / rows;

  var pts = [];
  for (var r=0; r<rows; r++){
    for (var c=0; c<cols; c++){
      // чуть смещаем от угла ячейки, чтобы не попадать в край
      var x = L + c*cellW + cellW*0.25;
      var y = T - r*cellH - cellH*0.25;
      pts.push([x,y]);
    }
  }
  return pts;
}

function scatterPos(){
  if (!SCATTER_SCAN) return [0,0];
  if (!_scatterPts || !_scatterPts.length) _scatterPts = buildScatterPoints();

  var idx = Math.floor(Math.random() * _scatterPts.length);
  if (_scatterPts.length > 1) {
    while (idx === _scatterLast) idx = Math.floor(Math.random() * _scatterPts.length);
  }
  _scatterLast = idx;

  return _scatterPts[idx];
}

  // ---------------- Two-pass overset detection ----------------
  function isOversetNative(tf){
    try { if (tf.overflows === true) return true; } catch(e){}
    try { if (tf.overflow === true) return true; } catch(e){}
    try { if (tf.textRange && tf.textRange.overflows === true) return true; } catch(e){}
    return false;
  }

  function isOversetByLines(tf){
    try{
      var totalComparable = null;
      try { totalComparable = tf._ag_totalComparable; } catch(e0){ totalComparable = null; }

      if (totalComparable === null || typeof totalComparable === "undefined"){
        totalComparable = countComparableChars(tf);
        try { tf._ag_totalComparable = totalComparable; } catch(e1){}
      }

      if (totalComparable === null) return false;
      if (totalComparable === 0) return false;

      var visible = 0;
      var lines = tf.lines;
      for (var i=0; i<lines.length; i++){
        try { visible += lines[i].characters.length; } catch(e){}
      }
      return (visible + 2) < totalComparable;
    }catch(e){
      return false;
    }
  }

  function isAreaText(tf){
    try { if (typeof tf.kind !== "undefined") return tf.kind === TextType.AREATEXT; } catch(e){}
    return true;
  }
  function isOversetSmart(tf){
    if (isOversetNative(tf)) return true;
    if (!isAreaText(tf)) return false;
    try { app.redraw(); } catch(e){}
    return isOversetByLines(tf);
  }

  // ---------------- Auto-fit font size ----------------
  function fitFontSizeToMaxNoOverset(tf, startPt){
    if (!isAreaText(tf)) return startPt;

    var EPS = 0.25;
    var MIN_PT = 1.0;
    var MAX_PT = 1200;
    var MAX_ITER = 28;

    var cur = Math.max(MIN_PT, startPt);
    setAllSize(tf, cur);
    try { app.redraw(); } catch(e){}
    if (busy) busy.pulse();

    if (isOversetSmart(tf)) {
      var hi = cur;
      var lo = cur;
      var guard = 0;

      while (lo > MIN_PT && isOversetSmart(tf) && guard < 25){
        lo = lo * 0.75;
        if (lo < MIN_PT) lo = MIN_PT;
        setAllSize(tf, lo);
        try { app.redraw(); } catch(e1){}
        guard++;
        if (busy) busy.pulse();
      }
      if (isOversetSmart(tf)) return lo;

      var best = lo;
      var left = lo, right = hi;
      for (var i=0; i<MAX_ITER; i++){
        var mid = (left + right) / 2;
        setAllSize(tf, mid);
        try { app.redraw(); } catch(e2){}
        if (isOversetSmart(tf)){
          right = mid;
        } else {
          best = mid;
          left = mid;
        }
        if ((right - left) <= EPS) break;
        if (busy) busy.pulse();
      }
      setAllSize(tf, best);
      try { app.redraw(); } catch(e3){}
      return best;
    }

    var lo2 = cur;
    var hi2 = cur;
    var grow = 1.25;
    var guard2 = 0;

    while (guard2 < 30){
      var next = hi2 * grow;
      if (next > MAX_PT) next = MAX_PT;

      setAllSize(tf, next);
      try { app.redraw(); } catch(e4){}
      if (busy) busy.pulse();

      if (isOversetSmart(tf)){
        hi2 = next;
        break;
      } else {
        lo2 = next;
        hi2 = next;
      }

      if (next >= MAX_PT) return lo2;
      guard2++;
    }

    if (!isOversetSmart(tf)) return lo2;

    var best2 = lo2;
    var left2 = lo2, right2 = hi2;

    for (var j=0; j<MAX_ITER; j++){
      var mid2 = (left2 + right2) / 2;
      setAllSize(tf, mid2);
      try { app.redraw(); } catch(e5){}
      if (isOversetSmart(tf)){
        right2 = mid2;
      } else {
        best2 = mid2;
        left2 = mid2;
      }
      if ((right2 - left2) <= EPS) break;
      if (busy) busy.pulse();
    }

    setAllSize(tf, best2);
    try { app.redraw(); } catch(e6){}
    return best2;
  }

  function forceFitByShrinkingOnly(tf_, startPt){
    if (!isAreaText(tf_)) return startPt;

    var MIN_PT = 1.0;
    var MAX_ITER = 80;
    var k = startPt;

    setAllSize(tf_, k);
    try { app.redraw(); } catch(e){}
    if (busy) busy.pulse();

    if (!isOversetSmart(tf_)) return k;

    for (var i=0; i<MAX_ITER && k > MIN_PT && isOversetSmart(tf_); i++){
      k = Math.max(MIN_PT, k * 0.92);
      setAllSize(tf_, k);
      try { app.redraw(); } catch(e2){}
      if (busy) busy.pulse();
    }

    return k;
  }

  // ---------------- Unicode groups ----------------
  var BLOCKS = {
    digits: [
      [0x0030, 0x0039],
      [0x0660, 0x0669], [0x06F0, 0x06F9],
      [0x0966, 0x096F], [0x09E6, 0x09EF], [0x0A66, 0x0A6F], [0x0AE6, 0x0AEF],
      [0x0B66, 0x0B6F], [0x0BE6, 0x0BEF], [0x0C66, 0x0C6F],
      [0x0D66, 0x0D6F],
      [0x0E50, 0x0E59], [0x0ED0, 0x0ED9], [0x0F20, 0x0F29], [0x1040, 0x1049], [0x17E0, 0x17E9],
      [0xFF10, 0xFF19],
      [0x2070, 0x2079], [0x2080, 0x2089],
      [0x2150, 0x218F],
      [0x2460, 0x24FF],
      [0x2776, 0x2793]
    ],

    latin: [
      [0x0041, 0x005A], [0x0061, 0x007A],
      [0x00C0, 0x00D6], [0x00D8, 0x00F6], [0x00F8, 0x00FF],
      [0x0100, 0x017F],
      [0x0180, 0x024F],
      [0x1E00, 0x1EFF],
      [0x2C60, 0x2C7F],
      [0xA720, 0xA7FF],
      [0xAB30, 0xAB6F]
    ],

    cyrillic: [
      [0x0400, 0x04FF],
      [0x0500, 0x052F],
      [0x2DE0, 0x2DFF],
      [0xA640, 0xA69F]
    ],

    punct_currency: [
      [0x0021, 0x002F], [0x003A, 0x0040], [0x005B, 0x0060], [0x007B, 0x007E],
      [0x00A1, 0x00BF],
      [0x2010, 0x206F], [0x2E00, 0x2E7F], [0x3001, 0x303F],
      [0x00A2, 0x00A5], [0x20AC, 0x20AC], [0x20A0, 0x20CF]
    ],

    ligatures: [[0xFB00, 0xFB06]],

    symbols_signs: [
      [0x2100, 0x214F],[0x2190, 0x21FF],[0x2200, 0x22FF],[0x2300, 0x23FF],
      [0x2460, 0x24FF],[0x2500, 0x257F],[0x2580, 0x259F],[0x25A0, 0x25FF],
      [0x2600, 0x26FF],[0x2700, 0x27BF],[0x27C0, 0x27EF],[0x27F0, 0x27FF]
    ],

    supersubs: [
      [0x2070, 0x209F],
      [0x0300, 0x036F], [0x1AB0, 0x1AFF], [0x1DC0, 0x1DFF], [0x20D0, 0x20FF]
    ],

    armenian: [[0x0530, 0x058F]],
    glagolitic: [[0x2C00, 0x2C5F]],
    greek: [[0x0370, 0x03FF], [0x1F00, 0x1FFF]],
    georgian: [[0x10A0, 0x10FF], [0x2D00, 0x2D2F]],
    south_asian: [[0x0900, 0x0DFF], [0x0E00, 0x0EFF], [0x0F00, 0x0FFF], [0x1000, 0x109F], [0x1780, 0x17FF]],
    korean: [[0x1100, 0x11FF], [0x3130, 0x318F], [0xA960, 0xA97F], [0xAC00, 0xD7AF], [0xD7B0, 0xD7FF]],
    runic: [[0x16A0, 0x16FF]],
    semitic: [[0x0590, 0x05FF], [0x0600, 0x06FF], [0x0700, 0x074F], [0x0750, 0x077F], [0x08A0, 0x08FF]],
    ethiopic: [[0x1200, 0x137F], [0x1380, 0x139F], [0x2D80, 0x2DDF]],
    japanese: [[0x3040, 0x309F], [0x30A0, 0x30FF], [0x31F0, 0x31FF]]
  };

  function collectFromRanges(ranges){
    var out = [];
    var lastPulse = (new Date()).getTime();

    for (var r = 0; r < ranges.length; r++){
      var a = ranges[r][0], b = ranges[r][1];

      for (var cp = a; cp <= b; cp++){
        if (isControl(cp) || isSurrogate(cp) || isNonCharacter(cp)) continue;
        if (isUselessForGlyphShowcase(cp)) continue;

        out.push(cp);

        var now = (new Date()).getTime();
        if (busy && (now - lastPulse) >= 2000) {
          lastPulse = now;
          try { busy.pulse(true); } catch(e1){}
          try { $.sleep(10); } catch(e2){}
        }
      }

      if (busy) busy.pulse(false);
    }

    return out;
  }

  // ---------------- Fonts list ----------------
  var fonts = app.textFonts;
  if (!fonts || fonts.length === 0) { alert(t("Не удалось получить список шрифтов.", "Cannot read installed fonts.")); return; }

  function safeFontDisplayName(tf){
    try {
      var fam = tf.family;
      var sty = tf.style;
      if (fam && sty) {
        fam = String(fam);
        sty = String(sty);
        if (trim(fam) && trim(sty)) return trim(fam) + " " + trim(sty);
      }
    } catch(e1){}
    try { return tf.name; } catch(e2){}
    return "";
  }

  var fontItems = [];
  for (var f = 0; f < fonts.length; f++) {
    var ps = fonts[f].name;
    var disp = safeFontDisplayName(fonts[f]);
    var srch = (disp + " " + ps).toLowerCase();
    fontItems.push({ ps: ps, display: disp, search: srch, font: fonts[f] });
  }

  fontItems.sort(function (a, b) {
    var A = (a.display || a.ps || "").toLowerCase();
    var B = (b.display || b.ps || "").toLowerCase();
    return A < B ? -1 : (A > B ? 1 : 0);
  });

  function findFontByTypedName(name){
    if (!name) return null;
    var needle = String(name).toLowerCase();

    for (var i=0; i<fontItems.length; i++){
      if ((fontItems[i].display || "").toLowerCase() === needle) return fontItems[i].font;
    }
    for (var j=0; j<fontItems.length; j++){
      if ((fontItems[j].ps || "").toLowerCase() === needle) return fontItems[j].font;
    }
    for (var k=0; k<fontItems.length; k++){
      if ((fontItems[k].display || "").toLowerCase().indexOf(needle) === 0) return fontItems[k].font;
    }
    for (var k2=0; k2<fontItems.length; k2++){
      if ((fontItems[k2].ps || "").toLowerCase().indexOf(needle) === 0) return fontItems[k2].font;
    }
    for (var m=0; m<fontItems.length; m++){
      if ((fontItems[m].search || "").indexOf(needle) !== -1) return fontItems[m].font;
    }
    return null;
  }

  // ---------------- Dialog ----------------
  var dlg = new Window("dialog", t("SP All Write", "SP All Write"));
  dlg.alignChildren = "fill";

  var bannerText =
t("<3 Больше шрифтов", "<3 More Fonts") + " — pavljenko.ru\n" +
    "_________________";

  var banner = dlg.add("statictext", undefined, bannerText, { multiline: true });

  function setMono(ctrl, size) {
    try { ctrl.graphics.font = ScriptUI.newFont("Menlo", "Regular", size); return true; } catch(e1){}
    try { ctrl.graphics.font = ScriptUI.newFont("Consolas", "Regular", size); return true; } catch(e2){}
    try { ctrl.graphics.font = ScriptUI.newFont("Courier New", "Regular", size); return true; } catch(e3){}
    return false;
  }
  setMono(banner, 12);

  var pnlFont = dlg.add("panel", undefined, t("Шрифт", "Font"));
  pnlFont.alignChildren = "fill";

  var etFont = pnlFont.add("edittext", undefined, "");
  etFont.preferredSize.width = 640;

  pnlFont.add("statictext", undefined, t("Нажмите дважды, чтобы выбрать", "Double-click to pick"));

  var lbFonts = pnlFont.add("listbox", undefined, [], {multiselect:false});
  lbFonts.preferredSize.height = 170;

  // ===========================
  // OUTPUT MODE (point/area) + GROUP SEPARATION (yes/no)
  // ===========================
  var pnlOutput = dlg.add("panel", undefined, t("Представление", "Output"));
  pnlOutput.alignChildren = "left";

  var grpMode = pnlOutput.add("group");
  grpMode.orientation = "row";
  grpMode.alignChildren = ["left", "center"];

  var rbPoint = grpMode.add("radiobutton", undefined, t("Объект текста", "Point text object"));
  var rbArea  = grpMode.add("radiobutton", undefined, t("Область текста", "Area text (viewport)"));
  rbPoint.value = true;

  var grpSepWrap = pnlOutput.add("group");
  grpSepWrap.orientation = "row";
  grpSepWrap.alignChildren = ["left", "center"];
  grpSepWrap.add("statictext", undefined, t("Разделять на группы:", "Separate into groups:"));

  var rbSepYes = grpSepWrap.add("radiobutton", undefined, t("Да", "Yes"));
  var rbSepNo  = grpSepWrap.add("radiobutton", undefined, t("Нет", "No"));
  rbSepYes.value = true;

  // ===========================
  // FONT PICKER
  // ===========================
  var SUPPRESS_FILTER = false;
  var IGNORE_NEXT_ONCHANGING = false;
  var lastFilterText = "";
  var SELECTED_FONT_INDEX = -1;

  function refillFontList(filter){
    if (SUPPRESS_FILTER) return;

    var q = (filter || "").toLowerCase();

    var prevIdx = -1;
    try {
      if (lbFonts.selection && typeof lbFonts.selection._fi !== "undefined") prevIdx = lbFonts.selection._fi;
    } catch(e0){ prevIdx = -1; }

    var prevTop = 0;
    try { prevTop = lbFonts.topIndex; } catch(eTop){ prevTop = 0; }

    while (lbFonts.items.length) lbFonts.remove(0);

    for (var i=0; i<fontItems.length; i++){
      if (!q || fontItems[i].search.indexOf(q) !== -1) {
        var it = lbFonts.add("item", fontItems[i].display);
        it._fi = i;
      }
    }

    if (!lbFonts.items.length) return;

    var selIndex = -1;
    if (prevIdx >= 0){
      for (var j=0; j<lbFonts.items.length; j++){
        if (lbFonts.items[j]._fi === prevIdx) { selIndex = j; break; }
      }
    }
    if (selIndex < 0) selIndex = 0;
    lbFonts.selection = selIndex;

    try { lbFonts.topIndex = Math.max(0, Math.min(prevTop, lbFonts.items.length - 1)); } catch(eTop2){}
  }

  etFont.text = fontItems[0].display;
  lastFilterText = etFont.text;
  SELECTED_FONT_INDEX = 0;
  refillFontList("");

  etFont.onChanging = function(){
    if (SUPPRESS_FILTER) return;

    if (IGNORE_NEXT_ONCHANGING) {
      IGNORE_NEXT_ONCHANGING = false;
      lastFilterText = etFont.text || "";
      return;
    }

    var txt = etFont.text || "";
    if (txt === lastFilterText) return;

    lastFilterText = txt;
    SELECTED_FONT_INDEX = -1;
    refillFontList(txt);
  };

  lbFonts.onChange = function(){};

  lbFonts.onDoubleClick = function(){
    var sel = lbFonts.selection;
    if (!sel) return;

    try { SELECTED_FONT_INDEX = sel._fi; } catch(e0){ SELECTED_FONT_INDEX = -1; }

    SUPPRESS_FILTER = true;
    etFont.text = sel.text;
    lastFilterText = etFont.text;
    SUPPRESS_FILTER = false;

    IGNORE_NEXT_ONCHANGING = true;
  };

  // ---------------- Sets UI ----------------
  var pnlDefault = dlg.add("panel", undefined, t("Включено по умолчанию", "Enabled by default"));
  pnlDefault.alignChildren = "fill";
  var defaultRow = pnlDefault.add("group");
  defaultRow.orientation = "row";
  defaultRow.alignChildren = ["left", "center"];

  var checkboxes = {};
  function addCB(parent, key, label, val) {
    var cb = parent.add("checkbox", undefined, label);
    cb.value = val;
    checkboxes[key] = cb;
    return cb;
  }
  function addDefault(key, labelRU, labelEN, val){
    addCB(defaultRow, key, t(labelRU, labelEN), val);
  }

  addDefault("digits", "Цифры", "Digits", true);
  addDefault("latin", "Латиница", "Latin", true);
  addDefault("cyrillic", "Кириллица", "Cyrillic", true);
  addDefault("punct_currency", "Пунктуация + валюты", "Punctuation + currency", true);

  var toggleGrp = dlg.add("group");
  toggleGrp.alignChildren = ["left", "center"];

  var btnToggle = toggleGrp.add("button", undefined, t("Выключенные наборы ▸", "Optional sets ▸"));

  // FULL mode only: Select all + warning
  var btnSelectAll = null;
  var warnFull = null;

if (!SAFE_MODE) {
  btnSelectAll = toggleGrp.add("button", undefined, t("Включить все", "Enable all"));
  warnFull = toggleGrp.add("statictext", undefined, t("Может работать нестабильно", "May be unstable"));
} else {
  // SAFE mode: error label near toggle
  toggleGrp.add("statictext", undefined, t("Ошибка совместимости. Включен базовый режим", "Compatibility error. Basic mode enabled"));
}

  var pnlOptional = dlg.add("panel", undefined, t("Выключенные наборы", "Optional sets"));
  pnlOptional.alignChildren = "fill";
  pnlOptional.visible = false;

  var optCols = pnlOptional.add("group");
  optCols.orientation = "row";
  optCols.alignChildren = ["fill", "top"];

  var optCol1 = optCols.add("group"); optCol1.orientation = "column"; optCol1.alignChildren = ["left","top"];
  var optCol2 = optCols.add("group"); optCol2.orientation = "column"; optCol2.alignChildren = ["left","top"];

  btnToggle.onClick = function () {
    pnlOptional.visible = !pnlOptional.visible;
    btnToggle.text = pnlOptional.visible ? t("Выключенные наборы ▾", "Optional sets ▾") : t("Выключенные наборы ▸", "Optional sets ▸");
    dlg.layout.layout(true);
  };

  var OPTIONAL_ITEMS = [
    { key:"diacritics",    labelRU:"Диакритика",                 labelEN:"Diacritics" },
    { key:"symbols_signs", labelRU:"Спецсимволы и знаки",        labelEN:"Symbols & signs" },
    { key:"supersubs",     labelRU:"Надстрочные и подстрочные",  labelEN:"Superscripts & subscripts" },

    { key:"armenian",      labelRU:"Армянский",                  labelEN:"Armenian" },
    { key:"glagolitic",    labelRU:"Глаголица",                  labelEN:"Glagolitic" },
    { key:"greek",         labelRU:"Греческий",                  labelEN:"Greek" },
    { key:"georgian",      labelRU:"Грузинский",                 labelEN:"Georgian" },
    { key:"south_asian",   labelRU:"Южноазиатские",              labelEN:"South Asian" },
    { key:"korean",        labelRU:"Корейский",                  labelEN:"Korean" },
    { key:"runic",         labelRU:"Руны",                       labelEN:"Runic" },
    { key:"semitic",       labelRU:"Семитские",                  labelEN:"Semitic" },
    { key:"ethiopic",      labelRU:"Эфиопский",                  labelEN:"Ethiopic" },
    { key:"japanese",      labelRU:"Японское письмо",            labelEN:"Japanese scripts" }
  ];

  var OPTIONAL_UI_ORDER = [];
  for (var oi=0; oi<OPTIONAL_ITEMS.length; oi++){
    var it = OPTIONAL_ITEMS[oi];
    var parent = (oi % 2 === 0) ? optCol1 : optCol2;
    addCB(parent, it.key, t(it.labelRU, it.labelEN), false);
    OPTIONAL_UI_ORDER.push(it.key);
  }

function anyOptionalChecked(){
  for (var i=0; i<OPTIONAL_UI_ORDER.length; i++){
    var k = OPTIONAL_UI_ORDER[i];
    if (checkboxes[k] && checkboxes[k].value === true) return true;
  }
  return false;
}

function updateSelectAllButtonLabel(){
  if (!btnSelectAll) return;        // safe mode => кнопки нет
  btnSelectAll.text = anyOptionalChecked()
    ? t("Выключить", "Disable")
    : t("Включить все", "Enable all");
}

  // SAFE MODE: limit optional selection to 4
  function updateOptionalLimitUI(){
    if (!SAFE_MODE) return;

    var cnt = 0;
    for (var i=0; i<OPTIONAL_UI_ORDER.length; i++){
      var k = OPTIONAL_UI_ORDER[i];
      if (checkboxes[k] && checkboxes[k].value === true) cnt++;
    }

    var limit = 4;
    var lockOthers = (cnt >= limit);

    for (var j=0; j<OPTIONAL_UI_ORDER.length; j++){
      var kk = OPTIONAL_UI_ORDER[j];
      var cb = checkboxes[kk];
      if (!cb) continue;

      if (cb.value === true) {
        cb.enabled = true;
      } else {
        cb.enabled = !lockOthers;
      }
    }
  }

for (var u=0; u<OPTIONAL_UI_ORDER.length; u++){
  (function(key){
    var cb = checkboxes[key];
    if (!cb) return;
    cb.onClick = function(){
      updateOptionalLimitUI();        // safe mode ограничение (в full mode просто ничего не делает)
      updateSelectAllButtonLabel();   // обновить подпись toggle-кнопки
    };
  })(OPTIONAL_UI_ORDER[u]);
}

if (!SAFE_MODE) {
  btnSelectAll.onClick = function(){
    var turnOff = anyOptionalChecked();

    for (var i=0; i<OPTIONAL_UI_ORDER.length; i++){
      var key = OPTIONAL_UI_ORDER[i];
      if (checkboxes[key]) checkboxes[key].value = turnOff ? false : true;
    }

    updateSelectAllButtonLabel();
  };
}

  // Apply initial safe-mode lock state
  updateOptionalLimitUI();
  updateSelectAllButtonLabel();

  var btns = dlg.add("group");
  btns.alignment = "right";
  btns.add("button", undefined, "OK", { name: "ok" });
  btns.add("button", undefined, t("Отмена", "Cancel"), { name: "cancel" });

  if (dlg.show() !== 1) return;

  // ---------------- Options from dialog ----------------
  var OUT_MODE = (rbArea && rbArea.value === true) ? "area" : "point";
  var SEP_GROUPS = (rbSepYes && rbSepYes.value === true);

  // ---------------- SHOW STATUS WINDOW AFTER PARAMS DIALOG ----------------
  busy = new BusyUI();
  busy.show();
  busy.setStage(t("Инициализация", "Initializing"));

  // ---------------- Choose font ----------------
  var chosen = null;
  if (SELECTED_FONT_INDEX >= 0 && SELECTED_FONT_INDEX < fontItems.length) {
    chosen = fontItems[SELECTED_FONT_INDEX].font;
  } else {
    var typedFontName = trim(etFont.text || "");
    if (!typedFontName && lbFonts.selection) {
      try { typedFontName = lbFonts.selection.text; } catch(e0){}
    }
    chosen = findFontByTypedName(typedFontName);
  }

  if (!chosen) {
    if (busy) busy.close();
    alert(t("Шрифт не найден: ", "Font not found: ") + (etFont.text || ""));
    return;
  }
  var chosenName = chosen.name;

  function enabled(key){
    return checkboxes[key] && checkboxes[key].value === true;
  }

  // ---------------- TEMP LAYER ----------------
  function getTempLayer() {
    var name = "__AllGlyphs_TMP__";
    var lay = null;
    try {
      for (var i=0; i<doc.layers.length; i++){
        if (doc.layers[i].name === name) { lay = doc.layers[i]; break; }
      }
      if (!lay) {
        lay = doc.layers.add();
        lay.name = name;
      }
      lay.visible = true;
      lay.locked = false;
    } catch(e) {}
    return lay;
  }

  // ---------------- TEMP MEASURE (no outlines) ----------------
  function measureChar(fontObj, ch){
    if (busy) busy.pulse();

    var lay = getTempLayer();
    if (!lay) return null;

    var tf = null, w = null, fontName = null;
    try {
      var p = scatterPos();
      tf = lay.textFrames.pointText(p);
      tf.contents = ch;

      try { tf.textRange.characterAttributes.textFont = fontObj; } catch(e1){}
      try { tf.textRange.characterAttributes.size = 100; } catch(e2){}
      try { tf.textRange.characterAttributes.fillColor = SCAN_NEON; } catch(eC){}

      try {
        var gb = tf.geometricBounds;
        w = gb[2] - gb[0];
      } catch(e4){ w = null; }

      try {
        var c0 = tf.textRange.characters[0];
        fontName = (c0 && c0.characterAttributes && c0.characterAttributes.textFont) ? c0.characterAttributes.textFont.name : null;
      } catch(e5){ fontName = null; }
    } catch(e6){
      w = null; fontName = null;
    } finally {
      try { if (tf) tf.remove(); } catch(e7){}
    }
    return { width: w, fontName: fontName };
  }

  function decideCasePolicyForScript(samplePairs){
    var hasUpper = false, hasLower = false;
    var distinctFound = false;
    var tol = 0.01;

    for (var i=0; i<samplePairs.length; i++){
      var up = samplePairs[i][0], lo = samplePairs[i][1];

      var mu = measureChar(chosen, up);
      var ml = measureChar(chosen, lo);

      var upOk = mu && mu.fontName === chosenName && mu.width !== null;
      var loOk = ml && ml.fontName === chosenName && ml.width !== null;

      if (upOk) hasUpper = true;
      if (loOk) hasLower = true;

      if (upOk && loOk) {
        if (Math.abs(mu.width - ml.width) > tol) { distinctFound = true; break; }
      }

      if (busy) busy.pulse();
    }

    var useUpper = hasUpper;
    var useLower = hasLower;

    if (hasUpper && hasLower && !distinctFound) { useUpper = true; useLower = false; }

    return { useUpper: useUpper, useLower: useLower, hasUpper: hasUpper, hasLower: hasLower, distinct: distinctFound };
  }

  var latinPolicy = { useUpper:true, useLower:true, hasUpper:true, hasLower:true, distinct:true };
  var cyrPolicy   = { useUpper:true, useLower:true, hasUpper:true, hasLower:true, distinct:true };

  if (enabled("latin")) {
    busy.setStage(t("Проверка регистра (Latin)", "Checking case (Latin)"));
    latinPolicy = decideCasePolicyForScript([["A","a"],["B","b"],["E","e"],["M","m"],["N","n"],["R","r"]]);
    if (latinPolicy.hasUpper && !latinPolicy.hasLower) {
      alert(t("В шрифте нет строчных латинских. Дублирование отключено.", "No Latin lowercase in this font. Duplication disabled."));
    } else if (!latinPolicy.hasUpper && latinPolicy.hasLower) {
      alert(t("В шрифте нет заглавных латинских. Дублирование отключено.", "No Latin uppercase in this font. Duplication disabled."));
    }
  }
  if (enabled("cyrillic")) {
    busy.setStage(t("Проверка регистра (Cyrillic)", "Checking case (Cyrillic)"));
    cyrPolicy = decideCasePolicyForScript(
      [[String.fromCharCode(0x0410),String.fromCharCode(0x0430)],
       [String.fromCharCode(0x0411),String.fromCharCode(0x0431)],
       [String.fromCharCode(0x0415),String.fromCharCode(0x0435)],
       [String.fromCharCode(0x041C),String.fromCharCode(0x043C)],
       [String.fromCharCode(0x041D),String.fromCharCode(0x043D)]]
    );
    if (cyrPolicy.hasUpper && !cyrPolicy.hasLower) {
      alert(t("В выбранном шрифте нет строчных кириллических. Дублирование отключено.", "No Cyrillic lowercase in this font. Duplication disabled."));
    } else if (!cyrPolicy.hasUpper && cyrPolicy.hasLower) {
      alert(t("В выбранном шрифте нет заглавных кириллических. Дублирование отключено.", "No Cyrillic uppercase in this font. Duplication disabled."));
    }
  }

  // ---------------- OUTLINES metrics ----------------
  function countPointsInItem(item){
    var total = 0;

    function walk(it){
      if (!it) return;

      if (it.typename === "GroupItem") {
        try { for (var i=0; i<it.pathItems.length; i++) walk(it.pathItems[i]); } catch(e1){}
        try { for (var j=0; j<it.compoundPathItems.length; j++) walk(it.compoundPathItems[j]); } catch(e2){}
        try { for (var k=0; k<it.groupItems.length; k++) walk(it.groupItems[k]); } catch(e3){}
        return;
      }

      if (it.typename === "CompoundPathItem") {
        try { for (var c=0; c<it.pathItems.length; c++) walk(it.pathItems[c]); } catch(e4){}
        return;
      }

      if (it.typename === "PathItem") {
        try { total += (it.pathPoints ? it.pathPoints.length : 0); } catch(e5){}
        return;
      }
    }

    walk(item);
    return total;
  }

  function measureOutlineMetrics(fontObj, ch){
    if (busy) busy.pulse();

    var lay = getTempLayer();
    if (!lay) return null;

    var tf = null, outlined = null;
    try {
      var p = scatterPos();
      tf = lay.textFrames.pointText(p);
      tf.contents = ch;

      try { tf.textRange.characterAttributes.textFont = fontObj; } catch(e1){}
      try { tf.textRange.characterAttributes.size = 100; } catch(e2){}
      try { tf.textRange.characterAttributes.fillColor = SCAN_NEON; } catch(eC){}

      try { app.redraw(); } catch(e3){}

      var fontName = null;
      try {
        var c0 = tf.textRange.characters[0];
        fontName = (c0 && c0.characterAttributes && c0.characterAttributes.textFont) ? c0.characterAttributes.textFont.name : null;
      } catch(e0){ fontName = null; }
      if (fontName !== chosenName) return null;

      try { outlined = tf.createOutline(); } catch(e4){ outlined = null; }
      if (!outlined) return null;

      var gb = null;
      try { gb = outlined.geometricBounds; } catch(e5){ gb = null; }
      if (!gb || gb.length !== 4) return null;

      var h = gb[1] - gb[3];
      var w = gb[2] - gb[0];
      var p = countPointsInItem(outlined);

      return { h: h, w: w, points: p };
    } catch(e6){
      return null;
    } finally {
      try { if (outlined) outlined.remove(); } catch(e7){}
      try { if (tf) tf.remove(); } catch(e8){}
    }
  }

  function sameOutlinePointsOrUnknown(ch1, ch2){
    var m1 = measureOutlineMetrics(chosen, ch1);
    var m2 = measureOutlineMetrics(chosen, ch2);
    if (!m1 || !m2) return null;
    return (m1.points === m2.points);
  }

  // ---------------- Latin helpers ----------------
  function latinBaseLetter(ch){
    var m = {
      "À":"A","Á":"A","Â":"A","Ã":"A","Ä":"A","Å":"A","Ā":"A","Ă":"A","Ą":"A","Ǎ":"A","Ǟ":"A","Ǡ":"A","Ǻ":"A","Ȁ":"A","Ȃ":"A",
      "à":"a","á":"a","â":"a","ã":"a","ä":"a","å":"a","ā":"a","ă":"a","ą":"a","ǎ":"a","ǟ":"a","ǡ":"a","ǻ":"a","ȁ":"a","ȃ":"a",
      "Ç":"C","Ć":"C","Ĉ":"C","Ċ":"C","Č":"C",
      "ç":"c","ć":"c","ĉ":"c","ċ":"c","č":"c",
      "Ď":"D","Ḋ":"D","Ḍ":"D","Ḏ":"D","Ḑ":"D","Ḓ":"D","Đ":"D",
      "ď":"d","ḋ":"d","ḍ":"d","ḏ":"d","ḑ":"d","ḓ":"d","đ":"d",
      "È":"E","É":"E","Ê":"E","Ë":"E","Ē":"E","Ĕ":"E","Ė":"E","Ę":"E","Ě":"E","Ȅ":"E","Ȇ":"E",
      "è":"e","é":"e","ê":"e","ë":"e","ē":"e","ĕ":"e","ė":"e","ę":"e","ě":"e","ȅ":"e","ȇ":"e",
      "Ĝ":"G","Ğ":"G","Ġ":"G","Ģ":"G","Ǧ":"G",
      "ĝ":"g","ğ":"g","ġ":"g","ģ":"g","ǧ":"g",
      "Ĥ":"H","Ḣ":"H","Ḥ":"H","Ḧ":"H","Ḩ":"H","Ḫ":"H",
      "ĥ":"h","ḣ":"h","ḥ":"h","ḧ":"h","ḩ":"h","ḫ":"h",
      "Ì":"I","Í":"I","Î":"I","Ï":"I","Ĩ":"I","Ī":"I","Ĭ":"I","Į":"I","İ":"I","Ǐ":"I","Ȉ":"I","Ȋ":"I",
      "ì":"i","í":"i","î":"i","ï":"i","ĩ":"i","ī":"i","ĭ":"i","į":"i","ǐ":"i","ȉ":"i","ȋ":"i",
      "Ĵ":"J","ĵ":"j",
      "Ķ":"K","Ǩ":"K","Ḱ":"K","Ḳ":"K","Ḵ":"K",
      "ķ":"k","ǩ":"k","ḱ":"k","ḳ":"k","ḵ":"k",
      "Ĺ":"L","Ļ":"L","Ľ":"L","Ŀ":"L","Ḷ":"L","Ḹ":"L","Ḻ":"L",
      "ĺ":"l","ļ":"l","ľ":"l","ŀ":"l","ḷ":"l","ḹ":"l","ḻ":"l",
      "Ñ":"N","Ń":"N","Ņ":"N","Ň":"N","Ǹ":"N",
      "ñ":"n","ń":"n","ņ":"n","ň":"n","ǹ":"n",
      "Ò":"O","Ó":"O","Ô":"O","Õ":"O","Ö":"O","Ō":"O","Ŏ":"O","Ő":"O","Ǒ":"O","Ȍ":"O","Ȏ":"O",
      "ò":"o","ó":"o","ô":"o","õ":"o","ö":"o","ō":"o","ŏ":"o","ő":"o","ǒ":"o","ȍ":"o","ȏ":"o",
      "Ŕ":"R","Ŗ":"R","Ř":"R","Ȑ":"R","Ȓ":"R",
      "ŕ":"r","ŗ":"r","ř":"r","ȑ":"r","ȓ":"r",
      "Ś":"S","Ŝ":"S","Ş":"S","Š":"S","Ș":"S",
      "ś":"s","ŝ":"s","ş":"s","š":"s","ș":"s",
      "Ţ":"T","Ť":"T","Ț":"T",
      "ţ":"t","ť":"t","ț":"t",
      "Ù":"U","Ú":"U","Û":"U","Ü":"U","Ũ":"U","Ū":"U","Ŭ":"U","Ů":"U","Ű":"U","Ų":"U","Ǔ":"U","Ȕ":"U","Ȗ":"U",
      "ù":"u","ú":"u","û":"u","ü":"u","ũ":"u","ū":"u","ŭ":"u","ů":"u","ű":"u","ų":"u","ǔ":"u","ȕ":"u","ȗ":"u",
      "Ŵ":"W","Ẁ":"W","Ẃ":"W","Ẅ":"W",
      "ŵ":"w","ẁ":"w","ẃ":"w","ẅ":"w",
      "Ý":"Y","Ÿ":"Y","Ŷ":"Y","Ȳ":"Y",
      "ý":"y","ÿ":"y","ŷ":"y","ȳ":"y",
      "Ź":"Z","Ż":"Z","Ž":"Z","Ẑ":"Z","Ȥ":"Z",
      "ź":"z","ż":"z","ž":"z","ẑ":"z","ȥ":"z"
    };
    return m[ch] || null;
  }

  function isLatinSpecialLetter(cp){
    if (cp === 0x00DF) return true;
    if (cp === 0x00C6 || cp === 0x00E6) return true;
    if (cp === 0x0152 || cp === 0x0153) return true;
    if (cp === 0x00D8 || cp === 0x00F8) return true;
    if (cp === 0x00DE || cp === 0x00FE) return true;
    if (cp === 0x00D0 || cp === 0x00F0) return true;
    if (cp === 0x0141 || cp === 0x0142) return true;
    if (cp === 0x0192) return true;
    return false;
  }

  function isLatinPrecomposedDiacritic(cp){
    if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A)) return false;
    if (isLatinSpecialLetter(cp)) return false;
    var ch = chr(cp);
    var base = latinBaseLetter(ch);
    return base !== null;
  }

  function isPointsOnlyDiacriticChar(ch){
    return (ch === "Đ" || ch === "đ" || ch === "Ľ" || ch === "Ŀ" || ch === "ľ" || ch === "ŀ");
  }

  // ---------------- Ranking helpers (with GROUPS) ----------------
  function pushCpsInto(result, seen, cps, groups){
    var g = [];
    for (var i=0; i<cps.length; i++){
      var cp = cps[i];
      if (seen[cp]) continue;
      seen[cp] = true;
      result.push(cp);
      g.push(cp);
      if (busy) busy.pulse();
    }
    if (groups && g.length) groups.push(g);
  }

  function rangeToArray(a,b){
    var arr = [];
    for (var cp=a; cp<=b; cp++) arr.push(cp);
    return arr;
  }

  function buildBasicLatinCps(){
    return rangeToArray(0x0041,0x005A).concat(rangeToArray(0x0061,0x007A));
  }

  function buildLatinParts(){
    if (busy) busy.pulse();

    var all = collectFromRanges(BLOCKS.latin);
    var wantDia = (enabled("diacritics") === true);

    var extended = [];
    var diaCandidates = [];

    for (var i=0; i<all.length; i++){
      var cp = all[i];

      if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A)) continue;

      if (isLatinPrecomposedDiacritic(cp)) {
        if (wantDia) diaCandidates.push(cp);
      } else {
        extended.push(cp);
      }

      if (busy) busy.pulse();
    }

    var diacritics = [];
    if (wantDia) {
      // SAFE MODE: NO outline filtering, keep as-is
      if (SAFE_MODE) {
        diacritics = diaCandidates;
      } else {
        var keptDia = [];
        var tolH = 0.5;

        for (var d=0; d<diaCandidates.length; d++){
          var dcp = diaCandidates[d];
          var dch = chr(dcp);

          var base = latinBaseLetter(dch);
          if (!base) { keptDia.push(dcp); continue; }

          var baseCh = base;
          try { baseCh = isLowercaseLetterChar(dch) ? base.toLowerCase() : base.toUpperCase(); } catch(e0){}

          if (isPointsOnlyDiacriticChar(dch)) {
            var samePts2 = sameOutlinePointsOrUnknown(dch, baseCh);
            if (samePts2 === true) continue;
            keptDia.push(dcp);
            continue;
          }

          var md = measureOutlineMetrics(chosen, dch);
          var mb = measureOutlineMetrics(chosen, baseCh);

          if (!md || !mb) { keptDia.push(dcp); continue; }

          var hd = md.h, hb = mb.h;

          if (hd < hb - tolH) { keptDia.push(dcp); continue; }
          if ((hd - hb) > tolH) { keptDia.push(dcp); continue; }

          if (busy) busy.pulse();
          continue;
        }

        diacritics = keptDia;
      }
    }

    function filterByLatinPolicy(list){
      var out = [];
      for (var i=0; i<list.length; i++){
        var s = chr(list[i]);
        if (isUppercaseLetterChar(s)) { if (latinPolicy.useUpper) out.push(list[i]); continue; }
        if (isLowercaseLetterChar(s)) { if (latinPolicy.useLower) out.push(list[i]); continue; }
        out.push(list[i]);
      }
      return out;
    }

    return {
      basic: filterByLatinPolicy(buildBasicLatinCps()),
      extended: filterByLatinPolicy(extended),
      diacritics: filterByLatinPolicy(diacritics)
    };
  }

  function buildRussianCyrillicCps(){
    var arr = [];
    for (var cp=0x0410; cp<=0x0415; cp++) arr.push(cp);
    arr.push(0x0401);
    for (var cp2=0x0416; cp2<=0x042F; cp2++) arr.push(cp2);

    for (var cp3=0x0430; cp3<=0x0435; cp3++) arr.push(cp3);
    arr.push(0x0451);
    for (var cp4=0x0436; cp4<=0x044F; cp4++) arr.push(cp4);

    var out = [];
    for (var i=0; i<arr.length; i++){
      var s = chr(arr[i]);
      if (isUppercaseLetterChar(s)) { if (cyrPolicy.useUpper) out.push(arr[i]); continue; }
      if (isLowercaseLetterChar(s)) { if (cyrPolicy.useLower) out.push(arr[i]); continue; }
      out.push(arr[i]);
    }
    return out;
  }

  function buildExtendedCyrillicCps(){
    var all = collectFromRanges(BLOCKS.cyrillic);

    var ru = {};
    for (var cp=0x0410; cp<=0x042F; cp++) ru[cp] = true;
    for (var cp2=0x0430; cp2<=0x044F; cp2++) ru[cp2] = true;
    ru[0x0401] = true;
    ru[0x0451] = true;

    var out = [];
    for (var i=0; i<all.length; i++){
      var c = all[i];
      if (ru[c]) continue;

      var s = chr(c);
      if (isUppercaseLetterChar(s)) { if (cyrPolicy.useUpper) out.push(c); continue; }
      if (isLowercaseLetterChar(s)) { if (cyrPolicy.useLower) out.push(c); continue; }
      out.push(c);

      if (busy) busy.pulse();
    }
    return out;
  }

  function buildDigitsCpsRanked(){
    var ranges = [
      [0x2776, 0x2793],
      [0x2460, 0x24FF],
      [0x2150, 0x218F],
      [0x2070, 0x2079], [0x2080, 0x2089],
      [0xFF10, 0xFF19],
      [0x17E0, 0x17E9],
      [0x1040, 0x1049],
      [0x0F20, 0x0F29],
      [0x0ED0, 0x0ED9],
      [0x0E50, 0x0E59],
      [0x0D66, 0x0D6F],
      [0x0C66, 0x0C6F],
      [0x0BE6, 0x0BEF],
      [0x0B66, 0x0B6F],
      [0x0AE6, 0x0AEF],
      [0x0A66, 0x0A6F],
      [0x09E6, 0x09EF],
      [0x0966, 0x096F],
      [0x06F0, 0x06F9],
      [0x0660, 0x0669],
      [0x0030, 0x0039]
    ];
    return collectFromRanges(ranges);
  }

  function pushGroupInto(result, seen, key, groups){
    var ranges = BLOCKS[key];
    if (!ranges) return;

    var cps = collectFromRanges(ranges);
    var g = [];

    for (var k=0; k<cps.length; k++){
      var cp = cps[k];
      if (seen[cp]) continue;
      seen[cp] = true;
      result.push(cp);
      g.push(cp);
      if (busy) busy.pulse();
    }

    if (groups && g.length) groups.push(g);
  }

  // ---------------- Build ordered cps + groups ----------------
  busy.setStage(t("Сбор и сортировка символов", "Collecting & sorting glyphs"));

  var seen = {};
  var orderedCP = [];
  var GROUPS = [];

  var latinParts = null;
  if (enabled("latin")) {
    latinParts = buildLatinParts();
    pushCpsInto(orderedCP, seen, latinParts.basic, GROUPS);
  }

  if (enabled("cyrillic")) {
    pushCpsInto(orderedCP, seen, buildRussianCyrillicCps(), GROUPS);
    pushCpsInto(orderedCP, seen, buildExtendedCyrillicCps(), GROUPS);
  }

  if (enabled("latin")) {
    if (!latinParts) latinParts = buildLatinParts();
    pushCpsInto(orderedCP, seen, latinParts.extended, GROUPS);
  }

  if (enabled("latin") && enabled("diacritics")) {
    if (!latinParts) latinParts = buildLatinParts();
    pushCpsInto(orderedCP, seen, latinParts.diacritics, GROUPS);
  }

  pushGroupInto(orderedCP, seen, "ligatures", GROUPS);

  if (enabled("punct_currency")) pushGroupInto(orderedCP, seen, "punct_currency", GROUPS);
  if (enabled("symbols_signs"))  pushGroupInto(orderedCP, seen, "symbols_signs", GROUPS);
  if (enabled("supersubs"))      pushGroupInto(orderedCP, seen, "supersubs", GROUPS);

  for (var i=0; i<OPTIONAL_UI_ORDER.length; i++){
    var kk2 = OPTIONAL_UI_ORDER[i];
    if (kk2 === "diacritics" || kk2 === "symbols_signs" || kk2 === "supersubs") continue;
    if (!enabled(kk2)) continue;
    pushGroupInto(orderedCP, seen, kk2, GROUPS);
  }

  if (enabled("digits")) {
    pushCpsInto(orderedCP, seen, buildDigitsCpsRanked(), GROUPS);
  }

  if (orderedCP.length === 0) {
    if (busy) busy.close();
    alert(t("Не выбран ни один набор символов.", "No glyph sets selected."));
    return;
  }

  function cpsToText(cps){
    var a = [];
    for (var i=0; i<cps.length; i++) a.push(chr(cps[i]));
    return a.join(" ");
  }

  var groupTexts = [];
  for (var gi=0; gi<GROUPS.length; gi++){
    groupTexts.push(cpsToText(GROUPS[gi]));
  }

  var candidateText = SEP_GROUPS ? groupTexts.join("\r") : groupTexts.join(" ");

  // ---------------- Text container (by chosen mode only) ----------------
  function ensureWritableLayer() {
    var lay = doc.activeLayer;
    try {
      if (lay.locked) {
        for (var i = 0; i < doc.layers.length; i++) {
          if (!doc.layers[i].locked && doc.layers[i].visible) return doc.layers[i];
        }
        var nl = doc.layers.add();
        nl.name = "AllGlyphs";
        nl.locked = false;
        nl.visible = true;
        return nl;
      }
    } catch (e) {}
    return lay;
  }

  function createAreaTextInViewport() {
    var vb = getViewBounds();
    var vL = vb[0], vT = vb[1], vR = vb[2], vB = vb[3];
    var vW = Math.max(300, vR - vL);
    var vH = Math.max(300, vT - vB);

    var desired = mmToPt(5500);
    var margin = 40;
    var w = Math.min(desired, Math.max(300, vW - margin * 2));
    var h = Math.min(desired, Math.max(300, vH - margin * 2));

    var cx = (vL + vR) / 2;
    var cy = (vT + vB) / 2;

    var left = cx - w / 2;
    var top  = cy + h / 2;

    var layer = ensureWritableLayer();
    var prevLocked = layer.locked;
    if (prevLocked) layer.locked = false;

    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.stroked = false;
    rect.filled = false;

    var tfr = layer.textFrames.areaText(rect);
    tfr.name = "AllGlyphs_" + chosenName;

    try { rect.hidden = true; } catch (e) {}
    if (prevLocked) layer.locked = true;

    return tfr;
  }

  function createPointTextInViewport() {
    var vb = getViewBounds();
    var vL = vb[0], vT = vb[1];

    var layer = ensureWritableLayer();
    var prevLocked = layer.locked;
    if (prevLocked) layer.locked = false;

    var x = vL + 40;
    var y = vT - 40;

    var tfr = layer.textFrames.pointText([x, y]);
    tfr.name = "AllGlyphs_" + chosenName;

    if (prevLocked) layer.locked = true;
    return tfr;
  }

  var tf = null;
  if (OUT_MODE === "area") {
    busy.setStage(t("Создание области текста", "Creating area text"));
    tf = createAreaTextInViewport();
  } else {
    busy.setStage(t("Создание объекта текста", "Creating point text"));
    tf = createPointTextInViewport();
  }

  function getStartSize(tf_) {
    try { var s2 = tf_.textRange.characterAttributes.size; if (s2 && s2 > 0) return s2; } catch (e2) {}
    return 24;
  }

  // ---------------- Paragraph normalization (critical for groups) ----------------
  function forceParagraphNoSpacing(tf_){
    try {
      var tr = tf_.textRange;
      try { tr.paragraphAttributes.spaceBefore = 0; } catch(e1){}
      try { tr.paragraphAttributes.spaceAfter  = 0; } catch(e2){}
      try { tr.paragraphAttributes.firstLineIndent = 0; } catch(e3){}
      try { tr.paragraphAttributes.leftIndent = 0; } catch(e4){}
      try { tr.paragraphAttributes.rightIndent = 0; } catch(e5){}
      try { tr.characterAttributes.autoLeading = true; } catch(e6){}
    } catch(e0){}
  }

  // ---------------- Whitespace normalization ----------------
  function normalizeTextSpacing(s, keepParagraphs){
    s = (s || "");
    s = s.replace(/\r\n/g, "\r");
    s = s.replace(/\n/g, "\r");
    s = s.replace(/\t+/g, " ");

    if (keepParagraphs) {
      s = s.replace(/[ ]{2,}/g, " ");
      s = s.replace(/ *\r+ */g, "\r");
      s = s.replace(/^\r+|\r+$/g, "");
    } else {
      s = s.replace(/\r+/g, " ");
      s = s.replace(/[ ]{2,}/g, " ");
      s = s.replace(/^\s+|\s+$/g, "");
    }
    return s;
  }

  // ---------------- Filter characters ----------------
  function keepOnlyChosenFontInFrame(tf_, fontName, fontObj, keepParagraphs) {
    setAllFont(tf_, fontObj);

    var chars = tf_.textRange.characters;
    var out = [];

    for (var i = 0; i < chars.length; i++) {
      var c = chars[i].contents;

      if (c === " " || c === "\t" || c === "\r" || c === "\n") {
        out.push(c);
        continue;
      }

      var fnt = null;
      try { fnt = chars[i].characterAttributes.textFont; } catch (e) { fnt = null; }
      if (fnt && fnt.name === fontName) out.push(c);

      if (busy) busy.pulse();
    }

    var raw = out.join("");
    var cleaned = normalizeTextSpacing(raw, keepParagraphs);

    tf_.contents = cleaned;
    setAllFont(tf_, fontObj);

    return cleaned;
  }

  // ---------------- Place text ----------------
  busy.setStage(t("Заполнение текста", "Placing glyph string"));

  var startSize = getStartSize(tf);

  tf.contents = candidateText;
  setAllFont(tf, chosen);

  if (SEP_GROUPS) {
    forceParagraphNoSpacing(tf);
  }

  if (OUT_MODE === "area") {
    setAllSize(tf, startSize);
  }

  try { app.redraw(); } catch (e0) {}
  if (busy) busy.pulse();

  keepOnlyChosenFontInFrame(tf, chosenName, chosen, SEP_GROUPS);

  if (SEP_GROUPS) {
    forceParagraphNoSpacing(tf);
  }

  if (OUT_MODE === "area") {
    setAllSize(tf, startSize);
  }

  try { tf.contents = collapseEmptyParagraphs(tf.contents); } catch(e){}

  try { app.redraw(); } catch (e1) {}
  if (busy) busy.pulse();

  try { tf._ag_totalComparable = countComparableChars(tf); } catch(e){}

  // ---------------- Missing group check ----------------
  function cpInRanges(cp, ranges){
    for (var i=0; i<ranges.length; i++){
      if (cp >= ranges[i][0] && cp <= ranges[i][1]) return true;
    }
    return false;
  }

  function countGroupInFrame(tf_, key){
    var n = 0;

    if (key === "diacritics") {
      if (!enabled("latin") || !enabled("diacritics")) return 0;
      try {
        var chs = tf_.textRange.characters;
        for (var i=0; i<chs.length; i++){
          var s = chs[i].contents;
          if (!s || s === " " || s === "\t" || s === "\r" || s === "\n") continue;
          var cp = s.charCodeAt(0);
          if (isLatinPrecomposedDiacritic(cp)) n++;
          if (busy) busy.pulse();
        }
      } catch(e0){}
      return n;
    }

    var ranges = BLOCKS[key];
    if (!ranges) return 0;

    try {
      var ch = tf_.textRange.characters;
      for (var i=0; i<ch.length; i++){
        var s2 = ch[i].contents;
        if (!s2 || s2 === " " || s2 === "\t" || s2 === "\r" || s2 === "\n") continue;
        var cp2 = s2.charCodeAt(0);
        if (cpInRanges(cp2, ranges)) n++;
        if (busy) busy.pulse();
      }
    } catch(e1){}
    return n;
  }

  function labelForKey(key){
    if (key === "diacritics") return t("Диакритика", "Diacritics");

    for (var i=0;i<OPTIONAL_ITEMS.length;i++){
      if (OPTIONAL_ITEMS[i].key === key) return t(OPTIONAL_ITEMS[i].labelRU, OPTIONAL_ITEMS[i].labelEN);
    }
    var map = {
      digits: t("Цифры","Digits"),
      latin: t("Латиница","Latin"),
      cyrillic: t("Кириллица","Cyrillic"),
      punct_currency: t("Пунктуация + валюты","Punctuation + currency")
    };
    return map[key] || key;
  }

  busy.setStage(t("Проверка групп из чекбоксов", "Checking checkbox groups"));

  var missing = [];
  var keysToCheck = ["digits","latin","cyrillic","punct_currency"].concat(OPTIONAL_UI_ORDER);

  for (var iK=0; iK<keysToCheck.length; iK++){
    var kk = keysToCheck[iK];
    if (!enabled(kk)) continue;
    if (kk === "diacritics" && !enabled("latin")) continue;

    var cnt = countGroupInFrame(tf, kk);
    if (cnt === 0) missing.push(labelForKey(kk));
    if (busy) busy.pulse();
  }

  var missingMsg = null;
  if (missing.length) {
    missingMsg =
      t("В выбранном шрифте не найдены символы для групп:\n• ", "No glyphs found in this font for groups:\n• ")
      + missing.join("\n• ");
  }

  // ---------------- FIT SIZE (ONLY for area text) ----------------
  if (OUT_MODE === "area") {
    if (SEP_GROUPS) forceParagraphNoSpacing(tf);

    busy.setStage(t("Подстройка кегля", "Fitting font size"));

    var fitted = fitFontSizeToMaxNoOverset(tf, startSize);

    if (isAreaText(tf) && isOversetSmart(tf)) {
      fitted = forceFitByShrinkingOnly(tf, fitted);
    }

    if (isAreaText(tf) && isOversetSmart(tf)) {
      if (busy) busy.close();
      alert(t(
        "Текст не помещается даже при минимальном кегле. Символы НЕ удалялись.",
        "Text still oversets even at minimal size. No characters were removed."
      ));
      return;
    }
  }

  // ---------------- CLOSE STATUS WINDOW, THEN SHOW MISSING GROUPS ALERT ----------------
  if (busy) busy.close();
  if (missingMsg) alert(missingMsg);

})();