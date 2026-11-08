/* Fio-Mar Gestor — Assistente de voz
   Você fala (ou digita) um comando em português e o assistente abre o formulário
   do próprio sistema já preenchido. Nada é salvo sozinho: confira e toque em Salvar.

   Entende:
   - Agendar:     "agenda revisão do Onix do Carlos quinta às 14h"
   - Placa:       "placa QRT4B21"  ·  "puxa a placa quê erre tê quatro bê dois um"
   - Despesa:     "despesa de 350 reais de conta de luz"  ·  "paguei 120 de gasolina ontem"
   - Item na O.S.: "adiciona 2 velas de 45 reais na O.S. do Gol"  ·  "lança mão de obra 200 na OS 12"
   - Pagamento:   "recebi 500 no pix da O.S. do Carlos"
   - Telas:       "abre a agenda de hoje"  ·  "mostra o estoque"

   Funciona sem internet de IA: a interpretação é feita aqui no aparelho, usando
   os clientes, veículos, serviços e O.S. já cadastrados. */
(function (G) {
'use strict';

/* ---------- texto ---------- */
/* minúsculas e sem acento, mantendo o mesmo tamanho do texto original (para recortar trechos) */
function N(s) { s = String(s == null ? '' : s); let o = ''; for (let i = 0; i < s.length; i++) { const c = s[i], b = (c.normalize('NFD')[0] || c), l = b.toLowerCase(); o += l.length == 1 ? l : b } return o }
const p2 = n => String(n).padStart(2, '0');
const hoje = () => (typeof today == 'function' ? today() : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
const isoD = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const valida = s => { const d = new Date(s + 'T12:00'); return !isNaN(d) && isoD(d) == s ? s : 'INV' };
const addD = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoD(d) };
const toNum = x => { if (typeof nBR == 'function') return nBR(x); const v = +String(x).replace(/\./g, '').replace(',', '.'); return isFinite(v) ? v : NaN };
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/* ---------- palavras parecidas (erros do reconhecimento de voz) ---------- */
function lev(a, b) { if (a == b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1)); p = c } return p[n] }
/* a e b já normalizadas; nomes curtos só batem iguais */
const parece = (a, b) => a == b || a + 's' == b || b + 's' == a || (Math.min(a.length, b.length) >= 4 && lev(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1));
/* o Android às vezes repete um pedaço: "visse de diagnóstico esse de diagnóstico" -> uma vez só */
function semRepeticao(s) {
  let w = String(s).split(/\s+/).filter(Boolean);
  const k = x => N(x).replace(/[^a-z0-9]/g, '');
  for (let n = Math.min(6, Math.floor(w.length / 2)); n >= 2; n--) {
    for (let i = 0; i + 2 * n <= w.length; i++) {
      let dif = 0; for (let j = 0; j < n; j++) if (!parece(k(w[i + j]), k(w[i + n + j])) && ++dif > (n >= 3 ? 1 : 0)) break;
      if (dif <= (n >= 3 ? 1 : 0) && w.slice(i, i + n).some(x => k(x).length >= 4)) { w.splice(i + n, n); i-- }
    }
  }
  return w.join(' ')
}

/* ---------- números falados ("trezentos e cinquenta" -> 350) ---------- */
const NUM = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };
const plc = v => v >= 100 && v % 100 == 0 ? 100 : v >= 20 && v % 10 == 0 ? 10 : 1;
function numWords(s) {
  const w = String(s).trim().split(/\s+/).filter(Boolean), o = [], cl = x => N(x || '').replace(/[.,!?;:]+$/, '');
  for (let i = 0; i < w.length; i++) {
    const k = cl(w[i]);
    if (!(k in NUM) && k != 'mil') { o.push(w[i]); continue }
    /* "um"/"uma" sozinho costuma ser artigo ("uma revisão") */
    if ((k == 'um' || k == 'uma') && !/^(real|reais|mil|hora|horas|e)$/.test(cl(w[i + 1]))) { o.push(w[i]); continue }
    let total = 0, cur = 0, last = null, j = i;
    while (j < w.length) {
      const t = cl(w[j]);
      if (last === null) { if (t == 'mil') { total = 1000; last = 1000 } else { cur = NUM[t]; last = cur } j++; continue }
      if (t == 'mil' && last !== 1000 && cur > 0) { total += cur * 1000; cur = 0; last = 1000; j++; continue }
      if (last === 1000 && t in NUM) { cur += NUM[t]; last = NUM[t]; j++; continue }
      if (t == 'e' && j + 1 < w.length) { const t2 = cl(w[j + 1]); if (t2 in NUM && (last === 1000 || NUM[t2] < plc(last))) { cur += NUM[t2]; last = NUM[t2]; j += 2; continue } }
      break
    }
    const pont = (w[j - 1].match(/[.,!?;:]+$/) || [''])[0];
    o.push(String(total + cur) + pont); i = j - 1
  }
  return o.join(' ')
}

