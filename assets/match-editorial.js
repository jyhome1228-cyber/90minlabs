/* Compact, result-led match reports. Predictions use only the supplied prior records. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MatchEditorial = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const valid = rows => (rows || []).filter(r => Number.isInteger(r.goalsFor) && r.goalsFor >= 0 && Number.isInteger(r.goalsAgainst) && r.goalsAgainst >= 0);
  const number = value => Number.isFinite(value) ? value.toFixed(2).replace(/\.?0+$/, "") : "—";
  function name(team) {
    return String(team && team.profile && team.profile.wikiKo || team && team.name || "구단")
      .replace(/\s*\([^)]*\)\s*$/, "").replace(/^(?:ACF|SSC|RCD|FC|AC|AS|CA|CF|RC|RB)\s+/, "").replace(/\s+(?:FC|CF|AFC|SC|BC)$/, "");
  }
  function subject(word) {
    const last = word.charCodeAt(word.length - 1);
    return last >= 0xac00 && last <= 0xd7a3 ? word + ((last - 0xac00) % 28 ? "은" : "는") : word + " 팀은";
  }
  function measure(rows) {
    rows = valid(rows);
    const s = { n: rows.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, scored: 0, clean: 0, multiConceded: 0, oneGoalLoss: 0 };
    rows.forEach(r => {
      s.gf += r.goalsFor; s.ga += r.goalsAgainst;
      if (r.goalsFor > r.goalsAgainst) s.w++; else if (r.goalsFor === r.goalsAgainst) s.d++; else s.l++;
      if (r.goalsFor) s.scored++;
      if (!r.goalsAgainst) s.clean++;
      if (r.goalsAgainst >= 2) s.multiConceded++;
      if (r.goalsAgainst - r.goalsFor === 1) s.oneGoalLoss++;
    });
    s.ppg = s.n ? (s.w * 3 + s.d) / s.n : null;
    s.gfAvg = s.n ? s.gf / s.n : null;
    s.gaAvg = s.n ? s.ga / s.n : null;
    return s;
  }
  function record(s) { return [[s.w, "승"], [s.d, "무"], [s.l, "패"]].filter(v => v[0]).map(v => v[0] + v[1]).join(" ") || "기록 없음"; }
  function streak(rows, condition) {
    let count = 0;
    for (const row of rows) { if (!condition(row)) break; count++; }
    return count;
  }
  function direction(value, threshold) { return Math.abs(value) >= threshold ? Math.sign(value) : 0; }

  function predict(a, home, away, hv, av) {
    if (home.n < 3 || away.n < 3) return { direction: "insufficient", label: "판단 유보", reason: "비교할 이전 경기가 충분하지 않습니다." };
    // Use the fixture's competition to avoid ranking unrelated domestic leagues by raw points.
    const sameHome = measure(valid(a.home.allRecords).filter(r => r.competition === a.fixture.league).slice(0, a.limit));
    const sameAway = measure(valid(a.away.allRecords).filter(r => r.competition === a.fixture.league).slice(0, a.limit));
    const comparable = sameHome.n >= 3 && sameAway.n >= 3;
    const formHome = comparable ? sameHome : home, formAway = comparable ? sameAway : away;
    const mixed = valid(a.home.records).concat(valid(a.away.records)).some(r => r.competition !== a.fixture.league);
    if (mixed && !comparable) return { direction: "close", label: "우세 판단 유보", reason: "같은 대회에서 두 팀의 우위를 가를 기록은 아직 적습니다." };
    const form = direction(formHome.ppg - formAway.ppg, 0.35);
    const venueHome = comparable ? measure(valid(a.home.allRecords).filter(r => r.competition === a.fixture.league && r.isHome).slice(0, a.limit)) : hv;
    const venueAway = comparable ? measure(valid(a.away.allRecords).filter(r => r.competition === a.fixture.league && !r.isHome).slice(0, a.limit)) : av;
    const venuesAvailable = venueHome.n >= 3 && venueAway.n >= 3;
    const venue = venuesAvailable ? direction(venueHome.ppg - venueAway.ppg, 0.35) : 0;
    const m = a.model || {};
    const goalGap = m.available ? m.homeLambda - m.awayLambda : venuesAvailable ? (venueHome.gfAvg + venueAway.gaAvg - venueAway.gfAvg - venueHome.gaAvg) / 2 : null;
    const goals = Number.isFinite(goalGap) ? direction(goalGap, 0.15) : 0;
    if (form && goals && form !== goals || form && venue && form !== venue) return { direction: "close", label: "접전 예상", reason: "최근 성적과 홈·원정 흐름이 서로 다른 방향을 가리킵니다." };
    if (Math.abs(formHome.ppg - formAway.ppg) <= 0.25 && formHome.d >= Math.ceil(formHome.n * 0.4) && formAway.d >= Math.ceil(formAway.n * 0.4) && (goals === 0 || !venuesAvailable)) return { direction: "draw", label: "무승부 쪽에 무게", reason: "승점 차이가 작고 양 팀 모두 무승부가 반복됐습니다." };
    if (form && (venue === form || goals === form) || !form && venue && goals === venue) {
      const sign = form || venue;
      return { direction: sign > 0 ? "home" : "away", label: sign > 0 ? "홈팀 우세 예상" : "원정팀 우세 예상", reason: "최근 성적과 장소별 기록이 같은 방향을 가리킵니다." };
    }
    return { direction: "close", label: "접전 예상", reason: "최근 성적만으로 한쪽의 우세를 뚜렷하게 잡기 어렵습니다." };
  }

  function build(a, options) {
    if (!a || !a.fixture || !a.home || !a.away) throw new Error("MatchEditorial.build requires a match analysis.");
    const hn = name(a.home), an = name(a.away), hr = valid(a.home.records), ar = valid(a.away.records);
    const h = measure(hr), aw = measure(ar), hv = measure(a.home.venue && a.home.venue.records), av = measure(a.away.venue && a.away.venue.records);
    const clubs = options && options.profiles && options.profiles.clubs || {};
    const opponent = row => clubs[row.opponentKey] ? name({ profile: clubs[row.opponentKey], name: row.opponent }) : row.opponent;
    const finished = a.fixture.status === "finished" && Array.isArray(a.fixture.score);
    const forecast = predict(a, h, aw, hv, av);
    if (forecast.direction === "home") forecast.label = hn + (finished ? " 우세 구도" : " 우세 예상");
    else if (forecast.direction === "away") forecast.label = an + (finished ? " 우세 구도" : " 우세 예상");
    else if (finished && forecast.direction === "close") forecast.label = forecast.label === "우세 판단 유보" ? "우세 판단 유보" : "접전 구도";
    else if (finished && forecast.direction === "draw") forecast.label = "무승부 쪽에 무게가 실린 구도";
    const sentences = [], cited = [];
    function add(text) { if (text) sentences.push(text); }
    function describe(teamName, rows, stats) {
      if (!stats.n) return subject(teamName) + " 비교할 이전 경기 기록이 없습니다.";
      const wins = streak(rows, r => r.goalsFor > r.goalsAgainst), losses = streak(rows, r => r.goalsFor < r.goalsAgainst), unbeaten = streak(rows, r => r.goalsFor >= r.goalsAgainst);
      cited.push(rows[0]);
      let text = subject(teamName) + " 최근 " + stats.n + "경기 " + record(stats);
      if (wins >= 2) text += "로, 최근 " + wins + "경기 연속 승리의 흐름입니다.";
      else if (losses >= 2) text += "로, 최근 " + losses + "경기 연속 패배를 기록했습니다.";
      else if (unbeaten >= 2) text += "이며 최근 " + unbeaten + "경기에서는 패배가 없었습니다.";
      else text += "를 기록했습니다.";
      return text;
    }
    add(describe(hn, hr, h));
    if (h.n >= 3) {
      const peak = hr.reduce((best, r) => r.goalsFor > best.goalsFor ? r : best, hr[0]);
      if (h.gf && peak.goalsFor >= 3 && peak.goalsFor / h.gf >= 0.45) {
        add("최근 " + h.gf + "득점 중 " + peak.goalsFor + "골이 " + opponent(peak) + "전 " + peak.goalsFor + "–" + peak.goalsAgainst + " 한 경기에 몰려 있어 득점의 꾸준함은 더 살펴볼 필요가 있습니다."); cited.push(peak);
      } else if (h.clean >= Math.ceil(h.n / 2)) add("그중 " + h.clean + "경기를 무실점으로 마쳐, 득점뿐 아니라 실점을 줄인 결과도 함께 쌓았습니다.");
      else if (h.multiConceded >= Math.ceil(h.n / 2)) add("다만 " + h.n + "경기 중 " + h.multiConceded + "경기에서 두 골 이상을 내줘 실점 관리가 과제로 남아 있습니다.");
      else add("최근 기록은 경기당 " + number(h.gfAvg) + "득점·" + number(h.gaAvg) + "실점으로, 득점이 나온 경기는 " + h.scored + "/" + h.n + "경기입니다.");
    }
    add(describe(an, ar, aw));
    if (aw.n >= 3) {
      const unbeaten = streak(ar, r => r.goalsFor >= r.goalsAgainst), run = ar.slice(0, unbeaten);
      if (unbeaten >= 2 && run.every(r => r.goalsAgainst >= 2)) add("무패를 기록한 그 " + unbeaten + "경기 모두 " + (run.every(r => r.goalsAgainst === 2) ? "두 골씩" : "두 골 이상을") + " 내줬다는 점에서 결과 회복과 수비 안정은 구분할 필요가 있습니다.");
      else if (aw.scored === aw.n && !aw.clean) add("모든 경기에서 득점했지만 무실점 경기는 없어, 공격의 흐름만큼 반복 실점도 눈여겨봐야 합니다.");
      else if (aw.clean >= Math.ceil(aw.n / 2)) add("무실점이 " + aw.clean + "/" + aw.n + "경기로 절반 이상이어서, 상대의 득점을 억제한 기록이 눈에 띕니다.");
      else add("최근 " + aw.n + "경기에서 " + aw.gf + "골을 넣고 " + aw.ga + "골을 내줘, 득점의 지속성과 실점 억제를 함께 확인해야 합니다.");
    }
    const mixed = hr.concat(ar).some(r => r.competition !== a.fixture.league);
    if (mixed) {
      const sameHomeRows = valid(a.home.allRecords).filter(r => r.competition === a.fixture.league).slice(0, a.limit), sameAwayRows = valid(a.away.allRecords).filter(r => r.competition === a.fixture.league).slice(0, a.limit);
      const sh = measure(sameHomeRows), sa = measure(sameAwayRows);
      if (sh.n >= 3 && sa.n >= 3) add((sameHomeRows[0].competitionLabel || a.fixture.league) + " 최근 성적은 " + hn + " " + sh.n + "경기 " + record(sh) + ", " + an + " " + sa.n + "경기 " + record(sa) + "입니다.");
    }
    if (hv.n && av.n) {
      let text = hn + "의 홈 " + hv.n + "경기는 " + record(hv) + ", " + an + "의 원정 " + av.n + "경기는 " + record(av);
      if (hv.n < 3 || av.n < 3) text += "로 아직 장소별 흐름을 단정하기에는 경기 수가 적습니다.";
      else if (Math.abs(hv.ppg - av.ppg) < 0.25) text += "로 장소별 승점 흐름은 비슷합니다.";
      else text += "로 장소별 성적에서는 " + (hv.ppg > av.ppg ? hn : an) + " 쪽이 앞섭니다.";
      add(text);
    }
    if (h.n >= 3 && aw.n >= 3) {
      if (h.scored >= Math.ceil(h.n * 0.6) && aw.scored >= Math.ceil(aw.n * 0.6) && h.clean <= h.n * 0.4 && aw.clean <= aw.n * 0.4) add("양 팀의 득점이 이어지고 실점도 반복된다면, 서로 골을 주고받는 흐름이 예상됩니다.");
      else if (h.clean >= h.n * 0.5 && aw.clean >= aw.n * 0.5) add("양 팀의 무실점 흐름이 이어진다면, 많은 골보다 적은 득점 차로 승부가 갈리는 양상을 예상할 수 있습니다.");
      else {
        const defending = h.clean > aw.clean ? hn : an;
        add(defending + "의 실점 억제가 이어진다면 상대의 득점 흐름이 유지되는지가 승부의 중요한 조건이 됩니다.");
      }
      if (forecast.direction === "home" || forecast.direction === "away") {
        const leader = forecast.direction === "home" ? hn : an;
        add("이 흐름을 종합하면 " + leader + " 쪽에 조금 더 무게를 둘 수 있지만, 최근의 득점과 실점 흐름이 유지되는지가 관건입니다.");
      } else if (forecast.direction === "draw") add("최근의 비슷한 승점 흐름과 반복된 무승부를 함께 보면, 이번 비교에서는 무승부 쪽에 조금 더 무게가 실립니다.");
      else if (forecast.label === "우세 판단 유보") add("같은 대회의 비교 기록은 아직 적어, 현재로서는 한 팀의 승리를 뚜렷하게 예상하기 어렵습니다.");
      else add("최근 성적과 홈·원정 조건을 함께 보면 한쪽의 확실한 우세보다는 접전으로 예상하는 편이 적절합니다.");
    } else add("이전 경기력이 기록으로 충분히 확인되지 않아 승패 방향은 유보합니다.");

    if (finished) {
      for (let i = 0; i < sentences.length; i++) {
        sentences[i] = sentences[i].replace(/흐름이 예상됩니다/g, "흐름을 생각해 볼 수 있는 구도입니다")
          .replace(/양상을 예상할 수 있습니다/g, "양상을 생각해 볼 수 있는 구도입니다")
          .replace(/이번 비교에서는/g, "경기 전 기록으로 다시 보면")
          .replace(/접전으로 예상하는 편이 적절합니다/g, "접전 구도로 읽을 수 있습니다")
          .replace(/한 팀의 승리를 뚜렷하게 예상하기 어렵습니다/g, "한 팀의 우세를 뚜렷하게 판단하기 어렵습니다");
      }
    }
    const split = sentences.length >= 6 ? Math.ceil(sentences.length / 2) : sentences.length;
    const paragraphs = [sentences.slice(0, split).join(" ")];
    if (split < sentences.length) paragraphs.push(sentences.slice(split).join(" "));
    const seen = new Set();
    const evidence = cited.filter(r => !seen.has(r.id) && seen.add(r.id)).map(r => ({ id: r.id, date: r.date, dateIsKst: r.dateIsKst, url: r.url || r.sourceUrl || null }));
    return {
      title: finished ? "경기 전 흐름 리뷰" : "경기 전망",
      sentences, paragraphs, forecast, evidence,
      sampleLabel: (finished ? "경기 전 기록 리뷰 · " : "") + (a.coverage && a.coverage.scopeLabel || "전체 대회") + " · 홈 " + h.n + "경기 · 원정 " + aw.n + "경기"
    };
  }
  return { build };
});
