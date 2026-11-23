"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = require("../assets/match-analysis.js");
const E = require("../assets/match-editorial.js");
const load = file => JSON.parse(fs.readFileSync(path.join(__dirname, "../data/", file + ".json"), "utf8"));
const context = A.createContext({ calendar: load("match-calendar"), results: load("team-results"), profiles: load("team-profiles"), standings: load("league-data"), uefa: load("uefa-standings") });
const originalNow = Date.now;
const fixedNow = () => Date.parse("2026-11-23T15:00:00+09:00");
function analysis(home, date, options = {}) {
  const fixture = context.matches.find(row => row.home === home && row.date === date);
  assert.ok(fixture);
  Date.now = fixedNow;
  try { return A.analyze(context, fixture, options); } finally { Date.now = originalNow; }
}
const prose = article => [article.headline].concat(article.deck, article.verdict.paragraphs, article.sections.flatMap(section => section.paragraphs)).join("\n");

test("Monza article explains the specific form/model disagreement and scoring concentration", () => {
  const a = analysis("Monza", "2026-11-24"), article = E.build(a), text = prose(article);
  assert.ok(text.length >= 1800 && text.length <= 3200, text.length + " characters");
  assert.equal(article.sections.length, 6);
  assert.match(text, /최근 4경기 연속/);
  assert.match(text, /3경기는 한 골 차 패배/);
  assert.match(text, /전체 8골 중 50\.0%/);
  assert.match(text, /합계 4득점·10실점/);
  assert.match(text, /3경기 모두 두 골씩/);
  assert.match(text, /1\.8골과 피오렌티나의 원정 평균 실점 2\.4골/);
  assert.match(text, /기준값은 2\.10/);
  assert.match(text, /원정 기준값 1\.90/);
  assert.match(text, /홈 약 43\.5%, 무승부 약 20\.6%, 원정 약 35\.8%/);
  assert.match(article.sections.find(section => section.id === "venue-story").paragraphs.join(" "), /홈팀 3\/5회, 원정팀 4\/5회/);
  assert.match(text, /2–1도 7\.7%/);
  assert.match(text, /앞선 5경기에서 최근 5경기로/);
  assert.match(text, /평균 득점은 1\.4골에서 2골/);
  assert.equal(new Set(article.sections.map(section => section.id)).size, article.sections.length);
  assert.ok(article.sections.every(section => /^[a-z][a-z-]+$/.test(section.id)));
  assert.doesNotMatch(text, /(?:undefined|NaN|Infinity|2\.10는|1\.8와)/);
});

test("10-match view keeps the actual five-game venue sample and uses disjoint trend windows", () => {
  const a = analysis("Monza", "2026-11-24", { limit: 10 }), article = E.build(a), text = prose(article);
  assert.match(text, /10경기 2승 1무 7패/);
  assert.match(text, /홈 5경기와 원정 5경기/);
  assert.match(text, /최근 10경기를 겹치지 않는 두 구간/);
  assert.match(text, /앞선 5경기에서 최근 5경기로 경기당 승점은 0\.8점에서 0\.6점/);
  assert.match(text, /홈 약 43\.5%, 무승부 약 20\.6%, 원정 약 35\.8%/);
  assert.doesNotMatch(text, /홈 10경기와 원정 10경기/);
});

test("optional profiles localize opponents while prose dates stay concise and evidence retains precision", () => {
  const a = analysis("Monza", "2026-11-24"), before = JSON.stringify(a);
  const article = E.build(a, { profiles: context.profiles });
  const home = article.sections.find(section => section.id === "home-story");
  assert.match(home.paragraphs.join(" "), /11월 8일 아탈란타 BC전/);
  assert.match(home.paragraphs.join(" "), /10월 20일 칼리아리 칼초전/);
  assert.ok(home.evidence.some(item => item.label.includes("2026-11-08 (한국시간)")));
  assert.equal(JSON.stringify(a), before, "editorial decoration must not mutate analysis records");
});

test("completed Racing article distinguishes retrospective analysis from the final score", () => {
  const a = analysis("R. Racing Club", "2026-11-23"), article = E.build(a), text = prose(article);
  assert.match(article.deck.join(" "), /이미 종료/);
  assert.match(article.deck.join(" "), /당시 발행한 예측문을 뜻하지는/);
  assert.match(text, /라싱 산탄데르는 5경기 2승 1무 2패/);
  assert.match(article.verdict.paragraphs.join(" "), /확정 결과는 3–2, 라싱 산탄데르의 승리/);
  assert.match(article.sections.find(section => section.id === "scenario-story").paragraphs[0], /세울 수 있었던 조건부 시나리오/);
  assert.ok(!article.sections.flatMap(section => section.evidence).some(item => item.url === A.matchUrl(a.fixture)));
  assert.ok(!article.sections.flatMap(section => section.paragraphs).some(p => /현재 .*순위표/.test(p)), "current standings must not become a past prematch premise");
});

test("empty early-season samples stay short and do not invent strengths or a model", () => {
  const fixture = context.matches[0];
  Date.now = fixedNow;
  let a;
  try { a = A.analyze(context, fixture); } finally { Date.now = originalNow; }
  const article = E.build(a), text = prose(article);
  assert.equal(a.home.records.length, 0);
  assert.equal(a.away.records.length, 0);
  assert.ok(text.length < 1000);
  assert.match(text, /홈팀 0경기, 원정팀 0경기/);
  assert.equal(article.sections.some(section => section.id === "reference-story" || section.id === "scenario-story"), false);
  assert.doesNotMatch(text, /평균 0득점|평균 0실점|홈 0%/);
});

test("UEFA mixed records retain source-date labels and correct team-perspective scores", () => {
  const fixture = context.matches.find(row => row.league === "ucl" && row.home === "Club Brugge" && row.date > "2026-11-23");
  assert.ok(fixture);
  Date.now = fixedNow;
  let a;
  try { a = A.analyze(context, fixture, { scope: "all", limit: 5 }); } finally { Date.now = originalNow; }
  const article = E.build(a), items = article.sections.flatMap(section => section.evidence);
  assert.ok(items.some(item => item.label.includes("원문 날짜")));
  const prior = a.home.allRecords.concat(a.away.allRecords, a.h2h);
  for (const item of items) {
    if (!item.url || !item.url.startsWith("match.html?")) continue;
    const row = prior.find(row => row.url === item.url);
    assert.ok(row, item.url);
    assert.ok(item.detail.includes(row.goalsFor + "–" + row.goalsAgainst));
    assert.notEqual(row.id, a.id);
  }
  assert.doesNotMatch(prose(article), /(?:undefined|NaN|Infinity)/);
});