/* ---------- placas faladas ---------- */
const LN = { a: 'A', be: 'B', ce: 'C', de: 'D', e: 'E', efe: 'F', ge: 'G', ga: 'H', aga: 'H', i: 'I', jota: 'J', ca: 'K', ka: 'K', ele: 'L', eme: 'M', ene: 'N', o: 'O', pe: 'P', que: 'Q', qe: 'Q', erre: 'R', re: 'R', esse: 'S', te: 'T', u: 'U', ve: 'V', dablio: 'W', dabliu: 'W', xis: 'X', ipsilon: 'Y', ipslon: 'Y', ze: 'Z' };
const DW = { zero: '0', um: '1', uma: '1', dois: '2', duas: '2', tres: '3', quatro: '4', cinco: '5', seis: '6', meia: '6', sete: '7', oito: '8', nove: '9' };
const COMUM = new Set('de do da dos das no na nos nas um uma os as ao em por pra pro que se me te eu ele ela seu sua meu mal bem sim nao ver vai vou tem ter faz foi era sao dia mes ano ali la aqui ja mas mais com sem tal oi ola ok and pro pras pros num dum gol uno ka hb ix'.split(' '));
const PLRE = /[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/;
function chunk(tok) {
  const raw = tok.replace(/[.,!?;:()"“”]+/g, ''), k = N(raw);
  if (!k) return null;
  if (k in LN && !/\d/.test(k)) return LN[k];
  if (k in DW) return DW[k];
  if (/^[a-z0-9-]{1,8}$/.test(k) && /\d/.test(k)) return k.replace(/-/g, '').toUpperCase();
  if (/^[a-z]$/.test(k)) return k.toUpperCase();
  if (/^[a-z]{2,3}$/.test(k) && (raw === raw.toUpperCase() || !COMUM.has(k))) return k.toUpperCase();
  return null
}
/* procura uma placa completa nas palavras; devolve {placa, idx:[índices das palavras usadas]} */
function achaPlaca(words) {
  for (let i = 0; i < words.length; i++) {
    let s = '', ranges = [];
    for (let j = i; j < words.length; j++) {
      const c = chunk(words[j]); if (c == null) break;
      ranges.push([s.length, s.length + c.length, j]); s += c;
      const m = s.match(PLRE);
      if (m) { const a = m.index, b = a + 7; return { placa: m[0], idx: ranges.filter(r => r[0] < b && r[1] > a).map(r => r[2]) } }
      if (s.length > 14) break
    }
  }
  return null
}
/* pedaço de placa depois de "placa"/"final" ("final 21", "placa 4B21") */
function fragPlaca(words) {
  for (let i = 0; i < words.length; i++) {
    const k = N(words[i]).replace(/[^a-z]/g, '');
    if (k != 'placa' && k != 'final') continue;
    let s = '', idx = [];
    for (let j = i + 1; j < words.length; j++) { const c = chunk(words[j]); if (c == null) { if (!s && /^(de|da|do|e|a|o)$/.test(N(words[j]))) continue; break } s += c; idx.push(j); if (s.length >= 7) break }
    if (s.length >= 2) return { frag: s, final: k == 'final', idx: [i, ...idx] }
  }
  return null
}
/* compara placas aceitando confusões comuns (O/0, I/1) e o modelo antigo x Mercosul */
function canon(p) {
  p = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (p.length != 7) return p;
  const L = c => ({ 0: 'O', 1: 'I', 8: 'B', 5: 'S', 2: 'Z' }[c] || c), D = c => ({ O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8' }[c] || c);
  const a = p.slice(0, 3).split('').map(L).join(''), d4 = D(p[3]), c5 = /\d/.test(p[4]) ? 'ABCDEFGHIJ'[+p[4]] : p[4], r = p.slice(5).split('').map(D).join('');
  return a + d4 + c5 + r
}
const veics = () => (db && db.vehicles) || [];
function buscaPlaca(placa) {
  const c = canon(placa), V = veics().filter(v => v.placa);
  let L = V.filter(v => canon(v.placa) == c);
  if (L.length) return { L, exata: true };
  const ham = (a, b) => a.length != b.length ? 9 : [...a].filter((x, i) => x != b[i]).length;
  L = V.filter(v => ham(canon(v.placa), c) == 1);
  return { L, exata: false }
}
function buscaFrag(f) {
  const c = String(f.frag).toUpperCase(), V = veics().filter(v => v.placa);
  return V.filter(v => { const p = String(v.placa).toUpperCase().replace(/[^A-Z0-9]/g, ''); return f.final ? p.endsWith(c) : p.includes(c) })
}

/* ---------- recorte de trechos (o texto vai sendo "consumido") ---------- */
function Txt(s) { this.o = s; this.n = N(s) }
Txt.prototype.take = function (re) {
  const m = this.n.match(re); if (!m) return null;
  const a = m.index, b = a + m[0].length, sp = ' '.repeat(b - a);
  m.orig = this.o.slice(a, b);
  this.o = this.o.slice(0, a) + sp + this.o.slice(b); this.n = this.n.slice(0, a) + sp + this.n.slice(b);
  return m
};
Txt.prototype.has = function (re) { return re.test(this.n) };

/* ---------- datas ---------- */
const DS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const PRE = '(?:(?:para|pra|pro|no|na|ate|em|de|do|da|dia)\\s+)?';
function pegaData(t, passado) {
  const H = hoje(); let m;
  if (t.take(new RegExp('\\b' + PRE + 'depois de amanha\\b'))) return addD(H, 2);
  if (t.take(new RegExp('\\b' + PRE + 'amanha(?! de manha)\\b')) || t.take(/\bamanha(?= de manha)/)) return addD(H, 1);
  if (t.take(/\b(?:de |no dia de )?anteontem\b/)) return addD(H, -2);
  if (t.take(/\b(?:de |no dia de )?ontem\b/)) return addD(H, -1);
  if (t.take(new RegExp('\\b' + PRE + 'hoje\\b'))) return H;
  if ((m = t.take(new RegExp('\\b' + PRE + '(?:(?:a|o)\\s+)?(?:proxima\\s+|proximo\\s+|essa\\s+|esta\\s+|nessa\\s+|nesta\\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[- ]feira)?(\\s+que vem|\\s+passad[ao])?\\b')))) {
    const alvo = DS[m[1]], d0 = new Date(H + 'T12:00').getDay(), past = passado || /passad/.test(m[2] || '');
    let dif = past ? -(((d0 - alvo) + 7) % 7 || 7) : (((alvo - d0) + 7) % 7 || 7);
    if (passado && !m[2] && dif == -7) dif = 0; /* "paguei na segunda" dita numa segunda = hoje */
    return addD(H, dif)
  }
  const ano = (d, mo, y) => {
    let Y = y ? (+y < 100 ? 2000 + +y : +y) : +H.slice(0, 4), s = Y + '-' + p2(mo) + '-' + p2(d);
    if (!y) { if (!passado && s < H) s = (Y + 1) + s.slice(4); if (passado && s > H) s = (Y - 1) + s.slice(4) }
    return valida(s)
  };
  if ((m = t.take(/\b(?:dia\s+)?(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/)) && +m[2] >= 1 && +m[2] <= 12) return ano(+m[1], +m[2], m[3]);
  if ((m = t.take(new RegExp('\\b' + PRE + '(\\d{1,2}) de (' + MESES.join('|') + ')(?: de (\\d{4}))?\\b')))) return ano(+m[1], MESES.indexOf(m[2]) + 1, m[3]);
  if ((m = t.take(/\b(?:(?:para|pra|no|ate)\s+)?(?:o\s+)?dia\s+(\d{1,2})\b/)) && +m[1] >= 1 && +m[1] <= 31) {
    const Y = +H.slice(0, 4), M = +H.slice(5, 7), d = +m[1]; let s = Y + '-' + p2(M) + '-' + p2(d);
    if (!passado && s < H) { s = (M == 12 ? Y + 1 : Y) + '-' + p2(M == 12 ? 1 : M + 1) + '-' + p2(d) }
    if (passado && s > H) { s = (M == 1 ? Y - 1 : Y) + '-' + p2(M == 1 ? 12 : M - 1) + '-' + p2(d) }
    return valida(s)
  }
  return ''
}

/* ---------- horas ---------- */
function ajH(h, mi, per) {
  h = +h; mi = mi == 'meia' ? 30 : +(mi || 0);
  if (per == 'tarde' || per == 'noite') { if (h < 12) h += 12 } else if (!per && h >= 1 && h <= 6) h += 12;
  if (h > 23 || mi > 59) return 'INV';
  return p2(h) + ':' + p2(mi)
}
function pegaHora(t) {
  let m;
  if ((m = t.take(/\b(?:(?:as|ao|pro|para o|pra)\s+)?meio[- ]dia(\s+e\s+meia)?\b/))) return m[1] ? '12:30' : '12:00';
  if ((m = t.take(/\b(?:(?:as|a partir das|pras|para as|por volta das|perto das)\s+)?(\d{1,2})\s*(?::|h)\s*(\d{2})\b(?:\s+(?:da|de)\s+(manha|tarde|noite))?/))) return ajH(m[1], m[2], m[3]);
  if ((m = t.take(/\b(?:as|a partir das|pras|para as|por volta das|perto das)\s+(\d{1,2})(?:\s*(?:h|hs|horas?)\b)?(?:\s+e\s+(\d{1,2}|meia)(?:\s*min(?:utos)?)?)?(?:\s+(?:da|de)\s+(manha|tarde|noite))?/))) return ajH(m[1], m[2], m[3]);
  if ((m = t.take(/\b(\d{1,2})\s*(?:h|hs|horas)\b(?:\s+e\s+(\d{1,2}|meia)(?:\s*min(?:utos)?)?)?(?:\s+(?:da|de)\s+(manha|tarde|noite))?/))) return ajH(m[1], m[2], m[3]);
  if ((m = t.take(/\b(?:de|pela|a|na|durante a|parte da)\s+(manha|tarde)\b/))) return m[1] == 'manha' ? '08:00' : '14:00';
  return ''
}

/* ---------- dinheiro ---------- */
const MOEDA = '(?:reais|real|conto|contos|pila|pilas|paus|pau)';
function pegaValores(t) {
  const out = []; let m;
  const ctx = (a) => { const antes = t.n.slice(Math.max(0, a - 22), a); return /(custo|custou|custa|paguei|comprei|pago)\W*(de|por|a|foi)?\s*$/.test(antes) ? 'custo' : /(cobra|cobrar|cobrei|preco|valor|vende|venda|cliente)\W*(de|por|a|e|foi)?\s*$/.test(antes) ? 'preco' : '' };
  for (let k = 0; k < 6; k++) {
    const i1 = t.n.search(/r\$\s*\d/), i2 = t.n.search(new RegExp('\\d[\\d.,]*\\s*' + MOEDA + '\\b'));
    if (i1 < 0 && i2 < 0) break;
    const a = i1 >= 0 && (i2 < 0 || i1 <= i2) ? i1 : i2, tipo = ctx(a);
    if (a === i1) m = t.take(/r\$\s*(\d[\d.,]*)(?:\s*(?:reais|real))?(?:\s*e\s*(\d{1,2})\s*centavos?)?/);
    else m = t.take(new RegExp('(\\d[\\d.,]*)\\s*' + MOEDA + '\\b(?:\\s*e\\s*(\\d{1,2})\\s*centavos?)?'));
    if (!m) break;
    let v = toNum(m[1].replace(/[.,]$/, '')); if (m[2]) v += +m[2] / 100;
    if (isFinite(v)) out.push({ v, tipo, pos: a })
  }
  return out
}
/* número solto (sem "reais"), de preferência depois de "de/por/a/valor" */
function numeroSolto(t, ultimo) {
  const re = /\b(?:(?:de|por|a|valor|custando|custou|deu|foi|total)\s+)?(\d+(?:[.,]\d+)*)\b/g; let m, best = null;
  while ((m = re.exec(t.n))) { const v = toNum(m[1]); if (isFinite(v) && v > 0) { best = { m, v }; if (!ultimo) break } }
  if (!best) return null;
  const a = best.m.index, b = a + best.m[0].length, sp = ' '.repeat(b - a);
  t.o = t.o.slice(0, a) + sp + t.o.slice(b); t.n = t.n.slice(0, a) + sp + t.n.slice(b);
  return best.v
}

/* ---------- pagamento ---------- */
function pegaForma(t) {
  let m;
  if ((m = t.take(/\b(?:no |na |em |via |pelo |pela |de )?(?:parcelado\s+)?(?:em\s+)?(\d{1,2})\s*(?:x|vezes)(?:\s+no cartao)?\b/))) return { forma: 'Parcelado', parc: +m[1] };
  if (t.take(/\b(?:no |na |em |via |pelo |pela |de )?parcelado\b/)) return { forma: 'Parcelado' };
  if (t.take(/\b(?:no |na |em |via |pelo |pela |de )?pix\b/)) return { forma: 'PIX' };
  if (t.take(/\b(?:no |na |em |via |pelo |pela |de )?(?:dinheiro|especie|cash)\b/)) return { forma: 'Dinheiro' };
  if (t.take(/\b(?:no |na |em |via |pelo |pela |de )?(?:cartao(?: de)?(?: credito| debito)?|credito|debito|maquininha)\b/)) return { forma: 'Cartão' };
  if (t.take(/\b(?:no |na |em |via |pelo |pela |de |por )?(?:transferencia|ted|doc|deposito)\b/)) return { forma: 'Transferência' };
  return {}
}

/* ---------- O.S. falada ("O.S. 12", "ordem de serviço 12") ---------- */
const OSW = '(?:o\\s?\\.?\\s?s\\.?|ordem(?: de servico)?)';
function pegaNumOS(t) {
  const m = t.take(new RegExp('\\b(?:(?:na|da|a|pra|para a|nessa|desta|numero)\\s+)?' + OSW + '\\s*(?:numero|n|no|nº)?\\s*(\\d{1,6})\\b'));
  return m ? m[1] : ''
}
const temOS = t => t.has(new RegExp('\\b(?:na|da|a|pra|para a|nessa|essa|nesta|desta|numa|dessa)\\s+' + OSW + '(?=\\s|$)')) || t.has(/\bordem de servico\b/) || t.has(/\bo\.s\.?/);

/* ---------- clientes e veículos citados ---------- */
const STOP = new Set('de do da dos das e o a os as um uma para pra pro no na nos nas com sem seu sua carro carros moto veiculo cliente senhor senhora sr sra dona dono placa servico os ordem pelo pela ao aos lá la que ele ela'.split(' '));
const GEN = new Set('flex completo completa turbo sedan hatch total plus sport sportline cabine dupla simples automatico manual prata preto preta branco branca vermelho azul cinza'.split(' '));
const toks = s => N(s).split(/[^a-z0-9]+/).filter(x => x.length >= 3 && !STOP.has(x));
function achaEnt(words, usados, placaInfo) {
  const W = words.map((w, i) => ({ i, n: N(w).replace(/[^a-z0-9]/g, '') })).filter(x => x.n && !usados.has(x.i));
  const pos = n => W.filter(x => x.n == n).map(x => x.i), posP = n => W.filter(x => parece(x.n, n)).map(x => x.i);
  const C = (db && db.clients) || [], V = veics(), r = { cli: '', veh: '', usa: [], avisos: [] };
  /* veículo pela placa */
  if (placaInfo && placaInfo.veh) { r.veh = placaInfo.veh.id; r.cli = placaInfo.veh.cli || '' }
  /* clientes pelo nome */
  let melhor = 0, cand = [];
  C.forEach(c => {
    const t = [...new Set(toks(c.nome))]; let sc = 0, us = [];
    t.forEach((x, k) => { const p = pos(x), q = p.length ? p : posP(x); if (q.length) { sc += (k == 0 ? 1.5 : 1) * (p.length ? 1 : 0.8); us.push(...q) } });
    if (sc > melhor) { melhor = sc; cand = [{ c, us }] } else if (sc && sc == melhor) cand.push({ c, us })
  });
  /* veículos pelo modelo */
  let vm = 0, vc = [];
  V.forEach(v => {
    const t = [...new Set(toks(v.modelo).filter(x => /[a-z]/.test(x) && !GEN.has(x)))]; let sc = 0, us = [];
    t.forEach(x => { const p = pos(x); if (p.length) { sc++; us.push(...p) } });
    if (sc > vm) { vm = sc; vc = [{ v, us }] } else if (sc && sc == vm) vc.push({ v, us })
  });
  if (!r.veh) {
    let cs = cand;
    if (cs.length > 1 && vc.length) { const ids = new Set(vc.map(x => x.v.cli)); const f = cs.filter(x => ids.has(x.c.id)); if (f.length) cs = f }
    if (cs.length == 1) {
      const c = cs[0].c; r.cli = c.id; r.usa.push(...cs[0].us);
      const doCli = vc.filter(x => x.v.cli == c.id), seus = V.filter(v => v.cli == c.id);
      if (doCli.length == 1) { r.veh = doCli[0].v.id; r.usa.push(...doCli[0].us) }
      else if (seus.length == 1) { r.veh = seus[0].id; doCli.forEach(x => r.usa.push(...x.us)) }
      else if (seus.length > 1) r.avisos.push('Escolha qual veículo de ' + c.nome.split(' ')[0])
    } else if (cs.length > 1) {
      r.avisos.push(cs.length + ' clientes com nome parecido (' + cs.slice(0, 3).map(x => x.c.nome).join(', ') + '): escolha na lista'); cs.forEach(x => r.usa.push(...x.us))
    } else if (vc.length == 1) { r.veh = vc[0].v.id; r.cli = vc[0].v.cli || ''; r.usa.push(...vc[0].us) }
    else if (vc.length > 1) { r.avisos.push(vc.length + ' veículos com esse modelo: escolha o cliente'); vc.forEach(x => r.usa.push(...x.us)) }
  } else {
    /* já veio pela placa: tira das palavras o nome do dono e o modelo, se foram ditos */
    cand.filter(x => x.c.id == r.cli).forEach(x => r.usa.push(...x.us));
    vc.filter(x => x.v.id == r.veh).forEach(x => r.usa.push(...x.us))
  }
  /* "para o cliente Fulano": se não achou no cadastro, avisa com o nome dito e não deixa o nome ir para o serviço */
  for (let i = 0; i < words.length - 1; i++) {
    if (!/^(cliente|senhor|senhora|sr|sra|dona)$/.test(N(words[i]).replace(/[^a-z]/g, ''))) continue;
    const nm = []; for (let j = i + 1; j < words.length && nm.length < 2; j++) { const k = N(words[j]).replace(/[^a-z]/g, ''); if (!k || LIGA.has(k) || /^\d/.test(words[j])) break; nm.push(j) }
    if (!nm.length) continue;
    if (!r.cli && !r.avisos.some(x => /parecido|modelo/.test(x))) r.avisos.push('Cliente “' + nm.map(j => words[j].replace(/[.,!?;:]+$/, '')).join(' ') + '” não encontrado no cadastro: escolha ou cadastre');
    r.usa.push(i, ...nm); r.nomeDito = true; break
  }
  return r
}

/* ---------- descrição: o que sobrou da frase ---------- */
const LIGA = new Set('de do da dos das e o a os as no na nos nas para pra pro com pelo pela ao em um uma que pro'.split(' '));
const LIXO = new Set('esse essa isso este esta aquele aquela carro veiculo cliente placa senhor senhora sr sra dona seu sua por favor ai ae entao tipo ne beleza cobrar cobra cobrando cobrei preco valor custo custou custa total cada unidade unidades reais real'.split(' '));
function sobra(words, usados) {
  let L = words.map((w, i) => usados.has(i) ? null : w.trim()).filter(w => w && /[\p{L}\p{N}]/u.test(w)).map(w => w.replace(/[.,!?;:]+$/, ''));
  L = L.filter(w => !LIXO.has(N(w)));
  let ok = true;
  while (ok) {
    ok = false;
    while (L.length && LIGA.has(N(L[0]))) { L.shift(); ok = true }
    while (L.length && LIGA.has(N(L[L.length - 1]))) { L.pop(); ok = true }
    for (let i = 0; i < L.length - 1; i++) if (LIGA.has(N(L[i])) && LIGA.has(N(L[i + 1]))) { L.splice(i, 1); ok = true; break }
  }
  return cap(L.join(' ').replace(/\s+/g, ' ').trim())
}
const palavras = s => s.split(/\s+/).filter(Boolean);
/* palavras do texto que foram totalmente apagadas pelos recortes */
function usadosDe(t, words) {
  const u = new Set(); let p = 0, src = t.o;
  words.forEach((w, i) => { const a = src.indexOf(w, p); if (a < 0) { u.add(i); return } p = a + w.length });
  return u
}

/* ---------- categorias de despesa ---------- */
const CATK = [
  ['Aluguel', /\balugue/],
  ['Energia, água e internet', /\b(luz|energia|agua|internet|telefone|celular|enel|sabesp|cemig|copel|celpe|coelba|cosern|equatorial|cpfl|wifi)\b/],
  ['Salários e pró-labore', /\b(salario|salarios|pro[- ]?labore|funcionario|funcionarios|ajudante|vale transporte|diaria|comissao|ferias|decimo)\b/],
  ['Impostos e taxas', /\b(imposto|impostos|taxa|taxas|simples nacional|mei|inss|iss|icms|alvara|iptu|tarifa|contador|contabilidade|darf|das do)\b/],
  ['Ferramentas e equipamentos', /\b(ferramenta|ferramentas|macaco|elevador|compressor|scanner|equipamento|maquina|furadeira|parafusadeira|chave de|jogo de chave)\b/],
  ['Marketing', /\b(marketing|anuncio|anuncios|propaganda|instagram|facebook|google|panfleto|panfletos|banner|adesivo|impulsionar)\b/],
  ['Combustível e transporte', /\b(gasolina|combustivel|etanol|alcool|diesel|uber|frete|transporte|pedagio|estacionamento|onibus|motoboy|moto boy)\b/],
  ['Manutenção do espaço', /\b(manutencao da oficina|reforma|pintura|limpeza|material de limpeza|pedreiro|eletricista|encanador|lampada)\b/]
];
const catDe = s => { const n = N(s); const c = CATK.find(([, re]) => re.test(n)); return c ? c[0] : 'Outros' };

/* ---------- serviço do catálogo da agenda ---------- */
function achaSvc(desc) {
  const L = (typeof SV == 'function' ? SV() : (db && db.svcs) || []);
  const d = [...new Set(toks(desc).filter(x => x.length >= 4 && !LIXO.has(x)))]; if (!d.length) return null;
  const R = L.map(s => { const t = [...new Set(toks(s.nome))]; const hit = t.filter(x => d.some(y => parece(x, y) || (y.length >= 5 && x.length >= 5 && (y.startsWith(x.slice(0, 5)) || x.startsWith(y.slice(0, 5)))))).length; return { s, hit, sc: t.length ? hit / t.length : 0 } }).filter(x => x.hit).sort((a, b) => b.hit - a.hit || b.sc - a.sc);
  if (!R.length) return null;
  if (R.length > 1 && R[1].hit == R[0].hit && Math.abs(R[1].sc - R[0].sc) < 0.01) return { ambiguo: R.filter(x => x.hit == R[0].hit && Math.abs(x.sc - R[0].sc) < 0.01).map(x => x.s.nome) };
  return R[0].s
}

/* ---------- telas ---------- */
const TELAS = [['dash', /\b(painel|inicio|tela inicial|resumo)\b/], ['agenda', /\b(agenda|agendamentos|horarios)\b/], ['clients', /\bclientes?\b/], ['vehicles', /\bveiculos\b/], ['quotes', /\borcamentos?\b/], ['orders', /\b(ordens(?: de servico)?|o\.?s\.?|lista de os)\b/], ['stock', /\b(estoque|pecas em estoque)\b/], ['fin', /\b(financas|financeiro|caixa|lucro|faturamento)\b/], ['notas', /\b(notas|nota fiscal|notas fiscais)\b/], ['entradas', /\b(entradas|compras)\b/], ['cfg', /\b(oficina|configuracoes|configuracao|ajustes)\b/]];

/* ================= interpretar ================= */
function interpreta(frase) {
  const txt0 = semRepeticao(String(frase || '').replace(/\s+/g, ' ').trim());
  const txt = numWords(txt0), n = N(txt), R = { texto: txt0, avisos: [] };
  if (!n) return { ...R, tipo: '?' };
  const T = new Txt(txt);
  const verbo = re => re.test(n);

  const navV = /\b(abr[aei]\w*|mostr\w*|ir para|ir pra|vai para|vai pra|ver|ve|exib\w*|entra\w* (na|no|em))\b/;
  const agV = /\b(agend\w*|marc(a|ar|ou|e|ando)|reserv\w*)\b/;
  const pagV = /\b(recebi|recebe|receber|recebido|recebemos|pagou|pagaram|pagamento|quitou|quitar|deu entrada|cliente pagou)\b/;
  const despF = /\b(despesa|despesas|gasto|gastos|conta de|conta da|boleto)\b/;
  const despV = /\b(gastei|paguei|comprei|compra de|compramos|pagamos)\b/;
  const itemV = /\b(adicion\w*|coloc\w*|lanc\w*|inclu\w*|bot[ae]|poe|ponha|acrescent\w*|inser\w*)\b/;
  const placaV = /\b(placa|placas|consulta\w*|busca\w*|procur\w*|pesquis\w*|puxa\w*|acha\w*|cade|de quem e)\b/;
  const os = temOS(T) || /\b(o\.?s\.?|ordem(?: de servico)?)\s*\d/.test(n);

  /* --- telas: "abre a agenda", "agenda de hoje" --- */
  const soAgenda = /^(?:\S+\s+)?(?:a\s+|minha\s+)?agenda(?:\s+(?:de|do|da|pra|para)\s+(hoje|amanha|semana|dia))?\s*$/.test(n) || /\b(o que tem|que tem|quem vem|tenho)\b.*\b(hoje|agenda|amanha)\b/.test(n);
  if (soAgenda || (navV.test(n) && !agV.test(n.replace(/\bagenda\b/, '')) && !pagV.test(n) && !despF.test(n) && !itemV.test(n) && !/\bplaca\b/.test(n))) {
    if (soAgenda || /\bagenda\b/.test(n)) return { ...R, tipo: 'nav', tela: 'agenda', f: { ag: /amanha|semana/.test(n) ? 'prox' : /hoje|dia\b/.test(n) ? 'hoje' : 'prox' } };
    const tl = TELAS.find(([, re]) => re.test(n));
    if (tl) return { ...R, tipo: 'nav', tela: tl[0] };
  }

  /* --- placa citada --- */
  const W0 = palavras(T.o);
  let pl = achaPlaca(W0), fr = pl ? null : fragPlaca(W0), plInfo = null;
  if (pl) { const b = buscaPlaca(pl.placa); plInfo = { placa: pl.placa, L: b.L, exata: b.exata, veh: b.L.length == 1 ? b.L[0] : null } }
  else if (fr) { const L = buscaFrag(fr); plInfo = { frag: fr.frag, final: fr.final, L, exata: false, veh: L.length == 1 ? L[0] : null } }
  /* tira a placa do texto */
  const tiraPlaca = () => { if (!pl && !fr) return; const w = palavras(T.o), p = pl ? achaPlaca(w) : fragPlaca(w), usa = p ? p.idx : []; if (!usa.length) return; const re = new Set(usa); let out = [], k = 0; T.o.split(/(\s+)/).forEach(part => { if (/^\s+$/.test(part) || !part) { out.push(part); return } out.push(re.has(k) ? ' '.repeat(part.length) : part); k++ }); T.o = out.join(''); T.n = N(T.o) };

  let tipo = '';
  if (agV.test(n) && !pagV.test(n)) tipo = 'agenda';
  else if (pagV.test(n) && !despV.test(n)) tipo = 'pag';
  else if (despF.test(n) && !os) tipo = 'desp';
  else if (itemV.test(n) || (os && /\b(peca|pecas|servico|mao de obra|custo|item)\b/.test(n))) tipo = 'item';
  else if (despV.test(n)) tipo = os ? 'item' : 'desp';
  else if (plInfo && (placaV.test(n) || pl)) tipo = 'placa';
  else if (plInfo) tipo = 'placa';

  if (tipo == 'placa' || (!tipo && plInfo)) return { ...R, tipo: 'placa', ...plInfo };

  if (tipo == 'agenda') {
    T.take(/\b(?:por favor\s+)?(?:(?:me\s+)?(?:faz|faca|fazer)\s+(?:um|o)\s+)?(?:agend\w*|marc(?:a|ar|ou|e|ando)|reserv\w*)\b(?:\s+(?:um|uma|o|a)\s+(?:horario|agendamento)\b)?(?:\s+(?:para|pra|de)\b)?/);
    let data = pegaData(T, false), hora = pegaHora(T);
    if (data == 'INV') { data = ''; R.avisos.push('Data inválida: escolha a data') }
    if (hora == 'INV') { hora = ''; R.avisos.push('Hora inválida: escolha a hora') } else if (!hora) R.avisos.push('Hora não informada: confira');
    tiraPlaca();
    const W = palavras(T.o), us = new Set(), ent = achaEnt(W, us, plInfo);
    ent.usa.forEach(i => us.add(i));
    let desc = sobra(W, us).replace(/^(?:um|uma|o|a)\s+/i, '');
    if (/^(?:(?:um|uma|o|a)\s+)?(?:servico|servicos|horario|agendamento)?$/.test(N(desc).trim())) { desc = ''; R.avisos.push('Escolha o serviço') }
    let sv = achaSvc(desc);
    if (sv && sv.ambiguo) { R.avisos.push('Serviço parecido com: ' + sv.ambiguo.slice(0, 3).join(', ') + '. Escolha na lista'); sv = null; desc = '' }
    const temCat = (typeof SV == 'function' ? SV() : (db && db.svcs) || []).length > 0;
    /* sem serviço do catálogo: frase curta vira o serviço; frase longa vai para observações */
    let obsLivre = '';
    if (!sv && desc && temCat && palavras(desc).length > 4) { obsLivre = desc; desc = ''; R.avisos.push('Escolha o serviço (o que você disse foi para Observações)') }
    const extra = sv ? toks(desc).filter(x => x.length >= 4 && !LIXO.has(x) && !toks(sv.nome).some(y => parece(x, y))) : [];
    if (plInfo && !plInfo.veh) R.avisos.push(plInfo.placa ? 'Placa ' + plInfo.placa + ' não cadastrada' : 'Placa não encontrada');
    if (!ent.cli && !ent.veh && !ent.avisos.length && !ent.nomeDito) R.avisos.push('Cliente não identificado: escolha na lista');
    if (!data && !R.avisos.some(a => /Data inv/.test(a))) R.avisos.push('Data não informada: ficou hoje');
    return { ...R, tipo, avisos: [...R.avisos, ...ent.avisos], cli: ent.cli, veh: ent.veh, data: data || hoje(), hora: hora || '08:00', svc: sv ? sv.nome : desc, obs: obsLivre || (sv && extra.length >= 2 ? desc : '') }
  }

  if (tipo == 'desp') {
    T.take(/\b(?:lanc\w*|registr\w*|anot\w*|adicion\w*|coloc\w*|cadastr\w*|nova|novo)?\s*(?:uma\s+|a\s+)?(?:despesas?|gastos?)\b(?:\s+(?:de|com|do|da|no|na))?/) || T.take(/\b(?:eu\s+)?(?:gastei|paguei|comprei|pagamos|compramos)\b(?:\s+(?:o|a|um|uma))?/);
    const rec = !!T.take(/\b(?:que\s+)?(?:repete\s+)?(?:todo mes|todos os meses|mensal|mensalmente|por mes|ao mes)\b/);
    let data = pegaData(T, true); if (data == 'INV') { data = ''; R.avisos.push('Data inválida: ficou hoje') }
    const vs = pegaValores(T); let valor = vs.length ? vs[0].v : numeroSolto(T, true);
    const W = palavras(T.o), desc = sobra(W, new Set()).replace(/^(?:com|de)\s+/i, '');
    if (!valor) R.avisos.push('Valor não entendido: digite');
    return { ...R, tipo, desc: desc || 'Despesa', cat: catDe(desc + ' ' + n), valor: valor || '', data: data || hoje(), rec: rec ? '1' : '0' }
  }

  if (tipo == 'pag' || tipo == 'item') {
    const osNum = pegaNumOS(T);
    T.take(new RegExp('\\b(?:na|da|a|pra|para a|nessa|essa|nesta|desta|numa|dessa)\\s+' + OSW + '(?=\\s|$)')) || T.take(/\bordem de servico\b/);
    let data = tipo == 'pag' ? pegaData(T, true) : ''; if (data == 'INV') { data = ''; R.avisos.push('Data inválida: ficou hoje') }
    const fp = tipo == 'pag' ? pegaForma(T) : {};
    if (tipo == 'pag') T.take(/\b(?:eu\s+)?(?:recebi|recebe|receber|recebido|recebemos|registr\w*|lanc\w*)?\s*(?:o\s+|um\s+)?(?:pagamento|pagou|pagaram|quitou|quitar|deu entrada)?\b(?:\s+(?:de|do|da))?/);
    else T.take(/\b(?:adicion\w*|coloc\w*|lanc\w*|inclu\w*|bot[ae]|poe|ponha|acrescent\w*|inser\w*)\b/);
    const vs = pegaValores(T);
    let q = 1, v = '', custo = '';
    if (tipo == 'item') {
      let m = T.take(/\b(\d{1,3})\s*x\s*(\d[\d.,]*)\b/);
      if (m) { q = +m[1]; v = toNum(m[2]) }
      else if ((m = T.take(/\b(\d{1,3})\s+(?:unidades?\s+(?:de\s+)?|pecas?\s+(?:de\s+)?|litros?\s+(?:de\s+)?|jogos?\s+(?:de\s+)?)?(?=[a-z])/)) && !/^(h|hs|horas?)\b/.test(T.n.slice(m.index + m[0].length))) q = +m[1] || 1;
      vs.forEach(x => { if (x.tipo == 'custo') custo = x.v; else if (v === '') v = x.v });
      if (v === '' && custo === '') { const s = numeroSolto(T, true); if (s) v = s }
      if (v === '' && custo !== '' && !/\bcusto\b/.test(n)) { v = custo; custo = '' }
    } else { if (vs.length) v = vs[0].v; else { const s = numeroSolto(T, true); if (s) v = s } }
    const n2 = n.replace(/\bordem de servico\b/g, ' '), tiTipo = /\bmao de obra\b/.test(n2) ? 'Mão de obra' : /\bservico\b/.test(n2) && !/\bpecas?\b/.test(n2) ? 'Serviço' : 'Peça';
    if (tipo == 'item') T.take(/\b(?:(?:de|uma?|o|a)\s+)?(?:mao de obra|peca|pecas|servico|item|custo)(?:\s+de)?\b/);
    tiraPlaca();
    const W = palavras(T.o), us = new Set(), ent = achaEnt(W, us, plInfo); ent.usa.forEach(i => us.add(i));
    const desc = sobra(W, us);
    /* qual O.S. */
    const O = (db && db.orders) || [], fim = o => ['Concluída', 'Entregue'].includes(o.status), deve = o => (typeof oTot == 'function' ? oTot(o) - paid(o) : 1) > 0.005;
    let o = null, aviso = '';
    if (osNum) { o = O.find(x => +x.num == +osNum); if (!o) aviso = 'O.S. ' + osNum + ' não encontrada' }
    if (!o && (ent.veh || ent.cli)) {
      let L = O.filter(x => ent.veh ? x.veh == ent.veh : x.cli == ent.cli);
      const ab = L.filter(x => tipo == 'pag' ? deve(x) : !fim(x));
      L = ab.length ? ab : (tipo == 'pag' ? [] : []);
      if (L.length) o = L.slice().sort((a, b) => String(b.aberta || '').localeCompare(String(a.aberta || '')) || (+b.num - +a.num))[0];
      else aviso = tipo == 'pag' ? 'Nenhuma O.S. com valor a receber para esse cliente/veículo' : 'Esse veículo não tem O.S. aberta';
    }
    if (!o && !osNum && !ent.veh && !ent.cli && S && S.v == 'order' && S.id) o = O.find(x => x.id == S.id) || null;
    if (!o && !aviso) aviso = 'Diga o número da O.S. ou a placa do carro';
    const base = { ...R, tipo, os: o ? o.id : '', osAviso: aviso, avisos: [...R.avisos, ...ent.avisos] };
    if (tipo == 'pag') { if (!v) base.avisos.push('Valor não dito: ficou o restante da O.S.'); return { ...base, valor: v, data: data || hoje(), ...fp } }
    if (v === '') base.avisos.push('Valor não entendido: digite');
    return { ...base, t: tiTipo, d: desc || (tiTipo == 'Mão de obra' ? 'Mão de obra' : ''), q, v, custo }
  }

  /* --- telas sem verbo --- */
  const tl = TELAS.find(([, re]) => re.test(n));
  if (tl && palavras(n).length <= 3) return { ...R, tipo: 'nav', tela: tl[0] };
  /* --- nome de cliente sozinho --- */
  const W = palavras(T.o), ent = achaEnt(W, new Set(), null);
  if (ent.veh) return { ...R, tipo: 'placa', L: [veics().find(v => v.id == ent.veh)], exata: true };
  if (ent.cli) return { ...R, tipo: 'cliente', cli: ent.cli };
  return { ...R, tipo: '?' }
}

/* ================= tela ================= */
const UI = typeof document != 'undefined';
const esc = s => (typeof e == 'function' ? e(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const SR = UI && (window.SpeechRecognition || window.webkitSpeechRecognition);
const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/></svg>';
const EX = ['Agenda revisão do Onix do Carlos quinta às 14h', 'Placa QRT4B21', 'Despesa de 350 reais de conta de luz', 'Adiciona 2 velas de 45 reais na O.S. 12', 'Recebi 500 no pix da O.S. do Carlos', 'Abre a agenda de hoje'];
let segura = false, errVoz = '', rec = null, ouvindo = false, fimV = true, acum = '', sess = '', inter = '', tmr = 0, t0 = 0, ouviu = false;
/* quanto tempo de silêncio espera antes de enviar (o usuário escolhe) */
const PAUSAS = [2000, 3000, 5000];
const lsG = k => { try { return localStorage.getItem(k) } catch (x) { return null } };
const lsS = (k, v) => { try { localStorage.setItem(k, v) } catch (x) { } };
let PAUSA = +lsG('vz_pausa') || 3000; if (!PAUSAS.includes(PAUSA)) PAUSA = 3000;

function css() {
  if (document.getElementById('vzcss')) return;
  const s = document.createElement('style'); s.id = 'vzcss';
  s.textContent = `#vzfab{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:18;width:58px;height:58px;border-radius:50%;border:0;padding:0;background:var(--hi);color:#15212B;box-shadow:0 6px 18px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;cursor:pointer;margin:0}
#vzfab svg,.vzm svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}
#vzfab{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;transition:transform .15s,background .15s}
#vzfab:active{transform:scale(.94)}
#vz.hold~#vzfab{display:flex!important;z-index:41;transform:scale(1.35);animation:vzp 1.3s ease-in-out infinite}
#vz.hold~#vzfab.cancel{background:#B4472E;color:#fff;animation:none}
.vzh{position:fixed;left:0;right:0;bottom:0;z-index:40;pointer-events:none;padding:0 12px calc(100px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;background:linear-gradient(transparent,rgba(0,0,0,.45) 45%)}
.vzhc{pointer-events:none;background:var(--sf);color:var(--ink);width:100%;max-width:520px;border-radius:16px;padding:12px 14px;box-shadow:0 8px 28px rgba(0,0,0,.35)}
.vzhs{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px}.vzhs:before{content:"";width:10px;height:10px;border-radius:50%;background:#E5484D;animation:vzb 1s infinite}
@keyframes vzb{50%{opacity:.25}}
.vzhc .vzo{margin:8px 0;min-height:44px;font-size:16px}
.vzhd{font-size:13px;color:var(--mut);display:flex;justify-content:space-between;gap:8px}
.vzh.cancel .vzhd{color:#B4472E;font-weight:600}
.vzdica{font-size:12.5px;color:var(--mut);margin:-4px 0 10px}
#modal:not(:empty)~#vzfab,#vz:not(:empty)~#vzfab{display:none}
body:has(#nav[style*="none"]) #vzfab{display:none}
#vz .ov{align-items:flex-end;padding:0}
#vz .sh{background:var(--sf);color:var(--ink);width:100%;max-width:560px;border-radius:16px 16px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom,0px));max-height:88vh;overflow:auto}
.vzt{display:flex;align-items:center;gap:12px}.vzt h2{margin:0;font-size:22px;flex:1}
.vzm{width:64px;height:64px;border-radius:50%;border:0;background:var(--hi);color:#15212B;display:flex;align-items:center;justify-content:center;flex:none;margin:0;padding:0;cursor:pointer}
.vzm.on{animation:vzp 1.3s ease-in-out infinite}
@keyframes vzp{0%,100%{box-shadow:0 0 0 0 rgba(245,183,0,.55)}50%{box-shadow:0 0 0 14px rgba(245,183,0,0)}}
.vzo{min-height:52px;margin:12px 0;padding:10px 12px;border-radius:10px;background:var(--bg);font-size:17px;line-height:1.35}.vzo i{color:var(--mut)}
.vzf{display:flex;gap:8px}.vzf input{margin:0;flex:1}.vzf button{margin:0}
.vzx{margin-top:12px}.vzx small{display:block;color:var(--mut);margin-bottom:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.vzx button{display:block;width:100%;text-align:left;margin:0 0 6px;font-weight:500;border-radius:8px;padding:9px 11px}
.vzb{display:flex;gap:8px;align-items:flex-start;background:color-mix(in srgb,var(--hi) 14%,var(--sf));border:1px solid color-mix(in srgb,var(--hi) 45%,var(--ln));border-radius:9px;padding:8px 10px;margin:-4px 0 12px;font-size:13.5px}
.vzb svg{width:17px;height:17px;flex:none;margin-top:1px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.vzb b{font-weight:600}.vzb ul{margin:4px 0 0;padding-left:18px;color:#B4472E}
.vzv{border:1px solid var(--ln);border-left:4px solid var(--c,var(--hi));border-radius:10px;padding:10px 12px;margin:0 0 10px}
.vzv .pl{font:600 13px ui-monospace,Menlo,monospace;padding:3px 8px;border-radius:6px;background:#15212B;color:#F5B700;display:inline-block}
.vzv h3{margin:6px 0 2px;font-size:20px}.vzv p{margin:3px 0;font-size:14px}.vzv .muted{font-size:13px}
.vzv .bar{margin:10px 0 0}.vzv .bar button{margin:0}
.vzok{margin:0;flex:none}
.vzp{display:flex;align-items:center;gap:6px;margin:0 0 10px;font-size:13px;color:var(--mut)}.vzp button{margin:0;padding:5px 10px;font-size:13px;border-radius:99px}.vzp button.on{background:var(--hi);color:#15212B;border-color:var(--hi)}
.vzbar{height:4px;border-radius:2px;background:var(--ln);overflow:hidden;margin:-6px 0 12px}.vzbar i{display:block;height:100%;width:0;background:var(--hi)}`;
  document.head.appendChild(s)
}
function monta() {
  css();
  if (!document.getElementById('vz')) { const d = document.createElement('div'); d.id = 'vz'; document.body.appendChild(d) }
  if (!document.getElementById('vzfab')) {
    const b = document.createElement('button'); b.id = 'vzfab'; b.type = 'button'; b.setAttribute('aria-label', 'Assistente de voz: toque para abrir, segure para falar'); b.innerHTML = MIC;
    document.body.appendChild(b); botaoSegurar(b)
  }
}
/* Segurar para falar (como no WhatsApp): segura = grava, solta = envia, arrasta para fora = cancela.
   Toque rápido abre o painel completo. */
const vibra = ms => { try { navigator.vibrate && navigator.vibrate(ms) } catch (x) { } };
const logado = () => typeof SES != 'undefined' && !!SES;
function botaoSegurar(b) {
  let pd = null, tm = 0, hold = false, canc = false;
  const z = () => document.getElementById('vz');
  b.addEventListener('contextmenu', ev => ev.preventDefault());
  b.addEventListener('pointerdown', ev => {
    if (ev.button > 0) return; ev.preventDefault();
    pd = { x: ev.clientX, y: ev.clientY }; hold = false; canc = false;
    try { b.setPointerCapture(ev.pointerId) } catch (x) { }
    clearTimeout(tm); tm = setTimeout(() => { if (!pd) return; hold = true; comecaSegurar() }, 250)
  });
  b.addEventListener('pointermove', ev => {
    if (!pd || !hold) return;
    const c = (pd.x - ev.clientX) > 80 || (pd.y - ev.clientY) > 120;
    if (c != canc) { canc = c; b.classList.toggle('cancel', c); const h = document.querySelector('.vzh'); if (h) h.classList.toggle('cancel', c); const d = document.getElementById('vzhd'); if (d) d.innerHTML = c ? '<span>Solte para cancelar</span>' : '<span>‹ Arraste para cancelar</span><span>Solte para enviar</span>'; if (c) vibra(15) }
  });
  const fim = cancelou => { clearTimeout(tm); if (!pd) return; pd = null; b.classList.remove('cancel'); if (hold) { hold = false; terminaSegurar(cancelou || canc) } else if (!cancelou) abre() };
  b.addEventListener('pointerup', () => fim(false));
  b.addEventListener('pointercancel', () => fim(true));
  b.addEventListener('lostpointercapture', () => { if (pd && hold) fim(false) });
  b.addEventListener('click', ev => { if (ev.detail === 0) abre() }) /* teclado */
}
function comecaSegurar() {
  if (!logado()) return toast && toast('Entre na sua conta primeiro');
  if (!SR) { toast && toast('Segurar para falar precisa do Chrome no Android'); return abre() }
  const z = document.getElementById('vz'); z.classList.add('hold'); errVoz = '';
  z.innerHTML = `<div class="vzh"><div class="vzhc" role="status"><div class="vzhs" id="vzst">Ouvindo...</div><div class="vzo" id="vzout"><i>Pode falar...</i></div><div class="vzhd" id="vzhd"><span>‹ Arraste para cancelar</span><span>Solte para enviar</span></div></div></div>`;
  vibra(25); segura = true; ouve()
}
function terminaSegurar(cancelou) {
  segura = false;
  if (cancelou) { para(); fecha(); vibra([10, 40, 10]); toast && toast('Cancelado'); return }
  st('Enviando...'); vibra(15);
  /* espera um instante para o Chrome entregar as últimas palavras */
  setTimeout(() => {
    const t = tudo(), e = errVoz; para();
    if (t) { fecha(); roda(t); return }
    fecha();
    if (e) { abre(true); st(e == 'perm' ? 'Permita o microfone' : 'Toque e fale de novo'); if (e == 'perm') out('<i>Libere o microfone para este site: toque no cadeado ao lado do endereço &gt; Permissões &gt; Microfone.</i>') }
    else toast && toast('Não ouvi nada. Segure o botão enquanto fala')
  }, 600)
}
function fecha() { para(); segura = false; const z = document.getElementById('vz'); if (z) { z.innerHTML = ''; z.classList.remove('hold') } const b = document.getElementById('vzfab'); if (b) b.classList.remove('cancel') }
function abre(semOuvir) {
  if (!logado()) return toast && toast('Entre na sua conta primeiro');
  const z = document.getElementById('vz'); z.classList.remove('hold');
  z.innerHTML = `<div class="ov" onclick="if(event.target===this)VZ.fecha()"><div class="sh" role="dialog" aria-label="Assistente de voz">
  <div class="vzt"><button type="button" class="vzm" id="vzmic" aria-label="Falar">${MIC}</button><h2 id="vzst">${SR ? 'Toque e fale' : 'Digite o comando'}</h2><button type="button" class="pr vzok" id="vzok" style="display:none" onclick="VZ.pronto()">Pronto</button><button type="button" class="sm" onclick="VZ.fecha()">Fechar</button></div>
  <div class="vzo" id="vzout"><i>${SR ? 'Ex.: “agenda troca de óleo do Gol do João amanhã às 9h”' : 'Este navegador não tem reconhecimento de voz. Use o Chrome no Android, ou digite abaixo.'}</i></div>
  ${SR ? `<div class="vzbar"><i id="vzbarra"></i></div><div class="vzp">Enviar depois de ${PAUSAS.map(p => `<button type="button" class="sm${p == PAUSA ? ' on' : ''}" onclick="VZ.pausa(${p},this)">${p / 1000} s</button>`).join('')} de silêncio</div>` : ''}
  <form class="vzf" onsubmit="event.preventDefault();VZ.roda(this.q.value)"><input name="q" id="vzq" placeholder="Ou digite aqui..." autocomplete="off"><button class="pr">OK</button></form>
  ${SR ? '<div class="vzdica">Dica: no botão amarelo, segure enquanto fala e solte para enviar (como no WhatsApp).</div>' : ''}<div class="vzx"><small>Exemplos (toque para testar)</small>${EX.map(x => `<button type="button" onclick="VZ.roda(this.textContent)">${esc(x)}</button>`).join('')}</div></div></div>`;
  document.getElementById('vzmic').onclick = () => ouvindo ? pronto() : ouve();
  if (SR && semOuvir !== true) ouve()
}
function st(t) { const x = document.getElementById('vzst'); if (x) x.textContent = t }
function out(h) { const x = document.getElementById('vzout'); if (x) x.innerHTML = h }
/* Escuta contínua: junta tudo o que for falado e só envia depois de PAUSA ms de silêncio
   (ou ao tocar em Pronto). Se o Chrome encerrar sozinho numa pausa, volta a ouvir. */
function junta2(a, b) {
  if (!a) return b; if (!b) return a;
  if (N(b).startsWith(N(a))) return b; if (N(a).endsWith(N(b)) || N(a).includes(N(b))) return a;
  const A = a.split(/\s+/), B = b.split(/\s+/), k = x => N(x).replace(/[^a-z0-9]/g, '');
  /* o fim de a repete o começo de b (com uma palavra ouvida diferente)? */
  for (let n = Math.min(A.length, B.length, 8); n >= 2; n--) { let dif = 0; for (let j = 0; j < n; j++) if (!parece(k(A[A.length - n + j]), k(B[j]))) dif++; if (dif <= (n >= 3 ? 1 : 0)) return A.concat(B.slice(n)).join(' ') }
  return a + ' ' + b
}
const junta = (...p) => p.map(x => String(x || '').trim()).filter(Boolean).reduce(junta2, '');
const tudo = () => junta(acum, sess, inter);
function mic(on) { const m = document.getElementById('vzmic'); if (m) m.classList.toggle('on', on); const k = document.getElementById('vzok'); if (k) k.style.display = on && tudo() ? '' : 'none' }
function barra(ms) { const b = document.getElementById('vzbarra'); if (!b) return; b.style.transition = 'none'; b.style.width = '0'; if (ms) { void b.offsetWidth; b.style.transition = 'width ' + ms + 'ms linear'; b.style.width = '100%' } }
function arma(ms) { clearTimeout(tmr); if (segura) return; tmr = setTimeout(() => ouviu ? pronto() : semFala(), ms); barra(ouviu ? ms : 0) }
function semFala() { fimV = true; parar(); mic(false); st('Não ouvi nada. Toque e fale') }
function mostra() { const t = junta(acum, sess); out(t || inter ? esc(t) + (inter ? ' <i>' + esc(inter) + '</i>' : '') : '<i>Pode falar...</i>'); mic(true) }
function ouve() {
  if (!SR) return;
  acum = sess = inter = ''; ouviu = false; fimV = false; t0 = Date.now();
  st('Ouvindo...'); out('<i>Pode falar...</i>'); arma(8000); inicia()
}
function inicia() {
  if (fimV) return;
  let r; try { r = new SR() } catch (x) { fimV = true; return st('Microfone indisponível') }
  rec = r; r.__t = Date.now(); r.lang = 'pt-BR'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
  r.onstart = () => { ouvindo = true; mic(true) };
  r.onresult = ev => {
    if (rec !== r || fimV) return;
    const fins = []; let tmp = '';
    for (let i = 0; i < ev.results.length; i++) {
      const x = ev.results[i], tx = String(x[0].transcript || '').trim(); if (!tx) continue;
      if (x.isFinal) fins.push(tx) /* junta() remove repetições do Android */
      else tmp += ' ' + tx
    }
    sess = junta(...fins); inter = tmp.trim();
    if (inter && sess && N(inter).startsWith(N(sess))) inter = inter.slice(sess.length).trim();
    if (sess || inter) ouviu = true;
    mostra(); arma(PAUSA)
  };
  r.onerror = ev => {
    if (rec !== r) return;
    if (ev.error == 'no-speech' || ev.error == 'aborted') return; /* segue ouvindo; onend reinicia */
    errVoz = ev.error == 'not-allowed' || ev.error == 'service-not-allowed' ? 'perm' : ev.error;
    fimV = true; clearTimeout(tmr); barra(0); ouvindo = false; mic(false);
    st(ev.error == 'not-allowed' || ev.error == 'service-not-allowed' ? 'Permita o microfone' : ev.error == 'network' ? 'Sem internet para a voz. Digite abaixo' : ev.error == 'audio-capture' ? 'Microfone ocupado ou ausente' : 'Toque e fale de novo');
    if (ev.error == 'not-allowed' || ev.error == 'service-not-allowed') out('<i>Libere o microfone para este site: toque no cadeado ao lado do endereço &gt; Permissões &gt; Microfone.</i>');
    else if (tudo()) { const q = document.getElementById('vzq'); if (q) q.value = tudo() }
  };
  r.onend = () => {
    if (rec !== r) return;
    ouvindo = false; acum = junta(acum, sess, inter); sess = inter = '';
    if (fimV) return;
    if (Date.now() - t0 > 60000) return segura ? undefined : pronto(); /* limite de 1 minuto por comando */
    setTimeout(inicia, Date.now() - r.__t < 1500 ? 600 : 120) /* o Chrome encerrou numa pausa: volta a ouvir sem perder o que já foi dito */
  };
  try { r.start() } catch (x) { setTimeout(() => { if (!fimV && rec === r) inicia() }, 300) }
}
function parar() { clearTimeout(tmr); barra(0); const r = rec; rec = null; ouvindo = false; try { r && r.abort() } catch (x) { } }
function pronto() { if (fimV && !tudo()) return; fimV = true; const t = tudo(); parar(); mic(false); if (t) roda(t); else st('Toque e fale') }
function para() { fimV = true; parar() }
function pausa(ms, b) { PAUSA = ms; lsS('vz_pausa', ms); document.querySelectorAll('.vzp button').forEach(x => x.classList.toggle('on', x === b)); if (ouvindo && ouviu) arma(PAUSA) }

/* fala uma resposta curta (útil com as mãos sujas) */
function diz(t) { try { if (!window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; u.rate = 1.05; speechSynthesis.speak(u) } catch (x) { } }

function faixa(r) {
  const f = document.querySelector('#modal form'); if (!f) return;
  const av = (r.avisos || []).filter(Boolean);
  const h = f.querySelector('h2');
  (h || f).insertAdjacentHTML(h ? 'afterend' : 'afterbegin', `<div class="vzb">${MIC}<div><b>Você disse:</b> “${esc(r.texto)}”${r.info ? '<br>' + r.info : ''}<br><span class="muted">Confira e toque em Salvar.</span>${av.length ? '<ul>' + av.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : ''}</div></div>`)
}

function roda(frase) {
  frase = String(frase || '').trim(); if (!frase) return;
  para();
  let r; try { r = interpreta(frase) } catch (x) { r = { tipo: '?', texto: frase } }
  G.VZ.ultimo = r;
  if (r.tipo == '?') { if (!document.getElementById('vzq')) abre(true); st('Não entendi'); out(`“${esc(frase)}”<br><i>Tente começar com: agenda, placa, despesa, adiciona, recebi ou abre.</i>`); const q = document.getElementById('vzq'); if (q) q.value = frase; return }
  fecha();
  executa(r)
}

function executa(r) {
  switch (r.tipo) {
    case 'nav': go(r.tela, 0, 0, r.f || {}); return;
    case 'cliente': go('clients', 0, 0, { q: (cl(r.cli).nome || '') }); return;
    case 'agenda':
      if (S.v != 'agenda') go('agenda');
      editAg(null, { cli: r.cli || '', veh: r.veh || '', data: r.data, hora: r.hora, svc: r.svc || '', obs: r.obs || '', status: 'Agendado' });
      faixa(r); return;
    case 'desp':
      if (!DONO()) { toast('Apenas o dono lança despesas'); return }
      if (S.v != 'fin') go('fin');
      editDesp(null, { desc: r.desc, cat: r.cat, valor: r.valor, data: r.data, rec: r.rec });
      faixa(r); return;
    case 'item': case 'pag': {
      const o = r.os && od(r.os);
      if (!o) { toast(r.osAviso || 'O.S. não encontrada'); diz(r.osAviso || 'Não achei a ordem de serviço'); if (r.veh || (r.L && r.L.length)) return mostraPlaca({ L: r.L || [vh(r.veh)], exata: true }); return }
      go('order', o.id, r.tipo == 'pag' ? 'pag' : 'resumo');
      if (r.tipo == 'pag') addPag({ ...(r.valor ? { valor: r.valor } : {}), data: r.data, ...(r.forma ? { forma: r.forma } : {}), ...(r.parc ? { parc: r.parc } : {}) });
      else addItem(o, { t: r.t, d: r.d, q: r.q, v: r.v, ...(r.custo !== '' ? { custo: r.custo } : {}) });
      r.info = '<b>O.S. ' + esc(o.num) + '</b> · ' + esc(vlabel(vh(o.veh)) || '') + ' · ' + esc(cl(o.cli).nome || '');
      faixa(r); return
    }
    case 'placa': mostraPlaca(r); return
  }
}

/* ---------- ficha rápida do veículo ---------- */
function cartao(v) {
  const c = cl(v.cli), O = db.orders.filter(o => o.veh == v.id).sort((a, b) => (+b.num || 0) - (+a.num || 0)), ab = O.find(o => !['Concluída', 'Entregue'].includes(o.status)), ult = O[0];
  const H = hoje(), prox = (db.appts || []).filter(a => a.veh == v.id && a.data >= H && a.status != 'Cancelado').sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))[0];
  const deve = O.reduce((s, o) => s + Math.max(0, oTot(o) - paid(o)), 0), cor = ab ? (SC && SC[ab.status]) || 'var(--hi)' : 'var(--ln)';
  return `<div class="vzv" style="--c:${cor}"><span class="pl">${esc(v.placa || 'Sem placa')}</span><h3>${esc(v.modelo || 'Modelo não informado')}${v.ano ? ` <span class="muted">${esc(v.ano)}</span>` : ''}</h3>
  <p><b>${esc(c.nome || 'Sem cliente')}</b>${c.tel ? ' · ' + esc(c.tel) : ''}</p>
  ${[v.cor, v.km && v.km + ' km', v.motor].filter(Boolean).length ? `<p class="muted">${[v.cor, v.km && v.km + ' km', v.motor].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
  ${ab ? `<p>O.S. aberta <b>${esc(ab.num)}</b> · ${pill ? pill(ab.status) : esc(ab.status)} · ${R(oTot(ab))}</p>` : ult ? `<p class="muted">Último serviço: O.S. ${esc(ult.num)}${ult.aberta ? ' em ' + D(ult.aberta) : ''}</p>` : '<p class="muted">Nenhuma O.S. ainda</p>'}
  ${deve > 0.005 ? `<p style="color:#B4472E"><b>A receber: ${R(deve)}</b></p>` : ''}
  ${prox ? `<p class="muted">Próximo horário: ${D(prox.data)} às ${esc(prox.hora)}${prox.svc ? ' · ' + esc(prox.svc) : ''}</p>` : ''}
  <div class="bar">${ab ? `<button class="pr sm" onclick="closeM();go('order','${ab.id}')">Abrir O.S. ${esc(ab.num)}</button>` : ''}<button class="sm" onclick="closeM();go('orders',0,0,{vei:'${v.id}'})">Histórico</button><button class="sm" onclick="closeM();editAg(null,{cli:'${v.cli || ''}',veh:'${v.id}'})">Agendar</button>${c.tel ? `<button class="sm wa" onclick="wa(cl('${v.cli}').tel,'Olá, '+cl('${v.cli}').nome.split(' ')[0]+'! ')">WhatsApp</button>` : ''}<button class="sm" onclick="closeM();editVeh('${v.id}')">Editar</button></div></div>`
}
function falaVeh(v) {
  const c = cl(v.cli), ab = db.orders.find(o => o.veh == v.id && !['Concluída', 'Entregue'].includes(o.status));
  diz([v.modelo || 'Veículo', c.nome ? 'de ' + c.nome : '', ab ? '. Ordem de serviço ' + (+ab.num) + ', ' + ab.status : ''].join(' '))
}
function mostraPlaca(r) {
  const L = (r.L || []).filter(Boolean), alvo = r.placa || r.frag || '';
  let h;
  if (!L.length) {
    h = `<h2 style="margin-top:0">Placa ${esc(alvo)}</h2><p>Não encontrei esse veículo no cadastro.</p>${r.texto ? `<p class="muted">Você disse: “${esc(r.texto)}”</p>` : ''}
    <div class="bar"><button type="button" onclick="closeM()">Fechar</button><span class="sp"></span>${r.placa ? `<button type="button" class="pr" onclick="closeM();editVeh(null,null,{placa:'${esc(r.placa)}'})">Cadastrar veículo</button>` : ''}</div>`;
    diz('Placa não encontrada')
  } else {
    const tit = L.length == 1 ? (r.exata ? 'Veículo encontrado' : 'Você quis dizer?') : L.length + ' veículos com “' + esc(alvo) + '”';
    h = `<h2 style="margin-top:0">${tit}</h2>${L.slice(0, 8).map(cartao).join('')}<div class="bar"><span class="sp"></span><button type="button" onclick="closeM()">Fechar</button></div>`;
    if (L.length == 1) falaVeh(L[0]); else diz(L.length + ' veículos encontrados')
  }
  document.getElementById('modal').innerHTML = `<div class="ov" onclick="if(event.target===this)closeM()"><div class="md">${h}</div></div>`
}

G.VZ = { interpreta, numWords, achaPlaca, canon, roda, fecha, abre, executa, mostraPlaca, pronto, pausa };
if (UI) { if (document.readyState == 'loading') document.addEventListener('DOMContentLoaded', monta); else monta();
  document.addEventListener('keydown', ev => { if (ev.key == 'Escape' && document.getElementById('vz') && document.getElementById('vz').innerHTML) fecha() }) }
})(typeof window != 'undefined' ? window : globalThis);
