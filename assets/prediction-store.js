/* Personal prediction records. Storage is local to this browser; no account or server is implied. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PredictionStore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "90minlabs.predictionSets.v1";
  const DAY = 86400000;
  const KST = 9 * 60 * 60 * 1000;
  const CHOICES = new Set(["H", "D", "A"]);
  const VOID_STATUSES = new Set(["postponed", "cancelled", "canceled"]);

  class PredictionStoreError extends Error {
    constructor(code, message) { super(message); this.name = "PredictionStoreError"; this.code = code; }
  }
  function fail(code, message) { throw new PredictionStoreError(code, message); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const ms = Date.parse(value + "T00:00:00Z");
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
  }
  function nowValue(value) {
    const ms = value === undefined ? Date.now() : value;
    if (typeof ms !== "number" || !Number.isFinite(ms) || !Number.isFinite(new Date(ms).getTime())) fail("INVALID_TIME", "현재 기기의 날짜와 시간을 확인해 주세요.");
    return ms;
  }
  function timestamp(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) && new Date(ms).toISOString() === value ? ms : null;
  }
  function kstDate(ms) { return new Date(nowValue(ms) + KST).toISOString().slice(0, 10); }
  function weekStart(date) {
    if (!validDate(date)) fail("INVALID_WEEK", "주간 날짜가 올바르지 않습니다.");
    const d = new Date(date + "T00:00:00Z"), offset = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - offset * DAY).toISOString().slice(0, 10);
  }
  function weekEnd(date) { return new Date(Date.parse(weekStart(date) + "T00:00:00Z") + 6 * DAY).toISOString().slice(0, 10); }
  function weekForFixture(fixture) { return fixture && validDate(fixture.date) ? weekStart(fixture.date) : null; }
  function kickoffMs(fixture) {
    if (!fixture || !validDate(fixture.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(fixture.time || "")) return null;
    return Date.parse(fixture.date + "T" + fixture.time + ":00+09:00");
  }
  // Kept identical to MatchAnalysis.fixtureId; the regression test guards this contract.
  function fixtureId(fixture) {
    return [fixture.league, fixture.date, fixture.time || "", fixture.home, fixture.away]
      .map(value => encodeURIComponent(String(value || "")).replace(/~/g, "%7E")).join("~");
  }
  function validScore(score) { return Array.isArray(score) && score.length === 2 && score.every(n => Number.isInteger(n) && n >= 0); }
  function canPick(fixture, nowMs) {
    const kickoff = kickoffMs(fixture);
    return Boolean(fixture && fixture.status === "scheduled" && kickoff !== null && kickoff > nowValue(nowMs));
  }
  function findFixture(context, id) {
    if (!context || typeof context.findMatch !== "function") return null;
    const match = context.findMatch(id);
    return match && fixtureId(match) === id ? match : null;
  }
  function snapshotOf(match) {
    const snapshot = { league: match.league, date: match.date, time: match.time, home: match.home, away: match.away };
    ["homeTeam", "awayTeam", "homeTeamLeague", "awayTeamLeague", "round"].forEach(key => {
      if (typeof match[key] === "string" && match[key]) snapshot[key] = match[key];
    });
    ["homeCrest", "awayCrest"].forEach(key => { if (Number.isInteger(match[key]) && match[key] > 0) snapshot[key] = match[key]; });
    return snapshot;
  }
  function lockInfo(pick, fixture, nowMs) {
    const original = kickoffMs(pick && pick.snapshot), current = kickoffMs(fixture);
    if (!fixture) return { locked: true, reasonCode: "FIXTURE_UNAVAILABLE", reason: "현재 일정에서 이 경기를 찾지 못해 저장한 선택을 유지합니다." };
    if (original === null || current === null) return { locked: true, reasonCode: "KICKOFF_UNKNOWN", reason: "경기 시작 시각을 확인할 수 없어 선택을 변경할 수 없습니다." };
    if (nowMs >= Math.min(original, current)) return { locked: true, reasonCode: "KICKOFF_PASSED", reason: "경기 시작 시각이 지난 선택은 변경하거나 제외할 수 없습니다." };
    if (fixture.status !== "scheduled" && !VOID_STATUSES.has(fixture.status)) return { locked: true, reasonCode: "FIXTURE_STARTED", reason: "이미 시작했거나 종료된 경기의 선택은 변경할 수 없습니다." };
    return { locked: false, reasonCode: null, reason: null };
  }

  function gradePick(pick, context, nowMs) {
    const now = nowValue(nowMs), fixture = findFixture(context, pick.fixtureId), lock = lockInfo(pick, fixture, now);
    const answer = Object.assign({}, clone(pick), {
      fixture: fixture ? clone(fixture) : pick.snapshot ? clone(pick.snapshot) : null,
      locked: lock.locked, status: "pending", actual: null, score: null,
      reason: "경기 시작 전입니다.", reasonCode: "NOT_STARTED"
    });
    if (!fixture) return Object.assign(answer, { reason: "현재 일정에서 경기를 찾지 못했습니다. 저장된 기록은 유지됩니다.", reasonCode: "FIXTURE_UNAVAILABLE" });
    if (VOID_STATUSES.has(fixture.status)) return Object.assign(answer, { status: "void", reason: fixture.status === "postponed" ? "연기된 경기로 적중률 계산에서 제외합니다." : "취소된 경기로 적중률 계산에서 제외합니다.", reasonCode: fixture.status === "postponed" ? "POSTPONED" : "CANCELLED" });
    const start = kickoffMs(fixture), saved = timestamp(pick.savedAt);
    if (start === null) return Object.assign(answer, { reason: "경기 시작 시각을 확인한 뒤 결과를 판단합니다.", reasonCode: "KICKOFF_UNKNOWN" });
    if (saved === null || saved >= start) return Object.assign(answer, { reason: "경기 시작 전 저장 여부를 확인할 수 없어 자동 채점에서 제외합니다.", reasonCode: "LATE_OR_UNDATED_PICK" });
    if (!CHOICES.has(pick.selection)) return Object.assign(answer, { reason: "저장된 승무패 선택을 확인할 수 없습니다.", reasonCode: "INVALID_SELECTION" });
    if (fixture.status !== "finished" || !validScore(fixture.score)) return Object.assign(answer, {
      reason: start <= now || fixture.status === "finished" ? "확인된 종료 스코어를 기다리고 있습니다." : "경기 시작 전입니다.",
      reasonCode: start <= now || fixture.status === "finished" ? "RESULT_PENDING" : "NOT_STARTED"
    });
    const actual = fixture.score[0] > fixture.score[1] ? "H" : fixture.score[0] < fixture.score[1] ? "A" : "D";
    return Object.assign(answer, { actual, score: fixture.score.slice(), status: actual === pick.selection ? "correct" : "incorrect", reason: actual === pick.selection ? "예측이 맞았습니다." : "예측과 결과가 다릅니다.", reasonCode: "CONFIRMED_RESULT", locked: true });
  }
  function gradeSet(set, context, nowMs) {
    const now = nowValue(nowMs), picks = set.picks.map(pick => gradePick(pick, context, now));
    const correct = picks.filter(p => p.status === "correct").length, incorrect = picks.filter(p => p.status === "incorrect").length;
    const settled = correct + incorrect;
    return { total: picks.length, settled, correct, incorrect, pending: picks.filter(p => p.status === "pending").length, void: picks.filter(p => p.status === "void").length, accuracy: settled ? correct / settled : null, picks };
  }

  function validateState(value) {
    function corrupt() { fail("CORRUPT_DATA", "저장된 경기 폴더의 형식을 읽을 수 없습니다. 기존 기록을 덮어쓰지 않았습니다."); }
    if (!value || typeof value !== "object" || Array.isArray(value)) corrupt();
    if (value.version !== VERSION) fail("UNSUPPORTED_VERSION", "이 버전에서 읽을 수 없는 저장 기록입니다. 기존 기록을 덮어쓰지 않았습니다.");
    if (!Array.isArray(value.sets) || !Number.isSafeInteger(value.revision) || value.revision < 0) corrupt();
    const ids = new Set();
    const sets = value.sets.map(set => {
      if (!set || typeof set !== "object" || typeof set.id !== "string" || !set.id || set.id.length > 180 || ids.has(set.id)) corrupt();
      ids.add(set.id);
      if (!validDate(set.weekStart) || weekStart(set.weekStart) !== set.weekStart || typeof set.title !== "string" || !set.title.trim() || set.title.length > 80) corrupt();
      const created = timestamp(set.createdAt), updated = timestamp(set.updatedAt);
      if (created === null || updated === null || created > updated || !Array.isArray(set.picks) || !set.picks.length) corrupt();
      const fixtureIds = new Set();
      const picks = set.picks.map(pick => {
        if (!pick || typeof pick.fixtureId !== "string" || !pick.fixtureId || fixtureIds.has(pick.fixtureId) || !CHOICES.has(pick.selection)) corrupt();
        fixtureIds.add(pick.fixtureId);
        const saved = timestamp(pick.savedAt), snapshot = pick.snapshot;
        if (saved === null || saved < created || saved > updated || !snapshot || kickoffMs(snapshot) === null || saved >= kickoffMs(snapshot)) corrupt();
        if (["league", "home", "away"].some(key => typeof snapshot[key] !== "string" || !snapshot[key]) || fixtureId(snapshot) !== pick.fixtureId || weekForFixture(snapshot) !== set.weekStart) corrupt();
        return { fixtureId: pick.fixtureId, selection: pick.selection, savedAt: pick.savedAt, snapshot: snapshotOf(snapshot) };
      });
      return { id: set.id, weekStart: set.weekStart, title: set.title, createdAt: set.createdAt, updatedAt: set.updatedAt, picks };
    });
    return { version: VERSION, revision: value.revision, sets };
  }

  function createStore(storage, options) {
    options = options || {};
    const key = options.key || STORAGE_KEY, clock = options.now || Date.now;
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") fail("STORAGE_UNAVAILABLE", "이 브라우저에서 저장 공간을 사용할 수 없습니다. 브라우저 설정을 확인해 주세요.");
    if (typeof clock !== "function") fail("INVALID_TIME", "현재 시각을 확인할 수 없습니다.");
    function readRaw() {
      try { return storage.getItem(key); }
      catch (error) { fail("STORAGE_READ_FAILED", "브라우저의 저장 기록을 읽지 못했습니다. 기존 기록을 덮어쓰지 않았습니다."); }
    }
    function read() {
      const raw = readRaw();
      if (raw === null) return { raw, data: { version: VERSION, revision: 0, sets: [] } };
      if (typeof raw !== "string") fail("STORAGE_READ_FAILED", "브라우저의 저장 기록을 읽지 못했습니다. 기존 기록을 덮어쓰지 않았습니다.");
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch (error) { fail("CORRUPT_DATA", "저장된 경기 폴더을 읽을 수 없습니다. 기존 기록을 덮어쓰지 않았습니다."); }
      return { raw, data: validateState(parsed) };
    }
    function write(before, next) {
      // Check again before writing so an intervening storage change is never intentionally replaced.
      if (readRaw() !== before.raw) fail("STORAGE_CONFLICT", "다른 화면에서 저장 기록이 변경됐습니다. 최신 목록을 불러온 뒤 다시 저장해 주세요.");
      const encoded = JSON.stringify(validateState(next));
      try { storage.setItem(key, encoded); }
      catch (error) {
        if (error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014)) fail("STORAGE_FULL", "브라우저 저장 공간이 부족합니다. 기존 기록은 유지됩니다. 필요 없는 폴더을 정리한 뒤 다시 저장해 주세요.");
        fail("STORAGE_WRITE_FAILED", "경기 폴더을 저장하지 못했습니다. 기존 기록은 유지됩니다.");
      }
    }
    function makeId(existing, now) {
      for (let attempt = 0; attempt < 8; attempt++) {
        let id;
        if (typeof options.idFactory === "function") id = String(options.idFactory());
        else if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") id = "set_" + globalThis.crypto.randomUUID();
        else id = "set_" + now.toString(36) + "_" + Math.random().toString(36).slice(2, 11) + attempt;
        if (id && id.length <= 180 && !existing.some(set => set.id === id)) return id;
      }
      fail("ID_CONFLICT", "폴더 번호를 만들지 못했습니다. 다시 저장해 주세요.");
    }
    function load() { return clone(read().data); }
    function saveSet(input, context) {
      const before = read(), now = nowValue(clock()), savedAt = new Date(now).toISOString();
      if (!input || typeof input !== "object") fail("INVALID_SET", "저장할 경기 폴더이 없습니다.");
      if (!context || typeof context.findMatch !== "function") fail("CONTEXT_UNAVAILABLE", "경기 일정을 다시 불러온 뒤 저장해 주세요.");
      if (!validDate(input.weekStart) || weekStart(input.weekStart) !== input.weekStart) fail("INVALID_WEEK", "월요일부터 시작하는 주간 범위를 선택해 주세요.");
      if (!Array.isArray(input.picks) || !input.picks.length) fail("EMPTY_SET", "경기를 한 개 이상 선택하고 승무패를 지정해 주세요.");
      if (input.title !== undefined && typeof input.title !== "string") fail("INVALID_TITLE", "폴더 이름을 확인해 주세요.");
      const title = (input.title || "").trim() || input.weekStart.replace(/-/g, ".") + " 주간 예측";
      if (title.length > 80) fail("INVALID_TITLE", "폴더 이름은 80자 이내로 입력해 주세요.");
      const existing = input.id ? before.data.sets.find(set => set.id === input.id) : null;
      if (input.id && !existing) fail("SET_NOT_FOUND", "수정할 폴더이 없습니다. 최신 목록을 다시 확인해 주세요.");
      if (existing && existing.weekStart !== input.weekStart) fail("WEEK_CHANGED", "저장한 폴더의 주간 범위는 바꿀 수 없습니다. 다른 주의 경기는 새 폴더으로 저장해 주세요.");
      if (existing && now < timestamp(existing.updatedAt)) fail("CLOCK_MOVED_BACKWARDS", "기기 시간이 마지막 저장 시각보다 이전입니다. 날짜와 시간을 확인해 주세요.");
      const expected = input.expectedUpdatedAt === undefined ? input.updatedAt : input.expectedUpdatedAt;
      if (existing && expected !== undefined && expected !== existing.updatedAt) fail("STORAGE_CONFLICT", "이 폴더이 다른 화면에서 수정됐습니다. 최신 기록을 불러온 뒤 다시 저장해 주세요.");
      const incoming = new Map();
      input.picks.forEach(pick => {
        if (!pick || typeof pick.fixtureId !== "string" || !pick.fixtureId || !CHOICES.has(pick.selection)) fail("INVALID_PICK", "선택한 모든 경기에 승·무·패를 지정해 주세요.");
        if (incoming.has(pick.fixtureId)) fail("DUPLICATE_PICK", "한 폴더에 같은 경기를 두 번 담을 수 없습니다.");
        incoming.set(pick.fixtureId, pick);
      });
      const previous = new Map(existing ? existing.picks.map(pick => [pick.fixtureId, pick]) : []);
      previous.forEach(pick => {
        const match = findFixture(context, pick.fixtureId), lock = lockInfo(pick, match, now), replacement = incoming.get(pick.fixtureId);
        if (lock.locked && (!replacement || replacement.selection !== pick.selection)) fail("LOCKED_PICK", lock.reason);
      });
      const picks = input.picks.map(candidate => {
        const prior = previous.get(candidate.fixtureId);
        if (prior && prior.selection === candidate.selection) return clone(prior);
        const fixture = findFixture(context, candidate.fixtureId);
        if (!fixture) fail("FIXTURE_UNAVAILABLE", "선택한 경기의 현재 일정을 확인할 수 없습니다. 목록을 다시 불러와 주세요.");
        if (weekForFixture(fixture) !== input.weekStart) fail("WRONG_WEEK", "선택한 주간 범위에 속하지 않는 경기가 포함되어 있습니다.");
        if (!canPick(fixture, now)) fail("PICK_UNAVAILABLE", "이미 시작했거나 예정 상태가 아닌 경기에는 새 승무패를 저장할 수 없습니다.");
        return { fixtureId: candidate.fixtureId, selection: candidate.selection, savedAt, snapshot: snapshotOf(fixture) };
      });
      const set = {
        id: existing ? existing.id : makeId(before.data.sets, now), weekStart: input.weekStart, title,
        createdAt: existing ? existing.createdAt : savedAt, updatedAt: savedAt, picks
      };
      const sets = existing ? before.data.sets.map(item => item.id === set.id ? set : item) : before.data.sets.concat(set);
      write(before, { version: VERSION, revision: before.data.revision + 1, sets });
      return clone(set);
    }
    function deleteSet(id) {
      const before = read();
      if (!before.data.sets.some(set => set.id === id)) fail("SET_NOT_FOUND", "삭제할 폴더이 없습니다. 최신 목록을 확인해 주세요.");
      write(before, { version: VERSION, revision: before.data.revision + 1, sets: before.data.sets.filter(set => set.id !== id) });
      return true;
    }
    function exportRecords() {
      const data = load();
      return JSON.stringify({ application: "90MIN LABS", type: "personal-prediction-records", version: VERSION, exportedAt: new Date(nowValue(clock())).toISOString(), storageScope: "same-browser", data }, null, 2);
    }
    return { key, load, saveSet, deleteSet, export: exportRecords };
  }

  return { VERSION, STORAGE_KEY, PredictionStoreError, weekStart, weekEnd, weekForFixture, kstDate, kickoffMs, canPick, gradePick, gradeSet, createStore };
});
