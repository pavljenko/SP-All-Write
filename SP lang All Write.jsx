// AllGlyphs_LanguageModule.jsx
// Language support detection module (case-insensitive requirements)
// Version: 2026-01-28

(function () {
  // ---------- helpers ----------
  function cpOfChar(str) {
    if (!str || !str.length) return -1;
    if (str.length === 1) return str.charCodeAt(0);
    var hi = str.charCodeAt(0);
    var lo = str.charCodeAt(1);
    if (hi >= 0xD800 && hi <= 0xDBFF && lo >= 0xDC00 && lo <= 0xDFFF) {
      return ((hi - 0xD800) * 0x400) + (lo - 0xDC00) + 0x10000;
    }
    return hi;
  }

  function isWS(ch) {
    return ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
  }

  // Build a presence map where:
  // - original chars are present
  // - uppercase 1-char equivalents are present
  // - special equivalences (ẞ <-> ß) are present
  function buildPresenceMap(glyphsPresent) {
    var p = {};
    for (var ch in glyphsPresent) {
      if (!glyphsPresent.hasOwnProperty(ch)) continue;
      p[ch] = true;

      // uppercase mapping if it stays single-char
      try {
        var up = ch.toUpperCase();
        if (up && up.length === 1) p[up] = true;
      } catch (e) {}

      // German sharp s equivalence
      if (ch === "ẞ") p["ß"] = true;
      if (ch === "ß") p["ẞ"] = true;
    }
    return p;
  }

  // spec string contains required symbols; separators are ignored.
  // Case-insensitive: we check via presence map built above.
  function hasAllFromSpec(presentMap, spec) {
    if (!spec) return true;
    var s = String(spec);

    var needed = {};
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (isWS(ch) || ch === "," || ch === ":" || ch === "/") continue;
      if (ch === "-") continue; // safety
      needed[ch] = true;
    }
    for (var k in needed) {
      if (!needed.hasOwnProperty(k)) continue;
      if (!presentMap[k]) {
        // also try uppercase (single-char) if k is lowercase or caseful
        try {
          var up = k.toUpperCase();
          if (!(up && up.length === 1 && presentMap[up])) return false;
        } catch (e) {
          return false;
        }
      }
    }
    return true;
  }

  function addUnique(out, seen, name) {
    if (!name) return;
    if (seen[name]) return;
    seen[name] = true;
    out.push({ name: name, flag: "" });
  }

  function addMany(out, seen, arr) {
    for (var i = 0; i < arr.length; i++) addUnique(out, seen, arr[i]);
  }

  function countInRanges(glyphsPresent, ranges) {
    var n = 0;
    for (var ch in glyphsPresent) {
      if (!glyphsPresent.hasOwnProperty(ch)) continue;
      var cp = cpOfChar(ch);
      if (cp < 0) continue;
      for (var r = 0; r < ranges.length; r++) {
        var a = ranges[r][0], b = ranges[r][1];
        if (cp >= a && cp <= b) { n++; break; }
      }
    }
    return n;
  }

  // ---------- BASE gates (uppercase only, per your last message) ----------
  var BASE_LATIN_UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var BASE_CYR_UP = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";

  function hasBaseLatin(presentMap) {
    return hasAllFromSpec(presentMap, BASE_LATIN_UP);
  }
  function hasBaseCyrillic(presentMap) {
    return hasAllFromSpec(presentMap, BASE_CYR_UP);
  }

  // ---------- 1) Latin basic (A–Z enough) ----------
  var LATIN_BASIC = [
    "Afar, Angas, Anyi, Anuta, Aranda, Aymara, Baoule, Banyumasan, Bari, Bemba, Bete, Biak, Bislama, Bontoc, Buginese (Latin), Bukusu, Bushi, Carolinian, Cebuano, Chamorro, Chokwe, Dyula, Efik, English, Fijian, Ganda, Garo, Gwere, Haya, Herero, Hiligaynon, Hiri Motu, Iban, Idoma, Ilocano, Indonesian, Isoko, Kabras, Kalenjin, Kambaata, Kaqchikel, Kawkawti, Kimbundu, Kinyarwanda, Kikongo, Kipsigis, Kirundi, Kongo, Kuanyama, Kuria, Lamba, Logooli, Lozi, Luba-Katanga, Luganda, Luhya, Lunyole, Luo, Lusoga, Luvale, Makua, Malagasy, Malay, Mandinka, Mauritian Creole, Minangkabau, Mossi, Nauruan, Ndebele, Ndonga, Ngoni, Niuean, Nyamwezi, Nyankore, Nyoro, Oromo, Ovambo, Paez, Pampanga, Pangasinan, Quechua, Rarotongan, Rotuman, Rundi, Sena, Serer, Sesotho, Seychellois Creole, Shona, Shuar, Solomon Islands Pijin, Somali, Soga, Songhai, Sukuma, Swahili, Taita, Tiv, Tok Pisin, Tokelauan, Tonga, Tsonga, Tshiluba, Tumbuka, Tuvaluan, Umbundu, Waray-Waray, Wayuu, Xhosa, Yao, Zande, Zarma, Zulu."
  ].join("");
  // parse to array
  function splitLangList(s) {
    var arr = [];
    var parts = String(s).split(",");
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i].replace(/^\s+|\s+$/g, "");
      if (!t) continue;
      // remove trailing period
      if (t.charAt(t.length - 1) === ".") t = t.substring(0, t.length - 1);
      arr.push(t);
    }
    return arr;
  }
  var LATIN_BASIC_LIST = splitLangList(LATIN_BASIC);

  // ---------- 2) Latin unique symbols ----------
  // Each entry: { langs:[...], must:"..."} where must contains only the unique symbols listed by you.
  // Notes:
  // - For entries mentioning extra requirements (tone marks etc.) but not listing characters: we ignore those extra parts, per your rule.
  // - Catalan "L·L": base covers L, so we only need "·" but it’s safe to list full set you provided.
  var LATIN_UNIQUE = [
    // Abenaki: "8 (или Ȣ/ȣ)" -> we treat as: require EITHER "8" OR (Ȣ/ȣ)
    { langs:["Abenaki"], must_any_of:[ "8", "Ȣ", "ȣ" ] },

    { langs:["Afrikaans"], must:"Ë, Ï" },
    { langs:["Akan","Ga"], must:"Ɛ, Ɔ" },
    { langs:["Albanian"], must:"Ç, Ë" },
    { langs:["Aragonese"], must:"Á, É, Í, Ñ, Ó, Ú" },
    { langs:["Asturian"], must:"Á, É, Í, Ñ, Ó, Ú, Ḷ, Ḥ" },
    { langs:["Azerbaijani"], must:"Ə, Ç, Ğ, İ, I, Ö, Ş, Ü" },
    { langs:["Bambara"], must:"Ɛ, Ɔ, Ɲ, Ŋ" },
    { langs:["Basaa"], must:"Ɛ, Ɔ" },
    { langs:["Basque"], must:"Ñ" },
    { langs:["Bemba"], must:"Ŋ" },
    { langs:["Bikol"], must:"Ñ" },
    { langs:["Bini","Edo"], must:"Ẹ, Ọ" },
    { langs:["Bosnian","Croatian"], must:"Č, Ć, Đ, Š, Ž" },
    { langs:["Breton"], must:"Ñ" },
    { langs:["Catalan"], must:"À, Ç, È, É, Í, Ï, Ò, Ó, Ú, Ü, L·L" },
    { langs:["Chichewa","Nyanja"], must:"’" },
    { langs:["Chiluba"], must:"Ɛ, Ɔ, Ɲ, Ŋ" },
    { langs:["Corsican"], must:"À, È, Ì, Ò, Ù" },
    { langs:["Czech"], must:"Á, Č, Ď, É, Ě, Í, Ň, Ó, Ř, Š, Ť, Ú, Ů, Ý, Ž" },
    { langs:["Danish","Norwegian"], must:"Æ, Ø, Å" },
    { langs:["Dinka"], must:"Ɛ, Ɔ, Ŋ, Ɣ, Ä, Ë, Ï, Ö, Ɛ̈, Ɔ̈" },
    { langs:["Dogon"], must:"Ɛ, Ɔ, Ɲ, Ŋ" },
    { langs:["Duala"], must:"Ɛ, Ɔ, Ɲ, Ŋ" },
    { langs:["Dutch","Flemish"], must:"Ĳ, Ë, Ï" },
    { langs:["Estonian"], must:"Ä, Ö, Õ, Ü, Š, Ž" },
    { langs:["Ewe"], must:"Ɖ, Ɛ, Ƒ, Ɣ, Ɔ, Ʋ" },
    { langs:["Ewondo"], must:"Ɛ, Ɔ, Ŋ" },
    { langs:["Faroese"], must:"Á, Ð, Í, Ó, Ú, Ý, Æ, Ø" },
    { langs:["Finnish"], must:"Ä, Ö" },
    { langs:["French"], must:"À, Â, Æ, Ç, È, É, Ê, Ë, Î, Ï, Ô, Œ, Ù, Û, Ü, Ÿ" },
    { langs:["Friulian"], must:"À, È, É, Ì, Í, Ò, Ó, Ù" },
    { langs:["Frisian"], must:"Â, Ê, Ô, Ú, Û" },
    { langs:["Fulani","Pulaar","Fulfulde"], must:"Ɓ, Ɗ, Ƴ, Ŋ" },
    { langs:["Gagauz"], must:"Ä, Ê, Ö, Ü, Ğ, Ş, Ț" },
    { langs:["Galician"], must:"Á, É, Í, Ñ, Ó, Ú" },
    { langs:["German"], must:"Ä, Ö, Ü, ß, ẞ" },
    { langs:["Greenlandic"], must:"Æ, Ø, Å, ĸ" },
    { langs:["Guarani"], must:"Ã, Ẽ, Ĩ, Õ, Ũ, Ÿ, Ñ" },
    { langs:["Hausa"], must:"Ɓ, Ɗ, Ƙ, Ƴ" },
    { langs:["Hungarian"], must:"Á, É, Í, Ó, Ö, Ő, Ú, Ü, Ű" },
    { langs:["Ibibio"], must:"Ə, Ñ, Ʌ" },
    { langs:["Icelandic"], must:"Á, Ð, É, Í, Ó, Ö, Þ, Ú, Ý, Æ" },
    { langs:["Igbo"], must:"Ị, Ọ, Ụ, Ñ" },
    { langs:["Irish"], must:"Á, É, Í, Ó, Ú" },
    { langs:["Italian"], must:"À, È, É, Ì, Ò, Ù" },
    { langs:["Javanese"], must:"É, È, Ṭ, Ḍ" },
    { langs:["Kamba"], must:"Ĩ, Ũ" },
    { langs:["Kanuri"], must:"Ǝ" },
    { langs:["Kashubian"], must:"Ą, Ã, Ć, É, Ë, Ł, Ń, Ò, Ó, Ś, Ù, Ż, Ź" },
    { langs:["Kikuyu"], must:"Ĩ, Ũ" },
    { langs:["Kurdish","Zaza"], must:"Ç, Ê, Î, Ş, Û" },
    { langs:["Lao (Transcription)"], must:"Ā, Ī, Ū, Ē, Ō, Ɔ, Ɛ" },
    { langs:["Latvian","Latgalian"], must:"Ā, Č, Ē, Ģ, Ī, Ķ, Ļ, Ņ, Š, Ū, Ž" },
    { langs:["Lingala"], must:"Ɛ, Ɔ" },
    { langs:["Lithuanian"], must:"Ą, Č, Ę, Ė, Į, Š, Ų, Ū, Ž" },
    { langs:["Livonian"], must:"Ā, Ä, Ē, Ī, Ō, Õ, Ū, Ȳ" },
    { langs:["Luxembourgish"], must:"Ä, É, Ë" },
    { langs:["Maori","Samoan","Tongan","Tahitian"], must:"Ā, Ē, Ī, Ō, Ū, ʻ" },
    { langs:["Maltese"], must:"Ċ, Ġ, Ħ, Ż" },
    { langs:["Mapuche"], must:"Ü, Ñ, Ẍ" },
    { langs:["Mirandese"], must:"Â, Ê, Ô, Ũ, Ŋ" },
    { langs:["Moldovan","Romanian"], must:"Ă, Â, Î, Ș, Ț" },
    { langs:["Montenegrin (Latin)"], must:"Ś, Ź, Č, Ć, Đ, Š, Ž" },
    { langs:["Nama","Damara"], must:"ǀ, ǁ, ǂ, ǃ" },
    { langs:["Nyanja"], must:"’" },
    { langs:["Occitan"], must:"À, Á, Â, Ç, È, É, Í, Ï, Ò, Ó, Ô, Ú, Ü" },
    { langs:["Papiamento"], must:"Á, É, Í, Ó, Ú, Ü, Ñ" },
    { langs:["Paez"], must:"Ä, Ë, Ï, Ö, Ü" },
    { langs:["Polish"], must:"Ą, Ć, Ę, Ł, Ń, Ó, Ś, Ż, Ź" },
    { langs:["Portuguese"], must:"Á, Â, Ã, À, Ç, É, Ê, Í, Ó, Ô, Õ, Ú" },
    { langs:["Rapanui"], must:"ꞌ" },
    { langs:["Romansh"], must:"À, È, É, Ì, Ò, Ó, Ù, Ü" },
    { langs:["Sango"], must:"Â, Ê, Î, Ô, Û" },
    { langs:["Sardinian"], must:"À, È, É, Ì, Í, Ò, Ó, Ù" },
    { langs:["Serbian (Latin)"], must:"Č, Ć, Đ, Š, Ž" },
    { langs:["Scottish Gaelic"], must:"À, È, Ì, Ò, Ù" },
    { langs:["Silesian","Kashubian"], must:"Ą, Ã, Ć, É, Ë, Ł, Ń, Ò, Ó, Ś, Ù, Ż, Ź" },
    { langs:["Slovak"], must:"Á, Ä, Č, Ď, É, Í, Ĺ, Ľ, Ň, Ó, Ô, Ŕ, Š, Ť, Ú, Ý, Ž" },
    { langs:["Slovenian"], must:"Č, Š, Ž" },
    { langs:["Soninke"], must:"Ñ, Ŋ" },
    { langs:["Southern Sotho","Tswana","Northern Sotho"], must:"Š, Ê, Ô" },
    { langs:["Spanish"], must:"Á, É, Í, Ñ, Ó, Ú, Ü" },
    { langs:["Sundanese"], must:"É" },
    { langs:["Swedish","Finnish"], must:"Å, Ä, Ö" },
    { langs:["Tagalog"], must:"Ñ" },
    { langs:["Talysh (Latin)"], must:"Ə, Ç, Ğ, I, İ, Ö, Ş, Ü" },
    { langs:["Tetum"], must:"Á, É, Í, Ó, Ú" },
    { langs:["Turkish","Azerbaijani"], must:"Ç, Ğ, İ, I, Ö, Ş, Ü, Ə" },
    { langs:["Venda"], must:"Ṅ, Ḓ, Ṱ, Ṋ, Ḽ" },
    { langs:["Vietnamese"], must:"Ă, Â, Đ, Ê, Ô, Ơ, Ư, Ạ, Ả, Ã, Á, À, Ằ, Ắ, Ẳ, Ẵ, Ặ, Ầ, Ấ, Ẩ, Ẫ, Ậ, Ề, Ế, Ể, Ễ, Ệ, Ỉ, Ị, Ò, Ó, Ỏ, Õ, Ọ, Ồ, Ố, Ổ, Ỗ, Ộ, Ờ, Ớ, Ở, Ỡ, Ợ, Ù, Ú, Ủ, Ũ, Ụ, Ừ, Ứ, Ử, Ữ, Ự, Ỳ, Ý, Ỷ, Ỹ, Ỵ" },
    { langs:["Walloon"], must:"Â, Ç, È, É, Ê, Î, Ô, Û, Ù" },
    { langs:["Welsh"], must:"Â, Ê, Î, Ô, Û, Ŵ, Ŷ" },
    { langs:["Wolof"], must:"À, É, Ë, Ñ, Ŋ, Ó" },
    { langs:["Yoruba"], must:"Ẹ, Ọ, Ṣ" },
    { langs:["Zaza","Kurdish"], must:"Ç, Ê, Î, Ş, Û" }
  ];

  function passesLatinUniqueRule(presentMap, rule) {
    // Special Abenaki handling
    if (rule.must_any_of && rule.must_any_of.length) {
      for (var i = 0; i < rule.must_any_of.length; i++) {
        var sym = rule.must_any_of[i];
        if (presentMap[sym]) return true;
        try {
          var up = sym.toUpperCase();
          if (up && up.length === 1 && presentMap[up]) return true;
        } catch (e) {}
      }
      return false;
    }
    return hasAllFromSpec(presentMap, rule.must);
  }

  // ---------- 3) Cyrillic basic ----------
  var CYRILLIC_BASIC = [
    "Bulgarian",
    "Crimean Tatar (Cyrillic)",
    "Erzya",
    "Moksha",
    "Russian"
  ];

  // ---------- 4) Cyrillic unique ----------
  var CYRILLIC_UNIQUE = [
    { langs:["Abaza","Adyghe","Agul","Archi","Avar","Chechen","Dargwa","Ingush","Kabardian","Karachay-Balkar","Kumyk","Lak","Lezgian","Nogai","Rutul","Tabasaran"], must:"Ӏ" },
    { langs:["Abkhaz"], must:"ӶӺӠҞҨҦҔҬҲҴҶҼҾ" },
    { langs:["Alutor","Aleut","Kerek"], must:"ӶӃԨӇ" },
    { langs:["Altai"], must:"ҤӦӰ" },
    { langs:["Azerbaijani (Cyrillic)"], must:"ӘҒҸӨҮҺ" },
    { langs:["Bashkir"], must:"ӘӨҮҒҠҢҺҘҪ" },
    { langs:["Buryat"], must:"ҮӨҢ" },
    { langs:["Chukchi","Koryak"], must:"ӃӇ" },
    { langs:["Chuvash"], must:"ӐӖҪӲ" },
    { langs:["Dungan"], must:"ӘҖҢЎҮ" },
    { langs:["Enets","Khanty"], must:"ӔԐӇӦӨӪӰ" },
    { langs:["Even","Evenki","Nanai","Udege"], must:"ӨӇҺ" },
    { langs:["Itelmen","Ket","Nenets"], must:"ӶӃӇӬ" },
    { langs:["Kalmyk"], must:"ӘӨҮҖҢҺ" },
    { langs:["Karakalpak (Cyrillic)"], must:"ӘҒҚҢӨҮЎҺІ" },
    { langs:["Karelian"], must:"ӒӦӰ" },
    { langs:["Khakas"], must:"ҒІҢӨҮ" },
    { langs:["Kildin Sami"], must:"ӒҊҒӅӍӉӇҎҌӬ" },
    { langs:["Komi"], must:"ӦІ" },
    { langs:["Kyrgyz"], must:"ҢӨҮ" },
    { langs:["Kazakh"], must:"ӘҒҚҢӨҰҮҺІ" },
    { langs:["Macedonian"], must:"ЃЅЈЉЊЌЏ" },
    // Mansi list includes Latin macron vowels (as you provided). We treat them as required symbols too.
    { langs:["Mansi"], must:"ӇĀĒӢŌӮЫ̄Э̄Ю̄Я̄" },
    { langs:["Mari"], must:"ӒӦӰӸ" },
    { langs:["Mongolian"], must:"ӨҮ" },
    { langs:["Nivkh"], must:"ӶҒӃӇӼӾ" },
    { langs:["Ossetian"], must:"Ӕ" },
    { langs:["Rusyn"], must:"ҐЄІЇЫ" },
    { langs:["Sakha (Yakut)"], must:"ҔҤӨҺҮ" },
    { langs:["Shor","Tofalar"], must:"ҒҢӨҮҺӦ" },
    { langs:["Tajik"], must:"ҒӢҚӮҲҶ" },
    { langs:["Talysh (Cyrillic)"], must:"ҒӘҶ" },
    { langs:["Tatar"], must:"ӘӨҮҖҢҺ" },
    { langs:["Turkmen (Cyrillic)"], must:"ӘҖҢӨҮ" },
    { langs:["Tuvan"], must:"ҮӨҢ" },
    { langs:["Udmurt"], must:"ӜӞӤӦӴ" },
    { langs:["Uighur (Cyrillic)"], must:"ӘҒҚҢӨҮҺ" },
    { langs:["Ukrainian"], must:"ҐЄІЇ" },
    { langs:["Uzbek (Cyrillic)"], must:"ЎҚҒҲ" },
    { langs:["Yukaghir"], must:"ҔӇӃӨ" }
  ];

  // ---------- 5) Script groups: languages + Unicode ranges ----------
  // Rule: if found >= 5 chars in ranges, then all languages in that script group are supported.
  var SCRIPT_GROUPS = [
    {
      name: "Greek script",
      langs: ["Ancient Greek","Calabrian Greek (Grecanic)","Cappadocian Greek","Griko","Koine Greek","Modern Greek","Pontic Greek","Tsakonian"],
      ranges: [ [0x0370,0x03FF], [0x1F00,0x1FFF] ]
    },
    {
      name: "Armenian script",
      langs: ["Armeno-Kipchak","Armeno-Turkish","Armenian (Eastern)","Armenian (Western)","Classical Armenian (Grabar)","Middle Armenian"],
      ranges: [ [0x0530,0x058F], [0xFB13,0xFB17] ]
    },
    {
      name: "Georgian script",
      langs: ["Bats","Georgian","Judaeo-Georgian","Laz","Mingrelian","Svan"],
      ranges: [ [0x10A0,0x10FF], [0x2D00,0x2D2F], [0x1C90,0x1CBF] ]
    },
    {
      name: "Hebrew script",
      langs: ["Aramaic","Hebrew","Judeo-Arabic","Judeo-Persian","Judeo-Spanish (Ladino)","Juhuri (Judeo-Tat)","Karaim (Hebrew tradition)","Yevanic","Yiddish"],
      ranges: [ [0x0590,0x05FF], [0xFB1D,0xFB4F] ]
    },
    {
      name: "Arabic script",
      langs: ["Arabic","Azerbaijani (Iran)","Balochi","Dari","Fulfulde / Fula (Ajami)","Hausa (Ajami)","Hindko","Kashmiri","Kazakh (China)","Kurdish (Sorani)","Kyrgyz (China)","Malay (Jawi)","Pashto","Persian (Farsi)","Punjabi (Shahmukhi)","Rohingya","Saraiki","Sindhi","Swahili (Ajami)","Urdu","Uyghur","Wolof (Wolofal)"],
      ranges: [ [0x0600,0x06FF], [0x0750,0x077F], [0x08A0,0x08FF], [0xFB50,0xFDFF], [0xFE70,0xFEFF] ]
    },
    {
      name: "Syriac script",
      langs: ["Assyrian Neo-Aramaic","Chaldean Neo-Aramaic","Mlahsô","Suret (Sureth)","Syriac","Turoyo"],
      ranges: [ [0x0700,0x074F], [0x0860,0x086F] ]
    },
    {
      name: "Samaritan script",
      langs: ["Samaritan Aramaic","Samaritan Hebrew"],
      ranges: [ [0x0800,0x083F] ]
    },
    {
      name: "Mandaic script",
      langs: ["Mandaic","Neo-Mandaic"],
      ranges: [ [0x0840,0x085F] ]
    },

    // Indic blocks
    {
      name: "Devanagari",
      langs: ["Awadhi","Bhili","Bhojpuri","Chhattisgarhi","Dogri","Garhwali","Haryanvi","Hindi","Konkani","Kumaoni","Magahi","Maithili","Marathi","Nepali","Rajasthani","Santali (Devanagari variant)","Sanskrit"],
      ranges: [ [0x0900,0x097F], [0xA8E0,0xA8FF] ]
    },
    {
      name: "Bengali–Assamese",
      langs: ["Assamese","Bengali","Bishnupriya Manipuri","Chittagonian","Meitei (Bengali script tradition)","Sylheti"],
      ranges: [ [0x0980,0x09FF] ]
    },
    {
      name: "Gurmukhi",
      langs: ["Punjabi"],
      ranges: [ [0x0A00,0x0A7F] ]
    },
    {
      name: "Gujarati",
      langs: ["Gujarati","Kachchi"],
      ranges: [ [0x0A80,0x0AFF] ]
    },
    {
      name: "Odia",
      langs: ["Odia"],
      ranges: [ [0x0B00,0x0B7F] ]
    },
    {
      name: "Tamil",
      langs: ["Tamil"],
      ranges: [ [0x0B80,0x0BFF] ]
    },
    {
      name: "Telugu",
      langs: ["Telugu"],
      ranges: [ [0x0C00,0x0C7F] ]
    },
    {
      name: "Kannada",
      langs: ["Kannada","Kodava","Konkani (Karnataka)","Tulu"],
      ranges: [ [0x0C80,0x0CFF] ]
    },
    {
      name: "Malayalam",
      langs: ["Malayalam"],
      ranges: [ [0x0D00,0x0D7F] ]
    },
    {
      name: "Sinhala",
      langs: ["Pali (Sinhala script)","Sinhala"],
      ranges: [ [0x0D80,0x0DFF] ]
    },
    {
      name: "Tibetan script",
      langs: ["Amdo Tibetan","Balti","Choni","Classical Tibetan","Dzongkha","Khams Tibetan","Ladakhi","Monpa (Tawang)","Purik","Sherpa","Sikkimese (Bhutia)","Tibetan"],
      ranges: [ [0x0F00,0x0FFF] ]
    },
    {
      name: "Thai script",
      langs: ["Isan","Pali (Thai script)","Thai"],
      ranges: [ [0x0E00,0x0E7F] ]
    },
    {
      name: "Lao script",
      langs: ["Lao"],
      ranges: [ [0x0E80,0x0EFF] ]
    },
    {
      name: "Myanmar script",
      langs: ["Arakanese","Burmese","Kachin / Jingpho","Kayah","Mon","Pa’O","Pwo Karen","Sgaw Karen","Shan"],
      ranges: [ [0x1000,0x109F], [0xA9E0,0xA9FF], [0xAA60,0xAA7F] ]
    },
    {
      name: "Khmer script",
      langs: ["Khmer","Kuy","Northern Khmer"],
      ranges: [ [0x1780,0x17FF], [0x19E0,0x19FF] ]
    },
    {
      name: "Tai scripts",
      langs: ["New Tai Lue","Tai Le","Tai Tham (Lanna)","Tai Viet"],
      ranges: [ [0x1980,0x19DF], [0x1950,0x197F], [0x1A20,0x1AAF], [0xAA80,0xAADF] ]
    },
    {
      name: "Ethiopic script",
      langs: ["Amharic","Argobba","Blin","Ge’ez","Gurage","Harari","Oromo (historical)","Sidamo","Silt’e","Tigre","Tigrinya","Wolaytta"],
      ranges: [ [0x1200,0x137F], [0x1380,0x139F], [0x2D80,0x2DDF], [0xAB00,0xAB2F] ]
    },
    {
      name: "Japanese kana",
      langs: ["Ainu (requires Katakana Phonetic Extensions)","Japanese","Miyako","Okinawan","Yaeyama","Yonaguni"],
      ranges: [ [0x3040,0x309F], [0x30A0,0x30FF], [0x31F0,0x31FF], [0xFF65,0xFF9F] ]
    },

    {
      name: "Glagolitic",
      langs: ["Croatian Church Slavonic","Old Church Slavonic (Glagolitic)","Old Croatian"],
      ranges: [ [0x2C00,0x2C5F], [0x1E000,0x1E02F] ]
    },
    {
      name: "Coptic",
      langs: ["Bohairic Coptic","Coptic","Old Nubian","Sahidic Coptic"],
      ranges: [ [0x2C80,0x2CFF] ]
    },
    {
      name: "Tifinagh",
      langs: ["Central Atlas Tamazight","Kabyle","Tamazight","Tarifit","Tashelhit","Tuareg"],
      ranges: [ [0x2D30,0x2D7F] ]
    },
    {
      name: "Vai",
      langs: ["Vai"],
      ranges: [ [0xA500,0xA63F] ]
    },
    {
      name: "Runic",
      langs: ["Old English","Old High German","Old Norse"],
      ranges: [ [0x16A0,0x16FF] ]
    },
    {
      name: "Cyrillic historical",
      langs: ["Church Slavonic","Old Church Slavonic (Cyrillic)","Old East Slavic","Old Russian","Ruthenian"],
      ranges: [ [0x2DE0,0x2DFF], [0xA640,0xA69F] ]
    },
    {
      name: "Gothic alphabet",
      langs: ["Gothic"],
      ranges: [ [0x10330,0x1034F] ]
    }
  ];

  // ---------- MAIN API ----------
  // glyphsPresent: object where keys are characters present in the font (as built by your main script)
  function detectLanguagesFromGlyphs(glyphsPresent) {
    var out = [];
    var seen = {};

    if (!glyphsPresent) return out;

    var presentMap = buildPresenceMap(glyphsPresent);

    var baseLatinOK = hasBaseLatin(presentMap);
    var baseCyrOK = hasBaseCyrillic(presentMap);

    // 1) Latin basic: if A–Z present -> all supported
    if (baseLatinOK) {
      addMany(out, seen, LATIN_BASIC_LIST);
    }

    // 2) Latin unique: only if base Latin is present (you didn’t explicitly demand this, but it prevents nonsense positives)
    // If you want unique-latin to work even without base A–Z, remove this gate.
    if (baseLatinOK) {
      for (var i = 0; i < LATIN_UNIQUE.length; i++) {
        var rule = LATIN_UNIQUE[i];
        if (passesLatinUniqueRule(presentMap, rule)) {
          addMany(out, seen, rule.langs);
        }
      }
    }

    // 3) Cyrillic basic: if base Cyrillic present -> these supported
    if (baseCyrOK) {
      addMany(out, seen, CYRILLIC_BASIC);
    }

    // 4) Cyrillic unique: only if base Cyrillic present (аналогично, чтобы не ловить случайные 1–2 буквы)
    if (baseCyrOK) {
      for (var j = 0; j < CYRILLIC_UNIQUE.length; j++) {
        var cr = CYRILLIC_UNIQUE[j];
        if (hasAllFromSpec(presentMap, cr.must)) {
          addMany(out, seen, cr.langs);
        }
      }
    }

    // 5) Other scripts: if >= 5 symbols in ranges -> all languages in that script supported
    var THRESHOLD = 5;
    for (var g = 0; g < SCRIPT_GROUPS.length; g++) {
      var grp = SCRIPT_GROUPS[g];
      var cnt = countInRanges(glyphsPresent, grp.ranges);
      if (cnt >= THRESHOLD) {
        addMany(out, seen, grp.langs);
      }
    }

    // Sorting (optional): alphabetical
    out.sort(function (a, b) {
      var A = a.name.toLowerCase();
      var B = b.name.toLowerCase();
      if (A < B) return -1;
      if (A > B) return 1;
      return 0;
    });

    return out;
  }

  // expose globally (safe)
  $.global.detectLanguagesFromGlyphs = detectLanguagesFromGlyphs;

})(); 