"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = require("../assets/match-analysis.js");
const root = path.resolve(__dirname, "..");
const read = name => JSON.parse(fs.readFileSync(path.join(root, "data", name + ".json"), "utf8"));
const data = { calendar: read("match-calendar"), results: read("team-results"), profiles: read("team-profiles"), standings: read("league-data"), uefa: read("uefa-standings") };
const context = A.createContext(data);
const fixedNow = Date.parse("2026-11-23T13:58:00+09:00");

function atFixedTime(work) {
  const actualNow = Date.now;
  Date.now = () => fixedNow;
  try { return work(); } finally { Date.now = actualNow; }
}

function fixture(date, home, away, score, extra = {}) {
  return Object.assign({ date, time: "03:00", league: "epl", home, away, status: score ? "finished" : "scheduled", ...(score ? { score } : {}) }, extra);
}

test("every stored fixture has a unique URL that resolves the original fixture", () => {
  assert.equal(context.matches.length, 2700);
  const ids = new Set();
  for (const match of context.matches) {
    const id = A.fixtureId(match);
    ids.add(id);
    const url = new URL(A.matchUrl(match), "https://example.test/90minlabs/");
    assert.equal(context.findMatch(url.searchParams.get("id")), match);
  }
  assert.equal(ids.size, context.matches.length);
  assert.equal(context.findMatch("nonexistent"), null);
});

test("Racing–Sociedad reproduces independently checked pre-match forms and competition scope", () => atFixedTime(() => {
  const match = context.matches.find(row => row.date === "2026-11-23" && row.home === "R. Racing Club");
  const all = A.analyze(context, match, { limit: 5, scope: "all" });
  const league = A.analyze(context, match, { limit: 5, scope: "competition" });
  assert.deepEqual(all.home.records.map(row => row.result), ["W", "L", "W", "L", "D"]);
  assert.deepEqual(all.away.records.map(row => row.result), ["W", "D", "L", "W", "W"]);
  assert.deepEqual(league.away.records.map(row => row.result), ["W", "L", "W", "W", "W"]);
  assert.deepEqual([all.home.stats.gf, all.home.stats.ga, all.home.stats.points], [6, 9, 7]);
  assert.deepEqual([all.away.stats.gf, all.away.stats.ga, all.away.stats.points], [11, 4, 10]);
  assert.deepEqual([league.away.stats.gf, league.away.stats.ga, league.away.stats.points], [12, 7, 12]);
  assert.equal(all.home.allRecords.some(row => row.id === A.fixtureId(match)), false);
  assert.equal(all.home.standing.current, true);
  assert.ok(all.home.standing.updatedAt);
}));

test("all 2700 analyses exclude the target and future records across form, venue and head-to-head", () => atFixedTime(() => {
  for (const match of context.matches) {
    const analysis = A.analyze(context, match, { limit: 10, scope: "all" });
    assert.ok(analysis.cutoffMs <= fixedNow);
    for (const side of [analysis.home, analysis.away]) {
      assert.ok(side.records.length <= 10);
      assert.equal(side.stats.played, side.records.length);
      for (const row of side.allRecords.concat(side.venue.allRecords, analysis.h2h)) {
        assert.notEqual(row.id, analysis.id);
        assert.ok(row.upperBoundMs < analysis.cutoffMs, row.id + " leaked into " + analysis.id);
      }
      assert.equal(new Set(side.allRecords.map(row => row.id)).size, side.allRecords.length);
    }
    assert.ok(analysis.home.venue.records.every(row => row.isHome));
    assert.ok(analysis.away.venue.records.every(row => !row.isHome));
    if (analysis.model.available) {
      assert.ok(Math.abs(analysis.model.homeWin + analysis.model.draw + analysis.model.awayWin - 1) < 1e-10);
      assert.ok(analysis.model.homeVenueSample >= 3 && analysis.model.awayVenueSample >= 3);
      assert.ok(analysis.model.homeSample >= 5 && analysis.model.awaySample >= 5);
    }
  }
}));

