/* ═══════════════════════════════════════════════════════════════
   ketqua_bts.js — MODULE KẾT QUẢ (Ngũ Linh Tứ Sắc)
   ───────────────────────────────────────────────────────────────
   - Tự tải data từ File01..File06 (cùng Repository GitHub)
   - Đọc trải bài thực tế từ ngulinh_bts.html (biến `state`)
   - Tự xuất ý nghĩa: 5 Lá Linh Hồn (File01) + 3 Khóm (File02..06)
   - Gắn vào ngulinh_bts.html bằng 1 thẻ <script> (xem hướng dẫn)
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ───────── CẤU HÌNH ───────── */
  const CONFIG = {
    // '' = cùng thư mục với ngulinh_bts.html (chạy qua GitHub Pages)
    // Hoặc: 'https://raw.githubusercontent.com/USER/REPO/main/'
    BASE_URL: '',
    FILES: {
      f01: ['File01_bts.html', 'file01_bts.html'],
      f02: ['File02_bts.html', 'file02_bts.html'],
      f03: ['File03_bts.html', 'file03_bts.html'],
      f04: ['File04_bts.html', 'file04_bts.html'],
      f05: ['file05_bts.html', 'File05_bts.html'],
      f06: ['File06_bts.html', 'file06_bts.html']
    }
  };
  Object.assign(CONFIG, window.KETQUA_CONFIG || {});

  /* ───────── TIỆN ÍCH ───────── */
  const P = 'TƯỚNG|TƯỢNG|SĨ|XE|PHÁO|NGỰA|CHỐT';
  const C = 'XANH|VÀNG|TRẮNG|ĐỎ';
  const COLORS = ['XANH', 'VÀNG', 'TRẮNG', 'ĐỎ'];
  const COLOR_HEX = { 'XANH': '#6dbe8c', 'VÀNG': '#e8c97a', 'TRẮNG': '#d0d0d0', 'ĐỎ': '#f08080' };
  const nfc = s => (s || '').normalize('NFC');
  const up = s => nfc(s).toUpperCase();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NODATA = '(chưa có dữ liệu)';

  const mk = (piece, color, m) => ({ piece: up(piece), color: up(color), m: up(m) });
  const ck = c => c.piece + ' ' + c.color + ' ' + c.m;            // khóa đầy đủ
  const nm = c => c.piece + ' ' + c.color;                         // khóa không ký hiệu
  const lbl = c => c.piece + ' ' + c.color + ' ' + c.m;
  const posName = m => (m === 'Đ' ? 'ĐỨNG (Thuận)' : 'NGƯỢC (Nghịch)');

  /* ───────── TẢI FILE ───────── */
  async function fetchText(names) {
    let lastErr = null;
    for (const n of names) {
      try {
        const res = await fetch(CONFIG.BASE_URL + n, { cache: 'no-cache' });
        if (res.ok) return await res.text();
        lastErr = new Error(n + ' → HTTP ' + res.status);
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Không tải được ' + names[0]);
  }

  function extractConst(html, name) {
    const m = nfc(html).match(new RegExp('const\\s+' + name + '\\s*=\\s*`([\\s\\S]*?)`'));
    if (!m) throw new Error('Không tìm thấy biến ' + name + ' trong file');
    return m[1];
  }

  /* ───────── PARSER ───────── */

  // File01: nghĩa chung + Đ + N cho từng lá
  function parseF01(html) {
    const text = extractConst(html, 'DATABASE');
    const hdr = new RegExp('^\\s*\\d+\\.\\s*(' + P + ')\\s+(' + C + ')\\s*:\\s*$', 'iu');
    const lab = new RegExp('^\\s*(' + P + ')\\s+(' + C + ')\\s+(Đ|N)\\s*:\\s*(.*)$', 'iu');
    const skip = /^\s*(CÁC|NHỮNG)\s+LÁ\s+BÀI/iu;
    const db = {};
    const ensure = (p, c) => (db[up(p) + ' ' + up(c)] = db[up(p) + ' ' + up(c)] || { chung: [], D: [], N: [] });
    let cur = null, mode = 'chung', m;
    for (const raw of nfc(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || skip.test(line)) continue;
      if ((m = hdr.exec(line))) { cur = ensure(m[1], m[2]); mode = 'chung'; continue; }
      if ((m = lab.exec(line))) {
        cur = ensure(m[1], m[2]);
        mode = up(m[3]) === 'Đ' ? 'D' : 'N';
        if (m[4]) cur[mode].push(m[4]);
        continue;
      }
      if (cur) cur[mode].push(line);
    }
    Object.keys(db).forEach(k => {
      ['chung', 'D', 'N'].forEach(f => { db[k][f] = db[k][f].join('\n').trim(); });
    });
    return db;
  }

  // File02: data[quân][màu]['Đứng'|'Ngược']
  function parseF02(html) {
    const m = nfc(html).match(/const\s+data\s*=\s*(\{[\s\S]*?\})\s*;\s*\n\s*const\s+types/);
    if (!m) throw new Error('Không tìm thấy biến data trong File02');
    try { return JSON.parse(m[1]); }
    catch (e) { return (new Function('return ' + m[1]))(); }
  }

  // File03/04/05: khối "chủ" → "Gặp X" → {left, right}
  // Xử lý cả trường hợp nội dung bị xuống dòng (dòng nối tiếp) & thiếu ký hiệu Đ/N
  function parsePairs(html, constName, hdrDef, gapDef) {
    const text = extractConst(html, constName);
    const hdr = new RegExp('^\\s*\\d+\\.\\s*(' + P + ')\\s+(' + C + ')(?:\\s+(Đ|N))?\\s*:?\\s*$', 'iu');
    const gap = new RegExp('^\\s*Gặp\\s+(' + P + ')\\s+(' + C + ')(?:\\s+(Đ|N))?\\s*:\\s*(.*)$', 'iu');
    const blocks = {};
    let cur = null, last = null, m;
    for (const raw of nfc(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (/^(MÀU\s|📊)/iu.test(line)) { last = null; continue; }
      if ((m = hdr.exec(line))) {
        cur = ck(mk(m[1], m[2], m[3] || hdrDef));
        blocks[cur] = blocks[cur] || {};
        last = null;
        continue;
      }
      if (cur && (m = gap.exec(line))) {
        last = { raw: m[4] };
        blocks[cur][ck(mk(m[1], m[2], m[3] || gapDef))] = last;
        continue;
      }
      if (last) last.raw += ' ' + line;     // dòng nối tiếp
    }
    Object.keys(blocks).forEach(b => Object.keys(blocks[b]).forEach(g => {
      const parts = blocks[b][g].raw.replace(/"/g, '').split('|').map(s => s.trim());
      blocks[b][g] = { left: parts[0] || '', right: parts[1] || '' };
    }));
    return blocks;
  }

  // File06: sections[1..5]["4 TƯỚNG XANH"] = {left,right}
  function parseF06(html) {
    const text = extractConst(html, 'LIBRARY_DATA');
    const re = new RegExp('^\\s*(\\d+)\\s+(' + P + ')\\s+(' + C + ')\\s*:\\s*(.*)$', 'iu');
    const secs = {};
    let sec = null, m;
    for (const raw of nfc(text).split(/\r?\n/)) {
      const line = raw.trim();
      if ((m = /^\[SECTION=(\d+)\]/i.exec(line))) { sec = +m[1]; secs[sec] = {}; continue; }
      if (sec && (m = re.exec(line))) {
        const parts = m[4].split('|').map(s => s.trim());
        secs[sec][m[1] + ' ' + up(m[2]) + ' ' + up(m[3])] = { left: parts[0] || '', right: parts[1] || '' };
      }
    }
    return secs;
  }

  /* ───────── LOAD TẤT CẢ ───────── */
  let dbPromise = null;
  function loadAll() {
    if (dbPromise) return dbPromise;
    const F = CONFIG.FILES;
    dbPromise = Promise.all(['f01', 'f02', 'f03', 'f04', 'f05', 'f06'].map(k => fetchText(F[k])))
      .then(([h1, h2, h3, h4, h5, h6]) => ({
        f01: parseF01(h1),
        f02: parseF02(h2),
        f03: parsePairs(h3, 'THU_VIEN_DATA', 'Đ', 'Đ'),
        f04: parsePairs(h4, 'DATA_04', 'N', 'N'),
        f05: parsePairs(h5, 'DATA_FILE_05', 'Đ', 'N'),
        f06: parseF06(h6)
      }))
      .catch(e => { dbPromise = null; throw e; });
    return dbPromise;
  }

  /* ───────── TRA CỨU ───────── */

  // File03 & File04: lá trái làm chủ → vế phải; nếu không có, lá phải làm chủ → vế trái
  function lookupPair(db, a, b) {
    let e = db[ck(a)] && db[ck(a)][ck(b)];
    if (e) return e.right || e.left;
    e = db[ck(b)] && db[ck(b)][ck(a)];
    if (e) return e.left;
    return null;
  }

  // File05: lá Đ làm chủ. Đ nằm bên trái → vế phải; Đ nằm bên phải → vế trái
  function lookupMixed(db, a, b) {
    const dLeft = a.m === 'Đ';
    const d = dLeft ? a : b, n = dLeft ? b : a;
    const e = db[ck(d)] && db[ck(d)][ck(n)];
    if (!e) return null;
    return dLeft ? (e.right || e.left) : e.left;
  }

  const PREFIX = { 1: 4, 2: 4, 3: 3, 4: 3, 5: 2 };   // đúng như File06
  function lookupLib(db, sec, card, pos) {
    const e = db[sec] && db[sec][PREFIX[sec] + ' ' + nm(card)];
    if (!e) return null;
    return pos === 'Đ' ? e.left : e.right;
  }

  function resolvePair(db, a, b) {
    if (a.m === b.m) {
      if (a.piece === b.piece) return { src: '', text: 'Hai lá trùng nhau — xem mục "Lá trùng" (File06).' };
      if (a.m === 'Đ') return { src: 'File03', text: lookupPair(db.f03, a, b) };
      return { src: 'File04', text: lookupPair(db.f04, a, b) };
    }
    return { src: 'File05', text: lookupMixed(db.f05, a, b) };
  }

  function groupItems(db, cards) {
    const by = {};
    cards.forEach(c => (by[c.piece] = by[c.piece] || []).push(c));
    const items = [];
    Object.keys(by).forEach(piece => {
      const g = by[piece];
      if (g.length < 2) return;
      const d = g.filter(c => c.m === 'Đ').length, n = g.length - d, s = g[0];
      const add = (sec, pos, desc) => items.push({
        label: nm(s) + ' — ' + desc,
        text: lookupLib(db.f06, sec, s, pos)
      });
      if (g.length === 4) {
        if (d === 4) add(1, 'Đ', '4 lá Đứng');
        else if (n === 4) add(1, 'N', '4 lá Ngược');
        else if (d === 3) add(2, 'Đ', '3 Đứng + 1 Ngược');
        else if (d === 1) add(2, 'N', '3 Ngược + 1 Đứng');
        else { add(5, 'Đ', '2 lá Đứng'); add(5, 'N', '2 lá Ngược'); }
      } else if (g.length === 3) {
        if (d === 3) add(3, 'Đ', '3 lá Đứng');
        else if (n === 3) add(3, 'N', '3 lá Ngược');
        else if (d === 2) add(4, 'Đ', '2 Đứng + 1 Ngược');
        else add(4, 'N', '2 Ngược + 1 Đứng');
      } else {
        if (d === 2) add(5, 'Đ', '2 lá Đứng');
        else if (n === 2) add(5, 'N', '2 lá Ngược');
      }
    });
    return items;
  }

  /* ───────── DỰNG MÔ HÌNH KẾT QUẢ ───────── */
  function build(st, db) {
    const color = up(st.colorName);
    const toCard = s => mk(s.n, color, s.f);

    const souls = st.souls.map((s, i) => {
      const c = toCard(s), e = db.f01[nm(c)];
      return {
        tag: 'L' + (i + 1), card: c,
        chung: e ? e.chung : '',
        pos: e ? (c.m === 'Đ' ? e.D : e.N) : ''
      };
    });

    const titles = ['QUÁ KHỨ', 'HIỆN TẠI', 'TƯƠNG LAI'];
    const khoms = st.khoms.map((grp, i) => {
      const cards = grp.map(toCard);
      return {
        title: 'KHÓM ' + (i + 1) + ' — ' + titles[i],
        cards,
        singles: cards.map((c, j) => {
          const e = db.f02[c.piece] && db.f02[c.piece][c.color];
          return { idx: j + 1, card: c, text: e ? e[c.m === 'Đ' ? 'Đứng' : 'Ngược'] : null };
        }),
        groups: groupItems(db, cards),
        pairs: [0, 1, 2].map(j => {
          const a = cards[j], b = cards[j + 1], r = resolvePair(db, a, b);
          return { n: j + 1, a, b, src: r.src, text: r.text };
        })
      };
    });
    return { color, souls, khoms };
  }

  /* ───────── HIỂN THỊ ───────── */
  const chip = c => '<span class="kq-chip" style="color:' + (COLOR_HEX[c.color] || '#ccc') + ';border-color:' +
    (COLOR_HEX[c.color] || '#ccc') + '">' + esc(lbl(c)) + '</span>';
  const val = t => (t ? esc(t) : '<i class="kq-miss">' + NODATA + '</i>');

  function injectStyle() {
    if (document.getElementById('kqStyle')) return;
    const s = document.createElement('style');
    s.id = 'kqStyle';
    s.textContent = `
#kqPanel{margin-top:22px;animation:fadeIn .5s ease}
#kqPanel .kq-title{font-family:'Cinzel',serif;font-size:11px;letter-spacing:3px;color:var(--gold,#c9a84c);text-align:center;margin-bottom:12px;opacity:.9}
#kqPanel details{background:var(--panel-light,#241a0a);border:1px solid var(--border,rgba(201,168,76,.4));border-radius:4px;margin-bottom:12px}
#kqPanel summary{cursor:pointer;padding:13px 14px;font-family:'Cinzel',serif;font-size:12px;letter-spacing:2px;color:var(--gold-light,#e8c97a);list-style:none}
#kqPanel summary::-webkit-details-marker{display:none}
#kqPanel summary::before{content:'▸ ';color:var(--gold,#c9a84c)}
#kqPanel details[open]>summary::before{content:'▾ '}
#kqPanel .kq-body{padding:0 14px 14px}
#kqPanel .kq-item{border-top:1px solid rgba(201,168,76,.18);padding:11px 0}
#kqPanel .kq-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
#kqPanel .kq-tag{font-family:'Cinzel',serif;font-size:10px;color:var(--gold,#c9a84c);opacity:.8;letter-spacing:1px}
#kqPanel .kq-chip{font-family:'Cinzel',serif;font-size:11px;font-weight:700;border:1px solid;border-radius:3px;padding:2px 8px;letter-spacing:.5px}
#kqPanel .kq-src{font-family:'Cinzel',serif;font-size:9px;color:var(--gold,#c9a84c);opacity:.55;margin-left:auto;letter-spacing:1px}
#kqPanel .kq-sub{font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;color:var(--gold,#c9a84c);opacity:.75;margin:12px 0 2px}
#kqPanel .kq-txt{font-size:15px;line-height:1.65;color:#e9dfc4;white-space:pre-wrap}
#kqPanel .kq-lbl{font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;color:var(--gold-light,#e8c97a);opacity:.8;display:block;margin:6px 0 2px}
#kqPanel .kq-miss{opacity:.45}
#kqPanel .kq-btn{width:100%;padding:14px;margin-top:6px;background:linear-gradient(135deg,#3a2a0a,#5a4010,#3a2a0a);color:var(--gold-light,#e8c97a);border:1px solid var(--gold,#c9a84c);border-radius:4px;font-family:'Cinzel',serif;font-size:12px;letter-spacing:2px;font-weight:700;cursor:pointer}
#kqPanel .kq-msg{text-align:center;font-style:italic;color:rgba(201,168,76,.7);padding:18px 8px;font-size:15px;line-height:1.6}
#kqPanel .kq-err{color:#f08080;font-style:normal}`;
    document.head.appendChild(s);
  }

  function getPanel() {
    let p = document.getElementById('kqPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'kqPanel';
      const anchor = document.getElementById('khomSection');
      if (anchor) anchor.insertAdjacentElement('afterend', p);
      else document.body.appendChild(p);
    }
    return p;
  }

  let lastText = '';

  function render(model) {
    const out = ['<div class="kq-title">✦ &nbsp; KẾT QUẢ TRÍCH XUẤT TỰ ĐỘNG &nbsp; ✦</div>'];
    const txt = ['KẾT QUẢ TRÍCH XUẤT — NGŨ LINH TỨ SẮC'];

    // 5 lá linh hồn
    out.push('<details open><summary>NGŨ LÁ LINH HỒN</summary><div class="kq-body">');
    txt.push('', '【 NGŨ LÁ LINH HỒN 】');
    model.souls.forEach(s => {
      out.push('<div class="kq-item"><div class="kq-head"><span class="kq-tag">' + s.tag + '</span>' + chip(s.card) +
        '<span class="kq-src">FILE01</span></div>' +
        '<span class="kq-lbl">NGHĨA CHUNG</span><div class="kq-txt">' + val(s.chung) + '</div>' +
        '<span class="kq-lbl">' + posName(s.card.m) + '</span><div class="kq-txt">' + val(s.pos) + '</div></div>');
      txt.push('', s.tag + '. ' + lbl(s.card), 'Nghĩa chung: ' + (s.chung || NODATA),
        posName(s.card.m) + ': ' + (s.pos || NODATA));
    });
    out.push('</div></details>');

    // 3 khóm
    model.khoms.forEach(k => {
      out.push('<details open><summary>' + esc(k.title) + '</summary><div class="kq-body">');
      txt.push('', '【 ' + k.title + ' 】');

      out.push('<div class="kq-sub">NGHĨA TỪNG LÁ</div>');
      txt.push('— Nghĩa từng lá (File02):');
      k.singles.forEach(x => {
        out.push('<div class="kq-item"><div class="kq-head"><span class="kq-tag">LÁ ' + x.idx + '</span>' + chip(x.card) +
          '<span class="kq-src">FILE02</span></div><div class="kq-txt">' + val(x.text) + '</div></div>');
        txt.push('  Lá ' + x.idx + ' ' + lbl(x.card) + ': ' + (x.text || NODATA));
      });

      if (k.groups.length) {
        out.push('<div class="kq-sub">LÁ TRÙNG</div>');
        txt.push('— Lá trùng (File06):');
        k.groups.forEach(g => {
          out.push('<div class="kq-item"><div class="kq-head"><span class="kq-tag">' + esc(g.label) +
            '</span><span class="kq-src">FILE06</span></div><div class="kq-txt">' + val(g.text) + '</div></div>');
          txt.push('  ' + g.label + ': ' + (g.text || NODATA));
        });
      }

      out.push('<div class="kq-sub">CẶP LIỀN KỀ</div>');
      txt.push('— Cặp liền kề:');
      k.pairs.forEach(p => {
        out.push('<div class="kq-item"><div class="kq-head"><span class="kq-tag">CẶP ' + p.n + '</span>' + chip(p.a) +
          '<span class="kq-tag">⟷</span>' + chip(p.b) + (p.src ? '<span class="kq-src">' + p.src.toUpperCase() + '</span>' : '') +
          '</div><div class="kq-txt">' + val(p.text) + '</div></div>');
        txt.push('  Cặp ' + p.n + ' (' + lbl(p.a) + ' — ' + lbl(p.b) + ')' + (p.src ? ' [' + p.src + ']' : '') +
          ': ' + (p.text || NODATA));
      });
      out.push('</div></details>');
    });

    out.push('<button class="kq-btn" id="kqCopy">📜 &nbsp; SAO CHÉP KẾT QUẢ TRÍCH XUẤT</button>');
    lastText = txt.join('\n');
    const p = getPanel();
    p.innerHTML = out.join('');
    document.getElementById('kqCopy').onclick = copyResult;
  }

  function copyResult() {
    const done = () => {
      const t = document.getElementById('toast');
      if (t) { t.textContent = '✦ Đã sao chép kết quả ✦'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
      else alert('Đã sao chép!');
    };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = lastText; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lastText).then(done).catch(fallback);
    else fallback();
  }

  function showMsg(html, isErr) {
    getPanel().innerHTML = '<div class="kq-title">✦ &nbsp; KẾT QUẢ TRÍCH XUẤT TỰ ĐỘNG &nbsp; ✦</div>' +
      '<div class="kq-msg' + (isErr ? ' kq-err' : '') + '">' + html + '</div>';
  }

  /* ───────── CHẠY ───────── */
  function stateOK() {
    return typeof state !== 'undefined' && state && state.souls && state.souls.length === 5 &&
      state.khoms && state.khoms.length === 3 && COLORS.indexOf(up(state.colorName)) !== -1;
  }

  function run() {
    injectStyle();
    if (!stateOK()) return;
    const snap = { colorName: state.colorName, souls: state.souls.map(x => ({ n: x.n, f: x.f })),
      khoms: state.khoms.map(g => g.map(x => ({ n: x.n, f: x.f }))) };
    const ref = state.souls;
    showMsg('Đang tải dữ liệu từ File01 … File06 …');
    loadAll().then(db => {
      if (state.souls !== ref) return;            // người dùng đã xào bài mới
      render(build(snap, db));
    }).catch(e => {
      console.error('[KetQua]', e);
      showMsg('Không tải được dữ liệu: ' + esc(e.message || e) +
        '<br>Kiểm tra: chạy qua GitHub Pages (không mở file://), đúng tên file, hoặc đặt BASE_URL.', true);
    });
  }

  function clear() {
    const p = document.getElementById('kqPanel');
    if (p) p.innerHTML = '';
    lastText = '';
  }

  /* ───────── GẮN VÀO ngulinh_bts.html ───────── */
  function wrap(fnName, after) {
    const orig = window[fnName];
    if (typeof orig !== 'function' || orig.__kq) return false;
    const w = function () {
      const r = orig.apply(this, arguments);
      try { after(); } catch (e) { console.error('[KetQua]', e); }
      return r;
    };
    w.__kq = true;
    window[fnName] = w;
    return true;
  }

  function install() {
    wrap('processResults', run);   // sau Lần 13 → tự xuất kết quả
    wrap('setupNgulinh', clear);   // bấm XÀO BÀI → xoá kết quả cũ
  }

  install();
  window.addEventListener('load', install);

  window.KetQua = { run, reload: () => { dbPromise = null; run(); }, config: CONFIG, loadAll };
})();
