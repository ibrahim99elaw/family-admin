let P = {}; const $ = s => document.querySelector(s), C = db.collection('people');
auth.onAuthStateChanged(u => { $('#login').hidden = !!u; $('#app').hidden = !u; if (u) load(); });
$('#in').onclick = () => auth.signInWithEmailAndPassword($('#em').value, $('#pw').value).catch(() => alert('بيانات الدخول غلط'));
$('#out').onclick = () => auth.signOut();
const esc = s => String(s || '').replace(/"/g, '&quot;');
async function load() {
  P = {}; (await C.get()).forEach(d => P[d.id] = { id: d.id, ...d.data() });
  const L = Object.values(P).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
  const opt = (a, ph) => `<option value="">${ph}</option>` + a.map(p => `<option value="${p.id}">${p.fullName}</option>`).join('');
  $('#fatherId').innerHTML = opt(L.filter(p => p.gender === 'm'), 'الأب (اختياري)');
  $('#motherId').innerHTML = opt(L.filter(p => p.gender === 'f'), 'الأم (اختياري)');
  renderSp();
  $('#list').innerHTML = L.map(p => `<div class="row"><span>${p.fullName}</span><span><button onclick="edit('${p.id}')">تعديل</button> <button class="sec" onclick="del('${p.id}')">حذف</button></span></div>`).join('') || '<p>لسه مفيش بيانات</p>';
  loadGal();
}
const F = ['fullName', 'name', 'nickname', 'gender', 'fatherId', 'motherId', 'birth', 'job', 'photo', 'bio'];
function edit(id) {
  const p = P[id]; $('#id').value = id; F.forEach(k => $('#' + k).value = p[k] || '');
  setPhoto(p.photo); autoM = autoF = false;
  SP = [...(p.spouseIds || [])]; renderSp(); scrollTo(0, 0);
}
async function del(id) {
  if (!confirm('متأكد من الحذف؟')) return;
  const b = db.batch(); b.delete(C.doc(id));
  (P[id].spouseIds || []).forEach(s => b.update(C.doc(s), { spouseIds: firebase.firestore.FieldValue.arrayRemove(id) }));
  await b.commit(); load();
}
$('#rs').onclick = () => { $('#f').reset(); $('#id').value = ''; setPhoto(''); SP = []; renderSp(); autoM = autoF = false; };
$('#f').onsubmit = async e => {
  e.preventDefault();
  const id = $('#id').value || C.doc().id, old = P[id]?.spouseIds || [], sp = SP.filter(s => s !== id);
  const data = { spouseIds: sp }; F.forEach(k => data[k] = $('#' + k).value.trim());
  const b = db.batch(), V = firebase.firestore.FieldValue;
  b.set(C.doc(id), data);
  sp.forEach(s => b.update(C.doc(s), { spouseIds: V.arrayUnion(id) }));
  old.filter(s => !sp.includes(s) && P[s]).forEach(s => b.update(C.doc(s), { spouseIds: V.arrayRemove(id) }));
  await b.commit(); $('#rs').click(); load();
};

// الصور: قص مربع + تصغير 320px وحفظها داخل Firestore (من غير Storage)
function setPhoto(d) { $('#photo').value = d || ''; $('#pv').innerHTML = d ? `<img src="${d}">` : '📷'; }
function shrink(file) {
  return new Promise(res => {
    const i = new Image();
    i.onload = () => {
      const s = 320, c = document.createElement('canvas'), m = Math.min(i.width, i.height);
      c.width = c.height = s;
      c.getContext('2d').drawImage(i, (i.width - m) / 2, (i.height - m) / 2, m, m, 0, 0, s, s);
      res(c.toDataURL('image/jpeg', .75));
    };
    i.src = URL.createObjectURL(file);
  });
}
['pf', 'pc'].forEach(k => $('#' + k).onchange = async e => { const f = e.target.files[0]; if (f) setPhoto(await shrink(f)); e.target.value = ''; });
$('#pg').onclick = () => $('#pf').click();
$('#pcam').onclick = () => $('#pc').click();
$('#px').onclick = () => setPhoto('');

// اختيار الزوج/الزوجة: قايمة بالنوع المعاكس + أزرار حذف
let SP = [];
function renderSp() {
  const me = $('#id').value, g = $('#gender').value, L = Object.values(P).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
  const ok = L.filter(p => p.id !== me && p.gender !== g && !SP.includes(p.id));
  $('#spSel').innerHTML = `<option value="">${g === 'm' ? 'اختر الزوجة' : 'اختر الزوج'}</option>` + ok.map(p => `<option value="${p.id}">${p.fullName}</option>`).join('');
  $('#spChips').innerHTML = SP.filter(s => P[s]).map(s => `<span class="chip">${P[s].name} <b style="cursor:pointer" onclick="rmSp('${s}')">✕</b></span>`).join('');
}
function rmSp(id) { SP = SP.filter(s => s !== id); renderSp(); }
$('#spAdd').onclick = () => { const v = $('#spSel').value; if (v) { SP.push(v); renderSp(); } };
$('#gender').onchange = renderSp;

// لما تختار الأب بيختار الأم تلقائي (زوجته)، والعكس
let autoM = false, autoF = false;
const spOf = (id, g) => (P[id]?.spouseIds || []).filter(s => P[s] && P[s].gender === g);
$('#fatherId').onchange = () => { autoF = false; const s = spOf($('#fatherId').value, 'f'); if (s.length && (!$('#motherId').value || autoM)) { $('#motherId').value = s[0]; autoM = true; } };
$('#motherId').onchange = () => { autoM = false; const s = spOf($('#motherId').value, 'm'); if (s.length && (!$('#fatherId').value || autoF)) { $('#fatherId').value = s[0]; autoF = true; } };

// معرض الصفحة الرئيسية (collection: gallery) — الصور بتتصغر لـ 1100px وتتخزن داخل Firestore
const G = db.collection('gallery');
const safe = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function loadGal() {
  const s = await G.orderBy('ts').get();
  $('#gl').innerHTML = s.docs.map(d => `<div class="gi"><img src="${d.data().img}"><small>${safe(d.data().caption)}</small><button class="sec" onclick="delGal('${d.id}')">حذف</button></div>`).join('') || '<p>لسه مفيش صور</p>';
}
async function delGal(id) { if (confirm('حذف الصورة؟')) { await G.doc(id).delete(); loadGal(); } }
function shrinkTo(file, max = 1100, q = .7) {
  return new Promise(res => {
    const i = new Image();
    i.onload = () => { const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * k; c.height = i.height * k; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q)); };
    i.src = URL.createObjectURL(file);
  });
}
['gf', 'gc'].forEach(k => $('#' + k).onchange = async e => {
  const fs = [...e.target.files]; let n = 0;
  for (const f of fs) { $('#gst').textContent = `جاري الرفع ${++n}/${fs.length}...`; await G.add({ img: await shrinkTo(f), caption: $('#gcap').value.trim(), ts: Date.now() + n }); }
  e.target.value = ''; $('#gcap').value = ''; $('#gst').textContent = ''; loadGal();
});
$('#gpick').onclick = () => $('#gf').click();
$('#gcam').onclick = () => $('#gc').click();
