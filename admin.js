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
}
const F = ['fullName', 'name', 'nickname', 'gender', 'fatherId', 'motherId', 'birth', 'job', 'photo', 'bio'];
function edit(id) {
  const p = P[id]; $('#id').value = id; F.forEach(k => $('#' + k).value = p[k] || '');
  setPhoto(p.photo);
  SP = [...(p.spouseIds || [])]; renderSp(); scrollTo(0, 0);
}
async function del(id) {
  if (!confirm('متأكد من الحذف؟')) return;
  const b = db.batch(); b.delete(C.doc(id));
  (P[id].spouseIds || []).forEach(s => b.update(C.doc(s), { spouseIds: firebase.firestore.FieldValue.arrayRemove(id) }));
  await b.commit(); load();
}
$('#rs').onclick = () => { $('#f').reset(); $('#id').value = ''; setPhoto(''); SP = []; renderSp(); };
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
