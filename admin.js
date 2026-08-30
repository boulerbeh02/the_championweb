/* ============================================================
   لوحة تحكم دورة المرحوم زحزاح أحمد
   يعتمد على TOURNAMENT_DATA و saveTournamentData() المعرّفين في data.js
   ============================================================ */

/* غيّر كلمة السر هنا وقتما تحب — حماية بسيطة فقط، وليست تشفيراً حقيقياً */
const ADMIN_PASSWORD = "زحزاح2026";
const AUTH_FLAG = "dorra_admin_authed";

let draftGoals = [];
let draftAssists = [];
let draftCards = [];
let editingMatchIndex = null; // null = مباراة جديدة

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

/* ---------------- الدخول ---------------- */
function tryLogin() {
  const val = document.getElementById("password-input").value;
  if (val === ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_FLAG, "1");
    document.getElementById("login-box").classList.add("hidden");
    initApp();
  } else {
    document.getElementById("login-error").textContent = "كلمة السر غير صحيحة";
  }
}
function logout() {
  sessionStorage.removeItem(AUTH_FLAG);
  location.reload();
}
window.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem(AUTH_FLAG) === "1") {
    document.getElementById("login-box").classList.add("hidden");
    initApp();
  }
});

/* ---------------- تشغيل التطبيق ---------------- */
function initApp() {
  document.getElementById("app").classList.remove("hidden");
  renderMatchesTable();
  renderKnockoutTable();
  populateTeamSelect();
  renderSquadEditor();
}
function persist() {
  saveTournamentData(TOURNAMENT_DATA);
  showToast("تم الحفظ في هذا المتصفح ✓");
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function downloadData() {
  const blob = new Blob([JSON.stringify(TOURNAMENT_DATA, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "data.json";
  a.click();
  URL.revokeObjectURL(url);
}
function importData(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      TOURNAMENT_DATA = JSON.parse(reader.result);
      persist();
      renderMatchesTable();
      populateTeamSelect();
      renderSquadEditor();
      showToast("تم استيراد الملف ✓");
    } catch (e) {
      alert("الملف غير صالح: " + e.message);
    }
  };
  reader.readAsText(file);
  evt.target.value = "";
}
function resetData() {
  if (!confirm("سيتم مسح كل التعديلات المحفوظة في هذا المتصفح والعودة لملف data.json الأصلي. متأكد؟")) return;
  localStorage.removeItem(DORRA_KEY);
  location.reload();
}

/* ---------------- التبويبات ---------------- */
function switchTab(name) {
  document.getElementById("tab-matches").classList.toggle("hidden", name !== "matches");
  document.getElementById("tab-knockout").classList.toggle("hidden", name !== "knockout");
  document.getElementById("tab-teams").classList.toggle("hidden", name !== "teams");
  document.getElementById("tab-btn-matches").classList.toggle("active", name === "matches");
  document.getElementById("tab-btn-knockout").classList.toggle("active", name === "knockout");
  document.getElementById("tab-btn-teams").classList.toggle("active", name === "teams");
}

/* ---------------- جدول المباريات ---------------- */
function renderMatchesTable() {
  const el = document.getElementById("matches-table");
  const rows = TOURNAMENT_DATA.matches.map((m, i) => {
    const scoreTxt = m.status === "finished" ? `${m.homeScore} - ${m.awayScore}` : "لم تُلعب بعد";
    return `<tr>
      <td>المجموعة ${esc(m.group)}</td>
      <td>ج${m.round}</td>
      <td>${esc(m.home)} × ${esc(m.away)}</td>
      <td>${scoreTxt}</td>
      <td><button class="btn-ghost btn-sm" onclick="openMatchEditor(${i})">تعديل</button>
          <button class="btn-danger btn-sm" onclick="deleteMatch(${i})">حذف</button></td>
    </tr>`;
  }).join("");
  el.innerHTML = `<tr><th>المجموعة</th><th>الجولة</th><th>المباراة</th><th>النتيجة</th><th></th></tr>${rows}`;
}
function deleteMatch(i) {
  if (!confirm("حذف هذه المباراة؟")) return;
  TOURNAMENT_DATA.matches.splice(i, 1);
  persist();
  renderMatchesTable();
}

/* ---------------- محرر المباراة ---------------- */
const GROUP_NAMES = ["الأولى", "الثانية", "الثالثة"];

function addNewMatch() {
  editingMatchIndex = null;
  const blank = {
    id: "m" + Date.now(), round: 1, group: GROUP_NAMES[0], status: "upcoming",
    home: "", away: "", homeScore: null, awayScore: null, time: "", date: "",
    goals: [], assists: [], cards: []
  };
  openMatchEditor(null, blank);
}
function openMatchEditor(index, blankTemplate) {
  editingMatchIndex = index;
  const m = blankTemplate || TOURNAMENT_DATA.matches[index];
  draftGoals = JSON.parse(JSON.stringify(m.goals || []));
  draftAssists = JSON.parse(JSON.stringify(m.assists || []));
  draftCards = JSON.parse(JSON.stringify(m.cards || []));
  document.getElementById("match-editor").classList.remove("hidden");
  document.getElementById("match-editor-body").innerHTML = matchEditorTemplate(m);
  fillTeamSelects(m.group, m.home, m.away);
  toggleScoreFields();
  renderSublists();
  document.getElementById("match-editor").scrollIntoView({ behavior: "smooth" });
}
function closeMatchEditor() {
  document.getElementById("match-editor").classList.add("hidden");
}

function matchEditorTemplate(m) {
  const groupOptions = GROUP_NAMES.map(g =>
    `<option value="${g}" ${g === m.group ? "selected" : ""}>المجموعة ${g}</option>`).join("");
  return `
    <div class="row2">
      <div class="field"><label>المجموعة</label>
        <select id="ed-group" onchange="fillTeamSelects(this.value)">${groupOptions}</select>
      </div>
      <div class="field"><label>الجولة</label>
        <input type="number" id="ed-round" value="${m.round}" min="1">
      </div>
    </div>
    <div class="row2">
      <div class="field"><label>الفريق المستضيف</label><select id="ed-home"></select></div>
      <div class="field"><label>الفريق الضيف</label><select id="ed-away"></select></div>
    </div>
    <div class="field"><label>حالة المباراة</label>
      <select id="ed-status" onchange="toggleScoreFields()">
        <option value="upcoming" ${m.status === "upcoming" ? "selected" : ""}>لم تُلعب بعد</option>
        <option value="finished" ${m.status === "finished" ? "selected" : ""}>منتهية</option>
      </select>
    </div>
    <div class="row2" id="ed-score-fields">
      <div class="field"><label>أهداف الفريق المستضيف</label>
        <input type="number" id="ed-scoreHome" value="${m.homeScore ?? 0}" min="0"></div>
      <div class="field"><label>أهداف الفريق الضيف</label>
        <input type="number" id="ed-scoreAway" value="${m.awayScore ?? 0}" min="0"></div>
    </div>
    <div class="row2">
      <div class="field"><label>التاريخ (اختياري)</label>
        <input type="text" id="ed-date" value="${esc(m.date || "")}" placeholder="مثال: 26/8/2026"></div>
      <div class="field"><label>الوقت (اختياري)</label>
        <input type="text" id="ed-time" value="${esc(m.time || "")}" placeholder="مثال: 17:15"></div>
    </div>

    <div class="field"><label>الهدافون</label>
      <div class="row3">
        <select id="ed-goal-team"></select>
        <input type="text" id="ed-goal-name" placeholder="اسم اللاعب">
        <input type="number" id="ed-goal-count" placeholder="عدد الأهداف" value="1" min="1" style="width:90px">
      </div>
      <button class="btn-ghost btn-sm" style="margin-top:6px" onclick="addGoal()">+ إضافة هدف</button>
      <div class="sublist" id="goals-sublist"></div>
    </div>

    <div class="field"><label>صناع الأهداف (تمريرات حاسمة)</label>
      <div class="row3">
        <select id="ed-assist-team"></select>
        <input type="text" id="ed-assist-name" placeholder="اسم اللاعب">
        <input type="number" id="ed-assist-count" placeholder="عدد التمريرات" value="1" min="1" style="width:90px">
      </div>
      <button class="btn-ghost btn-sm" style="margin-top:6px" onclick="addAssist()">+ إضافة تمريرة</button>
      <div class="sublist" id="assists-sublist"></div>
    </div>

    <div class="field"><label>البطاقات</label>
      <div class="row3">
        <select id="ed-card-team"></select>
        <input type="text" id="ed-card-name" placeholder="اسم اللاعب">
        <select id="ed-card-type" style="width:110px">
          <option value="yellow">صفراء</option>
          <option value="red">حمراء</option>
        </select>
      </div>
      <button class="btn-ghost btn-sm" style="margin-top:6px" onclick="addCard()">+ إضافة بطاقة</button>
      <div class="sublist" id="cards-sublist"></div>
    </div>
  `;
}

function fillTeamSelects(groupName, selectedHome, selectedAway) {
  const teams = TOURNAMENT_DATA.teams.filter(t => t.group === groupName);
  const opts = (selected) => teams.map(t =>
    `<option value="${esc(t.name)}" ${t.name === selected ? "selected" : ""}>${esc(t.name)}</option>`).join("");
  document.getElementById("ed-home").innerHTML = opts(selectedHome);
  document.getElementById("ed-away").innerHTML = opts(selectedAway);
  ["ed-goal-team", "ed-assist-team", "ed-card-team"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts();
  });
}
function toggleScoreFields() {
  const finished = document.getElementById("ed-status").value === "finished";
  document.getElementById("ed-score-fields").style.opacity = finished ? "1" : ".4";
}

function addGoal() {
  const team = document.getElementById("ed-goal-team").value;
  const player = document.getElementById("ed-goal-name").value.trim();
  const count = parseInt(document.getElementById("ed-goal-count").value, 10) || 1;
  if (!player) return;
  draftGoals.push({ team, player, count });
  document.getElementById("ed-goal-name").value = "";
  renderSublists();
}
function removeGoal(i) { draftGoals.splice(i, 1); renderSublists(); }

function addAssist() {
  const team = document.getElementById("ed-assist-team").value;
  const player = document.getElementById("ed-assist-name").value.trim();
  const count = parseInt(document.getElementById("ed-assist-count").value, 10) || 1;
  if (!player) return;
  draftAssists.push({ team, player, count });
  document.getElementById("ed-assist-name").value = "";
  renderSublists();
}
function removeAssist(i) { draftAssists.splice(i, 1); renderSublists(); }

function addCard() {
  const team = document.getElementById("ed-card-team").value;
  const player = document.getElementById("ed-card-name").value.trim();
  const type = document.getElementById("ed-card-type").value;
  if (!player) return;
  draftCards.push({ team, player, type });
  document.getElementById("ed-card-name").value = "";
  renderSublists();
}
function removeCard(i) { draftCards.splice(i, 1); renderSublists(); }

function renderSublists() {
  document.getElementById("goals-sublist").innerHTML = draftGoals.map((g, i) =>
    `<div class="sublist-item"><span>⚽ ${esc(g.player)} (${esc(g.team)}) — ${g.count} هدف</span>
     <button class="btn-danger btn-sm" onclick="removeGoal(${i})">حذف</button></div>`).join("")
    || `<p class="hint" style="margin:6px 0 0">لا يوجد هدافون بعد</p>`;

  document.getElementById("assists-sublist").innerHTML = draftAssists.map((a, i) =>
    `<div class="sublist-item"><span>🎯 ${esc(a.player)} (${esc(a.team)}) — ${a.count} تمريرة</span>
     <button class="btn-danger btn-sm" onclick="removeAssist(${i})">حذف</button></div>`).join("")
    || `<p class="hint" style="margin:6px 0 0">لا توجد تمريرات حاسمة بعد</p>`;

  document.getElementById("cards-sublist").innerHTML = draftCards.map((c, i) =>
    `<div class="sublist-item"><span>${c.type === "yellow" ? "🟨" : "🟥"} ${esc(c.player)} (${esc(c.team)})</span>
     <button class="btn-danger btn-sm" onclick="removeCard(${i})">حذف</button></div>`).join("")
    || `<p class="hint" style="margin:6px 0 0">لا توجد بطاقات بعد</p>`;
}

function saveMatchEditor() {
  const group = document.getElementById("ed-group").value;
  const round = parseInt(document.getElementById("ed-round").value, 10) || 1;
  const home = document.getElementById("ed-home").value;
  const away = document.getElementById("ed-away").value;
  const status = document.getElementById("ed-status").value;
  const homeScore = status === "finished" ? (parseInt(document.getElementById("ed-scoreHome").value, 10) || 0) : null;
  const awayScore = status === "finished" ? (parseInt(document.getElementById("ed-scoreAway").value, 10) || 0) : null;

  if (!home || !away || home === away) {
    alert("اختر فريقين مختلفين");
    return;
  }

  const match = {
    id: editingMatchIndex !== null ? TOURNAMENT_DATA.matches[editingMatchIndex].id : "m" + Date.now(),
    round, group, status, home, away, homeScore, awayScore,
    date: document.getElementById("ed-date").value.trim(),
    time: document.getElementById("ed-time").value.trim(),
    goals: status === "finished" ? draftGoals : [],
    assists: status === "finished" ? draftAssists : [],
    cards: status === "finished" ? draftCards : []
  };

  if (editingMatchIndex !== null) TOURNAMENT_DATA.matches[editingMatchIndex] = match;
  else TOURNAMENT_DATA.matches.push(match);

  persist();
  renderMatchesTable();
  closeMatchEditor();
}

/* ---------------- محرر الفرق واللاعبين ---------------- */
function populateTeamSelect() {
  const sel = document.getElementById("team-select");
  sel.innerHTML = GROUP_NAMES.map(g => {
    const teams = TOURNAMENT_DATA.teams.filter(t => t.group === g);
    return `<optgroup label="المجموعة ${g}">${teams.map(t =>
      `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</optgroup>`;
  }).join("");
}
function renderSquadEditor() {
  const teamId = document.getElementById("team-select").value;
  const team = getTeam(teamId);
  if (!team) return;
  const el = document.getElementById("squad-editor");
  el.innerHTML = `
    <table class="admin-table">
      <tr><th>اللاعب</th><th></th></tr>
      ${team.players.map((p, i) => `
        <tr>
          <td>${esc(p)}</td>
          <td><button class="btn-danger btn-sm" onclick="removePlayer('${teamId}', ${i})">حذف</button></td>
        </tr>`).join("")}
    </table>
    <div class="row3">
      <input type="text" id="new-player-name" placeholder="اسم اللاعب الجديد" style="grid-column:1/3">
      <button class="btn-primary btn-sm" onclick="addPlayer('${teamId}')">+ إضافة</button>
    </div>
  `;
}
function addPlayer(teamId) {
  const name = document.getElementById("new-player-name").value.trim();
  if (!name) return;
  const team = getTeam(teamId);
  team.players.push(name);
  persist();
  renderSquadEditor();
}
function removePlayer(teamId, index) {
  const team = getTeam(teamId);
  team.players.splice(index, 1);
  persist();
  renderSquadEditor();
}

/* ============================================================
   تبويب الدور الإقصائي (ربع النهائي / نصف النهائي / النهائي)
   منطق منفصل بمعرّفات ko-* حتى لا يتعارض مع محرر مباريات النتائج
   ============================================================ */
let koDraftGoals = [];
let koDraftAssists = [];
let koDraftCards = [];
let editingKoId = null;

function renderKnockoutTable() {
  const el = document.getElementById("knockout-table");
  const list = getKnockoutMatches();
  const rows = list.map((m) => {
    const scoreTxt = m.status === "finished" ? `${m.homeScore} - ${m.awayScore}` : "لم تُلعب بعد";
    return `<tr>
      <td>${esc(m.stage)}</td>
      <td>${m.home ? esc(m.home) : "<i>لم يتحدد</i>"} × ${m.away ? esc(m.away) : "<i>لم يتحدد</i>"}</td>
      <td>${scoreTxt}</td>
      <td><button class="btn-ghost btn-sm" onclick="openKoEditor('${m.id}')">تعديل</button></td>
    </tr>`;
  }).join("");
  el.innerHTML = `<tr><th>المرحلة</th><th>المباراة</th><th>النتيجة</th><th></th></tr>${rows}`;
}

function openKoEditor(id) {
  editingKoId = id;
  const m = getKnockoutMatches().find(x => x.id === id);
  koDraftGoals = JSON.parse(JSON.stringify(m.goals || []));
  koDraftAssists = JSON.parse(JSON.stringify(m.assists || []));
  koDraftCards = JSON.parse(JSON.stringify(m.cards || []));
  document.getElementById("ko-editor").classList.remove("hidden");
  document.getElementById("ko-editor-body").innerHTML = koEditorTemplate(m);
  koFillTeamSelects(m.home, m.away);
  koToggleScoreFields();
  koRenderSublists();
  document.getElementById("ko-editor").scrollIntoView({ behavior: "smooth" });
}
function closeKoEditor() {
  document.getElementById("ko-editor").classList.add("hidden");
}

function koEditorTemplate(m) {
  return `
    <div class="field"><label>المرحلة</label>
      <input type="text" value="${esc(m.stage)}" disabled>
    </div>
    <div class="row2">
      <div class="field"><label>الفريق المستضيف</label><select id="ko-ed-home"></select></div>
      <div class="field"><label>الفريق الضيف</label><select id="ko-ed-away"></select></div>
    </div>
    <div class="field"><label>حالة المباراة</label>
      <select id="ko-ed-status" onchange="koToggleScoreFields()">
        <option value="upcoming" ${m.status === "upcoming" ? "selected" : ""}>لم تُلعب بعد / لم يتحدد الفريقان</option>
        <option value="finished" ${m.status === "finished" ? "selected" : ""}>منتهية</option>
      </select>
    </div>
    <div class="row2" id="ko-ed-score-fields">
      <div class="field"><label>أهداف الفريق المستضيف</label>
        <input type="number" id="ko-ed-scoreHome" value="${m.homeScore ?? 0}" min="0"></div>
      <div class="field"><label>أهداف الفريق الضيف</label>
        <input type="number" id="ko-ed-scoreAway" value="${m.awayScore ?? 0}" min="0"></div>
    </div>
    <div class="row2">
      <div class="field"><label>التاريخ (اختياري)</label>
        <input type="text" id="ko-ed-date" value="${esc(m.date || "")}" placeholder="مثال: 30/8/2026"></div>
      <div class="field"><label>الوقت (اختياري)</label>
        <input type="text" id="ko-ed-time" value="${esc(m.time || "")}" placeholder="مثال: 17:15"></div>
    </div>

    <div class="field"><label>الهدافون</label>
      <div class="row3">
        <select id="ko-ed-goal-team"></select>
        <input type="text" id="ko-ed-goal-name" placeholder="اسم اللاعب">
        <input type="number" id="ko-ed-goal-count" value="1" min="1" style="width:90px">
      </div>
      <button class="btn-ghost btn-sm" style="margin-top:6px" onclick="koAddGoal()">+ إضافة هدف</button>
      <div class="sublist" id="ko-goals-sublist"></div>
    </div>

    <div class="field"><label>صناع الأهداف (تمريرات حاسمة)</label>
      <div class="row3">
        <select id="ko-ed-assist-team"></select>
        <input type="text" id="ko-ed-assist-name" placeholder="اسم اللاعب">
        <input type="number" id="ko-ed-assist-count" value="1" min="1" style="width:90px">
      </div>
      <button class="btn-ghost btn-sm" style="margin-top:6px" onclick="koAddAssist()">+ إضافة تمريرة</button>
      <div class="sublist" id="ko-assists-sublist"></div>
    </div>

    <div class="field"><label>البطاقات</label>
      <div class="row3">
        <select id="ko-ed-card-team"></select>
        <input type="text" id="ko-ed-card-name" placeholder="اسم اللاعب">
        <select id="ko-ed-card-type" style="width:110px">
          <option value="yellow">صفراء</option>
          <option value="red">حمراء</option>
        </select>
      </div>
      <button class="btn-ghost btn-sm" style="margin-top:6px" onclick="koAddCard()">+ إضافة بطاقة</button>
      <div class="sublist" id="ko-cards-sublist"></div>
    </div>
  `;
}

/* الفرق فالإقصائي تُختار من الـ12 فريق كاملين (بلا تحديد بمجموعة) */
function koFillTeamSelects(selectedHome, selectedAway) {
  const opts = (selected) => `<option value="">— لم يتحدد بعد —</option>` +
    TOURNAMENT_DATA.teams.map(t =>
      `<option value="${esc(t.name)}" ${t.name === selected ? "selected" : ""}>${esc(t.name)}</option>`).join("");
  document.getElementById("ko-ed-home").innerHTML = opts(selectedHome);
  document.getElementById("ko-ed-away").innerHTML = opts(selectedAway);
  const teamOnlyOpts = TOURNAMENT_DATA.teams.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join("");
  ["ko-ed-goal-team", "ko-ed-assist-team", "ko-ed-card-team"].forEach(id => {
    document.getElementById(id).innerHTML = teamOnlyOpts;
  });
}
function koToggleScoreFields() {
  const finished = document.getElementById("ko-ed-status").value === "finished";
  document.getElementById("ko-ed-score-fields").style.opacity = finished ? "1" : ".4";
}

function koAddGoal() {
  const team = document.getElementById("ko-ed-goal-team").value;
  const player = document.getElementById("ko-ed-goal-name").value.trim();
  const count = parseInt(document.getElementById("ko-ed-goal-count").value, 10) || 1;
  if (!player || !team) return;
  koDraftGoals.push({ team, player, count });
  document.getElementById("ko-ed-goal-name").value = "";
  koRenderSublists();
}
function koRemoveGoal(i) { koDraftGoals.splice(i, 1); koRenderSublists(); }

function koAddAssist() {
  const team = document.getElementById("ko-ed-assist-team").value;
  const player = document.getElementById("ko-ed-assist-name").value.trim();
  const count = parseInt(document.getElementById("ko-ed-assist-count").value, 10) || 1;
  if (!player || !team) return;
  koDraftAssists.push({ team, player, count });
  document.getElementById("ko-ed-assist-name").value = "";
  koRenderSublists();
}
function koRemoveAssist(i) { koDraftAssists.splice(i, 1); koRenderSublists(); }

function koAddCard() {
  const team = document.getElementById("ko-ed-card-team").value;
  const player = document.getElementById("ko-ed-card-name").value.trim();
  const type = document.getElementById("ko-ed-card-type").value;
  if (!player || !team) return;
  koDraftCards.push({ team, player, type });
  document.getElementById("ko-ed-card-name").value = "";
  koRenderSublists();
}
function koRemoveCard(i) { koDraftCards.splice(i, 1); koRenderSublists(); }

function koRenderSublists() {
  document.getElementById("ko-goals-sublist").innerHTML = koDraftGoals.map((g, i) =>
    `<div class="sublist-item"><span>⚽ ${esc(g.player)} (${esc(g.team)}) — ${g.count} هدف</span>
     <button class="btn-danger btn-sm" onclick="koRemoveGoal(${i})">حذف</button></div>`).join("")
    || `<p class="hint" style="margin:6px 0 0">لا يوجد هدافون بعد</p>`;

  document.getElementById("ko-assists-sublist").innerHTML = koDraftAssists.map((a, i) =>
    `<div class="sublist-item"><span>🎯 ${esc(a.player)} (${esc(a.team)}) — ${a.count} تمريرة</span>
     <button class="btn-danger btn-sm" onclick="koRemoveAssist(${i})">حذف</button></div>`).join("")
    || `<p class="hint" style="margin:6px 0 0">لا توجد تمريرات حاسمة بعد</p>`;

  document.getElementById("ko-cards-sublist").innerHTML = koDraftCards.map((c, i) =>
    `<div class="sublist-item"><span>${c.type === "yellow" ? "🟨" : "🟥"} ${esc(c.player)} (${esc(c.team)})</span>
     <button class="btn-danger btn-sm" onclick="koRemoveCard(${i})">حذف</button></div>`).join("")
    || `<p class="hint" style="margin:6px 0 0">لا توجد بطاقات بعد</p>`;
}

function saveKoEditor() {
  const home = document.getElementById("ko-ed-home").value;
  const away = document.getElementById("ko-ed-away").value;
  const status = document.getElementById("ko-ed-status").value;
  const homeScore = status === "finished" ? (parseInt(document.getElementById("ko-ed-scoreHome").value, 10) || 0) : null;
  const awayScore = status === "finished" ? (parseInt(document.getElementById("ko-ed-scoreAway").value, 10) || 0) : null;

  if (status === "finished" && (!home || !away || home === away)) {
    alert("لازم تختار فريقين مختلفين قبل ما تسجل المباراة كمنتهية");
    return;
  }

  const list = getKnockoutMatches();
  const idx = list.findIndex(x => x.id === editingKoId);
  list[idx] = {
    ...list[idx],
    home, away, status, homeScore, awayScore,
    date: document.getElementById("ko-ed-date").value.trim(),
    time: document.getElementById("ko-ed-time").value.trim(),
    goals: status === "finished" ? koDraftGoals : [],
    assists: status === "finished" ? koDraftAssists : [],
    cards: status === "finished" ? koDraftCards : []
  };

  persist();
  renderKnockoutTable();
  closeKoEditor();
}
