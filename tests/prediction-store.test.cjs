'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../assets/prediction-store.js');
const Analysis = require('../assets/match-analysis.js');

class MemoryStorage {
  constructor() { this.values = new Map(); this.writes = 0; this.readError = false; this.writeError = null; }
  getItem(key) { if (this.readError) throw new Error('Read denied'); return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { if (this.writeError) throw this.writeError; this.writes++; this.values.set(key, String(value)); }
}
const before = Date.parse('2026-11-23T06:00:00.000Z');
function fixture(home = 'Monza', away = 'Fiorentina', date = '2026-11-24', time = '04:45') {
  return { date, time, league: 'seriea', home, away, homeTeam: home, awayTeam: away, homeTeamLeague: 'seriea', awayTeamLeague: 'seriea', status: 'scheduled' };
}
function setup() {
  const fixtures = [fixture(), fixture('Milan', 'Roma', '2026-11-25'), fixture('Inter', 'Juventus', '2026-11-30')];
  const map = new Map(fixtures.map(m => [Analysis.fixtureId(m), m]));
  const context = { matches: fixtures, findMatch: id => map.get(id) || null };
  let time = before, sequence = 0;
  const storage = new MemoryStorage();
  const store = Store.createStore(storage, { now: () => time, idFactory: () => 'test-set-' + ++sequence });
  const pick = (index, selection = 'H') => ({ fixtureId: Analysis.fixtureId(fixtures[index]), selection });
  const draft = (picks = [pick(0)]) => ({ weekStart: '2026-11-23', title: '이번 주 경기', picks });
  return { fixtures, map, context, storage, store, pick, draft, setTime: value => { time = value; } };
}
function hasCode(code) { return error => error instanceof Store.PredictionStoreError && error.code === code; }

test('KST date and Monday weeks cross UTC Sunday midnight and year boundaries correctly', () => {
  assert.equal(Store.kstDate(Date.parse('2026-11-22T14:59:59.000Z')), '2026-11-22');
  assert.equal(Store.weekStart(Store.kstDate(Date.parse('2026-11-22T14:59:59.000Z'))), '2026-11-16');
  assert.equal(Store.kstDate(Date.parse('2026-11-22T15:00:00.000Z')), '2026-11-23');
  assert.equal(Store.weekStart(Store.kstDate(Date.parse('2026-11-22T15:00:00.000Z'))), '2026-11-23');
  assert.equal(Store.weekEnd('2026-11-24'), '2026-11-29');
  assert.equal(Store.weekStart('2027-01-01'), '2026-12-28');
  assert.equal(Store.weekEnd('2027-01-01'), '2027-01-03');
  assert.equal(Store.weekStart('2027-01-04'), '2027-01-04');
  assert.equal(Store.weekStart('2028-02-29'), '2028-02-28');
  assert.throws(() => Store.weekStart('2026-02-30'), hasCode('INVALID_WEEK'));
  assert.equal(Store.kickoffMs(fixture()), Date.parse('2026-11-23T19:45:00.000Z'));
});

test('new bundle survives fresh store reload, clones caller data and preserves fixture identity', () => {
  const s = setup();
  s.fixtures[0].home = 'Monza~ FC';
  const id = Analysis.fixtureId(s.fixtures[0]); s.map.set(id, s.fixtures[0]);
  const input = s.draft([{ fixtureId: id, selection: 'D', savedAt: '2000-01-01T00:00:00.000Z' }]);
  const saved = s.store.saveSet(input, s.context);
  assert.equal(saved.picks[0].savedAt, new Date(before).toISOString(), 'caller cannot provide a backdated save time');
  assert.equal(Analysis.fixtureId(saved.picks[0].snapshot), id);
  input.picks[0].selection = 'A'; saved.picks[0].selection = 'H';
  const reloaded = Store.createStore(s.storage).load();
  assert.equal(reloaded.version, 1); assert.equal(reloaded.revision, 1); assert.equal(reloaded.sets.length, 1);
  assert.equal(reloaded.sets[0].picks[0].selection, 'D');
  assert.equal(reloaded.sets[0].picks[0].snapshot.home, 'Monza~ FC');
});

test('kickoff locks old picks at the exact boundary; future picks remain editable', () => {
  const s = setup(), saved = s.store.saveSet(s.draft([s.pick(0), s.pick(1, 'A')]), s.context);
  const originalTime = saved.picks[0].savedAt, start = Store.kickoffMs(s.fixtures[0]);
  assert(Store.canPick(s.fixtures[0], start - 1)); assert(!Store.canPick(s.fixtures[0], start));
  s.setTime(start);
  assert.throws(() => s.store.saveSet({ ...saved, picks: [s.pick(0, 'D'), s.pick(1, 'A')] }, s.context), hasCode('LOCKED_PICK'));
  assert.throws(() => s.store.saveSet({ ...saved, picks: [s.pick(1, 'A')] }, s.context), hasCode('LOCKED_PICK'));
  assert.throws(() => s.store.saveSet(s.draft([s.pick(0)]), s.context), hasCode('PICK_UNAVAILABLE'));
  const next = s.store.saveSet({ ...saved, title: '시작한 선택은 유지', picks: [s.pick(0), s.pick(1, 'D')] }, s.context);
  assert.equal(next.picks[0].savedAt, originalTime);
  assert.equal(next.picks[1].savedAt, new Date(start).toISOString());
  assert.equal(next.createdAt, saved.createdAt);
  assert.equal(Store.gradeSet(next, s.context, start).picks[0].locked, true);
  assert.equal(Store.gradeSet(next, s.context, start).picks[1].locked, false);
});

test('batch validation rejects duplicates, invalid choices, wrong weeks and nonfuture picks without writing', () => {
  const s = setup();
  assert.throws(() => s.store.saveSet(s.draft([s.pick(0), s.pick(0, 'D')]), s.context), hasCode('DUPLICATE_PICK'));
  assert.throws(() => s.store.saveSet(s.draft([s.pick(0), s.pick(1, '')]), s.context), hasCode('INVALID_PICK'));
  assert.throws(() => s.store.saveSet(s.draft([s.pick(0), s.pick(2)]), s.context), hasCode('WRONG_WEEK'));
  s.fixtures[1].status = 'finished'; s.fixtures[1].score = [1, 0];
  assert.throws(() => s.store.saveSet(s.draft([s.pick(0), s.pick(1)]), s.context), hasCode('PICK_UNAVAILABLE'));
  assert.throws(() => s.store.saveSet(s.draft([]), s.context), hasCode('EMPTY_SET'));
  assert.throws(() => s.store.saveSet({ ...s.draft(), weekStart: '2026-11-24' }, s.context), hasCode('INVALID_WEEK'));
  assert.equal(s.storage.writes, 0); assert.equal(s.store.load().sets.length, 0);
});

test('confirmed finished scores grade H/D/A while a stored stale score on scheduled remains pending', () => {
  const s = setup(), saved = s.store.saveSet(s.draft([s.pick(0, 'H'), s.pick(1, 'A')]), s.context);
  const later = Date.parse('2026-11-29T00:00:00.000Z');
  s.fixtures[0].status = 'finished'; s.fixtures[0].score = [4, 0];
  s.fixtures[1].score = [0, 5];
  let result = Store.gradeSet(saved, s.context, later);
  assert.deepEqual([result.total, result.settled, result.correct, result.incorrect, result.pending, result.void, result.accuracy], [2, 1, 1, 0, 1, 0, 1]);
  assert.equal(result.picks[0].actual, 'H'); assert.equal(result.picks[1].actual, null); assert.equal(result.picks[1].score, null);
  s.fixtures[1].status = 'finished';
  result = Store.gradeSet(saved, s.context, later); assert.equal(result.picks[1].actual, 'A'); assert.equal(result.correct, 2);
  s.fixtures[0].score = [0, 0];
  result = Store.gradeSet(saved, s.context, later); assert.equal(result.picks[0].actual, 'D'); assert.equal(result.incorrect, 1); assert.equal(result.accuracy, 0.5);
  s.fixtures[0].score = [-1, 0];
  result = Store.gradeSet(saved, s.context, later); assert.equal(result.picks[0].status, 'pending'); assert.equal(result.settled, 1);
  s.fixtures[0].score = [1.5, 0]; assert.equal(Store.gradePick(saved.picks[0], s.context, later).status, 'pending');
  s.fixtures[0].score = [1, 0]; s.fixtures[0].status = 'unverified'; assert.equal(Store.gradePick(saved.picks[0], s.context, later).status, 'pending');
});

test('postponed/cancelled fixtures are void, not incorrect, and may be removed before kickoff', () => {
  const s = setup(), saved = s.store.saveSet(s.draft([s.pick(0), s.pick(1)]), s.context);
  s.fixtures[0].status = 'postponed';
  let graded = Store.gradeSet(saved, s.context, before);
  assert.equal(graded.void, 1); assert.equal(graded.incorrect, 0); assert.equal(graded.accuracy, null); assert.equal(graded.picks[0].locked, false);
  assert.throws(() => s.store.saveSet({ ...saved, picks: [s.pick(0, 'A'), s.pick(1)] }, s.context), hasCode('PICK_UNAVAILABLE'));
  const removed = s.store.saveSet({ ...saved, picks: [s.pick(1)] }, s.context);
  assert.equal(removed.picks.length, 1);
  s.fixtures[1].status = 'cancelled'; graded = Store.gradeSet(removed, s.context, before);
  assert.equal(graded.picks[0].status, 'void'); assert.equal(graded.settled, 0);
  s.fixtures[1].status = 'canceled'; assert.equal(Store.gradeSet(removed, s.context, before).void, 1);
});

test('missing scheduled fixture preserves snapshot and cannot be changed or silently omitted', () => {
  const s = setup(), saved = s.store.saveSet(s.draft([s.pick(0), s.pick(1)]), s.context);
  s.map.delete(saved.picks[0].fixtureId);
  const graded = Store.gradePick(saved.picks[0], s.context, before);
  assert.equal(graded.status, 'pending'); assert.equal(graded.reasonCode, 'FIXTURE_UNAVAILABLE'); assert.equal(graded.locked, true);
  assert.equal(graded.fixture.home, 'Monza');
  assert.throws(() => s.store.saveSet({ ...saved, picks: [s.pick(1)] }, s.context), hasCode('LOCKED_PICK'));
  const rename = s.store.saveSet({ ...saved, title: '기록 유지' }, s.context);
  assert.equal(rename.picks[0].fixtureId, saved.picks[0].fixtureId);
});

test('late or undated standalone records are never retroactively awarded a correct result', () => {
  const s = setup(), saved = s.store.saveSet(s.draft(), s.context);
  s.fixtures[0].status = 'finished'; s.fixtures[0].score = [3, 0];
  const late = { ...saved.picks[0], savedAt: new Date(Store.kickoffMs(s.fixtures[0])).toISOString() };
  assert.equal(Store.gradePick(late, s.context, before + 7 * 86400000).reasonCode, 'LATE_OR_UNDATED_PICK');
  assert.equal(Store.gradePick({ ...late, savedAt: undefined }, s.context).status, 'pending');
});

test('corrupt JSON/schema and unsupported versions stop all writes and exports without replacing data', () => {
  const s = setup();
  for (const raw of ['{broken', JSON.stringify({ version: 2, revision: 0, sets: [] }), JSON.stringify({ version: 1, revision: 0, sets: [{ id: 'x' }] })]) {
    s.storage.values.set(Store.STORAGE_KEY, raw); const priorWrites = s.storage.writes;
    assert.throws(() => s.store.load(), error => ['CORRUPT_DATA', 'UNSUPPORTED_VERSION'].includes(error.code));
    assert.throws(() => s.store.saveSet(s.draft(), s.context)); assert.throws(() => s.store.deleteSet('x')); assert.throws(() => s.store.export());
    assert.equal(s.storage.getItem(Store.STORAGE_KEY), raw); assert.equal(s.storage.writes, priorWrites);
  }
});

test('storage denial and quota failure preserve the last saved bytes', () => {
  assert.throws(() => Store.createStore(null), hasCode('STORAGE_UNAVAILABLE'));
  const s = setup(); s.store.saveSet(s.draft(), s.context); const raw = s.storage.getItem(Store.STORAGE_KEY), writes = s.storage.writes;
  s.storage.readError = true;
  assert.throws(() => s.store.saveSet(s.draft([s.pick(1)]), s.context), hasCode('STORAGE_READ_FAILED'));
  assert.equal(s.storage.writes, writes); s.storage.readError = false;
  s.storage.writeError = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  assert.throws(() => s.store.saveSet(s.draft([s.pick(1)]), s.context), hasCode('STORAGE_FULL'));
  assert.equal(s.storage.getItem(Store.STORAGE_KEY), raw); assert.equal(s.storage.writes, writes);
});

test('stale edited bundle and intervening cross-tab storage changes are rejected', () => {
  const s = setup(), first = s.store.saveSet(s.draft(), s.context);
  s.setTime(before + 1000);
  s.store.saveSet({ ...first, title: '다른 화면에서 수정' }, s.context);
  assert.throws(() => s.store.saveSet({ ...first, title: '오래된 화면' }, s.context), hasCode('STORAGE_CONFLICT'));
  const raw = s.storage.getItem(Store.STORAGE_KEY), external = JSON.parse(raw); external.revision++;
  const externalRaw = JSON.stringify(external); let reads = 0;
  const racingStorage = { getItem() { reads++; return reads === 1 ? raw : externalRaw; }, setItem() { throw new Error('must not write'); } };
  const racing = Store.createStore(racingStorage, { now: () => before + 2000 });
  assert.throws(() => racing.saveSet(s.draft([s.pick(1)]), s.context), hasCode('STORAGE_CONFLICT'));
  assert.equal(s.storage.getItem(Store.STORAGE_KEY), raw);
});

test('explicit deletion is allowed for settled personal sets; export is lossless record JSON', () => {
  const s = setup(), first = s.store.saveSet(s.draft(), s.context);
  s.setTime(before + 1000); const second = s.store.saveSet(s.draft([s.pick(1, 'D')]), s.context);
  const exported = JSON.parse(s.store.export());
  assert.equal(exported.type, 'personal-prediction-records'); assert.equal(exported.storageScope, 'same-browser');
  assert.deepEqual(exported.data.sets, [first, second]);
  s.setTime(before + 10 * 86400000); s.fixtures[0].status = 'finished'; s.fixtures[0].score = [2, 1];
  assert(s.store.deleteSet(first.id, s.context));
  assert.deepEqual(s.store.load().sets.map(x => x.id), [second.id]);
  assert.throws(() => s.store.deleteSet(first.id), hasCode('SET_NOT_FOUND'));
});
