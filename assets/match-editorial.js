/* Result-led editorial copy. This module describes supplied records; it invents no match events. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MatchEditorial = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RESULTS = { W: "승리", D: "무승부", L: "패배" };
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const number = value => finite(value) ? value.toFixed(2).replace(/\.?0+$/, "") : "—";
  const percent = value => finite(value) ? (value * 100).toFixed(1) : "—";
  const valid = rows => (rows || []).filter(row => Number.isInteger(row.goalsFor) && row.goalsFor >= 0 && Number.isInteger(row.goalsAgainst) && row.goalsAgainst >= 0);

  function name(team) {
    const raw = team && team.profile && team.profile.wikiKo || team && team.name || "구단";
    return String(raw).replace(/\s*\([^)]*\)\s*$/, "").replace(/^(?:ACF|SSC|RCD|FC|AC|AS|CA|CF|RC|RB)\s+/, "").replace(/\s+(?:FC|CF|AFC|SC)$/, "");
  }

  function particle(word, consonant, vowel) {
    const last = word.charCodeAt(word.length - 1);
    return last >= 0xac00 && last <= 0xd7a3 ? word + ((last - 0xac00) % 28 ? consonant : vowel) : word + " 팀" + consonant;
  }

  const subject = word => particle(word, "은", "는");
  const nominative = word => particle(word, "이", "가");
  const date = row => row.date + (row.dateIsKst === false ? " (원문 날짜)" : " (한국시간)");
  const when = row => row.editorialDate || date(row);
  const opponent = row => row.editorialOpponent || row.opponent;
  const score = row => row.goalsFor + "–" + row.goalsAgainst;

  function measure(rows) {
    rows = valid(rows);
    const s = { n: rows.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, clean: 0, scored: 0, both: 0, three: 0, multiConceded: 0, oneGoalLoss: 0 };
    rows.forEach(row => {
      s.gf += row.goalsFor; s.ga += row.goalsAgainst;
      if (row.goalsFor > row.goalsAgainst) s.w++;
      else if (row.goalsFor === row.goalsAgainst) s.d++;
      else s.l++;
      if (row.goalsAgainst === 0) s.clean++;
      if (row.goalsFor > 0) s.scored++;
      if (row.goalsFor > 0 && row.goalsAgainst > 0) s.both++;
      if (row.goalsFor + row.goalsAgainst >= 3) s.three++;
      if (row.goalsAgainst >= 2) s.multiConceded++;
      if (row.goalsAgainst - row.goalsFor === 1) s.oneGoalLoss++;
    });
    s.points = s.w * 3 + s.d;
    s.ppg = s.n ? s.points / s.n : null;
    s.gfAvg = s.n ? s.gf / s.n : null;
    s.gaAvg = s.n ? s.ga / s.n : null;
    return s;
  }

  const record = s => s.w + "승 " + s.d + "무 " + s.l + "패";

  function evidence(row, teamName) {
    const item = {
      label: date(row) + " · " + (row.competitionLabel || row.competition || "경기 기록"),
      detail: teamName + " 기준 · " + (row.isHome ? "홈" : "원정") + " " + opponent(row) + "전 " + score(row) + " " + (RESULTS[row.result] || "종료")
    };
    const url = row.url || row.sourceUrl;
    if (typeof url === "string" && (/^https?:\/\//.test(url) || /^match\.html\?/.test(url))) item.url = url;
    return item;
  }

  function uniqueEvidence(items) {
    const seen = new Set();
    return items.filter(Boolean).filter(item => {
      const key = item.label + "|" + item.detail;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  function streak(rows, predicate) {
    let count = 0;
    for (const row of rows) { if (!predicate(row)) break; count++; }
    return count;
  }

  function teamSection(team, which, scope) {
    const label = name(team), rows = valid(team.records), all = valid(team.allRecords), s = measure(rows);
    if (!s.n) return null;
    const paragraphs = [], cited = [evidence(rows[0], label)];
    const losses = streak(rows, row => row.goalsFor < row.goalsAgainst);
    const unbeaten = streak(rows, row => row.goalsFor >= row.goalsAgainst);
    const wins = streak(rows, row => row.goalsFor > row.goalsAgainst);
    let title = label + "의 최근 결과를 읽는 법";
    let opener = subject(label) + " " + scope + " 최근 " + s.n + "경기에서 " + record(s) + "를 기록했습니다. 가장 최근인 " + when(rows[0]) + " " + opponent(rows[0]) + "전은 " + score(rows[0]) + " " + RESULTS[rows[0].result] + "였습니다.";
    if (losses >= 2) {
      const recent = measure(rows.slice(0, losses));
      title = label + "의 연속 패배, 점수 차이까지 볼 필요";
      opener += " 최근 " + losses + "경기 연속으로 승점을 얻지 못했습니다.";
      if (recent.oneGoalLoss) opener += " 이 가운데 " + recent.oneGoalLoss + "경기는 한 골 차 패배였습니다. 연속 패배의 부담은 크지만, 매번 큰 점수 차로 밀린 흐름은 아니었습니다.";
    } else if (unbeaten >= 2) {
      const unbeatenRows = rows.slice(0, unbeaten), recent = measure(unbeatenRows);
      title = label + "의 무패 흐름과 그 안의 실점";
      opener += wins >= 2 ? " 최근 " + wins + "경기 연속 승리" + (unbeaten > wins ? "를 포함해 " + unbeaten + "경기 동안 패배가 없었습니다." : "를 거뒀습니다.") : " 최근 " + unbeaten + "경기에서는 패배가 없었습니다.";
      if (recent.multiConceded === unbeaten) opener += " 다만 그 " + unbeaten + "경기 모두 " + (unbeatenRows.every(row => row.goalsAgainst === 2) ? "두 골씩" : "두 골 이상을") + " 내줘, 무패가 곧 수비 안정으로 이어진 기록은 아닙니다.";
      else if (recent.clean === unbeaten) {
        title = label + "의 무패 흐름을 지탱한 무실점";
        opener += " 그 " + unbeaten + "경기는 모두 무실점으로 마쳐 결과와 실점 억제가 함께 이어졌습니다.";
      }
      else opener += " 그 기간의 무실점 경기는 " + recent.clean + "회로, 승패와 실점 흐름을 함께 봐야 합니다.";
    }
    paragraphs.push(opener);

    if (s.n >= 3) {
      const highest = rows.reduce((best, row) => row.goalsFor > best.goalsFor ? row : best, rows[0]);
      const concentration = s.gf > 0 && highest.goalsFor >= 3 && highest.goalsFor / s.gf >= 0.45;
      if (concentration) {
        const recentRows = rows.slice(0, rows.indexOf(highest));
        const recent = measure(recentRows);
        let p = "평균 득점 " + number(s.gfAvg) + "골의 구성도 살펴볼 만합니다. " + when(highest) + " " + opponent(highest) + "전의 " + highest.goalsFor + "골이 최근 " + s.n + "경기 전체 " + s.gf + "골 중 " + percent(highest.goalsFor / s.gf) + "%를 차지합니다.";
        if (recent.n >= 2) p += " 그 경기 이후 최근 " + recent.n + "경기에서는 합계 " + recent.gf + "득점·" + recent.ga + "실점을 기록했습니다. 한 번의 많은 득점이 최근 공격의 지속성을 그대로 설명하지는 않습니다.";
        else p += " 한 경기의 큰 득점이 평균을 높였으므로, 매 경기 같은 득점력을 유지했다고 해석하기는 어렵습니다.";
        paragraphs.push(p); cited.push(evidence(highest, label));
      } else {
        let p = "득점은 " + s.n + "경기 중 " + s.scored + "경기에서 나왔고, 평균 " + number(s.gfAvg) + "득점·" + number(s.gaAvg) + "실점입니다.";
        if (s.scored === s.n && s.clean === 0) p += " 모든 경기에서 골을 넣었지만 무실점 경기는 없었습니다. 득점의 연속성은 긍정적인 기록이지만, 실점 없이 경기를 마무리하는 안정성까지 확인된 것은 아닙니다.";
        else if (s.clean >= Math.ceil(s.n / 2)) p += " " + s.clean + "차례의 무실점이 결과를 지탱했습니다. 이 기간에는 실점을 억제한 경기가 절반 이상이어서, 득점 총량과 별도로 볼 만한 강점입니다.";
        else if (s.scored <= Math.floor(s.n / 2)) p += " 무득점이 " + (s.n - s.scored) + "회여서, 몇 골을 넣었는지뿐 아니라 득점한 경기의 수가 핵심입니다. 득점의 편차가 결과 비교에 영향을 줍니다.";
        else p += " 무실점은 " + s.clean + "회, 두 골 이상 실점은 " + s.multiConceded + "회입니다.";
        paragraphs.push(p);
      }
    }

    if (all.length >= 10) {
      const recent = measure(all.slice(0, 5)), before = measure(all.slice(5, 10));
      let p = "최근 10경기를 겹치지 않는 두 구간으로 나누면, 앞선 5경기에서 최근 5경기로 경기당 승점은 " + number(before.ppg) + "점에서 " + number(recent.ppg) + "점, 평균 득점은 " + number(before.gfAvg) + "골에서 " + number(recent.gfAvg) + "골, 평균 실점은 " + number(before.gaAvg) + "골에서 " + number(recent.gaAvg) + "골로 바뀌었습니다.";
      if (recent.gfAvg > before.gfAvg && recent.gaAvg > before.gaAvg) p += " 공격의 득점 증가와 실점 증가가 함께 나타났습니다.";
      else if (recent.gfAvg >= before.gfAvg && recent.gaAvg < before.gaAvg && recent.ppg > before.ppg) p += " 득점을 유지하거나 늘리면서 실점을 줄인 변화가 승점 개선과 함께 나타났습니다.";
      else if (recent.ppg < before.ppg && recent.gaAvg <= before.gaAvg) p += " 실점 평균이 악화되지 않았는데도 승점이 줄어, 실점 총량만으로 최근 부진을 설명하기는 어렵습니다.";
      else if (recent.ppg === before.ppg) p += " 승점 수준이 같아도 득실점의 구성이 같은지는 따로 봐야 합니다.";
      else p += " 두 구간은 서로 다른 상대와 치른 경기이므로, 이 변화는 최근 결과의 방향을 보여주는 비교입니다.";
      paragraphs.push(p); cited.push(evidence(all[5], label));
    }
    return { id: which + "-story", kicker: which === "home" ? "HOME TEAM" : "AWAY TEAM", title, paragraphs, evidence: uniqueEvidence(cited) };
  }

  function venueSection(a, hn, an) {
    const hr = valid(a.home.venue && a.home.venue.records), ar = valid(a.away.venue && a.away.venue.records);
    const h = measure(hr), aw = measure(ar);
    if (!h.n || !aw.n) return null;
    const paragraphs = [];
    let p = "이번 경기와 같은 장소 조건에서 " + subject(hn) + " 최근 홈 " + h.n + "경기 " + record(h) + ", " + subject(an) + " 최근 원정 " + aw.n + "경기 " + record(aw) + "입니다. 경기당 승점은 각각 " + number(h.ppg) + "점과 " + number(aw.ppg) + "점입니다.";
    if (h.n < 3 || aw.n < 3) p += " 장소별 경기 수가 적어 홈과 원정의 지속적인 강약을 판단하기에는 이릅니다.";
    else if (h.ppg === aw.ppg) p += " 장소별 승점 생산성은 같으므로, 어느 쪽에 무게를 둘지는 득점과 실점의 내용에서 더 살펴봐야 합니다.";
    else p += " 장소별 경기당 승점에서는 " + nominative(h.ppg > aw.ppg ? hn : an) + " 앞섭니다. 다만 홈과 원정 표본의 상대와 날짜는 서로 다릅니다.";
    paragraphs.push(p);
    if (h.n >= 3 && aw.n >= 3) {
      p = hn + "의 홈 평균은 " + number(h.gfAvg) + "득점·" + number(h.gaAvg) + "실점, " + an + "의 원정 평균은 " + number(aw.gfAvg) + "득점·" + number(aw.gaAvg) + "실점입니다. 이 홈·원정 기록에서 양 팀이 모두 골을 넣은 경기는 홈팀 " + h.both + "/" + h.n + "회, 원정팀 " + aw.both + "/" + aw.n + "회였습니다.";
      if (h.three >= h.n * 0.6 && aw.three >= aw.n * 0.6) p += " 합계 세 골 이상 나온 경기도 각각 " + h.three + "/" + h.n + "회와 " + aw.three + "/" + aw.n + "회로, 여러 골이 나온 경기의 비중이 높았습니다.";
      else p += " 이 빈도는 서로 다른 과거 경기의 결과이며, 이번 맞대결의 득점 여부를 확정하는 수치는 아닙니다.";
      paragraphs.push(p);
    }
    return { id: "venue-story", kicker: "HOME & AWAY", title: "장소를 바꾸어 보면 달라지는 득실점", paragraphs,
      evidence: uniqueEvidence([evidence(hr[0], hn), evidence(ar[0], an), evidence(hr[hr.length - 1], hn), evidence(ar[ar.length - 1], an)]) };
  }

  function modelSection(a, hn, an, formDirection) {
    const m = a.model || {};
    if (!m.available) return null;
    const hr = valid(a.home.allRecords).filter(row => row.competition === a.fixture.league && row.isHome).slice(0, a.limit);
    const ar = valid(a.away.allRecords).filter(row => row.competition === a.fixture.league && !row.isHome).slice(0, a.limit);
    const h = measure(hr), aw = measure(ar);
    if (!h.n || !aw.n) return null;
    const modelDirection = Math.sign(m.homeWin - m.awayWin);
    const divergence = formDirection && modelDirection && formDirection !== modelDirection;
    const paragraphs = [];
    let p = divergence ? "최근 경기당 승점에서는 " + nominative(formDirection > 0 ? hn : an) + " 앞서지만, 참고 분포에서는 " + (modelDirection > 0 ? "홈" : "원정") + " 승리 쪽 비중이 더 큽니다. 비교에 사용한 표본과 계산 기준이 다르기 때문입니다. " : "참고 분포는 최근 승점 순서를 그대로 확률로 바꾼 값이 아닙니다. ";
    p += "계산에는 " + (m.competitionLabel || a.fixture.league) + "에서만 추린 홈 " + h.n + "경기와 원정 " + aw.n + "경기를 사용합니다. 홈 표본은 " + when(hr[hr.length - 1]) + "부터, 원정 표본은 " + when(ar[ar.length - 1]) + "부터의 기록을 포함합니다.";
    paragraphs.push(p);
    p = "홈 득점 기준값은 " + m.homeLambda.toFixed(2) + "입니다. " + hn + "의 홈 평균 득점 " + number(h.gfAvg) + "골과 " + an + "의 원정 평균 실점 " + number(aw.gaAvg) + "골을 평균했습니다. 원정 기준값 " + m.awayLambda.toFixed(2) + "도 원정 평균 득점 " + number(aw.gfAvg) + "골과 홈 평균 실점 " + number(h.gaAvg) + "골의 평균입니다.";
    if (Math.abs(m.homeLambda - m.awayLambda) < 0.35) p += " 두 기준값의 차이는 " + Math.abs(m.homeLambda - m.awayLambda).toFixed(2) + "골로, 계산상 한쪽으로 크게 벌어진 구도는 아닙니다.";
    paragraphs.push(p);
    p = "이 기준값을 독립 포아송 분포에 넣으면 홈 약 " + percent(m.homeWin) + "%, 무승부 약 " + percent(m.draw) + "%, 원정 약 " + percent(m.awayWin) + "%로 나뉩니다.";
    if (m.scorelines && m.scorelines.length) {
      const top = m.scorelines[0];
      p += " 가장 큰 비중의 " + top.home + "–" + top.away + "도 " + percent(top.probability) + "%여서 하나의 스코어로 결과를 단정할 수는 없습니다.";
    }
    p += " 이는 과거 득실점으로 만든 참고 분포이며 실제 xG나 검증된 승률은 아닙니다.";
    paragraphs.push(p);
    return { id: "reference-story", kicker: "READING THE MODEL", title: divergence ? "최근 흐름과 참고 분포가 갈리는 이유" : "참고 분포가 설명하는 범위", paragraphs,
      evidence: uniqueEvidence([evidence(hr[hr.length - 1], hn), evidence(ar[ar.length - 1], an)]) };
  }

  function scenarioSection(a, hn, an, finished) {
    const hr = valid(a.home.records), ar = valid(a.away.records), h = measure(hr), aw = measure(ar);
    if (h.n < 3 || aw.n < 3) return null;
    const paragraphs = [finished ? "아래는 경기 전 기록에서 세울 수 있었던 조건부 시나리오입니다. 확정된 경기의 실제 전개를 재현한 설명은 아닙니다." : "다음은 확인된 반복 패턴이 이어진다고 가정한 조건부 시나리오입니다. 경기의 실제 전개나 득점 순서를 예고하는 설명은 아닙니다."];
    let p = "홈팀의 득점이 이어지는 경우를 먼저 볼 수 있습니다. " + subject(hn) + " 최근 " + h.n + "경기 중 " + h.scored + "경기에서 득점했고, " + an + "의 무실점은 " + aw.clean + "/" + aw.n + "회였습니다.";
    if (h.scored >= h.n * 0.6 && aw.clean <= aw.n * 0.4) p += " 이 두 패턴이 함께 이어진다면 원정팀의 득점 기록과 별개로, 상대 득점을 얼마나 억제하는지가 함께 중요해지는 조건입니다.";
    else p += " 홈팀이 득점을 유지할 수 있는지와 원정팀의 무실점 기록이 재현되는지를 함께 확인하는 조건입니다.";
    paragraphs.push(p);
    p = "원정팀의 득점이 유지되는 경우도 따로 봐야 합니다. " + subject(an) + " 최근 " + aw.n + "경기 중 " + aw.scored + "경기에서 골을 넣었고, " + subject(hn) + " " + h.multiConceded + "/" + h.n + "경기에서 두 골 이상을 내줬습니다.";
    if (aw.scored >= aw.n * 0.6 && h.multiConceded >= h.n * 0.4) p += " 원정 득점이 이어지고 홈팀의 반복 실점이 줄지 않는다면 홈팀이 결과를 바꾸는 부담은 커집니다.";
    else p += " 원정 득점의 지속성과 홈팀의 실점 억제 중 어떤 기록이 이어지는지가 이 조건을 가릅니다.";
    paragraphs.push(p);
    return { id: "scenario-story", kicker: "CONDITIONAL SCENARIOS", title: "기록에서 세울 수 있는 두 가지 조건", paragraphs,
      evidence: uniqueEvidence([evidence(hr.find(row => row.goalsAgainst >= 2) || hr[0], hn), evidence(ar.find(row => row.goalsFor > 0) || ar[0], an)]) };
  }

  function contextSection(a, hn, an, finished) {
    const paragraphs = [], cited = [], h2h = valid(a.h2h);
    if (h2h.length) {
      const s = measure(h2h), recent = h2h[0];
      paragraphs.push("현재 저장된 " + (a.coverage && a.coverage.scopeLabel || "선택 범위") + " 이전 맞대결 " + s.n + "경기에서 " + hn + " 기준 성적은 " + record(s) + "입니다. 가장 최근인 " + when(recent) + " 맞대결은 " + score(recent) + " " + RESULTS[recent.result] + "였습니다. " + (s.n < 3 ? "맞대결 표본이 적어 반복되는 상성으로 일반화하기는 어렵습니다." : "이 기록은 저장된 시즌 범위의 비교이며, 전체 역대 전적을 뜻하지는 않습니다."));
      h2h.slice(0, 2).forEach(row => cited.push(evidence(row, hn)));
    } else {
      const hasHistory = valid(a.home.records).length || valid(a.away.records).length;
      paragraphs.push("분석 대상 경기보다 앞선 두 팀의 맞대결은 현재 저장된 " + (a.coverage && a.coverage.scopeLabel || "선택 범위") + " 기록에서 확인되지 않습니다. " + (hasHistory ? "확보된 다른 상대전 성적과 홈·원정 기록이 이번 비교의 범위입니다." : "양 팀의 다른 상대전 기록도 없어 경기력과 장소별 성적의 비교는 아직 할 수 없습니다."));
    }
    const hs = a.home.standing, as = a.away.standing;
    if (!finished && hs && as && hs.row && as.row && hs.league === as.league) {
      let p = "현재 " + hs.label + " 순위표에서 " + subject(hn) + " " + hs.row.played + "경기 " + hs.row.points + "점으로 " + hs.row.rank + "위, " + subject(an) + " " + as.row.played + "경기 " + as.row.points + "점으로 " + as.row.rank + "위입니다. 이 순위는 " + (hs.updatedAt || "표에 표시된 확인 시점") + " 기준입니다.";
      if (hs.row.played === as.row.played) p += " 같은 경기 수에서 승점 차이는 " + Math.abs(hs.row.points - as.row.points) + "점입니다.";
      else p += " 치른 경기 수가 달라 총승점만으로 최근 경기력을 비교할 수는 없습니다.";
      paragraphs.push(p);
      if (hs.sourceUrl) cited.push({ label: (hs.updatedAt || "확인 시점") + " · 현재 순위", detail: hs.label + " 순위표", url: hs.sourceUrl });
    }
    return { id: "context-story", kicker: "MATCH CONTEXT", title: h2h.length ? "맞대결 기록이 더해 주는 맥락" : "맞대결과 시즌 맥락의 범위", paragraphs, evidence: uniqueEvidence(cited) };
  }

  function build(input, options) {
    if (!input || !input.fixture || !input.home || !input.away) throw new Error("MatchEditorial.build requires a match analysis.");
    const clubs = options && options.profiles && options.profiles.clubs || {};
    const targetYear = String(input.fixture.date || "").slice(0, 4);
    function decorate(rows) {
      return (rows || []).map(row => {
        const parts = String(row.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const editorialDate = parts ? (parts[1] !== targetYear ? Number(parts[1]) + "년 " : "") + Number(parts[2]) + "월 " + Number(parts[3]) + "일" + (row.dateIsKst === false ? " (원문 날짜)" : "") : date(row);
        return Object.assign({}, row, { editorialDate, editorialOpponent: clubs[row.opponentKey] ? name({ profile: clubs[row.opponentKey], name: row.opponent }) : row.opponent });
      });
    }
    function decorateTeam(team) {
      return Object.assign({}, team, { records: decorate(team.records), allRecords: decorate(team.allRecords), venue: Object.assign({}, team.venue || {}, { records: decorate(team.venue && team.venue.records) }) });
    }
    const a = Object.assign({}, input, { home: decorateTeam(input.home), away: decorateTeam(input.away), h2h: decorate(input.h2h) });
    const hn = name(a.home), an = name(a.away);
    const h = measure(a.home.records), aw = measure(a.away.records), scope = a.coverage && a.coverage.scopeLabel || "전체 대회";
    const finished = a.fixture.status === "finished" && Array.isArray(a.fixture.score) && a.fixture.score.every(Number.isFinite);
    const enough = h.n >= 3 && aw.n >= 3;
    const formDirection = enough ? Math.sign(h.ppg - aw.ppg) : 0;
    const model = a.model || {}, modelDirection = model.available ? Math.sign(model.homeWin - model.awayWin) : 0;
    const divergence = enough && formDirection && modelDirection && formDirection !== modelDirection;
    let headline = "두 팀의 최근 결과와 장소별 기록을 함께 읽는 경기";
    if (!h.n && !aw.n) headline = "확인 가능한 경기 정보부터 살펴볼 매치업";
    else if (!enough) headline = "표본이 적은 만큼 결과의 내용을 먼저 볼 경기";
    else if (divergence) headline = "최근 성적은 " + (formDirection > 0 ? hn : an) + ", 장소별 득실점은 " + (modelDirection > 0 ? hn : an) + " 쪽을 가리킨다";
    else if (formDirection) headline = (formDirection > 0 ? hn : an) + "의 최근 승점 우위, 득실점의 내용까지 볼 경기";
    else headline = "최근 승점이 같은 두 팀, 차이는 득실점의 구성에 있다";

    const deck = [];
    if (h.n && aw.n) {
      let p = scope + " 최근 기록에서 " + subject(hn) + " " + h.n + "경기 " + record(h) + ", " + subject(an) + " " + aw.n + "경기 " + record(aw) + "입니다.";
      if (enough) {
        p += " 경기당 승점은 " + number(h.ppg) + "점과 " + number(aw.ppg) + "점입니다.";
        if (formDirection) p += " " + (Math.abs(h.ppg - aw.ppg) <= 0.6 ? "차이는 " + number(Math.abs(h.ppg - aw.ppg)) + "점으로, " : "") + "최근 결과에서는 " + nominative(formDirection > 0 ? hn : an) + " 앞섭니다.";
        else p += " 결과의 총량만으로는 두 팀을 가르기 어렵습니다.";
      } else p += " 서로 비교할 수 있는 경기 수가 충분하지 않아 우세 방향을 단정하기는 이릅니다.";
      deck.push(p);
    } else deck.push("현재 확인 가능한 경기 전 결과는 홈팀 " + h.n + "경기, 원정팀 " + aw.n + "경기입니다. 기록이 없는 구간을 0득점이나 0실점으로 취급하지 않으며, 확보된 결과만으로 읽을 수 있는 내용을 정리했습니다.");
    if (finished) deck.push("이 경기는 이미 종료됐습니다. 아래 글은 분석 대상 경기와 그 이후 결과를 제외한 기록으로 경기 전 조건을 다시 살펴보는 분석이며, 당시 발행한 예측문을 뜻하지는 않습니다.");
    else if (divergence) deck.push("최근 승점과 참고 분포가 다른 방향을 가리키는 이유는 전체 흐름과 장소별 득실점이 서로 다른 질문에 답하기 때문입니다. 어느 한 숫자로 결론을 내리기보다, 득점의 지속성·반복 실점·표본의 기간을 연결해 읽어야 하는 매치업입니다.");
    else if (enough) deck.push("승패 기록만으로는 득점이 한 경기에 몰렸는지, 접전이 반복됐는지, 무패 속에서도 실점이 이어졌는지 알기 어렵습니다. 최근 결과의 구성과 홈·원정 조건을 차례로 살펴보면 비교의 근거가 더 분명해집니다.");

    if (a.scope === "all" && valid(a.home.records).concat(valid(a.away.records)).some(row => row.competition !== a.fixture.league)) {
      function composition(rows) {
        const counts = new Map();
        valid(rows).forEach(row => {
          const key = row.competitionLabel || row.competition || "대회";
          counts.set(key, (counts.get(key) || 0) + 1);
        });
        return Array.from(counts, item => item[0] + " " + item[1] + "경기").join("·") || "확인 기록 없음";
      }
      deck.push("비교 범위는 홈팀 " + composition(a.home.records) + ", 원정팀 " + composition(a.away.records) + "입니다. 대회와 상대 수준의 차이를 보정한 전력 평가는 아닙니다.");
    }

    const sections = [teamSection(a.home, "home", scope), teamSection(a.away, "away", scope), venueSection(a, hn, an), modelSection(a, hn, an, formDirection), scenarioSection(a, hn, an, finished), contextSection(a, hn, an, finished)].filter(Boolean);
    const verdict = { title: "이 매치업을 읽는 기준", paragraphs: [] };
    if (!enough) {
      verdict.title = "확보된 표본 안에서만 비교";
      verdict.paragraphs.push("현재 표본으로는 두 팀의 지속적인 강약이나 장소별 차이를 충분히 확인하기 어렵습니다. 확인된 개별 경기와 실제 표본 수를 우선 보고, 데이터가 쌓인 뒤 같은 기준으로 비교할 필요가 있습니다.");
    } else {
      if (divergence) verdict.paragraphs.push("최근 결과의 흐름은 " + (formDirection > 0 ? hn : an) + " 쪽이 앞서고, 같은 대회의 장소별 득실점을 사용한 계산은 " + (modelDirection > 0 ? hn : an) + " 쪽에 더 큰 비중을 둡니다. 두 신호를 합쳐 한 팀의 확실한 우세로 표현하기보다, 최근 변화와 더 긴 장소별 표본이 엇갈리는 경기로 읽는 편이 정확합니다.");
      else if (formDirection) verdict.paragraphs.push("최근 경기당 승점에서는 " + nominative(formDirection > 0 ? hn : an) + " 앞섭니다. 다만 이 우위가 득점의 연속성에서 왔는지, 무실점 경기에서 왔는지에 따라 해석은 달라집니다. 위에서 확인한 최근 결과의 구성과 이번 장소 조건을 함께 보는 것이 핵심입니다.");
      else verdict.paragraphs.push("최근 승점이 같다는 사실만으로 경기의 성격까지 같다고 볼 수는 없습니다. 득점이 발생한 경기 수, 두 골 이상 실점한 횟수, 이번 장소 조건의 기록을 함께 비교하는 것이 핵심입니다.");
    }
    if (finished) {
      const result = a.fixture.score, winner = result[0] > result[1] ? hn : result[0] < result[1] ? an : null;
      const p = "확정 결과는 " + result[0] + "–" + result[1] + (winner ? ", " + winner + "의 승리입니다." : " 무승부입니다.") + " 이 결과는 경기 전 비교에 포함하지 않았습니다." + (enough ? " 본문의 최근 흐름" + (model.available ? "과 참고 분포는" : "은") + " 최종 결과를 설명하기 위해 바꾼 수치가 아닙니다." : "");
      verdict.paragraphs.push(p);
    }
    const coverageNote = "분석 범위: " + scope + " · 홈 " + h.n + "경기, 원정 " + aw.n + "경기. " + (a.coverage && a.coverage.cutoffLabel ? a.coverage.cutoffLabel + " 이전 종료 기록 기준. " : "") + (a.coverage && a.coverage.conservativeDates ? "시각이 없는 보충 기록은 원문 날짜로 구분하고 보수적으로 포함했습니다." : "분석 대상 경기와 이후 결과는 제외했습니다.");
    const prose = [headline].concat(deck, verdict.paragraphs, sections.flatMap(section => [section.title].concat(section.paragraphs)), [coverageNote]).join(" ");
    return { headline, deck, verdict, sections, coverageNote, readingMinutes: Math.max(1, Math.ceil(prose.length / 650)) };
  }

  return { build };
});
