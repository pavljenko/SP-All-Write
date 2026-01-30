#target illustrator
/*

  SP All Write 1.0

*/

(function () {
  if (app.documents.length === 0) { alert("Open a document first."); return; }
  var doc = app.activeDocument;

// =====================================================
// MODULE LOADER
// =====================================================
function loadLanguageModule() {
  try {
    // ВАРИАНТ 1: Ищем рядом с основным скриптом
    var scriptFile = new File($.fileName);
    var scriptFolder = scriptFile.parent;
    var modulePath = scriptFolder + "/SP lang All Write.jsx";
    var moduleFile = new File(modulePath);
    
    // ВАРИАНТ 2: Если не нашли, ищем в папке Scripts
    if (!moduleFile.exists) {
      var appFolder = Folder.appPackage;
      var scriptsFolder = new Folder(appFolder + "/Presets/ru_RU/Scripts");
      if (!scriptsFolder.exists) {
        scriptsFolder = new Folder(appFolder + "/Presets/en_US/Scripts");
      }
      moduleFile = new File(scriptsFolder + "/SP lang All Write.jsx");
    }
    
    if (!moduleFile.exists) {
      return null;
    }
    
    $.evalFile(moduleFile);
    
    if (typeof detectLanguagesFromGlyphs !== 'undefined') {
      return true;
    }
    return null;
  } catch(e) {
    return null;
  }
}

var LANGUAGE_MODULE_LOADED = loadLanguageModule();

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
  // PRE-FLIGHT COMPATIBILITY CHECK
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
    var os = parseOSInfo();
    if (os.isMac && os.major !== null) {
      if (os.major === 10 && os.minor !== null && os.minor < 12) ok = false;
      if (os.major < 10) ok = false;
    }
    if (os.isWin && os.major !== null) {
      if (os.major <= 6) ok = false;
    }
    var aiMaj = parseAiMajor();
    if (aiMaj !== null && aiMaj < 28) ok = false;

    var layName = "__AllGlyphs_COMPAT__";
    var lay = null;
    var tfArea = null, rect = null, tfPoint = null, outlined = null;
    try {
      lay = getOrCreateTempLayer(layName);
      if (!lay) throw new Error("No temp layer");
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
      } catch(eLines){ linesOk = false; }
      if (!linesOk) ok = false;
      var ovOk = false;
      try { var a = tfArea.overflows; ovOk = true; } catch(eO1){}
      if (!ovOk) { try { var b = tfArea.overflow; ovOk = true; } catch(eO2){} }
      if (!ovOk) ok = false;
      tfPoint = lay.textFrames.pointText([0, 0]);
      tfPoint.contents = "A";
      var outOk = false;
      try {
        outlined = tfPoint.createOutline();
        outOk = !!outlined;
      } catch(eOut){ outOk = false; }
      if (!outOk) ok = false;
    } catch(eMain) {
      ok = false;
    } finally {
      try { if (outlined) outlined.remove(); } catch(e1){}
      try { if (tfPoint) tfPoint.remove(); } catch(e2){}
      try { if (tfArea) tfArea.remove(); } catch(e3){}
      try { if (rect) rect.remove(); } catch(e4){}
      try { if (lay) removeLayerIfEmpty(lay); } catch(e5){}
    }
    ui.close();
    return ok;
  }

  var preflightOK = runCompatibilityCheck();
  SAFE_MODE = !preflightOK;

  // ---------------- STATUS PALETTE ----------------
  var busy = null;