test("verified calendar scores win over duplicate source-date histories and aliases", () => atFixedTime(() => {
  const past = fixture("2026-11-19", "Man Utd", "Liverpool", [4, 0], {
    homeTeam: "Manchester United", homeTeamLeague: "epl", awayTeam: "Liverpool", awayTeamLeague: "epl", scoreSourceUrl: "https://example.test/verified"
  });
  const target = fixture("2026-11-23", "Man Utd", "Liverpool", [1, 1], {
    homeTeam: "Manchester United", homeTeamLeague: "epl", awayTeam: "Liverpool", awayTeamLeague: "epl"
  });
  const c = A.createContext({
    calendar: { matches: [past, target] },
    results: { teams: {
      "epl:Manchester United": { team: "Manchester United", league: "epl", matchName: "Man Utd", matches: [
        { date: "2026-11-18", home: "Man Utd", away: "Liverpool", homeScore: 0, awayScore: 0 },
        { date: "2026-11-22", home: "Man Utd", away: "Liverpool", homeScore: 1, awayScore: 1 }
      ] }
    } }
  });
  const a = A.analyze(c, target);
  assert.equal(a.home.records.length, 1);
  assert.deepEqual(a.home.records[0].score, [4, 0]);
  assert.equal(a.home.records[0].sourceUrl, "https://example.test/verified");
  assert.equal(a.h2h.length, 1, "older meetings with identical home/away names must survive");
  assert.equal(a.home.stats.points, 3);
}));

test("unknown source times use conservative bounds and remain explicitly labelled", () => atFixedTime(() => {
  const target = fixture("2026-11-23", "Club A", "Club B", null);
  const c = A.createContext({
    calendar: { matches: [target] },
    results: { teams: {
      "epl:Club A": { team: "Club A", league: "epl", matchName: "Club A", matches: [
        { date: "2026-11-22", home: "Club A", away: "Club C", homeScore: 3, awayScore: 1 },
        { date: "2026-11-21", home: "Club D", away: "Club A", homeScore: 0, awayScore: 2 }
      ] }
    } }
  });
  const a = A.analyze(c, target);
  assert.deepEqual(a.home.records.map(row => row.date), ["2026-11-21"]);
  assert.equal(a.home.records[0].dateIsKst, false);
  assert.equal(a.home.records[0].datePrecision, "source-date");
  assert.match(a.home.records[0].dateLabel, /원문 날짜/);
  assert.equal(a.coverage.conservativeDates, 1);
  assert.equal(a.model.available, false);
}));

test("a future target uses only records already available now, including defensive future-score filtering", () => atFixedTime(() => {
  const matches = [fixture("2026-11-20", "A", "C", [2, 0]), fixture("2026-11-25", "A", "D", [5, 0]), fixture("2026-11-28", "A", "B", null)];
  const c = A.createContext({ calendar: { matches } });
  const a = A.analyze(c, matches[2]);
  assert.equal(a.cutoffMs, fixedNow);
  assert.equal(a.coverage.cutoffIsNow, true);
  assert.deepEqual(a.home.records.map(row => row.date), ["2026-11-20"]);
}));

test("European profiles merge local league and European records without double-counting", () => atFixedTime(() => {
  const match = context.matches.find(row => row.date > "2026-11-23" && row.league === "ucl" && row.home === "Sporting CP");
  const all = A.analyze(context, match, { limit: 10, scope: "all" });
  const european = A.analyze(context, match, { limit: 10, scope: "competition" });
  assert.ok(all.home.records.some(row => row.competition.startsWith("domestic:")));
  assert.ok(all.home.records.some(row => row.competition === "ucl"));
  assert.ok(european.home.records.every(row => row.competition === "ucl"));
  assert.equal(european.home.records.length, 4);
  assert.equal(european.model.available, false);
  assert.equal(new Set(european.home.records.map(row => row.id)).size, 4);
}));

test("empty samples stay unavailable instead of fabricated zero averages", () => {
  const empty = A.stats([]);
  assert.equal(empty.played, 0);
  for (const metric of ["ppg", "gfAvg", "gaAvg", "winRate", "cleanSheetRate", "bttsRate", "over25Rate", "scoredRate"]) assert.equal(empty[metric], null);
  assert.equal(A.normalize("Beşiktaş"), A.normalize("Besiktas"));
  assert.equal(A.normalize("Bodø/Glimt"), A.normalize("Bodo Glimt"));
});
