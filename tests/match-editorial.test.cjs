"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = require("../assets/match-analysis.js");
const E = require("../assets/match-editorial.js");
const load = file => JSON.parse(fs.readFileSync(path.join(__dirname, "../data/", file + ".json"), "utf8"));
const context = A.createContext({ calendar: load("match-calendar"), results: load("team-results"), profiles: load("team-profiles"), standings: load("league-data"), uefa: load("uefa-standings") });
function analyze(home, date, options = {}) {
  const fixture = context.matches.find(row => row.home === home && row.date === date);
  assert.ok(fixture);
  const originalNow = Date.now;
  Date.now = () => Date.parse("2026-11-23T15:00:00+09:00");
  try { return A.analyze(context, fixture, options); } finally { Date.now = originalNow; }
}
const prose = article => article.sentences.join(" ");

test("Monza report has a compact evidence-to-forecast flow without calculation chatter", () => {
  // Preserve the intended pre-kickoff editorial scenario even after that
  // real match has been finalized in the daily score calendar.
  const analyzed = analyze("Monza", "2026-11-24");
  const preview = { ...analyzed, fixture: { ...analyzed.fixture, status: "scheduled", score: null } };
  const report = E.build(preview, { profiles: context.profiles });
  const text = prose(report);
  assert.ok(report.sentences.length >= 5 && report.sentences.length <= 10);
  assert.ok(report.paragraphs.length <= 3);
  assert.ok(text.length < 900);
  assert.equal(report.forecast.direction, "close");
  assert.equal(report.forecast.label, "접전 예상");
  assert.match(text, /최근 4경기 연속 패배/);
  assert.match(text, /8득점 중 4골이 칼리아리 칼초전 4–0/);
  assert.match(text, /3경기 모두 두 골씩/);
  assert.match(text, /양 팀의 득점이 이어지고 실점도 반복된다면/);
  assert.match(text, /접전으로 예상/);
  assert.doesNotMatch(text, /포아송|기준값|계산|xG|출처|방법론|검증|보정|모델|NaN|undefined|Infinity/);
});

test("the ten-match control updates the narrative while retaining actual venue counts", () => {
  const report = E.build(analyze("Monza", "2026-11-24", { limit: 10 }));
  assert.match(prose(report), /최근 10경기 2승 1무 7패/);
  assert.match(prose(report), /홈 5경기는/);
  assert.match(prose(report), /원정 5경기는/);
  assert.doesNotMatch(prose(report), /홈 10경기는|원정 10경기는/);
  assert.match(report.sampleLabel, /홈 10경기 · 원정 10경기/);
});

test("completed fixtures are reviews and their final scores cannot affect the pre-match report", () => {
  const a = analyze("R. Racing Club", "2026-11-23"), report = E.build(a, { profiles: context.profiles });
  const changedScore = { ...a, fixture: { ...a.fixture, score: [99, 98] } };
  const alternate = E.build(changedScore, { profiles: context.profiles });
  assert.equal(report.title, "경기 전 흐름 리뷰");
  assert.match(report.sampleLabel, /경기 전 기록 리뷰/);
  assert.ok(report.sentences.length >= 5 && report.sentences.length <= 10);
  assert.deepEqual(alternate.sentences, report.sentences);
  assert.deepEqual(alternate.forecast, report.forecast);
  assert.doesNotMatch(prose(report), /99|98|이미 예측|예상됩니다|승리가 확실/);
  assert.ok(report.evidence.every(item => item.id !== a.id));
});

test("empty early-season histories stay honest and do not force a five-sentence prediction", () => {
  const a = A.analyze(context, context.matches[0]), report = E.build(a);
  assert.equal(a.home.records.length, 0); assert.equal(a.away.records.length, 0);
  assert.equal(report.forecast.direction, "insufficient");
  assert.equal(report.forecast.label, "판단 유보");
  assert.ok(report.sentences.length < 5);
  assert.doesNotMatch(prose(report), /평균 0|접전 예상|확인된 개별 결과/);
  assert.match(report.sampleLabel, /홈 0경기 · 원정 0경기/);
});

test("a short report retains same-competition context and prior evidence for mixed UEFA histories", () => {
  const fixture = context.matches.find(row => row.league === "ucl" && row.home === "Club Brugge" && row.date > "2026-11-23");
  const a = analyze(fixture.home, fixture.date), before = JSON.stringify(a), report = E.build(a, { profiles: context.profiles });
  assert.ok(report.sentences.length <= 10);
  assert.match(prose(report), /챔피언스리그 최근 성적/);
  const prior = a.home.allRecords.concat(a.away.allRecords);
  assert.ok(report.evidence.every(item => prior.some(row => row.id === item.id && row.upperBoundMs < a.cutoffMs)));
  assert.equal(JSON.stringify(a), before);
});

function synthetic(homeScores, awayScores) {
  const make = (scores, home) => scores.map((score, i) => ({ id: (home ? "h" : "a") + i, goalsFor: score[0], goalsAgainst: score[1], result: score[0] > score[1] ? "W" : score[0] === score[1] ? "D" : "L", isHome: home, competition: "epl", competitionLabel: "프리미어리그", opponent: "Opponent", date: "2026-11-01" }));
  const hr = make(homeScores, true), ar = make(awayScores, false);
  return { fixture: { league: "epl", status: "scheduled" }, limit: 5, scope: "all", home: { name: "Home", records: hr, allRecords: hr, venue: { records: hr } }, away: { name: "Away", records: ar, allRecords: ar, venue: { records: ar } }, model: { available: false }, coverage: { scopeLabel: "프리미어리그" } };
}

test("forecast direction requires supporting records and can distinguish home, away, draw and conflict", () => {
  const wins = [[2, 0], [3, 1], [2, 0], [1, 0], [2, 1]], losses = [[0, 2], [1, 3], [0, 1], [1, 2], [0, 2]], draws = [[0, 0], [1, 1], [1, 1], [0, 0], [1, 1]];
  assert.equal(E.build(synthetic(wins, losses)).forecast.direction, "home");
  assert.equal(E.build(synthetic(losses, wins)).forecast.direction, "away");
  assert.equal(E.build(synthetic(draws, draws)).forecast.direction, "draw");
  const conflicting = synthetic(wins, losses);
  conflicting.model = { available: true, homeLambda: 0.5, awayLambda: 2.5 };
  assert.equal(E.build(conflicting).forecast.direction, "close");
});

test("the match page exposes one compact report and no methodology or duplicate long report", () => {
  const html = fs.readFileSync(path.join(__dirname, "../match.html"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "../assets/match-page.js"), "utf8");
  assert.equal((html.match(/id="reportBody"/g) || []).length, 1);
  assert.doesNotMatch(html, /DATA &amp; METHODOLOGY|분석 기준과 출처|id="sources"|href="#sources"|reportOutline|reportCoverage|modelPanel|id="report"/);
  assert.doesNotMatch(js, /renderSources|renderModel|reportOutline|modelMethod|\$\("menuToggle"\)\.addEventListener/);
  for (const section of ["comparison", "recent", "headtohead", "standings"]) assert.ok(html.includes('id="' + section + '"'));
});