var _metricsCache = {};

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

  var SCAN_NEON = makeRGB(0x96E354);

  function mmToPt(mm) { return mm * 72 / 25.4; }

  // По умолчанию: НЕ включаем non-BMP (в Illustrator часто нестабильно: tofu/копирование/экспорт)
  var ALLOW_NON_BMP = false;

  // --- Unicode safe conversion (BMP + non-BMP) ---
  function codePointToString(cp){
    if (cp === null || typeof cp === "undefined") return "";
    if (cp < 0 || cp > 0x10FFFF) return "";
    if (cp <= 0xFFFF) return String.fromCharCode(cp);
    cp -= 0x10000;
    var hi = 0xD800 + ((cp >> 10) & 0x3FF);
    var lo = 0xDC00 + (cp & 0x3FF);
    return String.fromCharCode(hi, lo);
  }

  // Iterate a JS string by Unicode code points (ExtendScript-safe)
  function forEachCodePoint(str, fn){
    if (!str) return;
    for (var i=0; i<str.length; i++){
      var c = str.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && (i+1) < str.length){
        var d = str.charCodeAt(i+1);
        if (d >= 0xDC00 && d <= 0xDFFF){
          var cp = ((c - 0xD800) << 10) + (d - 0xDC00) + 0x10000;
          fn(cp);
          i++;
          continue;
        }
      }
      fn(c);
    }
  }

  function tokenizeGlyphList(str){
    str = (str || "");
    str = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    str = str.replace(/\n+/g, " ");
    str = str.replace(/[ ]{2,}/g, " ");
    str = trim(str);
    if (!str) return [];
    return str.split(/\s+/);
  }

  function cpsFromTokenString(str){
    var tokens = tokenizeGlyphList(str);
    var cps = [];
    var seen = {};
    for (var i=0; i<tokens.length; i++){
      var tok = tokens[i];
      if (!tok) continue;
      forEachCodePoint(tok, function(cp){
        if (!seen[cp]) { seen[cp] = true; cps.push(cp); }
      });
    }
    return cps;
  }

  function cpsToSet(cps){
    var s = {};
    for (var i=0; i<cps.length; i++) s[cps[i]] = true;
    return s;
  }

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
    }catch(e){ return null; }
  }

  function collapseEmptyParagraphs(s){
    try{
      if (!s) return s;
      s = s.replace(/\r{2,}/g, "\r");
      s = s.replace(/^\r+|\r+$/g, "");
      return s;
    }catch(e){ return s; }
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

  // ВАЖНО: FE20–FE2F НЕ выкидываем (combining marks)
  function isUselessForGlyphShowcase(cp) {
    if (cp >= 0xFE00 && cp <= 0xFE0F) return true; // Variation Selectors
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

  function isCombiningMarkChar(ch){
    if (!ch || ch.length === 0) return false;
    var cp = ch.charCodeAt(0);
    if (cp >= 0xD800 && cp <= 0xDFFF) return false;
    return (
      (cp >= 0x0300 && cp <= 0x036F) ||
      (cp >= 0x1AB0 && cp <= 0x1AFF) ||
      (cp >= 0x1DC0 && cp <= 0x1DFF) ||
      (cp >= 0x20D0 && cp <= 0x20FF) ||
      (cp >= 0xFE20 && cp <= 0xFE2F)
    );
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

  // ---------------- Viewport bounds ----------------
  function getViewBounds() {
    try {
      var view = (doc.views && doc.views.length) ? doc.views[0] : null;
      if (view && view.bounds && view.bounds.length === 4) return view.bounds;
    } catch (e) {}
    var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
    return ab.artboardRect;
  }

  // ---------------- SCATTER SCAN ----------------
  var SCATTER_SCAN = true;
  if (SAFE_MODE) SCATTER_SCAN = false;
  var SCATTER_GRID_COLS = 18;
  var SCATTER_GRID_ROWS = 10;
  var _scatterPts = null;
  var _scatterLast = -1;

  function buildScatterPoints(){
    var vb = getViewBounds();
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

  // ---------------- Overset detection ----------------
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
    }catch(e){ return false; }
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

  // =====================================================
  // ✅ GOLDEN DEFAULT SETS (EXPLICIT LISTS, NOT RANGES)
  // =====================================================
  var GOLDEN_DIGITS_STR = "0 1 2 3 4 5 6 7 8 9";

var GOLDEN_PUNCT_STR =
  "! \" # % & ' ʼ ʻ ' ( ) * + , - . · / : ; < = > ? @ [ \\\\ ] _ – — ~ ' ' \" \" \" … « » ¡ ¿ © ® ™ № § ° ± × ÷ $ € £ ¥ ₽ ₹ ₿ ¢";

  var GOLDEN_LATIN_STR =
    "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z " +
    "a b c d e f g h i j k l m n o p q r s t u v w x y z " +
    "À Á Â Ã Ä Å Æ Ç È É Ê Ë Ì Í Î Ï Ð Ñ Ò Ó Ô Õ Ö Ø Ù Ú Û Ü Ý Þ Ÿ ẞ Ə " +
    "à á â ã ä å æ ç è é ê ë ì í î ï ð ñ ò ó ô õ ö ø ù ú û ü ý þ ÿ ß ə " +
    "Ā Ă Ą Ć Ĉ Ċ Č Ď Đ Ē Ĕ Ė Ę Ě Ĝ Ğ Ġ Ģ Ĥ Ħ Ĩ Ī Ĭ Į İ Ĳ Ĵ Ķ Ĺ Ļ Ľ Ŀ Ł Ń Ņ Ň Ŋ Ō Ŏ Ő Œ Ŕ Ŗ Ř Ś Ŝ Ş Š Ș Ţ Ť Ŧ Ț Ũ Ū Ŭ Ů Ű Ų Ŵ Ŷ Ź Ż Ž " +
    "ā ă ą ć ĉ ċ č ď đ ē ĕ ė ę ě ĝ ğ ġ ģ ĥ ħ ĩ ī ĭ į ı ĳ ĵ ķ ĸ ĺ ļ ľ ŀ ł ń ņ ň ŉ ŋ ō ŏ ő œ ŕ ŗ ř ś ŝ ş š ș ţ ť ŧ ț ũ ū ŭ ů ű ų ŵ ŷ ſ ź ż ž " +
    "A À Á Â Ã Ă Ắ Ằ Ẳ Ẵ Ặ Ấ Ầ Ẩ Ẫ Ậ " +
    "E È É Ê Ế Ề Ể Ễ Ệ " +
    "I Ì Í Ĩ Ị " +
    "O Ò Ó Ô Ố Ồ Ổ Ỗ Ộ Ơ Ớ Ờ Ở Ỡ Ợ " +
    "U Ù Ú Ũ Ụ Ư Ứ Ừ Ử Ữ Ự " +
    "Y Ỳ Ý Ỷ Ỹ Ỵ " +
    "Đ " +
    "a à á â ã ă ắ ằ ẳ ẵ ặ ấ ầ ẩ ẫ ậ " +
    "e è é ê ế ề ể ễ ệ " +
    "i ì í ĩ ị " +
    "o ò ó ô ố ồ ổ ỗ ộ ơ ớ ờ ở ỡ ợ " +
    "u ù ú ũ ụ ư ứ ừ ử ữ ự " +
    "y ỳ ý ỷ ỹ ỵ " +
    "đ";

  var GOLDEN_CYRILLIC_STR =
    "А Б В Г Д Е Ё Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ъ Ы Ь Э Ю Я " +
    "а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я " +
    "Є І Ї Ґ Ў Ј Љ Њ Ђ Ћ Џ Ѓ Ќ Ӣ Ӯ Ә Ө Ү Ұ Ғ Қ Ң Һ Ҳ Ҷ Җ Ҙ Ҫ Ҡ " +
    "є і ї ґ ў ј љ њ ђ ћ џ ѓ ќ ӣ ӯ ә ө ү ұ ғ қ ң һ ҳ ҷ җ ҙ ҫ ҡ";

  var GOLDEN_DIGITS_CPS   = cpsFromTokenString(GOLDEN_DIGITS_STR);
  var GOLDEN_PUNCT_CPS    = cpsFromTokenString(GOLDEN_PUNCT_STR);
  var GOLDEN_LATIN_CPS    = cpsFromTokenString(GOLDEN_LATIN_STR);
  var GOLDEN_CYRILLIC_CPS = cpsFromTokenString(GOLDEN_CYRILLIC_STR);

  var GOLDEN_DIGITS_SET   = cpsToSet(GOLDEN_DIGITS_CPS);
  var GOLDEN_PUNCT_SET    = cpsToSet(GOLDEN_PUNCT_CPS);
  var GOLDEN_LATIN_SET    = cpsToSet(GOLDEN_LATIN_CPS);
  var GOLDEN_CYRILLIC_SET = cpsToSet(GOLDEN_CYRILLIC_CPS);

  // =====================================================
  // OPTIONAL RANGES (for extra glyphs)
  // =====================================================
  var BLOCKS = {
    // ✅ Extended Latin (ALL Latin ranges + phonetic/modifiers + ligatures)
    extended_latin: [
      // Latin ranges (so that “rest of Latin” is ONLY here)
      [0x0041, 0x005A], [0x0061, 0x007A],
      [0x00C0, 0x00D6], [0x00D8, 0x00F6], [0x00F8, 0x00FF],
      [0x0100, 0x017F],
      [0x0180, 0x024F],
      [0x1E00, 0x1EFF],
      [0x2C60, 0x2C7F],
      [0xA720, 0xA7FF],
      [0xAB30, 0xAB6F],

      // IPA / modifiers / phonetic etc
      [0x0250, 0x02AF],
      [0x02B0, 0x02FF],
      [0x1D00, 0x1D7F],
      [0x1D80, 0x1DBF],
      [0xA700, 0xA71F],
      [0x10780, 0x107BF],
      [0x1DF00, 0x1DFFF],

      // Latin ligatures
      [0xFB00, 0xFB06]
    ],

    // ✅ Extended Cyrillic (ALL 0400–04FF + 0500–052F, BUT extra will be filtered by set-diff)
    extended_cyrillic: [
      [0x0400, 0x04FF],
      [0x0500, 0x052F]
    ],

    // ✅ Default “punct_currency” is GOLDEN list only (NOT ranges).
    // Ranges for extra punctuation/currency/digits live in symbols_signs.

    // ✅ Symbols & Signs (+ combining marks) + extra digits/punct/currency outside golden
    symbols_signs: [
      // Combining marks
      [0x0300, 0x036F],
      [0x1AB0, 0x1AFF],
      [0x1DC0, 0x1DFF],
      [0x20D0, 0x20FF],
      [0xFE20, 0xFE2F],

      // Extra digits (was in old digits block; now ONLY here)
      [0x0660, 0x0669], [0x06F0, 0x06F9],
      [0x0966, 0x096F], [0x09E6, 0x09EF], [0x0A66, 0x0A6F], [0x0AE6, 0x0AEF],
      [0x0B66, 0x0B6F], [0x0C66, 0x0C6F],
      [0x0D66, 0x0D6F],
      [0x0E50, 0x0E59], [0x0ED0, 0x0ED9], [0x0F20, 0x0F29], [0x1040, 0x1049], [0x17E0, 0x17E9],
      [0xFF10, 0xFF19],
      [0x2070, 0x2079], [0x2080, 0x2089],
      [0x2150, 0x218F],
      [0x2460, 0x24FF],
      [0x2776, 0x2793],

      // Extra punctuation/currency blocks (broad)
      [0x0021, 0x002F], [0x003A, 0x0040], [0x005B, 0x0060], [0x007B, 0x007E],
      [0x00A1, 0x00BF],
      [0x02BC, 0x02BC], // Ukrainian apostrophe (if font supports)
      [0x2010, 0x206F],
      [0x00A2, 0x00A5], [0x20AC, 0x20AC], [0x20A0, 0x20CF],

      // Rest (as before)
      [0x2E00, 0x2E7F],
      [0x3001, 0x303F],
      [0x2100, 0x214F],
      [0x2190, 0x21FF],
      [0x2200, 0x22FF],
      [0x2300, 0x23FF],
      [0x2500, 0x257F],
      [0x2580, 0x259F],
      [0x25A0, 0x25FF],
      [0x2600, 0x26FF],
      [0x2700, 0x27BF],
      [0x27C0, 0x27EF],
      [0x27F0, 0x27FF]
    ],

    historical: [
      [0x2C00, 0x2C5F],
      [0x2DE0, 0x2DFF],
      [0xA640, 0xA69F],
      [0x1C80, 0x1C8F],
      [0x2C80, 0x2CFF],
      [0x2D30, 0x2D7F],
      [0xA500, 0xA63F],
      [0x16A0, 0x16FF]
    ],

    armenian: [
      [0x0530, 0x058F],
      [0xFB13, 0xFB17]
    ],

    greek: [
      [0x0370, 0x03FF],
      [0x1F00, 0x1FFF]
    ],

    georgian: [
      [0x10A0, 0x10FF],
      [0x2D00, 0x2D2F],
      [0x1C90, 0x1CBF]
    ],

    semitic: [
      [0x0590, 0x05FF],
      [0x0600, 0x06FF],
      [0x0700, 0x074F],
      [0x0750, 0x077F],
      [0x0780, 0x07BF],
      [0x07C0, 0x07FF],
      [0x0800, 0x083F],
      [0x0840, 0x085F],
      [0x0860, 0x086F],
      [0x08A0, 0x08FF]
    ],

    tibetan: [[0x0F00, 0x0FFF]],

    southeast_asian: [
      [0x0E01, 0x0E3A],
      [0x0E3F, 0x0E5B],
      [0x0E80, 0x0EFF],
      [0x1000, 0x109F],
      [0x1780, 0x17FF],
      [0x1950, 0x197F],
      [0x1980, 0x19DF],
      [0x1A20, 0x1AAF],
      [0xAA80, 0xAADF]
    ],

    ethiopic: [
      [0x1200, 0x137F],
      [0x1380, 0x139F],
      [0x2D80, 0x2DDF]
    ],

    japanese: [
      [0x3040, 0x309F],
      [0x30A0, 0x30FF],
      [0x31F0, 0x31FF]
    ]
  };

  // ✅ OPTIMIZED collectFromRanges (NO $.sleep in loops)
  function collectFromRanges(ranges){
    var out = [];
    var lastPulse = (new Date()).getTime();

    for (var r = 0; r < ranges.length; r++){
      var a = ranges[r][0], b = ranges[r][1];

      for (var cp = a; cp <= b; cp++){
        if (!ALLOW_NON_BMP && cp > 0xFFFF) continue;
        if (isControl(cp) || isSurrogate(cp) || isNonCharacter(cp)) continue;
        if (isUselessForGlyphShowcase(cp)) continue;

        out.push(cp);

        var now = (new Date()).getTime();
        if (busy && (now - lastPulse) >= 2000) {
          lastPulse = now;
          try { busy.pulse(true); } catch(e1){}
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

  // =====================================================
  // DIALOG (with "Show languages")
  // =====================================================
  var dlg = new Window("dialog", t("SP All Write", "SP All Write"));
  dlg.alignChildren = "fill";

  var bannerText = t("<3 Больше шрифтов", "<3 More Fonts") + " — pavljenko.ru\n_________________";
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

  // OUTPUT MODE
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

  var cbShowLanguages = pnlOutput.add("checkbox", undefined, t("Показать языки", "Show languages"));
  cbShowLanguages.value = true;

  // FONT PICKER
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

  // DEFAULT SETS (GOLDEN)
  var pnlDefault = dlg.add("panel", undefined, t("Включено по умолчанию (золотой набор)", "Enabled by default (golden set)"));
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
  addDefault("punct_currency", "Пунктуация и знаки", "Punctuation & signs", true);

  // TOGGLE BUTTON "Дополнительно"
  var toggleGrp = dlg.add("group");
  toggleGrp.alignChildren = ["left", "center"];
  var btnToggle = toggleGrp.add("button", undefined, t("Дополнительно ▸", "Additional ▸"));

  var btnSelectAll = null;
  var warnFull = null;

  if (!SAFE_MODE) {
    btnSelectAll = toggleGrp.add("button", undefined, t("Включить все", "Enable all"));
    warnFull = toggleGrp.add("statictext", undefined, t("Может работать нестабильно", "May be unstable"));
  } else {
    toggleGrp.add("statictext", undefined, t("Ошибка совместимости. Включен базовый режим", "Compatibility error. Basic mode enabled"));
  }

  var pnlOptional = dlg.add("panel", undefined, t("Дополнительно", "Additional"));
  pnlOptional.alignChildren = "fill";
  pnlOptional.visible = false;

  var optCols = pnlOptional.add("group");
  optCols.orientation = "row";
  optCols.alignChildren = ["fill", "top"];
  var optCol1 = optCols.add("group"); optCol1.orientation = "column"; optCol1.alignChildren = ["left","top"];
  var optCol2 = optCols.add("group"); optCol2.orientation = "column"; optCol2.alignChildren = ["left","top"];

  btnToggle.onClick = function () {
    pnlOptional.visible = !pnlOptional.visible;
    btnToggle.text = pnlOptional.visible
      ? t("Дополнительно ▾", "Additional ▾")
      : t("Дополнительно ▸", "Additional ▸");
    dlg.layout.layout(true);
  };

  // ✅ UPDATED OPTIONAL LIST (added extended_cyrillic; symbols_signs now also carries extra digits/punct)
  var OPTIONAL_ITEMS = [
    { key:"extended_latin",      labelRU:"Расширенная латиница",      labelEN:"Extended Latin" },
    { key:"extended_cyrillic",   labelRU:"Расширенная кириллица",     labelEN:"Extended Cyrillic" },
    { key:"symbols_signs",       labelRU:"Спецсимволы и знаки",       labelEN:"Symbols & Signs" },
    { key:"historical",          labelRU:"Исторические",              labelEN:"Historical" },
    { key:"armenian",            labelRU:"Армянский",                 labelEN:"Armenian" },
    { key:"greek",               labelRU:"Греческий",                 labelEN:"Greek" },
    { key:"georgian",            labelRU:"Грузинский",                labelEN:"Georgian" },
    { key:"semitic",             labelRU:"Семитские",                 labelEN:"Semitic" },
    { key:"tibetan",             labelRU:"Тибетский",                 labelEN:"Tibetan" },
    { key:"southeast_asian",     labelRU:"Южноазиатские",             labelEN:"Southeast Asian" },
    { key:"ethiopic",            labelRU:"Эфиопские",                 labelEN:"Ethiopic" },
    { key:"japanese",            labelRU:"Японское письмо",           labelEN:"Japanese" }
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
    if (!btnSelectAll) return;
    btnSelectAll.text = anyOptionalChecked()
      ? t("Выключить", "Disable")
      : t("Включить все", "Enable all");
  }

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
        updateOptionalLimitUI();
        updateSelectAllButtonLabel();
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

  updateOptionalLimitUI();
  updateSelectAllButtonLabel();

  var btns = dlg.add("group");
  btns.alignment = "right";
  btns.add("button", undefined, "OK", { name: "ok" });
  btns.add("button", undefined, t("Отмена", "Cancel"), { name: "cancel" });

  if (dlg.show() !== 1) return;

  // ---------------- Params from dialog ----------------
  var OUT_MODE = (rbArea && rbArea.value === true) ? "area" : "point";
  var SEP_GROUPS = (rbSepYes && rbSepYes.value === true);
  var SHOW_LANGUAGES = (cbShowLanguages && cbShowLanguages.value === true);

  // ✅ $.sleep after dialog
  busy = new BusyUI();
  busy.show();
  busy.setStage(t("Инициализация", "Initializing"));
  try { $.sleep(15); } catch(e){}

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

  // ---------------- Helpers: enabled ----------------
  function enabled(key){
    return checkboxes[key] && checkboxes[key].value === true;
  }

  // =====================================================
  // ✅ “Case policy” probe (kept) — affects filtering of upper/lower duplicates
  // =====================================================
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
    try { $.sleep(15); } catch(e){}
    latinPolicy = decideCasePolicyForScript([["A","a"],["B","b"],["E","e"],["M","m"],["N","n"],["R","r"]]);
    if (latinPolicy.hasUpper && !latinPolicy.hasLower) {
      alert(t("В шрифте нет строчных латинских. Дублирование отключено.", "No Latin lowercase. Duplication disabled."));
    } else if (!latinPolicy.hasUpper && latinPolicy.hasLower) {
      alert(t("В шрифте нет заглавных латинских. Дублирование отключено.", "No Latin uppercase. Duplication disabled."));
    }
  }

  if (enabled("cyrillic")) {
    busy.setStage(t("Проверка регистра (Cyrillic)", "Checking case (Cyrillic)"));
    try { $.sleep(15); } catch(e){}
    cyrPolicy = decideCasePolicyForScript([
      [String.fromCharCode(0x0410),String.fromCharCode(0x0430)],
      [String.fromCharCode(0x0411),String.fromCharCode(0x0431)],
      [String.fromCharCode(0x0415),String.fromCharCode(0x0435)],
      [String.fromCharCode(0x041C),String.fromCharCode(0x043C)],
      [String.fromCharCode(0x041D),String.fromCharCode(0x043D)]
    ]);
    if (cyrPolicy.hasUpper && !cyrPolicy.hasLower) {
      alert(t("В выбранном шрифте нет строчных кириллических. Дублирование отключено.", "No Cyrillic lowercase. Duplication disabled."));
    } else if (!cyrPolicy.hasUpper && cyrPolicy.hasLower) {
      alert(t("В выбранном шрифте нет заглавных кириллических. Дублирование отключено.", "No Cyrillic uppercase. Duplication disabled."));
    }
  }

// =====================================================
// ОПТИМИЗИРОВАННЫЕ ФУНКЦИИ ПРОВЕРКИ ДУБЛИКАТОВ
// =====================================================

// УРОВЕНЬ 1: Быстрая проверка ширины (БЕЗ outline)
function measureWidthFast(fontObj, ch, fontName) {
  if (busy) busy.pulse();
  var lay = getTempLayer();
  if (!lay) return null;
  var tf = null;
  try {
    var p = scatterPos();
    tf = lay.textFrames.pointText(p);
    tf.contents = ch;
    try { tf.textRange.characterAttributes.textFont = fontObj; } catch(e1){}
    try { tf.textRange.characterAttributes.size = 100; } catch(e2){}
    try { tf.textRange.characterAttributes.fillColor = SCAN_NEON; } catch(eC){}
    
    var actualFont = null;
    try {
      actualFont = tf.textRange.characters[0].characterAttributes.textFont;
    } catch(e3){ actualFont = null; }
    
    if (!actualFont || actualFont.name !== fontName) return null;
    
    var gb = tf.geometricBounds;
    var w = gb[2] - gb[0];
    
    return w;
  } catch(e) {
    return null;
  } finally {
    try { if (tf) tf.remove(); } catch(e2) {}
  }
}

// УРОВЕНЬ 2+3: Полные метрики через outline (высота + точки) с кэшированием
function measureOutlineMetricsFull(fontObj, ch, fontName) {
  // Проверяем кэш
  var key = fontName + "|" + ch;
  if (_metricsCache[key] !== undefined) {
    return _metricsCache[key];
  }
  
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
    
    var actualFont = null;
    try {
      actualFont = tf.textRange.characters[0].characterAttributes.textFont;
    } catch(e0){ actualFont = null; }
    if (!actualFont || actualFont.name !== fontName) {
      _metricsCache[key] = null;
      return null;
    }
    
    try { outlined = tf.createOutline(); } catch(e4){ outlined = null; }
    if (!outlined) {
      _metricsCache[key] = null;
      return null;
    }
    
    var gb = null;
    try { gb = outlined.geometricBounds; } catch(e5){ gb = null; }
    if (!gb || gb.length !== 4) {
      _metricsCache[key] = null;
      return null;
    }
    
    var h = gb[1] - gb[3];
    var w = gb[2] - gb[0];
    var points = countPointsInItem(outlined);
    
    var result = { h: h, w: w, points: points };
    _metricsCache[key] = result;
    return result;
  } catch(e6){
    _metricsCache[key] = null;
    return null;
  } finally {
    try { if (outlined) outlined.remove(); } catch(e7){}
    try { if (tf) tf.remove(); } catch(e8){}
  }
}

// СПИСОК символов, требующих проверки по точкам
function needsPointsCheck(ch) {
  // Перечёркнутые
  if (ch === "Ł" || ch === "ł") return true;
  if (ch === "Ø" || ch === "ø") return true;
  if (ch === "Đ" || ch === "đ") return true;
  if (ch === "Ŧ" || ch === "ŧ") return true;
  
  // Точечные/апострофные
  if (ch === "Ŀ" || ch === "ŀ") return true;
  if (ch === "Ľ" || ch === "ľ") return true;
  
  return false;
}

// ГЛАВНАЯ функция: трёхуровневая проверка
function isDiacriticDuplicateOptimized(fontObj, diacritic, base, fontName) {
  // ============================================
  // УРОВЕНЬ 1: БЫСТРО (ширина без outline)
  // ============================================
  var wDia = measureWidthFast(fontObj, diacritic, fontName);
  var wBase = measureWidthFast(fontObj, base, fontName);
  
  if (wDia === null || wBase === null) return null;
  
  var tolW = 0.01;
  
  // Если ширина РАЗНАЯ → точно НЕ дубль
  if (Math.abs(wDia - wBase) > tolW) {
    return false; // ✅ БЫСТРЫЙ ВЫХОД (~80% случаев)
  }
  
  // ============================================
  // УРОВЕНЬ 2: СРЕДНЕ (высота через outline)
  // ============================================
  var mDia = measureOutlineMetricsFull(fontObj, diacritic, fontName);
  var mBase = measureOutlineMetricsFull(fontObj, base, fontName);
  
  if (!mDia || !mBase) return null;
  
  var tolH = 0.5;
  
  // Если высота РАЗНАЯ → точно НЕ дубль
  if (Math.abs(mDia.h - mBase.h) > tolH) {
    return false; // ✅ СРЕДНИЙ ВЫХОД (~15% случаев)
  }
  
  // ============================================
  // УРОВЕНЬ 3: ТОЧНО (только для спорных!)
  // ============================================
  
  // Проверяем, нужна ли проверка по точкам
  var needPoints = needsPointsCheck(diacritic);
  
  if (needPoints) {
    // Для Ł, Ø, Đ и т.д. сравниваем точки
    if (mDia.points !== mBase.points) {
      return false; // ✅ Разные точки → НЕ дубль
    }
  }
  
  // Если дошли сюда → это ДУБЛЬ
  return true;
}

// =====================================================
  // OUTLINE METRICS HELPERS (для фильтрации диакритики)
  // =====================================================
  
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

  function latinBaseLetter(ch){
    var m = {
      "À":"A","Á":"A","Â":"A","Ã":"A","Ă":"A","Ắ":"A","Ằ":"A","Ẳ":"A","Ẵ":"A","Ặ":"A","Ấ":"A","Ầ":"A","Ẩ":"A","Ẫ":"A","Ậ":"A","Ä":"A","Å":"A","Ā":"A","Ą":"A","Ǎ":"A","Ǟ":"A","Ǡ":"A","Ǻ":"A","Ȁ":"A","Ȃ":"A",
      "à":"a","á":"a","â":"a","ã":"a","ă":"a","ắ":"a","ằ":"a","ẳ":"a","ẵ":"a","ặ":"a","ấ":"a","ầ":"a","ẩ":"a","ẫ":"a","ậ":"a","ä":"a","å":"a","ā":"a","ą":"a","ǎ":"a","ǟ":"a","ǡ":"a","ǻ":"a","ȁ":"a","ȃ":"a",
      "Ç":"C","Ć":"C","Ĉ":"C","Ċ":"C","Č":"C",
      "ç":"c","ć":"c","ĉ":"c","ċ":"c","č":"c",
      "Ď":"D","Ḋ":"D","Ḍ":"D","Ḏ":"D","Ḑ":"D","Ḓ":"D",
      "ď":"d","ḋ":"d","ḍ":"d","ḏ":"d","ḑ":"d","ḓ":"d",
      "È":"E","É":"E","Ê":"E","Ế":"E","Ề":"E","Ể":"E","Ễ":"E","Ệ":"E","Ë":"E","Ē":"E","Ĕ":"E","Ė":"E","Ę":"E","Ě":"E","Ȅ":"E","Ȇ":"E",
      "è":"e","é":"e","ê":"e","ế":"e","ề":"e","ể":"e","ễ":"e","ệ":"e","ë":"e","ē":"e","ĕ":"e","ė":"e","ę":"e","ě":"e","ȅ":"e","ȇ":"e",
      "Ĝ":"G","Ğ":"G","Ġ":"G","Ģ":"G","Ǧ":"G",
      "ĝ":"g","ğ":"g","ġ":"g","ģ":"g","ǧ":"g",
      "Ĥ":"H","Ḣ":"H","Ḥ":"H","Ḧ":"H","Ḩ":"H","Ḫ":"H",
      "ĥ":"h","ḣ":"h","ḥ":"h","ḧ":"h","ḩ":"h","ḫ":"h",
      "Ì":"I","Í":"I","Î":"I","Ï":"I","Ĩ":"I","Ī":"I","Ĭ":"I","Į":"I","İ":"I","Ǐ":"I","Ȉ":"I","Ȋ":"I","Ị":"I",
      "ì":"i","í":"i","î":"i","ï":"i","ĩ":"i","ī":"i","ĭ":"i","į":"i","ǐ":"i","ȉ":"i","ȋ":"i","ị":"i",
      "Ĵ":"J","ĵ":"j",
      "Ķ":"K","Ǩ":"K","Ḱ":"K","Ḳ":"K","Ḵ":"K",
      "ķ":"k","ǩ":"k","ḱ":"k","ḳ":"k","ḵ":"k",
      "Ĺ":"L","Ļ":"L","Ľ":"L","Ŀ":"L","Ḷ":"L","Ḹ":"L","Ḻ":"L",
      "ĺ":"l","ļ":"l","ľ":"l","ŀ":"l","ḷ":"l","ḹ":"l","ḻ":"l",
      "Ñ":"N","Ń":"N","Ņ":"N","Ň":"N","Ǹ":"N",
      "ñ":"n","ń":"n","ņ":"n","ň":"n","ǹ":"n",
      "Ò":"O","Ó":"O","Ô":"O","Ố":"O","Ồ":"O","Ổ":"O","Ỗ":"O","Ộ":"O","Õ":"O","Ö":"O","Ō":"O","Ŏ":"O","Ő":"O","Ơ":"O","Ớ":"O","Ờ":"O","Ở":"O","Ỡ":"O","Ợ":"O","Ǒ":"O","Ȍ":"O","Ȏ":"O",
      "ò":"o","ó":"o","ô":"o","ố":"o","ồ":"o","ổ":"o","ỗ":"o","ộ":"o","õ":"o","ö":"o","ō":"o","ŏ":"o","ő":"o","ơ":"o","ớ":"o","ờ":"o","ở":"o","ỡ":"o","ợ":"o","ǒ":"o","ȍ":"o","ȏ":"o",
      "Ŕ":"R","Ŗ":"R","Ř":"R","Ȑ":"R","Ȓ":"R",
      "ŕ":"r","ŗ":"r","ř":"r","ȑ":"r","ȓ":"r",
      "Ś":"S","Ŝ":"S","Ş":"S","Š":"S","Ș":"S",
      "ś":"s","ŝ":"s","ş":"s","š":"s","ș":"s",
      "Ţ":"T","Ť":"T","Ț":"T",
      "ţ":"t","ť":"t","ț":"t",
      "Ù":"U","Ú":"U","Û":"U","Ü":"U","Ũ":"U","Ū":"U","Ŭ":"U","Ů":"U","Ű":"U","Ų":"U","Ư":"U","Ứ":"U","Ừ":"U","Ử":"U","Ữ":"U","Ự":"U","Ǔ":"U","Ȕ":"U","Ȗ":"U","Ụ":"U",
      "ù":"u","ú":"u","û":"u","ü":"u","ũ":"u","ū":"u","ŭ":"u","ů":"u","ű":"u","ų":"u","ư":"u","ứ":"u","ừ":"u","ử":"u","ữ":"u","ự":"u","ǔ":"u","ȕ":"u","ȗ":"u","ụ":"u",
      "Ŵ":"W","Ẁ":"W","Ẃ":"W","Ẅ":"W",
      "ŵ":"w","ẁ":"w","ẃ":"w","ẅ":"w",
      "Ý":"Y","Ỳ":"Y","Ỷ":"Y","Ỹ":"Y","Ỵ":"Y","Ÿ":"Y","Ŷ":"Y","Ȳ":"Y",
      "ý":"y","ỳ":"y","ỷ":"y","ỹ":"y","ỵ":"y","ÿ":"y","ŷ":"y","ȳ":"y",
      "Ź":"Z","Ż":"Z","Ž":"Z","Ẑ":"Z","Ȥ":"Z",
      "ź":"z","ż":"z","ž":"z","ẑ":"z","ȥ":"z"
    };
    return m[ch] || null;
  }

  function isLatinSpecialLetter(cp){
    if (cp === 0x00DF) return true; // ß
    if (cp === 0x00C6 || cp === 0x00E6) return true; // Æ æ
    if (cp === 0x0152 || cp === 0x0153) return true; // Œ œ
    if (cp === 0x00D8 || cp === 0x00F8) return true; // Ø ø
    if (cp === 0x00DE || cp === 0x00FE) return true; // Þ þ
    if (cp === 0x00D0 || cp === 0x00F0) return true; // Ð ð
    if (cp === 0x0141 || cp === 0x0142) return true; // Ł ł
    if (cp === 0x0192) return true; // ƒ
    return false;
  }

  function isLatinPrecomposedDiacritic(cp){
    if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A)) return false;
    if (isLatinSpecialLetter(cp)) return false;
    var ch = codePointToString(cp);
    if (!ch) return false;
    var base = latinBaseLetter(ch);
    return base !== null;
  }

  function isPointsOnlyDiacriticChar(ch){
    return (ch === "Đ" || ch === "đ" || ch === "Ľ" || ch === "Ŀ" || ch === "ľ" || ch === "ŀ");
  }

  // =====================================================
  // ✅ GOLDEN builders (apply case policy to avoid duplicating missing case)
  // =====================================================
  function filterByPolicy(list, policy){
    var out = [];
    for (var i=0; i<list.length; i++){
      var s = codePointToString(list[i]);
      if (!s) continue;
      if (isUppercaseLetterChar(s)) { if (policy.useUpper) out.push(list[i]); continue; }
      if (isLowercaseLetterChar(s)) { if (policy.useLower) out.push(list[i]); continue; }
      out.push(list[i]);
    }
    return out;
  }

  function buildGoldenDigitsCps(){
    // digits have no case policy
    return GOLDEN_DIGITS_CPS.slice(0);
  }

  function buildGoldenPunctCps(){
    return GOLDEN_PUNCT_CPS.slice(0);
  }

function buildGoldenLatinCps(){
  // Разделяем на basic + остальное
  var basic = [];
  var rest = [];
  
  for (var i = 0; i < GOLDEN_LATIN_CPS.length; i++) {
    var cp = GOLDEN_LATIN_CPS[i];
    if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A)) {
      basic.push(cp);
    } else {
      rest.push(cp);
    }
  }
  
  // Фильтруем "rest" через трёхуровневую проверку
  var filtered = [];
  
  if (SAFE_MODE) {
    // В безопасном режиме не фильтруем
    filtered = rest;
  } else {
    // Проверяем каждый символ
    for (var j = 0; j < rest.length; j++) {
      var cp2 = rest[j];
      var ch = codePointToString(cp2);
      if (!ch) continue;
      
      // Спецбуквы (Æ, Ø, Œ, Þ, Ð, Ł, ß, ƒ)
      if (isLatinSpecialLetter(cp2)) {
        if (cp2 === 0x00DF) { filtered.push(cp2); continue; } // ß всегда оставляем
        
        var specialBaseMap = {
          "\u00D8": "O", "\u00F8": "o",  // Ø ø
          "\u00C6": "A", "\u00E6": "a",  // Æ æ
          "\u0152": "O", "\u0153": "o",  // Œ œ
          "\u00DE": "P", "\u00FE": "p",  // Þ þ
          "\u00D0": "D", "\u00F0": "d",  // Ð ð
          "\u0141": "L", "\u0142": "l",  // Ł ł
          "\u0192": "f"                  // ƒ
        };
        
        var baseChar = specialBaseMap[ch];
        if (!baseChar) { filtered.push(cp2); continue; }
        
        // ТРЁХУРОВНЕВАЯ проверка
        var isDupe = isDiacriticDuplicateOptimized(chosen, ch, baseChar, chosenName);
        if (isDupe === null) { filtered.push(cp2); continue; }
        if (isDupe === true) continue; // пропускаем дубль
        
        filtered.push(cp2);
        continue;
      }
      
      // Диакритика - ТРЁХУРОВНЕВАЯ проверка
      if (isLatinPrecomposedDiacritic(cp2)) {
        var base = latinBaseLetter(ch);
        if (!base) { filtered.push(cp2); continue; }
        
        var baseCh = base;
        try { baseCh = isLowercaseLetterChar(ch) ? base.toLowerCase() : base.toUpperCase(); } catch(e0){}
        
        // Точечные/перечёркнутые - особая обработка
        if (isPointsOnlyDiacriticChar(ch)) {
          var samePts2 = isDiacriticDuplicateOptimized(chosen, ch, baseCh, chosenName);
          if (samePts2 === null) { filtered.push(cp2); continue; }
          if (samePts2 === true) continue;
          filtered.push(cp2);
          continue;
        }
        
        // Обычная диакритика
        var isDupe2 = isDiacriticDuplicateOptimized(chosen, ch, baseCh, chosenName);
        
        if (isDupe2 === null) { filtered.push(cp2); continue; }
        if (isDupe2 === true) {
          if (busy) busy.pulse();
          continue;
        }
        
        filtered.push(cp2);
        if (busy) busy.pulse();
        continue;
      }
      
      // Остальное просто добавляем
      filtered.push(cp2);
    }
  }
  
  // Собираем обратно: basic + filtered
  var result = basic.concat(filtered);
  
  return filterByPolicy(result, latinPolicy);
}

  function buildGoldenCyrillicCps(){
    return filterByPolicy(GOLDEN_CYRILLIC_CPS, cyrPolicy);
  }

  // =====================================================
  // ✅ EXTRA builders (set-diff vs GOLDEN)
  // =====================================================
  function buildExtendedLatinExtraCps(){
    var all = collectFromRanges(BLOCKS.extended_latin);
    var out = [];
    for (var i=0; i<all.length; i++){
      var cp = all[i];
      if (GOLDEN_LATIN_SET[cp]) continue;
      out.push(cp);
    }
    return filterByPolicy(out, latinPolicy);
  }

  function buildExtendedCyrillicExtraCps(){
    var all = collectFromRanges(BLOCKS.extended_cyrillic);
    var out = [];
    for (var i=0; i<all.length; i++){
      var cp = all[i];
      if (GOLDEN_CYRILLIC_SET[cp]) continue;
      out.push(cp);
    }
    return filterByPolicy(out, cyrPolicy);
  }

  // =====================================================
  // ✅ NEW SUB-RANGE PROBE LOGIC (for OPTIONAL ranges only)
  // =====================================================
  var _ag_skipped = {};

  function firstUsefulCpsFromRanges(ranges, limit){
    var out = [];
    if (!ranges || !ranges.length) return out;

    for (var r=0; r<ranges.length; r++){
      var a = ranges[r][0], b = ranges[r][1];

      for (var cp=a; cp<=b; cp++){
        if (!ALLOW_NON_BMP && cp > 0xFFFF) continue;
        if (isControl(cp) || isSurrogate(cp) || isNonCharacter(cp)) continue;
        if (isUselessForGlyphShowcase(cp)) continue;

        out.push(cp);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  function shouldSkipBlockByProbe(key, ranges, chosen, chosenName){
    // digits / punct now golden-only, so probe skip is relevant only for OPTIONAL blocks:
    // symbols_signs should not be skipped by probe
    if (key === "symbols_signs") return false;

    var probe = firstUsefulCpsFromRanges(ranges, 10);
    if (!probe.length) return false;
    var hits = 0;
    for (var i=0; i<probe.length; i++){
      var ch = codePointToString(probe[i]);
      if (!ch) continue;

      var m = measureChar(chosen, ch);
      if (m && m.fontName === chosenName && m.width !== null) hits++;
      if (busy) busy.pulse();
    }
    return (hits === 0);
  }

  // ---------------- Ranking helpers ----------------
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

  // ✅ Sub-range scan for OPTIONAL blocks
  function pushGroupInto(result, seen, key, groups){
    var ranges = BLOCKS[key];
    if (!ranges) return;

    var allCps = [];

    for (var r = 0; r < ranges.length; r++) {
      var subRange = [ranges[r]];
      if (shouldSkipBlockByProbe(key, subRange, chosen, chosenName)) continue;

      var subCps = collectFromRanges(subRange);
      allCps = allCps.concat(subCps);

      if (busy) busy.pulse();
    }

    if (allCps.length === 0) {
      _ag_skipped[key] = true;
      return;
    }

    var g = [];
    for (var k = 0; k < allCps.length; k++) {
      var cp = allCps[k];
      if (seen[cp]) continue;
      seen[cp] = true;
      result.push(cp);
      g.push(cp);
    }

    if (groups && g.length) groups.push(g);
  }

  // =====================================================
  // BUILD ORDERED CPS + GROUPS (GOLDEN DEFAULTS FIRST)
  // =====================================================
  busy.setStage(t("Сбор и сортировка символов", "Collecting & sorting glyphs"));
  try { $.sleep(15); } catch(e){}

  var seen = {};
  var orderedCP = [];
  var GROUPS = [];

  // ---- DEFAULTS: GOLDEN ONLY ----
  if (enabled("digits")) {
    pushCpsInto(orderedCP, seen, buildGoldenDigitsCps(), GROUPS);
    try { $.sleep(10); } catch(e){}
  }

  if (enabled("latin")) {
    pushCpsInto(orderedCP, seen, buildGoldenLatinCps(), GROUPS);
    try { $.sleep(10); } catch(e){}
  }

  if (enabled("cyrillic")) {
    pushCpsInto(orderedCP, seen, buildGoldenCyrillicCps(), GROUPS);
    try { $.sleep(10); } catch(e){}
  }

  if (enabled("punct_currency")) {
    pushCpsInto(orderedCP, seen, buildGoldenPunctCps(), GROUPS);
    try { $.sleep(10); } catch(e){}
  }

  // ---- OPTIONALS ----
  // Extended Latin (rest of Latin ONLY here)
  if (enabled("extended_latin")) {
    pushCpsInto(orderedCP, seen, buildExtendedLatinExtraCps(), GROUPS);
    try { $.sleep(10); } catch(e){}
  }

  // Extended Cyrillic (rest of Cyrillic ONLY here)
  if (enabled("extended_cyrillic")) {
    pushCpsInto(orderedCP, seen, buildExtendedCyrillicExtraCps(), GROUPS);
    try { $.sleep(10); } catch(e){}
  }

  // Symbols & Signs (includes extra digits/punct/currency + marks + many symbols)
  if (enabled("symbols_signs")) {
    pushGroupInto(orderedCP, seen, "symbols_signs", GROUPS);
    try { $.sleep(10); } catch(e){}
  }

  // Other optional scripts by ranges
  for (var i=0; i<OPTIONAL_UI_ORDER.length; i++){
    var kk2 = OPTIONAL_UI_ORDER[i];
    if (kk2 === "extended_latin") continue;
    if (kk2 === "extended_cyrillic") continue;
    if (kk2 === "symbols_signs") continue;
    if (kk2 === "indic") continue;
    if (!enabled(kk2)) continue;
    pushGroupInto(orderedCP, seen, kk2, GROUPS);
  }

  try { $.sleep(15); } catch(e){}

  if (orderedCP.length === 0) {
    if (busy) busy.close();
    alert(t("Не выбран ни один набор символов.", "No glyph sets selected."));
    return;
  }

  function cpsToText(cps){
    var a = [];
    for (var i=0; i<cps.length; i++){
      var s = codePointToString(cps[i]);
      if (!s) continue;
      a.push(s);
    }
    return a.join(" ");
  }

  var groupTexts = [];
  for (var gi=0; gi<GROUPS.length; gi++){
    groupTexts.push(cpsToText(GROUPS[gi]));
  }

  var candidateText = (SEP_GROUPS ? groupTexts.join("\r") : groupTexts.join(" "));

  // =====================================================
  // CREATE TEXT CONTAINER
  // =====================================================
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
  try { $.sleep(15); } catch(e){}

  function getStartSize(tf_) {
    try { var s2 = tf_.textRange.characterAttributes.size; if (s2 && s2 > 0) return s2; } catch (e2) {}
    return 24;
  }

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

      // ✅ Combining marks NOT removed here (required for symbols_signs when enabled)
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

  busy.setStage(t("Заполнение текста", "Placing glyph string"));
  try { $.sleep(15); } catch(e){}

  var startSize = getStartSize(tf);
  tf.contents = candidateText;
  setAllFont(tf, chosen);
  if (SEP_GROUPS) forceParagraphNoSpacing(tf);
  if (OUT_MODE === "area") setAllSize(tf, startSize);
  try { app.redraw(); } catch (e0) {}
  if (busy) busy.pulse();

  busy.setStage(t("Фильтрация глифов", "Filtering glyphs"));
  try { $.sleep(15); } catch(e){}

  keepOnlyChosenFontInFrame(tf, chosenName, chosen, SEP_GROUPS);
  if (SEP_GROUPS) forceParagraphNoSpacing(tf);
  if (OUT_MODE === "area") setAllSize(tf, startSize);
  try { tf.contents = collapseEmptyParagraphs(tf.contents); } catch(e){}
  try { app.redraw(); } catch (e1) {}
  if (busy) busy.pulse();
  try { tf._ag_totalComparable = countComparableChars(tf); } catch(e){}

// =====================================================
// ✅ DETECT SUPPORTED LANGUAGES (через модуль)
// =====================================================
var supportedLanguages = [];

if (SHOW_LANGUAGES && LANGUAGE_MODULE_LOADED) {
  busy.setStage(t("Определение языков", "Detecting languages"));
  try { $.sleep(15); } catch(e){}

  // Собираем присутствующие глифы
  var glyphsPresent = {};
  try {
    var chars = tf.textRange.characters;
    for (var i = 0; i < chars.length; i++) {
      var s = chars[i].contents;
      if (s && s !== " " && s !== "\t" && s !== "\r" && s !== "\n") {
        glyphsPresent[s] = true;
      }
    }
  } catch(e){}

  // Вызываем функцию из модуля
  try {
    supportedLanguages = detectLanguagesFromGlyphs(glyphsPresent);
  } catch(e) {
    supportedLanguages = [];
  }
} else if (SHOW_LANGUAGES && !LANGUAGE_MODULE_LOADED) {
  alert(t(
    "Модуль определения языков не найден.\nПоместите 'SP lang All Write.jsx' рядом с основным скриптом.",
    "Language detection module not found.\nPlace 'SP lang All Write.jsx' next to the main script."
  ));
}

  // =====================================================
  // FIT SIZE (AREA TEXT ONLY)
  // =====================================================
  if (OUT_MODE === "area") {
    if (SEP_GROUPS) forceParagraphNoSpacing(tf);
    busy.setStage(t("Подстройка кегля", "Fitting font size"));
    try { $.sleep(15); } catch(e){}
    var fitted = fitFontSizeToMaxNoOverset(tf, startSize);
    if (isAreaText(tf) && isOversetSmart(tf)) {
      fitted = forceFitByShrinkingOnly(tf, fitted);
    }
    if (isAreaText(tf) && isOversetSmart(tf)) {
      if (busy) busy.close();
      alert(t("Текст не помещается даже при минимальном кегле.", "Text still oversets at minimal size."));
      return;
    }
  }

  // =====================================================
  // RESULTS DIALOG
  // =====================================================
  if (busy) busy.close();

  function showResultsDialog(fontInfo, glyphsText, languages, showLang) {
    var dlgResult = new Window("dialog", t("Результат проверки", "Check Results"));
    dlgResult.alignChildren = "fill";
    dlgResult.orientation = "column";

    var hdr = dlgResult.add("group");
    hdr.orientation = "column";
    hdr.alignChildren = ["fill","top"];

    var stTitle = hdr.add("statictext", undefined, fontInfo.displayName);
    try { stTitle.graphics.font = ScriptUI.newFont(stTitle.graphics.font.name, "Bold", stTitle.graphics.font.size + 2); } catch(e){}

    hdr.add("statictext", undefined, "PostScriptName: " + fontInfo.psName);

    function countGlyphsNoWS(s){
      var n = 0;
      for (var i=0; i<s.length; i++){
        var ch = s.charAt(i);
        if (ch !== " " && ch !== "\t" && ch !== "\r" && ch !== "\n") n++;
      }
      return n;
    }

    var glyphCount = countGlyphsNoWS(glyphsText || "");

    dlgResult.add("statictext", undefined,
      t("Всего символов: ", "Total glyphs: ") + glyphCount +
      (showLang ? ("    " + t("Языков: ", "Languages: ") + (languages ? languages.length : 0)) : "")
    );

    var txtResult = dlgResult.add("edittext", undefined, "", {multiline:true, scrolling:true});
    txtResult.preferredSize = [720, 520];

var resultText = "";
resultText += fontInfo.displayName + "\n";
resultText += "PostScriptName: " + fontInfo.psName + "\n\n";
resultText += t("Всего символов: ", "Total glyphs: ") + glyphCount + "\n\n";
resultText += (glyphsText || "") + "\n\n";

if (showLang) {
  if (languages && languages.length > 0) {
    resultText += t("Поддерживаемые языки: ", "Supported languages: ") + languages.length + "\n";
    
    // Форматируем с флагами
    var langStrings = [];
    for (var i = 0; i < languages.length; i++) {
      langStrings.push(languages[i].flag + " " + languages[i].name);
    }
    resultText += langStrings.join(", ");
  } else {
    resultText += t("Языки не определены", "No languages detected");
  }
}

    txtResult.text = resultText;

    var btnGrp = dlgResult.add("group");
    btnGrp.alignment = "right";
    btnGrp.orientation = "row";

    var btnCopy = btnGrp.add("button", undefined, t("Копировать", "Copy"));
    var btnSave = btnGrp.add("button", undefined, t("Сохранить проверку", "Save check"));
    btnGrp.add("button", undefined, t("Закрыть", "Close"), {name:"cancel"});

    btnCopy.onClick = function () {
      try {
        var txt = txtResult.text || "";
        if (!txt || txt.length === 0) {
          alert(t("Нечего копировать.", "Nothing to copy."));
          return;
        }

        function copyToClipboardViaIllustrator(text) {
          var layName = "__AllGlyphs_CLIP__";
          var lay = null, tfc = null;
          var prevSel = null;

          try {
            try { prevSel = doc.selection; } catch (eSel) { prevSel = null; }

            lay = getOrCreateTempLayer(layName);
            if (!lay) return false;

            var vb = getViewBounds();
            var x = vb[0] - 100000;
            var y = vb[1] + 100000;

            tfc = lay.textFrames.pointText([x, y]);
            tfc.contents = text;

            doc.selection = null;
            tfc.selected = true;

            try { app.redraw(); } catch (eR) {}
            app.executeMenuCommand("copy");

            return true;
          } catch (e) {
            return false;
          } finally {
            try { if (tfc) tfc.remove(); } catch (e1) {}
            try { if (lay) removeLayerIfEmpty(lay); } catch (e2) {}
            try { doc.selection = prevSel; } catch (e3) {}
          }
        }

        var ok = copyToClipboardViaIllustrator(txt);
        if (ok) alert(t("Скопировано в буфер обмена.", "Copied to clipboard."));
        else alert(t("Не удалось скопировать через Illustrator.", "Failed to copy via Illustrator."));
      } catch (e) {
        alert(t("Ошибка копирования: ", "Copy error: ") + e);
      }
    };

    btnSave.onClick = function(){
      var textToSave = txtResult.text;

      if (!textToSave || textToSave.length === 0) {
        alert(t("Нет текста для сохранения", "No text to save"));
        return;
      }

      var defaultName = "";
      try { defaultName = String(fontInfo.displayName || "Font"); } catch(e){ defaultName = "Font"; }
      defaultName = defaultName.replace(/[^\w\s\-]/g, "");
      if (!defaultName) defaultName = "Font";
      defaultName += " Info.txt";

      var file = File.saveDialog(t("Сохранить как", "Save as"), defaultName);
      if (file) {
        try {
          file.encoding = "UTF-8";
          if (file.open("w")) {
            file.write(textToSave);
            file.close();
            alert(t("Сохранено: ", "Saved: ") + file.fsName);
          } else {
            alert(t("Ошибка записи файла", "Failed to write file"));
          }
        } catch(e2){
          alert(t("Ошибка записи: ", "Write error: ") + e2);
        }
      }
    };

    dlgResult.show();
  }

  var fontDisplayName = safeFontDisplayName(chosen);
  var finalText = "";
  try { finalText = tf.contents || ""; } catch(e) { finalText = ""; }

  if (!finalText || finalText.length === 0) {
    alert(t("ОШИБКА: Финальный текст пустой! Проверьте фильтрацию глифов.", "ERROR: Final text is empty! Check glyph filtering."));
  }

  showResultsDialog(
    { displayName: fontDisplayName, psName: chosenName },
    finalText,
    supportedLanguages,
    SHOW_LANGUAGES
  );

})(); // end IIFE