import { h, clear, $, get, post, put, del, api, toast, dialog } from './dom.js';

const S = { user: null, users: [], currency: 'EUR', month: new Date().toISOString().slice(0, 7), tab: 'dash', accounts: [], categories: [] };
const root = () => document.getElementById('root');
const fmt = (n) => new Intl.NumberFormat('sl-SI', { style: 'currency', currency: S.currency }).format(Number(n || 0));
const fmtS = (n) => (n >= 0 ? '+' : '') + fmt(n);
const monthName = (ym) => { const [y, m] = ym.split('-'); return new Date(y, m - 1, 1).toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' }); };
const userById = (id) => S.users.find(u => u.id === id);

async function boot() {
  try { const me = await get('auth/me'); S.user = me.user; S.users = me.users || []; S.currency = me.currency || 'EUR'; } catch (e) { S.user = null; }
  if (!S.user) return renderLogin();
  await loadLookups();
  renderShell();
  route();
}
async function loadLookups() {
  try { S.accounts = (await get('accounts')).accounts; S.categories = (await get('categories')).categories; } catch (e) {}
}

// ───────── prijava ─────────
function renderLogin() {
  const err = h('div', { class: 'err' });
  const uI = h('input', { placeholder: 'uporabniško ime', autocomplete: 'username' });
  const pI = h('input', { type: 'password', placeholder: 'geslo', autocomplete: 'current-password' });
  const btn = h('button', { class: 'btn primary', style: 'width:100%' }, 'Prijava');
  async function submit() { err.textContent = ''; btn.disabled = true; try { await post('auth/login', { username: uI.value.trim(), password: pI.value }); location.reload(); } catch (e) { err.textContent = e.message; btn.disabled = false; } }
  btn.addEventListener('click', submit);
  [uI, pI].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
  clear(root(), h('div', { class: 'login' }, h('div', { class: 'card' },
    h('div', { class: 'brand' }, h('span', { class: 'dot' }, '€'), 'Blagajna'),
    h('p', { class: 'muted', style: 'margin:6px 0 20px' }, 'Domače finance'),
    h('label', { class: 'f' }, h('span', {}, 'Uporabnik'), uI),
    h('label', { class: 'f' }, h('span', {}, 'Geslo'), pI), err, btn)));
  setTimeout(() => uI.focus(), 50);
}

// ───────── ogrodje ─────────
function renderShell() {
  clear(root(),
    h('div', { class: 'app' },
      h('div', { class: 'top' },
        h('div', { class: 'brand' }, h('span', { class: 'dot' }, '€'), 'Blagajna'),
        h('div', { class: 'spacer' }),
        monthSelector()),
      h('div', { id: 'view' })),
    h('button', { class: 'fab', title: 'Nov vnos', onclick: () => txDialog() }, '+'),
    navBar());
}
function monthSelector() {
  const shift = (d) => { const [y, m] = S.month.split('-').map(Number); const nd = new Date(y, m - 1 + d, 1); S.month = nd.toISOString().slice(0, 7); route(); };
  return h('div', { class: 'msel' },
    h('button', { onclick: () => shift(-1) }, '‹'),
    h('span', { class: 'lbl' }, monthName(S.month)),
    h('button', { onclick: () => shift(1) }, '›'));
}
function navBar() {
  const items = [['dash', '🏠', 'Pregled'], ['tx', '📄', 'Promet'], ['goals', '🎯', 'Cilji'], ['more', '⋯', 'Več']];
  return h('nav', { class: 'nav' }, items.map(([k, ic, l]) =>
    h('a', { class: S.tab === k ? 'on' : '', href: 'javascript:void 0', onclick: () => { S.tab = k; route(); } }, h('span', { class: 'ic' }, ic), l)));
}

function route() {
  if (!S.user) return;
  const v = $('#view'); if (!v) return renderShell();
  document.querySelectorAll('.nav a').forEach((a, i) => a.classList.toggle('on', ['dash', 'tx', 'goals', 'more'][i] === S.tab));
  const sel = $('.msel'); if (sel) sel.querySelector('.lbl').textContent = monthName(S.month);
  if (S.tab === 'dash') viewDash();
  else if (S.tab === 'tx') viewTx();
  else if (S.tab === 'goals') viewGoals();
  else viewMore();
}
const view = (...n) => clear($('#view'), ...n);

// ───────── pregled ─────────
async function viewDash() {
  view(h('p', { class: 'muted' }, 'Nalagam …'));
  const s = await get('summary?month=' + S.month);
  S.accounts = s.accounts.map(a => ({ ...a }));
  const hero = h('div', { class: 'hero' },
    h('div', { class: 'card' }, h('div', { class: 'l' }, 'Skupno stanje'), h('div', { class: 'big mono' }, fmt(s.totalBalance)),
      h('div', { class: 'sub muted' }, 'varčevanje: ' + fmt(s.savings))),
    h('div', { class: 'card' }, h('div', { class: 'l' }, 'Prihodki ' + S.month.slice(5)), h('div', { class: 'big mono pos' }, fmt(s.income))),
    h('div', { class: 'card' }, h('div', { class: 'l' }, 'Odhodki'), h('div', { class: 'big mono neg' }, fmt(s.expense)),
      h('div', { class: 'sub ' + (s.net >= 0 ? 'pos' : 'neg') }, 'saldo ' + fmtS(s.net))));

  const accs = h('div', { class: 'accs' }, s.accounts.map(a => h('div', { class: 'acc', style: `--c:${a.color}`, onclick: () => { S.tab = 'tx'; S.filterAccount = a.id; route(); } },
    h('div', { class: 'n' }, a.name), h('div', { class: 'b mono' }, fmt(a.balance)), h('div', { class: 'k' }, kindLabel(a.kind)))));

  view(hero, accs, barsPanel(s.series), categoryPanel(s.byCategory, s.expense), personPanel(s.byPerson), recentPanel());
}
function kindLabel(k) { return { shared: 'skupni', personal: 'osebni', savings: 'varčevanje', cash: 'gotovina' }[k] || k; }

function barsPanel(series) {
  const max = Math.max(1, ...series.map(s => Math.max(s.income, s.expense)));
  return h('div', { class: 'panel' }, h('h2', {}, 'Zadnjih 6 mesecev', h('span', { class: 'spacer' }),
    h('span', { class: 'pill' }, '🟢 prihodki  🔴 odhodki')),
    h('div', { class: 'body' }, h('div', { class: 'bars' }, series.map(s => h('div', { class: 'bar' },
      h('div', { class: 'col' }, h('i', { class: 'in', style: `height:${(s.income / max * 100).toFixed(0)}%` }), h('i', { class: 'ex', style: `height:${(s.expense / max * 100).toFixed(0)}%` })),
      h('div', { class: 'm' }, s.ym.slice(5)))))));
}
function categoryPanel(byCat, total) {
  if (!byCat.length) return h('div', { class: 'panel' }, h('h2', {}, 'Po kategorijah'), h('div', { class: 'empty' }, 'Ni odhodkov v tem mesecu.'));
  const max = byCat[0].total || 1;
  return h('div', { class: 'panel' }, h('h2', {}, 'Odhodki po kategorijah'), h('div', { class: 'body' },
    byCat.map(c => h('div', { class: 'catrow' }, h('span', { class: 'ic' }, c.icon || '•'), h('span', { class: 'nm' }, c.name),
      h('span', { class: 'track' }, h('span', { class: 'fill', style: `width:${(c.total / max * 100).toFixed(0)}%;background:${c.color}` })),
      h('span', { class: 'amt mono' }, fmt(c.total))))));
}
function personPanel(byPerson) {
  if (byPerson.length < 1) return '';
  return h('div', { class: 'panel' }, h('h2', {}, 'Kdo je porabil'), h('div', { class: 'body' },
    byPerson.map(p => h('div', { class: 'catrow' }, h('span', { class: 'person', style: `background:${p.color};width:12px;height:12px;border-radius:50%` }),
      h('span', { class: 'nm' }, p.display_name), h('span', { class: 'amt mono' }, fmt(p.total))))));
}
async function recentPanel() { return h('div'); }

// ───────── promet ─────────
async function viewTx() {
  view(h('p', { class: 'muted' }, 'Nalagam …'));
  const params = new URLSearchParams({ month: S.month, limit: 500 });
  if (S.filterAccount) params.set('account', S.filterAccount);
  if (S.filterType) params.set('type', S.filterType);
  const txs = (await get('transactions?' + params)).transactions;

  const filters = h('div', { class: 'panel' }, h('div', { class: 'body' },
    h('div', { class: 'chips' },
      chip('Vse', !S.filterType && !S.filterAccount, () => { S.filterType = null; S.filterAccount = null; route(); }),
      chip('Prihodki', S.filterType === 'income', () => { S.filterType = S.filterType === 'income' ? null : 'income'; route(); }),
      chip('Odhodki', S.filterType === 'expense', () => { S.filterType = S.filterType === 'expense' ? null : 'expense'; route(); }),
      chip('Prenosi', S.filterType === 'transfer', () => { S.filterType = S.filterType === 'transfer' ? null : 'transfer'; route(); }),
      ...S.accounts.map(a => chip(a.name, +S.filterAccount === a.id, () => { S.filterAccount = S.filterAccount == a.id ? null : a.id; route(); })))));

  const list = h('div', { class: 'panel' });
  if (!txs.length) list.append(h('div', { class: 'empty' }, 'Ni vnosov v tem mesecu. Dodaj z gumbom + spodaj.'));
  else {
    let lastDay = null;
    for (const t of txs) {
      if (t.tdate !== lastDay) { lastDay = t.tdate; list.append(h('div', { class: 'day' }, new Date(t.tdate).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' }))); }
      list.append(txRow(t));
    }
  }
  view(filters, list);
}
function txRow(t) {
  const sign = t.type === 'income' ? 1 : t.type === 'expense' ? -1 : 0;
  const amtCls = t.type === 'income' ? 'pos' : t.type === 'expense' ? 'neg' : '';
  const icon = t.type === 'transfer' ? '🔁' : (t.category_icon || (t.type === 'income' ? '💶' : '💸'));
  const sub = t.type === 'transfer' ? `${t.account_name} → ${t.counter_name}` : `${t.category_name || 'brez kategorije'} · ${t.account_name}`;
  const person = t.person_user_id ? userById(t.person_user_id) : null;
  return h('div', { class: 'tx', onclick: () => txDialog(t) },
    h('span', { class: 'ic' }, icon),
    h('div', { class: 'mid' }, h('div', { class: 't1' }, t.note || (t.type === 'transfer' ? 'Prenos' : (t.category_name || '—'))), h('div', { class: 't2' }, sub)),
    person ? h('span', { class: 'person', style: `background:${person.color}`, title: person.display_name }) : null,
    h('span', { class: 'amt mono ' + amtCls }, (sign > 0 ? '+' : sign < 0 ? '−' : '') + fmt(t.amount)));
}
const chip = (label, on, onClick) => h('button', { class: 'chip' + (on ? ' on' : ''), onclick: onClick }, label);

// ───────── vnos transakcije ─────────
function txDialog(t) {
  let type = t ? t.type : 'expense';
  const amtI = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', value: t ? String(t.amount).replace('.', ',') : '' });
  const dateI = h('input', { type: 'date', value: t ? t.tdate : new Date().toISOString().slice(0, 10) });
  const noteI = h('input', { placeholder: 'opomba (neobvezno)', value: t ? (t.note || '') : '' });
  const accSel = h('select', {}, S.accounts.map(a => h('option', { value: a.id, selected: t && t.account_id === a.id }, a.name)));
  const counterSel = h('select', {}, S.accounts.map(a => h('option', { value: a.id, selected: t && t.counter_account_id === a.id }, a.name)));
  const personWrap = h('div', { class: 'chips' }, chip('—', !(t && t.person_user_id), function () { setPerson(null, this); }),
    ...S.users.map(u => chip(u.display_name, t && t.person_user_id === u.id, function () { setPerson(u.id, this); })));
  let person = t ? t.person_user_id : null;
  function setPerson(id, el) { person = id; personWrap.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); el.classList.add('on'); }

  let catId = t ? t.category_id : null;
  const catWrap = h('div', { class: 'chips' });
  function renderCats() {
    clear(catWrap, ...S.categories.filter(c => c.type === type).map(c =>
      chip((c.icon ? c.icon + ' ' : '') + c.name, catId === c.id, function () { catId = catId === c.id ? null : c.id; catWrap.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); if (catId === c.id) this.classList.add('on'); })));
  }
  renderCats();

  const counterRow = h('label', { class: 'f' }, h('span', {}, 'Na račun'), counterSel);
  const catRow = h('label', { class: 'f' }, h('span', {}, 'Kategorija'), catWrap);
  const personRow = h('label', { class: 'f' }, h('span', {}, 'Oseba'), personWrap);
  function applyType() { counterRow.style.display = type === 'transfer' ? '' : 'none'; catRow.style.display = type === 'transfer' ? 'none' : ''; renderCats(); }

  const seg = h('div', { class: 'seg' }, ['expense', 'income', 'transfer'].map(ty =>
    h('button', { class: (type === ty ? 'on ' + ty : ''), onclick: function () { type = ty; seg.querySelectorAll('button').forEach(b => b.className = ''); this.className = 'on ' + ty; applyType(); } },
      ty === 'expense' ? 'Odhodek' : ty === 'income' ? 'Prihodek' : 'Prenos')));

  const body = h('div', {}, seg,
    h('label', { class: 'f' }, h('span', {}, 'Znesek (€)'), amtI),
    h('label', { class: 'f' }, h('span', {}, type === 'transfer' ? 'Z računa' : 'Račun'), accSel),
    counterRow, catRow,
    h('div', { class: 'grid2' }, h('label', { class: 'f' }, h('span', {}, 'Datum'), dateI), personRow),
    h('label', { class: 'f' }, h('span', {}, 'Opomba'), noteI));
  applyType();

  const acts = [{ label: 'Prekliči' }];
  if (t) acts.push({ label: 'Izbriši', kind: 'red', onClick: async () => { await del('transactions?id=' + t.id); afterChange(); } });
  acts.push({ label: t ? 'Shrani' : 'Dodaj', kind: 'primary', onClick: async () => {
    const payload = { type, amount: amtI.value, account_id: +accSel.value, counter_account_id: type === 'transfer' ? +counterSel.value : null, category_id: type === 'transfer' ? null : catId, person_user_id: person, tdate: dateI.value, note: noteI.value };
    if (t) await put('transactions?id=' + t.id, payload); else await post('transactions', payload);
    afterChange();
  } });
  dialogBtns(t ? 'Uredi vnos' : 'Nov vnos', body, acts);
  setTimeout(() => amtI.focus(), 60);
}
async function afterChange() { await loadLookups(); route(); }

// ───────── cilji ─────────
async function viewGoals() {
  view(h('p', { class: 'muted' }, 'Nalagam …'));
  const goals = (await get('goals')).goals;
  const add = h('div', { style: 'margin-bottom:14px' }, h('button', { class: 'btn primary', onclick: () => goalDialog() }, '+ Nov cilj'));
  const list = h('div', { class: 'panel' });
  if (!goals.length) list.append(h('div', { class: 'empty' }, 'Ni ciljev. Dodaj npr. »Dopust 2000 €«.'));
  goals.forEach(g => {
    const pct = Math.min(100, g.target_amount ? (g.saved / g.target_amount * 100) : 0);
    list.append(h('div', { class: 'goal' },
      h('div', { class: 'top2' }, h('span', { class: 'nm' }, g.name),
        h('button', { class: 'btn sm', onclick: () => contributeDialog(g) }, '+ Polog'),
        h('button', { class: 'btn sm ghost', onclick: () => goalDialog(g) }, '✎')),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${pct}%;background:${g.color}` })),
      h('div', { class: 'nums' }, h('span', { class: 'mono' }, fmt(g.saved) + ' / ' + fmt(g.target_amount)),
        h('span', { class: 'muted' }, pct.toFixed(0) + '%' + (g.due_date ? ' · do ' + new Date(g.due_date).toLocaleDateString('sl-SI') : '')))));
  });
  view(add, list);
}
function goalDialog(g) {
  const nI = h('input', { value: g ? g.name : '', placeholder: 'npr. Dopust' });
  const tI = h('input', { inputmode: 'decimal', value: g ? String(g.target_amount).replace('.', ',') : '', placeholder: '2000' });
  const dI = h('input', { type: 'date', value: g && g.due_date ? g.due_date : '' });
  const acts = [{ label: 'Prekliči' }];
  if (g) acts.push({ label: 'Izbriši', kind: 'red', onClick: async () => { await del('goals?id=' + g.id); route(); } });
  acts.push({ label: g ? 'Shrani' : 'Ustvari', kind: 'primary', onClick: async () => {
    const p = { name: nI.value.trim(), target_amount: tI.value, due_date: dI.value || null };
    if (g) await put('goals?id=' + g.id, p); else await post('goals', p); route();
  } });
  dialogBtns(g ? 'Uredi cilj' : 'Nov cilj', h('div', {}, labeled('Ime', nI), labeled('Ciljni znesek (€)', tI), labeled('Rok (neobvezno)', dI)), acts);
}
function contributeDialog(g) {
  const aI = h('input', { inputmode: 'decimal', placeholder: '100', autofocus: true });
  const dI = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
  dialogBtns('Polog v »' + g.name + '«', h('div', {}, labeled('Znesek (€)', aI), labeled('Datum', dI),
    h('p', { class: 'muted', style: 'font-size:12.5px' }, 'Za dvig vpiši negativen znesek (npr. -50).')), [
    { label: 'Prekliči' },
    { label: 'Dodaj', kind: 'primary', onClick: async () => { await post('goals?id=' + g.id + '&action=contribute', { amount: aI.value, cdate: dI.value }); route(); } },
  ]);
}

// ───────── več ─────────
async function viewMore() {
  const p = h('div', {});
  // računi
  const accPanel = h('div', { class: 'panel' }, h('h2', {}, 'Računi', h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => accDialog() }, '+ Račun')));
  const accBody = h('div', {});
  S.accounts.forEach(a => accBody.append(h('div', { class: 'tx', onclick: () => accDialog(a) },
    h('span', { class: 'ic', style: `background:${a.color}22` }, '🏦'),
    h('div', { class: 'mid' }, h('div', { class: 't1' }, a.name), h('div', { class: 't2' }, kindLabel(a.kind) + (a.owner_name ? ' · ' + a.owner_name : ''))),
    h('span', { class: 'amt mono' }, fmt(a.balance)))));
  accPanel.append(accBody);

  p.append(accPanel,
    bigBtn('🔁 Ponavljajoče postavke', () => viewRecurring()),
    bigBtn('🏷️ Kategorije', () => viewCategories()),
    bigBtn('📥 Uvoz iz banke (CSV)', () => importDialog()),
    h('div', { class: 'panel' }, h('h2', {}, 'Račun'), h('div', { class: 'body' },
      h('p', { class: 'muted', style: 'margin-bottom:10px' }, 'Prijavljen: ' + S.user.display_name),
      h('div', { class: 'row', style: 'display:flex;gap:10px' },
        h('button', { class: 'btn', onclick: passwordDialog }, 'Spremeni geslo'),
        h('button', { class: 'btn ghost', onclick: logout }, 'Odjava')))));
  view(p);
}
function bigBtn(label, onClick) { return h('div', { class: 'panel', onclick: onClick, style: 'cursor:pointer' }, h('h2', {}, label, h('span', { class: 'spacer' }), '›')); }

function accDialog(a) {
  const nI = h('input', { value: a ? a.name : '' });
  const kSel = h('select', {}, [['shared', 'Skupni'], ['personal', 'Osebni'], ['savings', 'Varčevalni'], ['cash', 'Gotovina']].map(([v, l]) => h('option', { value: v, selected: a && a.kind === v }, l)));
  const oSel = h('select', {}, h('option', { value: '' }, '—'), ...S.users.map(u => h('option', { value: u.id, selected: a && a.owner_user_id === u.id }, u.display_name)));
  const obI = h('input', { inputmode: 'decimal', value: a ? String(a.opening_balance).replace('.', ',') : '0', placeholder: '0' });
  const acts = [{ label: 'Prekliči' }];
  if (a) acts.push({ label: a.archived ? 'Povrni' : 'Arhiviraj', onClick: async () => { await put('accounts?id=' + a.id, { archived: a.archived ? 0 : 1 }); afterChange(); } });
  acts.push({ label: a ? 'Shrani' : 'Dodaj', kind: 'primary', onClick: async () => {
    const p = { name: nI.value.trim(), kind: kSel.value, owner_user_id: oSel.value ? +oSel.value : null, opening_balance: obI.value };
    if (a) await put('accounts?id=' + a.id, p); else await post('accounts', p); afterChange();
  } });
  dialogBtns(a ? 'Uredi račun' : 'Nov račun', h('div', {}, labeled('Ime', nI), labeled('Vrsta', kSel), labeled('Lastnik (za osebni)', oSel), labeled('Začetno stanje (€)', obI)), acts);
}
async function viewRecurring() {
  const rec = (await get('recurring')).recurring;
  const list = h('div', { class: 'panel' }, h('h2', {}, 'Ponavljajoče postavke', h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => recDialog() }, '+ Dodaj')));
  if (!rec.length) list.append(h('div', { class: 'empty' }, 'Ni postavk. Dodaj npr. plačo ali položnice.'));
  rec.forEach(r => list.append(h('div', { class: 'tx', onclick: () => recDialog(r) },
    h('span', { class: 'ic' }, r.type === 'income' ? '💶' : r.type === 'transfer' ? '🔁' : '💸'),
    h('div', { class: 'mid' }, h('div', { class: 't1' }, r.note || r.category_name || r.account_name), h('div', { class: 't2' }, `vsak ${r.day_of_month}. v mesecu · ${r.account_name}` + (r.active ? '' : ' · ustavljeno'))),
    h('span', { class: 'amt mono ' + (r.type === 'income' ? 'pos' : 'neg') }, fmt(r.amount)))));
  view(h('button', { class: 'btn sm ghost', style: 'margin-bottom:12px', onclick: () => { S.tab = 'more'; route(); } }, '‹ Nazaj'), list);
}
function recDialog(r) {
  let type = r ? r.type : 'expense';
  const amtI = h('input', { inputmode: 'decimal', value: r ? String(r.amount).replace('.', ',') : '' });
  const domI = h('input', { type: 'number', min: 1, max: 28, value: r ? r.day_of_month : 1 });
  const accSel = h('select', {}, S.accounts.map(a => h('option', { value: a.id, selected: r && r.account_id === a.id }, a.name)));
  const catSel = h('select', {}, h('option', { value: '' }, '—'), ...S.categories.map(c => h('option', { value: c.id, selected: r && r.category_id === c.id }, c.name)));
  const noteI = h('input', { value: r ? (r.note || '') : '', placeholder: 'npr. Plača, Elektrika' });
  const tSel = h('select', {}, [['expense', 'Odhodek'], ['income', 'Prihodek']].map(([v, l]) => h('option', { value: v, selected: type === v }, l)));
  const acts = [{ label: 'Prekliči' }];
  if (r) acts.push({ label: 'Izbriši', kind: 'red', onClick: async () => { await del('recurring?id=' + r.id); viewRecurring(); } });
  acts.push({ label: r ? 'Shrani' : 'Dodaj', kind: 'primary', onClick: async () => {
    const p = { type: tSel.value, amount: amtI.value, account_id: +accSel.value, category_id: catSel.value ? +catSel.value : null, day_of_month: +domI.value, note: noteI.value };
    if (r) await put('recurring?id=' + r.id, p); else await post('recurring', p); viewRecurring();
  } });
  dialogBtns(r ? 'Uredi postavko' : 'Nova ponavljajoča postavka', h('div', {}, labeled('Tip', tSel), labeled('Znesek (€)', amtI), labeled('Dan v mesecu (1–28)', domI), labeled('Račun', accSel), labeled('Kategorija', catSel), labeled('Opis', noteI)), acts);
}
async function viewCategories() {
  const cats = (await get('categories')).categories;
  const mk = (type, title) => { const pnl = h('div', { class: 'panel' }, h('h2', {}, title, h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => catDialog({ type }) }, '+'))); cats.filter(c => c.type === type).forEach(c => pnl.append(h('div', { class: 'tx', onclick: () => catDialog(c) }, h('span', { class: 'ic' }, c.icon || '•'), h('div', { class: 'mid' }, h('div', { class: 't1' }, c.name)), h('span', { class: 'person', style: `background:${c.color}` })))); return pnl; };
  view(h('button', { class: 'btn sm ghost', style: 'margin-bottom:12px', onclick: () => { S.tab = 'more'; route(); } }, '‹ Nazaj'), mk('expense', 'Odhodki'), mk('income', 'Prihodki'));
}
function catDialog(c) {
  const nI = h('input', { value: c.name || '' });
  const icI = h('input', { value: c.icon || '', placeholder: 'emoji (npr. 🛒)' });
  const colI = h('input', { type: 'color', value: c.color || '#8a94a6' });
  const acts = [{ label: 'Prekliči' }];
  if (c.id) acts.push({ label: 'Izbriši', kind: 'red', onClick: async () => { await del('categories?id=' + c.id); viewCategories(); } });
  acts.push({ label: c.id ? 'Shrani' : 'Dodaj', kind: 'primary', onClick: async () => {
    const p = { name: nI.value.trim(), type: c.type, icon: icI.value, color: colI.value };
    if (c.id) await put('categories?id=' + c.id, p); else await post('categories', p);
    await loadLookups(); viewCategories();
  } });
  dialogBtns(c.id ? 'Uredi kategorijo' : 'Nova kategorija', h('div', {}, labeled('Ime', nI), labeled('Ikona', icI), labeled('Barva', colI)), acts);
}

// ───────── uvoz CSV ─────────
function importDialog() {
  const fileI = h('input', { type: 'file', accept: '.csv,text/csv' });
  const accSel = h('select', {}, S.accounts.map(a => h('option', { value: a.id }, a.name)));
  const info = h('div', { class: 'muted', style: 'font-size:12.5px;margin-top:8px' }, 'Izberi CSV izpisek. Program poskusi prepoznati datum, znesek in opis; pred uvozom vidiš predogled.');
  const preview = h('div', {});
  let parsed = [];
  fileI.addEventListener('change', () => { const f = fileI.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { parsed = parseCSV(r.result); renderPreview(); }; r.readAsText(f, 'utf-8'); });
  function renderPreview() {
    if (!parsed.length) { clear(preview, h('p', { class: 'err' }, 'Ni prepoznanih vrstic. Preveri ločilo (; ali ,).')); return; }
    clear(preview, h('p', { class: 'muted', style: 'margin:10px 0 6px' }, 'Prepoznanih vrstic: ' + parsed.length + ' (prikazane prve 3)'),
      h('div', { class: 'panel' }, parsed.slice(0, 3).map(r => h('div', { class: 'tx' }, h('span', { class: 'ic' }, r.type === 'income' ? '💶' : '💸'),
        h('div', { class: 'mid' }, h('div', { class: 't1' }, r.note || '—'), h('div', { class: 't2' }, r.tdate)),
        h('span', { class: 'amt mono ' + (r.type === 'income' ? 'pos' : 'neg') }, fmt(r.amount))))));
  }
  dialogBtns('Uvoz iz banke (CSV)', h('div', {}, labeled('Dodaj na račun', accSel), labeled('Datoteka CSV', fileI), info, preview), [
    { label: 'Prekliči' },
    { label: 'Uvozi', kind: 'primary', onClick: async () => {
      if (!parsed.length) { toast('Najprej izberi datoteko', true); return false; }
      const res = await post('import', { account_id: +accSel.value, rows: parsed });
      toast(`Uvoženih ${res.inserted}, preskočenih ${res.skipped}`); afterChange();
    } },
  ]);
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const rows = lines.map(l => splitCsvLine(l, delim));
  // najdi stolpce: datum, znesek, opis
  const header = rows[0].map(x => x.toLowerCase());
  let di = header.findIndex(h => /datum|date/.test(h));
  let ai = header.findIndex(h => /znesek|amount|breme|dobro|v dobro|v breme/.test(h));
  let ni = header.findIndex(h => /opis|namen|prejemnik|descr|text|referenc/.test(h));
  const hasHeader = di >= 0 || ai >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  if (di < 0) di = 0; if (ai < 0) ai = findAmountCol(body); if (ni < 0) ni = pickNoteCol(body, [di, ai]);
  const out = [];
  for (const r of body) {
    const tdate = normDate(r[di]); const amt = normAmount(r[ai]);
    if (!tdate || isNaN(amt) || amt === 0) continue;
    out.push({ tdate, amount: Math.abs(amt), type: amt < 0 ? 'expense' : 'income', note: (r[ni] || '').slice(0, 120) });
  }
  return out;
}
function splitCsvLine(line, d) { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === d && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim().replace(/^"|"$/g, '')); }
function normDate(s) { if (!s) return null; s = s.trim(); let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/); if (m) { let [_, d, mo, y] = m; if (y.length === 2) y = '20' + y; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; } m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0]; return null; }
function normAmount(s) { if (s == null) return NaN; s = String(s).replace(/\s/g, '').replace(/\./g, x => '').replace(',', '.'); const n = Number(s.replace(/[^0-9.\-]/g, '')); return n; }
function findAmountCol(body) { const n = body[0] ? body[0].length : 0; for (let i = n - 1; i >= 0; i--) if (body.some(r => !isNaN(normAmount(r[i])) && /[0-9]/.test(r[i] || ''))) return i; return 1; }
function pickNoteCol(body, exclude) { const n = body[0] ? body[0].length : 0; let best = 0, bestLen = 0; for (let i = 0; i < n; i++) { if (exclude.includes(i)) continue; const len = body.reduce((s, r) => s + (r[i] || '').length, 0); if (len > bestLen) { bestLen = len; best = i; } } return best; }

// ───────── račun / geslo ─────────
function passwordDialog() {
  const c = h('input', { type: 'password', placeholder: 'trenutno geslo' });
  const n = h('input', { type: 'password', placeholder: 'novo geslo (min 6)' });
  dialogBtns('Sprememba gesla', h('div', {}, labeled('Trenutno geslo', c), labeled('Novo geslo', n)), [
    { label: 'Prekliči' }, { label: 'Shrani', kind: 'primary', onClick: async () => { await post('auth/password', { current: c.value, next: n.value }); toast('Geslo spremenjeno'); } },
  ]);
}
async function logout() { try { await post('auth/logout'); } catch (e) {} location.reload(); }

// ───────── pomočniki dialogov ─────────
function labeled(label, input) { return h('label', { class: 'f' }, h('span', {}, label), input); }
function dialogBtns(title, body, actions) {
  let back;
  const close = () => back && back.remove();
  const btns = actions.map(a => h('button', { class: 'btn ' + (a.kind || 'ghost'), onclick: async (e) => { e.currentTarget.disabled = true; try { const r = a.onClick ? await a.onClick() : true; if (r !== false) close(); } catch (err) { toast(err.message || String(err), true); e.currentTarget.disabled = false; } } }, a.label));
  const box = h('div', { class: 'dlg' }, h('h3', {}, title), body, h('div', { class: 'acts' }, btns));
  back = h('div', { class: 'back', onclick: (e) => { if (e.target === back) close(); } }, box);
  document.body.append(back);
}

boot();
