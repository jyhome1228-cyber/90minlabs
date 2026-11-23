(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const leagueKeys = ["epl", "championship", "laliga", "seriea", "bundesliga", "ligue1", "ucl", "uel", "uecl"];
  const shortLeagues = { epl: "EPL", championship: "챔피언십", laliga: "LA LIGA", seriea: "SERIE A", bundesliga: "분데스리가", ligue1: "LIGUE 1", ucl: "UCL", uel: "UEL", uecl: "UECL" };
  const choices = { H: "승", D: "무", A: "패" };
  const choiceNames = { H: "홈 승리", D: "무승부", A: "원정 승리" };
  const gradeNames = { correct: "적중", incorrect: "미적중", pending: "결과 대기", void: "집계 제외" };
  const searchKey = value => String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFC").replace(/[^a-z0-9가-힣]/g, "");
  const params = new URLSearchParams(location.search);
  const state = { accountMode: false, context: null, store: null, sets: [], storageReady: false, loading: false, week: "", league: "all", query: "", filter: "available", historyWeek: "all", picks: new Map(), editingId: null, editingUpdatedAt: null, baseline: "", highlighted: null, currentDay: "" };
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = String(text); return node; };
  const shiftDate = (iso, days) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const dateLabel = (iso, long) => new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", ...(long ? { year: "numeric" } : {}), month: "long", day: "numeric", weekday: long ? undefined : "short" }).format(new Date(iso + "T12:00:00Z"));
  const shortDate = iso => Number(iso.slice(5, 7)) + "." + Number(iso.slice(8, 10));
  const weekLabel = week => week.slice(0, 4) + ". " + shortDate(week) + " – " + shortDate(PredictionStore.weekEnd(week));
  const defaultTitle = () => shortDate(state.week) + " – " + shortDate(PredictionStore.weekEnd(state.week)) + " 주간 예측";
  function notice(message) { $("pageNotice").textContent = message; $("pageNotice").hidden = !message; }
  function storageFailure(error) {
    state.storageReady = false;
    $("storageErrorMessage").textContent = error && error.message || "기록을 저장할 수 없습니다. 브라우저의 저장 공간 설정을 확인해 주세요.";
    $("storageError").hidden = false;
    $("saveSet").disabled = true;
    $("exportRecords").disabled = true;
  }
  function loadSaved() {
    try { state.sets = state.store.load().sets; state.storageReady = true; $("storageError").hidden = true; return true; }
    catch (error) { storageFailure(error); return false; }
  }
  function fingerprint() {
    return JSON.stringify([$("setTitle").value, Array.from(state.picks.values(), p => [p.fixtureId, p.selection]).sort((a, b) => a[0].localeCompare(b[0]))]);
  }
  function isDirty() { return state.baseline && state.baseline !== fingerprint(); }
  function commitBaseline() { state.baseline = fingerprint(); }
  function confirmAction(title, message, action) {
    const dialog = $("confirmDialog");
    if (dialog.open) return Promise.resolve(false);
    $("confirmTitle").textContent = title; $("confirmMessage").textContent = message; $("confirmAction").textContent = action;
    if (typeof dialog.showModal !== "function") return Promise.resolve(window.confirm(message));
    dialog.returnValue = "cancel";
    return new Promise(resolve => { dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }); dialog.showModal(); });
  }
  async function allowDiscard() { return !isDirty() || await confirmAction("저장하지 않은 예측이 있습니다", "지금 선택한 내용은 저장되지 않았습니다. 계속 이동할까요?", "이동하기"); }
  function draftReset(week) {
    state.week = week; state.picks.clear(); state.editingId = null; state.editingUpdatedAt = null; state.highlighted = null;
    $("setTitle").value = defaultTitle(); $("saveStatus").textContent = ""; commitBaseline();
  }
  function updateLocation() {
    const url = new URL(location.href); url.searchParams.set("week", state.week); url.searchParams.delete("match");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  function renderWeek() {
    $("weekLabel").textContent = weekLabel(state.week); $("weekDate").value = state.week;
    $("slipWeek").textContent = shortDate(state.week) + " – " + shortDate(PredictionStore.weekEnd(state.week));
  }
  function descriptor(fixture, side) {
    if (!fixture) return { name: "경기 정보 확인 중", profile: null };
    return state.context && state.context.teamFor ? state.context.teamFor(fixture, side) : { name: fixture[side], profile: null, crestId: fixture[side + "Crest"] };
  }
  function teamName(fixture, side) { return descriptor(fixture, side).name || fixture && fixture[side] || "구단"; }
  function fixtureFor(pick) { return state.context && state.context.findMatch(pick.fixtureId) || pick.snapshot || null; }
  function previousPick(id) { const set = state.sets.find(item => item.id === state.editingId); return set && set.picks.find(pick => pick.fixtureId === id); }
  function lockedPick(pick) {
    const saved = previousPick(pick.fixtureId);
    return Boolean(saved && PredictionStore.gradePick(saved, state.context, Date.now()).locked);
  }
  function fixtureStatus(fixture) {
    if (fixture.status === "finished" && Array.isArray(fixture.score) && fixture.score.length === 2 && fixture.score.every(n => Number.isInteger(n) && n >= 0)) return fixture.score[0] + " : " + fixture.score[1] + " · 종료";
    if (fixture.status === "postponed") return "연기";
    if (["cancelled", "canceled"].includes(fixture.status)) return "취소";
    if (!PredictionStore.kickoffMs(fixture)) return "시간 미정";
    return PredictionStore.canPick(fixture, Date.now()) ? "" : "선택 마감";
  }
  const crestLookups = new Map();
  function validImageUrl(value) { return typeof value === "string" && /^https:\/\//i.test(value) ? value : null; }
  function badge(fixture, side) {
    const team=descriptor(fixture, side), profile=team.profile||{};
    const label=team.name||fixture&&fixture[side]||"FC";
    const holder=el("span","pick-badge",(label.replace(/[^\\p{L}\\p{N}]/gu,"").slice(0,2)||"FC").toUpperCase());
    holder.setAttribute("aria-hidden","true");
    holder.title=label;
    const crestId=fixture&&fixture[side+"Crest"]||team.crestId||profile.crestId;
    const direct=validImageUrl(profile.badgeUrl)||validImageUrl(team.badgeUrl);
    const known=direct||(crestId&&/^\\d+$/.test(String(crestId))?"https://crests.football-data.org/"+encodeURIComponent(String(crestId))+".png":null);
    const query=profile.searchName||fixture&&(fixture[side+"Team"]||fixture[side])||label;
    let fallbackAttempted=false;
    function requestFallback(){
      if(fallbackAttempted||!query)return;
      fallbackAttempted=true;
      if(!crestLookups.has(query)){
        const promise=fetch("https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t="+encodeURIComponent(query))
          .then(resp=>resp.ok?resp.json():null)
          .then(data=>{
            const candidates=(data?.teams||[]).filter(x=>x.strSport==="Soccer"&&validImageUrl(x.strBadge));
            const norm=x=>String(x||"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,"");
            const searched=norm(query);
            const matched=candidates.find(x=>norm(x.strTeam)===searched||String(x.strTeamAlternate||"").split(";").some(a=>norm(a)===searched));
            return validImageUrl(matched?.strBadge)||null;
          }).catch(()=>null);
        crestLookups.set(query,promise);
      }
      crestLookups.get(query).then(url=>{if(url&&holder.isConnected)showImage(url,false);});
    }
    function showImage(url,allowFallback){
      const img=el("img");img.alt="";img.loading="lazy";img.decoding="async";img.width=28;img.height=28;
      img.onload=()=>{if(holder.isConnected)holder.replaceChildren(img);};
      img.onerror=()=>{img.remove();if(allowFallback)requestFallback();};
      img.src=url;
    }
    if(known)showImage(known,true);else requestFallback();
    return holder;
  }
  function choiceGroup(fixture, id, selected, disabled, area) {
    const group = el("div", "choice-group"); group.setAttribute("role", "group"); group.setAttribute("aria-label", teamName(fixture, "home") + " 대 " + teamName(fixture, "away") + " 예측");
    Object.entries(choices).forEach(([choice, label]) => {
      const button = el("button", "choice-button", label); button.type = "button"; button.dataset.fixtureId = id; button.dataset.choice = choice; button.dataset.area = area;
      button.setAttribute("aria-pressed", String(choice === selected)); button.setAttribute("aria-label", choice === "D" ? "무승부 선택" : teamName(fixture, choice === "H" ? "home" : "away") + " 승리 선택");
      button.disabled = disabled; group.append(button);
    });
    return group;
  }
  function rowFor(fixture) {
    const id = MatchAnalysis.fixtureId(fixture), pick = state.picks.get(id), canPick = PredictionStore.canPick(fixture, Date.now());
    const row = el("article", "pick-row" + (state.highlighted === id ? " is-highlighted" : "")); row.dataset.matchId = id;
    const time = el("div", "pick-time"); time.append(el("strong", "", fixture.time || "미정"), el("span", "", shortLeagues[fixture.league] || MatchAnalysis.leagueLabel(fixture.league)));
    const match = el("div", "pick-match"), teams = el("div", "pick-teams");
    ["home", "away"].forEach((side, index) => {
      if (index) teams.append(el("span", "pick-versus", "vs"));
      const team = el("div", "pick-team " + side); team.append(badge(fixture, side), el("span", "pick-team-name", teamName(fixture, side))); teams.append(team);
    });
    match.append(teams); const status = fixtureStatus(fixture); if (status) match.append(el("div", "pick-result", status));
    const analysis = el("a", "pick-analysis", "분석"); analysis.href = MatchAnalysis.matchUrl(fixture); analysis.setAttribute("aria-label", teamName(fixture, "home") + " 대 " + teamName(fixture, "away") + " 경기 분석");
    row.append(time, match, choiceGroup(fixture, id, pick && pick.selection, !canPick || Boolean(pick && lockedPick(pick)), "list"), analysis);
    return row;
  }
  function queryMatches(fixture) {
    if (!state.query) return true;
    const words = [fixture.home, fixture.away];
    ["home", "away"].forEach(side => { const team = descriptor(fixture, side); words.push(team.name, team.profile && team.profile.wikiKo, team.profile && team.profile.searchName); });
    return searchKey(words.filter(Boolean).join(" ")).includes(searchKey(state.query));
  }
  function renderFixtures() {
    if (!state.context) return;
    const end = PredictionStore.weekEnd(state.week), now = Date.now();
    const weekMatches = state.context.matches.filter(m => m.date >= state.week && m.date <= end);
    const filtered = weekMatches.filter(m => (state.league === "all" || m.league === state.league) && queryMatches(m) && (state.filter === "all" || (state.filter === "selected" ? state.picks.has(MatchAnalysis.fixtureId(m)) : PredictionStore.canPick(m, now))));
    filtered.sort((a, b) => (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99")) || a.league.localeCompare(b.league));
    $("fixtureCount").textContent = filtered.length + "경기" + (state.picks.size ? " · " + state.picks.size + "경기 선택" : "");
    const list = $("fixtureList"); list.replaceChildren();
    if (!filtered.length) {
      const empty = el("div", "empty-state");
      empty.append(el("strong", "", state.filter === "selected" ? "아직 선택한 경기가 없습니다." : "조건에 맞는 경기가 없습니다."));
      empty.append(el("p", "", !weekMatches.length ? "다른 주간의 경기를 확인해 보세요." : state.filter === "selected" ? "승·무·패를 선택하면 나의 예측에 담깁니다." : "대회·검색 조건을 바꾸거나 전체 경기를 확인해 보세요."));
      if (weekMatches.length) { const reset = el("button", "text-button", "전체 경기 보기"); reset.type = "button"; reset.dataset.action = "reset-filters"; empty.append(reset); }
      list.append(empty); return;
    }
    let lastDate = "", group;
    filtered.forEach(fixture => {
      if (fixture.date !== lastDate) { lastDate = fixture.date; group = el("section", "fixture-day"); const title = el("h4", "", dateLabel(fixture.date)); group.append(title); list.append(group); }
      group.append(rowFor(fixture));
    });
  }
  function renderSlip() {
    $("slipTitle").textContent = state.editingId ? "저장한 예측 수정" : "나의 예측";
    $("selectionCount").textContent = state.picks.size + "경기 선택";
    $("saveSet").textContent = state.editingId ? "변경 내용 저장" : "예측 묶음 저장";
    $("saveSet").disabled = !state.storageReady || !state.context || !state.picks.size;
    const target = $("selectedPicks"); target.replaceChildren();
    if (!state.picks.size) { target.append(el("p", "slip-empty", "관심 있는 경기의 승·무·패를 선택하세요. 여러 경기를 하나의 묶음으로 기록할 수 있습니다.")); return; }
    const sorted = Array.from(state.picks.values()).sort((a, b) => { const af = fixtureFor(a) || {}, bf = fixtureFor(b) || {}; return String(af.date + af.time).localeCompare(String(bf.date + bf.time)); });
    sorted.forEach(pick => {
      const fixture = fixtureFor(pick), locked = lockedPick(pick), available = fixture && PredictionStore.canPick(fixture, Date.now());
      const card = el("div", "selected-pick"), top = el("div", "selected-pick-top");
      top.append(el("span", "selected-pick-time", fixture ? shortDate(fixture.date) + " · " + (fixture.time || "시간 미정") + " · " + (shortLeagues[fixture.league] || fixture.league) : "경기 정보 확인 중"));
      if (!locked) { const remove = el("button", "remove-pick", "제외"); remove.type = "button"; remove.dataset.remove = pick.fixtureId; remove.setAttribute("aria-label", (fixture ? teamName(fixture, "home") + " 대 " + teamName(fixture, "away") : "선택한 경기") + " 제외"); top.append(remove); }
      else top.append(el("span", "locked-label", "선택 마감"));
      const pickClubs=el("div","selected-pick-clubs");
      if(fixture){pickClubs.append(badge(fixture,"home"),el("span","",teamName(fixture,"home")),el("span","pick-versus","vs"),badge(fixture,"away"),el("span","",teamName(fixture,"away")));}
      else pickClubs.append(el("span","","일정 확인이 필요한 경기"));
      card.append(top,pickClubs);
      const bottom = el("div", "selected-pick-bottom"); bottom.append(choiceGroup(fixture, pick.fixtureId, pick.selection, locked || !available, "slip"));
      if (locked) { const grade = PredictionStore.gradePick(pick, state.context, Date.now()); bottom.append(el("span", "selected-pick-status", gradeNames[grade.status])); }
      else if (!available) bottom.append(el("span", "selected-pick-status", "마감된 경기 · 제외 필요"));
      card.append(bottom); target.append(card);
    });
  }
  function updateChoice(id, choice, area) {
    const fixture = state.context && state.context.findMatch(id), pick = state.picks.get(id);
    if (!fixture || !PredictionStore.canPick(fixture, Date.now()) || pick && lockedPick(pick)) { $("saveStatus").textContent = "경기가 시작되어 선택을 변경할 수 없습니다."; renderFixtures(); renderSlip(); return; }
    if (!pick && state.picks.size >= 100) { $("saveStatus").textContent = "한 묶음에는 100경기까지 담을 수 있습니다."; return; }
    state.picks.set(id, Object.assign({}, pick || {}, { fixtureId: id, selection: choice }));
    $("saveStatus").textContent = ""; renderFixtures(); renderSlip();
    const buttons = document.querySelectorAll("button[data-fixture-id]");
    const button = Array.from(buttons).find(node => node.dataset.fixtureId === id && node.dataset.choice === choice && node.dataset.area === area);
    if (button) button.focus({ preventScroll: true });
  }
  function gradeSummary(set) { return PredictionStore.gradeSet(set, state.context, Date.now()); }
  function formattedSavedAt(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date) : ""; }
  function savedRow(pick) {
    const fixture = pick.fixture || fixtureFor(pick), row = el("div", "saved-pick");
    row.append(el("span", "saved-pick-date", fixture ? shortDate(fixture.date) + " " + (fixture.time || "미정") : "일정 확인 중"));
    const name = el(fixture && state.context && state.context.findMatch(pick.fixtureId) ? "a" : "span", "saved-pick-name", fixture ? teamName(fixture, "home") + " vs " + teamName(fixture, "away") : "경기 정보 확인 중");
    if (name.tagName === "A") name.href = MatchAnalysis.matchUrl(fixture);
    const named=el("span","saved-pick-clubs");
    if(fixture){named.append(badge(fixture,"home"),badge(fixture,"away"));}
    named.append(name);
    row.append(named,el("span","saved-pick-choice","선택 "+choices[pick.selection]),el("span","saved-pick-score",pick.score?pick.score.join(" : "):"—"));
    const grade = el("span", "grade-label " + pick.status, gradeNames[pick.status]);
    if (pick.reason) grade.title = pick.reason;
    row.append(grade); return row;
  }
  function renderSaved() {
    const setCount = state.sets.length; $("savedCount").textContent = setCount;
    $("exportRecords").disabled = !state.storageReady || !setCount;
    const grades = state.context ? state.sets.map(gradeSummary) : [];
    const total = grades.reduce((out, item) => { ["total", "settled", "correct", "pending", "void"].forEach(key => out[key] += item[key]); return out; }, { total: 0, settled: 0, correct: 0, pending: 0, void: 0 });
    $("statSets").textContent = setCount; $("statPicks").textContent = state.sets.reduce((n, set) => n + set.picks.length, 0);
    $("statCorrect").textContent = total.settled ? total.correct : "—"; $("statAccuracy").textContent = total.settled ? Math.round(total.correct / total.settled * 100) + "%" : "—";
    $("statSettled").textContent = total.settled ? "종료 " + total.settled + "경기 기준" : "결과 확인 전";
    const weeks = [...new Set(state.sets.map(set => set.weekStart))].sort().reverse();
    if (state.historyWeek !== "all" && !weeks.includes(state.historyWeek)) state.historyWeek = "all";
    const select = $("historyWeek"); select.replaceChildren(new Option("모든 주간", "all")); weeks.forEach(week => select.append(new Option(weekLabel(week), week))); select.value = state.historyWeek;
    const target = $("savedSets"); target.replaceChildren();
    if (!setCount) { const empty = el("div", "empty-state"); empty.append(el("strong", "", "아직 저장한 예측이 없습니다."), el("p", "", "경기를 선택하고 첫 번째 주간 예측을 남겨보세요.")); target.append(empty); return; }
    weeks.filter(week => state.historyWeek === "all" || week === state.historyWeek).forEach(week => {
      const group = el("section", "saved-week"); group.append(el("h3", "saved-week-title", weekLabel(week)));
      state.sets.filter(set => set.weekStart === week).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach(set => {
        const summary = gradeSummary(set), article = el("article", "saved-set"); article.dataset.setId = set.id;
        const header = el("div", "saved-set-header"), title = el("div"); title.append(el("h4", "", set.title), el("p", "saved-set-meta", formattedSavedAt(set.updatedAt) + " 저장 · 한국시간"));
        const actions = el("div", "saved-set-actions"); [["edit", "불러오기"], ["delete", "삭제"]].forEach(([action, label]) => { const button = el("button", "text-button", label); button.type = "button"; button.dataset.setAction = action; button.dataset.setId = set.id; button.setAttribute("aria-label", set.title + " " + label); actions.append(button); });
        header.append(title, actions); article.append(header);
        const stats = el("div", "saved-set-summary"); stats.append(el("strong", "", summary.total + "경기"), el("span", "", "적중 " + summary.correct + " · 미적중 " + summary.incorrect), el("span", "", "대기 " + summary.pending + (summary.void ? " · 제외 " + summary.void : "")), el("span", "", "적중률 " + (summary.settled ? Math.round(summary.correct / summary.settled * 100) + "%" : "—")));
        article.append(stats); const details = el("details"); details.append(el("summary", "", "경기 " + summary.total + "개 보기"));
        const rows = el("div", "saved-picks"); summary.picks.forEach(pick => rows.append(savedRow(pick))); details.append(rows); article.append(details); group.append(article);
      });
      target.append(group);
    });
  }
  function render() { renderWeek(); renderFixtures(); renderSlip(); renderSaved(); }
  async function changeWeek(week) {
    if (!week || week === state.week) { renderWeek(); return; }
    if (!await allowDiscard()) { renderWeek(); return; }
    draftReset(week); state.query = ""; $("fixtureSearch").value = ""; updateLocation(); render(); notice("");
  }
  async function save(event) {
    event.preventDefault(); if (!state.store || !state.context || !state.storageReady) return;
    $("saveSet").disabled = true;
    try {
      const saved = state.store.saveSet({ id: state.editingId || undefined, expectedUpdatedAt: state.editingUpdatedAt || undefined, weekStart: state.week, title: $("setTitle").value.trim() || defaultTitle(), picks: Array.from(state.picks.values(), p => ({ fixtureId: p.fixtureId, selection: p.selection })) }, state.context);
      state.editingId = saved.id; state.editingUpdatedAt = saved.updatedAt; state.picks = new Map(saved.picks.map(pick => [pick.fixtureId, pick])); $("setTitle").value = saved.title;
      if (!loadSaved()) return; commitBaseline(); render();
      $("saveStatus").textContent = "예측 묶음이 저장되었습니다.";
      notice(saved.title + " · " + saved.picks.length + "경기의 예측을 저장했습니다.");
       if (state.accountMode) window.dispatchEvent(new CustomEvent("ninetymin:local-change"));
    } catch (error) { $("saveStatus").textContent = error.message || "저장하지 못했습니다. 다시 시도해 주세요."; if (/CORRUPT|UNSUPPORTED|STORAGE_(?:UNAVAILABLE|READ_FAILED|WRITE_FAILED|FULL)/.test(error.code || "")) storageFailure(error); if (error.code === "STORAGE_CONFLICT") { loadSaved(); renderSaved(); } }
    finally { $("saveSet").disabled = !state.storageReady || !state.picks.size; }
  }
  async function editSet(id) {
    if (!await allowDiscard()) return;
    if (!loadSaved()) return; const set = state.sets.find(item => item.id === id); if (!set) { renderSaved(); return; }
    state.week = set.weekStart; state.editingId = id; state.editingUpdatedAt = set.updatedAt; state.picks = new Map(set.picks.map(pick => [pick.fixtureId, pick])); state.highlighted = null;
    $("setTitle").value = set.title; $("saveStatus").textContent = "저장한 예측을 불러왔습니다.";
    state.league = "all"; state.query = ""; state.filter = "all"; $("leagueFilter").value = "all"; $("fixtureSearch").value = ""; $("fixtureFilter").value = "all";
    commitBaseline(); updateLocation(); render(); $("predictionBuilder").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function deleteSet(id) {
    const set = state.sets.find(item => item.id === id); if (!set) return;
    if (!await confirmAction("예측 기록을 삭제할까요?", "‘" + set.title + "’ 묶음과 저장된 선택이 삭제됩니다. 삭제한 기록은 되돌릴 수 없습니다.", "삭제하기")) return;
    try { state.store.deleteSet(id, state.context); if (!loadSaved()) return; if (state.editingId === id) draftReset(state.week); render(); notice("예측 묶음을 삭제했습니다."); if (state.accountMode) window.dispatchEvent(new CustomEvent("ninetymin:local-change")); }
    catch (error) { notice(error.message || "기록을 삭제하지 못했습니다."); }
  }
  function exportRecords() {
    if (!loadSaved() || !state.sets.length) return;
    const headers = ["주간 시작", "주간 종료", "묶음 이름", "경기 날짜", "한국시간", "대회", "홈팀", "원정팀", "내 예측", "경기 결과", "확인 상태", "예측 저장 시각 (한국시간)"];
    const rows = [headers];
    state.sets.forEach(set => gradeSummary(set).picks.forEach(pick => {
      const fixture = pick.fixture || fixtureFor(pick) || {};
      const savedKst = new Date(Date.parse(pick.savedAt) + 9 * 3600000).toISOString().slice(0, 19).replace("T", " ");
      rows.push([set.weekStart, PredictionStore.weekEnd(set.weekStart), set.title, fixture.date || "", fixture.time || "", MatchAnalysis.leagueLabel(fixture.league), fixture.home || "", fixture.away || "", choiceNames[pick.selection], pick.score ? pick.score.join(":") : "", gradeNames[pick.status], savedKst]);
    }));
    const quote = value => { let text = String(value == null ? "" : value); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
    const blob = new Blob(["\ufeff" + rows.map(row => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), anchor = el("a"); anchor.href = url; anchor.download = "90minlabs-predictions-" + PredictionStore.kstDate(Date.now()) + ".csv"; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice("예측 기록을 CSV 파일로 내보냈습니다.");
  }
  async function json(path) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try { const response = await fetch(path, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error("일정을 불러오지 못했습니다."); return await response.json(); }
    finally { clearTimeout(timer); }
  }
  async function loadFixtures() {
    if (state.loading) return; state.loading = true; $("fixturesLoading").hidden = false; $("fixturesError").hidden = true; $("builderContent").hidden = true;
    try {
      const results = await Promise.allSettled([json("data/match-calendar.json"), json("data/team-profiles.json")]);
      if (results[0].status !== "fulfilled" || !Array.isArray(results[0].value.matches)) throw new Error("Calendar unavailable");
      state.context = MatchAnalysis.createContext({ calendar: results[0].value, profiles: results[1].status === "fulfilled" ? results[1].value : {} });
      const requestedId = params.get("match"), requested = requestedId && state.context.findMatch(requestedId);
      if (requested) { draftReset(PredictionStore.weekStart(requested.date)); state.highlighted = requestedId; state.filter = PredictionStore.canPick(requested, Date.now()) ? "available" : "all"; $("fixtureFilter").value = state.filter; notice(PredictionStore.canPick(requested, Date.now()) ? teamName(requested, "home") + " 대 " + teamName(requested, "away") + " 경기를 찾았습니다. 승·무·패를 선택해 주세요." : "이 경기는 선택이 마감되었습니다. 다른 예정 경기를 골라보세요."); }
      else if (requestedId) notice("연결된 경기를 찾지 못했습니다. 주간 목록에서 경기를 선택해 주세요.");
      $("fixturesLoading").hidden = true; $("builderContent").hidden = false; render();
      if (state.highlighted) { const node = Array.from(document.querySelectorAll(".pick-row")).find(row => row.dataset.matchId === state.highlighted); if (node) requestAnimationFrame(() => node.scrollIntoView({ block: "center" })); }
    } catch (error) { $("fixturesLoading").hidden = true; $("fixturesError").hidden = false; renderSaved(); }
    finally { state.loading = false; }
  }
  function bind() {
    $("prevWeek").addEventListener("click", () => changeWeek(shiftDate(state.week, -7)));
    $("nextWeek").addEventListener("click", () => changeWeek(shiftDate(state.week, 7)));
    $("currentWeek").addEventListener("click", () => changeWeek(PredictionStore.weekStart(PredictionStore.kstDate(Date.now()))));
    $("weekDate").addEventListener("change", event => { try { const week = PredictionStore.weekStart(event.target.value); changeWeek(week); } catch (error) { renderWeek(); } });
    $("leagueFilter").addEventListener("change", event => { state.league = event.target.value; renderFixtures(); });
    $("fixtureSearch").addEventListener("input", event => { state.query = event.target.value.trim(); renderFixtures(); });
    $("fixtureFilter").addEventListener("change", event => { state.filter = event.target.value; renderFixtures(); });
    $("historyWeek").addEventListener("change", event => { state.historyWeek = event.target.value; renderSaved(); });
    $("predictionForm").addEventListener("submit", save);
    $("setTitle").addEventListener("input", () => { $("saveStatus").textContent = ""; });
    $("newSet").addEventListener("click", async () => { if (!await allowDiscard()) return; draftReset(state.week); renderFixtures(); renderSlip(); $("setTitle").focus(); notice(""); });
    $("retryFixtures").addEventListener("click", loadFixtures); $("exportRecords").addEventListener("click", exportRecords);
    $("retryStorage").addEventListener("click", () => {
      try { if (!state.store) state.store = PredictionStore.createStore(window.localStorage); if (loadSaved()) { renderSaved(); renderSlip(); $("saveStatus").textContent = "저장 공간을 다시 확인했습니다."; } }
      catch (error) { storageFailure(error); }
    });
    $("builderContent").addEventListener("click", event => {
      const button = event.target.closest("button"); if (!button || button.disabled) return;
      if (button.dataset.choice) updateChoice(button.dataset.fixtureId, button.dataset.choice, button.dataset.area);
      else if (button.dataset.remove) { const pick = state.picks.get(button.dataset.remove); if (pick && !lockedPick(pick)) { state.picks.delete(button.dataset.remove); renderFixtures(); renderSlip(); $("saveStatus").textContent = ""; } }
      else if (button.dataset.action === "reset-filters") { state.league = "all"; state.query = ""; state.filter = "all"; $("leagueFilter").value = "all"; $("fixtureSearch").value = ""; $("fixtureFilter").value = "all"; renderFixtures(); }
    });
    $("savedSets").addEventListener("click", event => { const button = event.target.closest("button[data-set-action]"); if (!button) return; if (button.dataset.setAction === "edit") editSet(button.dataset.setId); else if (button.dataset.setAction === "delete") deleteSet(button.dataset.setId); });
    window.addEventListener("beforeunload", event => { if (isDirty()) { event.preventDefault(); event.returnValue = ""; } });
    window.addEventListener("storage", event => { if (event.key && event.key !== PredictionStore.STORAGE_KEY) return; if (loadSaved()) { renderSaved(); renderFixtures(); renderSlip(); notice("다른 창에서 저장한 기록이 반영되었습니다."); } });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && state.context) { renderFixtures(); renderSlip(); renderSaved(); } });
    setInterval(() => { if (!document.hidden && state.context) { renderFixtures(); renderSlip(); } }, 60000);
  }
  if (!window.MatchAnalysis || !window.PredictionStore) { $("fixturesLoading").hidden = true; $("fixturesError").hidden = false; $("fixturesError").querySelector("p").textContent = "화면을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요."; $("retryFixtures").addEventListener("click", () => location.reload()); return; }
  state.currentDay = PredictionStore.kstDate(Date.now());
  try { state.week = PredictionStore.weekStart(params.get("week") || state.currentDay); } catch (error) { state.week = PredictionStore.weekStart(state.currentDay); }
  draftReset(state.week); renderWeek();
  leagueKeys.forEach(key => $("leagueFilter").append(new Option(MatchAnalysis.leagueLabel(key), key)));
  try { state.store = PredictionStore.createStore(window.localStorage); loadSaved(); } catch (error) { storageFailure(error); }
  window.NinetyMinPage = { setAccountMode(enabled) { state.accountMode = Boolean(enabled); }, reloadRecords() { if (loadSaved()) { renderSaved(); renderFixtures(); renderSlip(); } }, isDirty };
  renderSaved(); bind(); loadFixtures();
})();
