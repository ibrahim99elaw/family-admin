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
  loadGal(); loadArc(); loadSn();
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
  const fa = data.fatherId, mo = data.motherId;  // الأب والأم يتربطوا كزوجين تلقائي
  if (fa && mo && P[fa] && P[mo]) {
    if (!(P[fa].spouseIds || []).includes(mo)) b.update(C.doc(fa), { spouseIds: V.arrayUnion(mo) });
    if (!(P[mo].spouseIds || []).includes(fa)) b.update(C.doc(mo), { spouseIds: V.arrayUnion(fa) });
  }
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
      const s = 480, c = document.createElement('canvas'), m = Math.min(i.width, i.height);
      c.width = c.height = s;
      c.getContext('2d').drawImage(i, (i.width - m) / 2, (i.height - m) / 2, m, m, 0, 0, s, s);
      res(c.toDataURL('image/jpeg', .85));
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
function shrinkTo(file, max = 1920) {
  // جودة عالية: أقصى مقاس 1920px، ونقلل الجودة/المقاس بس لو الصورة عدّت حد Firestore (~1MB)
  return new Promise(res => {
    const i = new Image();
    i.onload = () => {
      let k = Math.min(1, max / Math.max(i.width, i.height)), out;
      for (let t = 0; t < 6; t++) {
        const c = document.createElement('canvas'); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, c.width, c.height);
        for (const q of [.9, .82, .74]) { out = c.toDataURL('image/jpeg', q); if (out.length < 900000) return res(out); }
        k *= .85;
      }
      res(out);
    };
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

// فحص الروابط: الأزواج متبادلين، الأب والأم مربوطين، الأنواع، التواريخ، ودوائر الأجداد
const yr = p => +((dg0(p.birth).match(/\d{4}/) || [0])[0]);
const dg0 = s => String(s || '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632);
async function check(apply) {
  const b = db.batch(), V = firebase.firestore.FieldValue, msg = new Set(), nm = id => P[id] ? P[id].name : '؟'; let fixes = 0;
  const ps = Object.values(P);
  ps.forEach(p => {
    (p.spouseIds || []).forEach(s => {
      if (!P[s]) { msg.add(`${p.name}: زوج/زوجة محذوف من النظام`); b.update(C.doc(p.id), { spouseIds: V.arrayRemove(s) }); fixes++; }
      else if (!(P[s].spouseIds || []).includes(p.id)) { msg.add(`${p.name} مربوط بـ ${nm(s)} من طرف واحد`); b.update(C.doc(s), { spouseIds: V.arrayUnion(p.id) }); fixes++; }
    });
    const f = P[p.fatherId], m = P[p.motherId];
    if (p.fatherId && !f) msg.add(`${p.name}: الأب المسجل اتحذف`);
    if (p.motherId && !m) msg.add(`${p.name}: الأم المسجلة اتحذفت`);
    if (f && f.gender !== 'm') msg.add(`${p.name}: الأب (${f.name}) نوعه أنثى`);
    if (m && m.gender !== 'f') msg.add(`${p.name}: الأم (${m.name}) نوعها ذكر`);
    if (f && m && !(f.spouseIds || []).includes(m.id)) { msg.add(`${f.name} و${m.name} والدين ${p.name} ومش مربوطين كزوجين`); b.update(C.doc(f.id), { spouseIds: V.arrayUnion(m.id) }); b.update(C.doc(m.id), { spouseIds: V.arrayUnion(f.id) }); fixes++; }
    [f, m].filter(Boolean).forEach(x => { if (yr(p) && yr(x) && yr(p) - yr(x) < 12) msg.add(`${p.name}: فرق السن بينه وبين ${x.name} غير منطقي، راجع تاريخ الميلاد`); });
    let c = p, n = 0; while (c && n++ < 60) { c = P[c.fatherId] || P[c.motherId]; if (c && c.id === p.id) { msg.add(`${p.name}: دايرة في الأجداد (بقى جد نفسه)`); break; } }
  });
  if (apply) { await b.commit(); await load(); }
  const kids = ps.filter(p => P[p.fatherId] || P[p.motherId]).length, sib = ps.filter(p => ps.some(x => x.id !== p.id && ((p.fatherId && x.fatherId === p.fatherId) || (p.motherId && x.motherId === p.motherId)))).length;
  const list = [...msg].map(t => `<p>⚠️ ${safe(t)}</p>`).join('');
  $('#chkout').innerHTML = `<p>الأشخاص: ${ps.length} • مربوطين بأب أو أم: ${kids} • عندهم إخوة: ${sib}</p>` + (msg.size ? list : '<p>✅ كل الروابط سليمة</p>') + (fixes && !apply ? '<button type="button" onclick="check(true)">🛠️ إصلاح الروابط اللي ينفع تتصلح تلقائي</button>' : '');
}
$('#chk').onclick = () => check(false);

// الأرشيف: المصغّرة في collection اسمه archive (خفيفة للعرض)، والصورة الكاملة في archiveFull (بتتحمّل لما تفتح الصورة)
const A = db.collection('archive'), AF = db.collection('archiveFull');
async function loadArc() {
  const s = await A.orderBy('ts').get();
  $('#al').innerHTML = s.docs.map(d => { const x = d.data(); return `<div class="gi"><img src="${x.thumb}"><small>${safe(x.year)} ${safe(x.caption)}</small><button class="sec" onclick="delArc('${d.id}')">حذف</button></div>`; }).join('') || '<p>الأرشيف فاضي</p>';
}
async function delArc(id) { if (confirm('حذف الصورة من الأرشيف؟')) { const b = db.batch(); b.delete(A.doc(id)); b.delete(AF.doc(id)); await b.commit(); loadArc(); } }
['af', 'ac'].forEach(k => $('#' + k).onchange = async e => {
  const fs = [...e.target.files]; let n = 0;
  for (const f of fs) {
    $('#ast').textContent = `جاري الرفع ${++n}/${fs.length}...`;
    const id = A.doc().id, b = db.batch();
    b.set(A.doc(id), { thumb: await shrinkTo(f, 480), caption: $('#acap').value.trim(), year: $('#ayr').value.trim(), ts: Date.now() + n });
    b.set(AF.doc(id), { img: await shrinkTo(f) });
    await b.commit();
  }
  e.target.value = ''; $('#acap').value = ''; $('#ayr').value = ''; $('#ast').textContent = ''; loadArc();
});
$('#apick').onclick = () => $('#af').click();
$('#acam').onclick = () => $('#ac').click();

// رسالة الترحيب الصوتية: الملف بيتقسم لقطع (700KB) في collection اسمه audioChunks، والبيانات في audio/welcome
const AU = db.collection('audio'), ACH = db.collection('audioChunks'), CH = 700000;
const mimeOf = f => { const t = (f.type || '').split(';')[0], e = (f.name.split('.').pop() || '').toLowerCase(); return t && t !== 'audio/x-m4a' ? t : ({ mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac' }[e] || 'audio/mpeg'); };
async function loadSn() {
  const d = await AU.doc('welcome').get();
  if (!d.exists) { $('#snCur').innerHTML = '<p>مفيش ملف صوتي حاليًا</p>'; return; }
  const m = d.data(); $('#snTitle').value = m.title || ''; $('#snLoop').checked = !!m.loop;
  $('#snCur').innerHTML = `<p>الحالي: <b>${safe(m.title)}</b> (${Math.round(m.size / 1024)} KB)</p><audio id="snAu" controls style="width:100%"></audio><button type="button" class="sec" id="snDel">حذف الملف الصوتي</button>`;
  $('#snDel').onclick = delSn;
  const parts = await Promise.all([...Array(m.chunks)].map((_, i) => ACH.doc('welcome_' + i).get()));
  $('#snAu').src = `data:${m.mime};base64,` + parts.map(p => p.data().d).join('');
}
async function saveSn(blob, mime) {
  if (blob.size > 4 * 1024 * 1024) return alert('الملف أكبر من 4MB. اضغطه أو سجّل رسالة أقصر.');
  $('#snSt').textContent = 'جاري الرفع...';
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  const old = await AU.doc('welcome').get(), oldN = old.exists ? old.data().chunks : 0, n = Math.ceil(b64.length / CH), b = db.batch();
  for (let i = 0; i < n; i++) b.set(ACH.doc('welcome_' + i), { d: b64.slice(i * CH, (i + 1) * CH) });
  for (let i = n; i < oldN; i++) b.delete(ACH.doc('welcome_' + i));
  b.set(AU.doc('welcome'), { title: $('#snTitle').value.trim(), loop: $('#snLoop').checked, mime: (mime || 'audio/mpeg').split(';')[0], size: blob.size, chunks: n, ts: Date.now() });
  await b.commit(); $('#snSt').textContent = 'تم الحفظ ✅'; loadSn();
}
async function delSn() {
  if (!confirm('حذف الملف الصوتي؟')) return;
  const d = await AU.doc('welcome').get(), b = db.batch();
  for (let i = 0; i < (d.exists ? d.data().chunks : 0); i++) b.delete(ACH.doc('welcome_' + i));
  b.delete(AU.doc('welcome')); await b.commit(); $('#snSt').textContent = ''; loadSn();
}
$('#snPick').onclick = () => $('#snFile').click();
$('#snFile').onchange = e => { const f = e.target.files[0]; if (f) saveSn(f, mimeOf(f)); e.target.value = ''; };
let rec, rch = [], rtim;
$('#snRec').onclick = async () => {
  if (rec && rec.state === 'recording') { rec.stop(); return; }
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mt = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)), t0 = Date.now();
    rec = new MediaRecorder(st, mt ? { mimeType: mt, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 }); rch = [];
    rec.ondataavailable = e => e.data.size && rch.push(e.data);
    rec.onstop = async () => { clearInterval(rtim); st.getTracks().forEach(t => t.stop()); $('#snRec').textContent = '🎙️ تسجيل رسالة بالميكروفون'; await saveSn(new Blob(rch, { type: rec.mimeType }), rec.mimeType); };
    rec.start(); $('#snRec').textContent = '⏹ إيقاف وحفظ';
    rtim = setInterval(() => $('#snSt').textContent = '🔴 بيسجّل... ' + Math.floor((Date.now() - t0) / 1000) + ' ثانية', 500);
  } catch (e) { alert('تعذر الوصول للميكروفون: ' + e.message); }
};
