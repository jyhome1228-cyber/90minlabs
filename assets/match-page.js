(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { context: null, match: null, analysis: null, limit: 5, scope: "all", partial: [], loading: false };
  const params = new URLSearchParams(location.search);
  const resultLabels = { W: "승", D: "무", L: "패" };
  const leagueShort = { epl: "EPL", championship: "CHAMPIONSHIP", laliga: "LA LIGA", seriea: "SERIE A", bundesliga: "BUNDESLIGA", ligue1: "LIGUE 1", ucl: "UCL", uel: "UEL", uecl: "UECL" };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function link(text, href, cls, external) {
    const node = el("a", cls, text);
    node.href = href;
    if (external) { node.target = "_blank"; node.rel = "noopener noreferrer"; }
    return node;
  }
  function decimal(value) { return Number.isFinite(value) ? value.toFixed(2) : "—"; }
  function percent(value) { return Number.isFinite(value) ? Math.round(value * 100) + "%" : "—"; }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const ms = Date.parse(value + "T12:00:00Z");
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
  }
  function shortDate(value) { return validDate(value) ? value.slice(5).replace("-", ".") : value; }
  function fullDate(value) {
    return validDate(value) ? new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(value + "T12:00:00Z")) : "날짜 미정";
  }
  function verifiedDate(value) {
    if (!value) return "자료 확인일 미제공";
    if (validDate(value)) return value.replace(/-/g, ". ") + ".";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date) + " KST";
  }
  function safeUrl(value) { return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null; }
  function isFinished(match) { return match.status === "finished" && Array.isArray(match.score) && match.score.length === 2 && match.score.every(n => Number.isInteger(n) && n >= 0); }
  function matchStatus(match) {
    if (isFinished(match)) return "finished";
    if (/postponed|cancelled|canceled/.test(match.status)) return match.status === "postponed" ? "postponed" : "cancelled";
    const kickoff = Date.parse(match.date + "T" + (match.time || "00:00") + ":00+09:00");
    return Number.isFinite(kickoff) && kickoff <= Date.now() ? "unverified" : "scheduled";
  }
  function backHref(match, sameLeague) {
    const query = new URLSearchParams();
    const date = params.get("backDate");
    query.set("date", validDate(date) ? date : match.date);
    const league = params.get("backLeague");
    query.set("league", sameLeague ? match.league : league === "all" || leagueShort[league] ? league : "all");
    query.set("view", params.get("backView") === "week" ? "week" : "day");
    const status = params.get("backStatus");
    query.set("status", ["scheduled", "finished", "unverified"].includes(status) ? status : "all");
    return "index.html?" + query + "#matches";
  }
  function formStrip(records, limit) {
    const strip = el("div", "form-strip");
    const selected = records.slice(0, limit || records.length);
    strip.setAttribute("aria-label", "최근 경기부터 " + selected.map(row => resultLabels[row.result]).join(" "));
    selected.forEach(row => {
      const chip = el("span", "form-chip " + row.result, resultLabels[row.result]);
      chip.title = row.dateLabel + " · " + row.opponent + " · " + row.goalsFor + "–" + row.goalsAgainst;
      strip.append(chip);
    });
    return strip;
  }
  function initials(name) {
    const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(word => word[0]).join("").toUpperCase() || "FC";
  }
  const crestRequests = new Map();
  async function alternativeCrest(team) {
    const query = team.profile && team.profile.searchName || team.name;
    if (crestRequests.has(query)) return crestRequests.get(query);
    const request = fetch("https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=" + encodeURIComponent(query), { signal: AbortSignal.timeout(6000) })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const names = [query, team.name].map(MatchAnalysis.normalize);
        const row = (data && data.teams || []).find(item => item.strSport === "Soccer" && [item.strTeam].concat(String(item.strTeamAlternate || "").split(";")).some(name => names.includes(MatchAnalysis.normalize(name))));
        return safeUrl(row && (row.strBadge || row.strTeamBadge));
      }).catch(() => null);
    crestRequests.set(query, request);
    return request;
  }
  function crest(team) {
    const holder = el("span", "club-badge");
    const fallback = el("span", "badge-fallback", initials(team.name));
    fallback.setAttribute("aria-hidden", "true");
    holder.append(fallback);
    const image = el("img"); image.alt = ""; image.width = 64; image.height = 64;
    let attemptedFallback = false;
    function setImage(url) {
      if (!url) return;
      image.onload = () => { if (holder.isConnected) holder.replaceChildren(image); };
      image.onerror = async () => {
        holder.replaceChildren(fallback);
        if (!attemptedFallback) { attemptedFallback = true; setImage(await alternativeCrest(team)); }
      };
      image.src = url;
    }
    if (team.crestId) setImage("https://crests.football-data.org/" + encodeURIComponent(team.crestId) + ".png");
    else { attemptedFallback = true; alternativeCrest(team).then(setImage); }
    return holder;
  }

  function renderHeader(a) {
    const match = a.fixture, status = matchStatus(match);
    $("matchTitle").textContent = a.home.name + " vs " + a.away.name + " 경기 분석";
    document.title = a.home.name + " vs " + a.away.name + " | 90MIN LABS";
    $("backToMatches").href = backHref(match, false);
    $("relatedListLink").href = backHref(match, true);
    $("fixtureCompetition").replaceChildren(link(MatchAnalysis.leagueLabel(match.league), a.standings ? "leagues.html?league=" + encodeURIComponent(match.league) : backHref(match, true)));
    $("fixtureCompetition").append(document.createTextNode(" · " + (a.coverage.season || "시즌") + (match.round ? " · " + match.round + " ROUND" : "")));
    $("fixtureDate").textContent = fullDate(match.date) + " · " + (match.time || "시간 미정") + " 한국시간";
    const statusText = { finished: "경기 종료", scheduled: "경기 예정", unverified: "결과 확인 중", postponed: "경기 연기", cancelled: "경기 취소" }[status];
    $("fixtureStatus").className = "fixture-status " + status;
    $("fixtureStatus").textContent = statusText;
    ["home", "away"].forEach(side => {
      const team = a[side], node = $(side + "Header");
      node.replaceChildren();
      const club = el(team.url ? "a" : "div", "club-link");
      if (team.url) { club.href = team.url; club.title = team.name + " 구단 정보"; }
      club.append(crest(team), el("span", "club-name", team.name));
      node.append(club);
      if (team.profile && team.profile.wikiKo && team.profile.wikiKo !== team.name) node.append(el("span", "club-ko", team.profile.wikiKo));
      node.append(el("span", "club-role", side === "home" ? "HOME" : "AWAY"));
    });
    const score = $("scoreHeader"); score.replaceChildren();
    if (status === "finished") {
      const value = el("div", "score-value");
      value.append(el("span", "", match.score[0]), el("span", "score-separator", ":"), el("span", "", match.score[1]));
      value.setAttribute("aria-label", a.home.name + " " + match.score[0] + " 대 " + match.score[1] + " " + a.away.name);
      score.append(value, el("p", "score-subtitle", "FULL TIME"));
    } else score.append(el("div", "score-value kickoff", status === "postponed" || status === "cancelled" ? "—" : match.time || "미정"), el("p", "score-subtitle", status === "scheduled" ? "KICK OFF · KST" : statusText));
    if (safeUrl(match.scoreSourceUrl)) score.append(link("스코어 출처", match.scoreSourceUrl, "score-link", true));
    const homeProfile = a.home.profile;
    $("fixtureVenue").textContent = homeProfile && homeProfile.stadium ? "홈 구단 경기장 · " + homeProfile.stadium + (homeProfile.cityKo ? " · " + homeProfile.cityKo : "") : "모든 일정은 한국시간 기준";
    $("fixtureBaseline").textContent = status === "finished" ? "분석 기준 · 경기 시작 이전 기록 재구성" : "분석 기준 · 현재 확보한 경기 시작 이전 기록";
    const outcome = $("fixtureOutcome"); outcome.hidden = status !== "finished";
    if (status === "finished") {
      const hs = match.score[0], as = match.score[1];
      const text = hs === as ? "두 팀은 " + hs + "–" + as + " 무승부로 경기를 마쳤습니다." : (hs > as ? a.home.name : a.away.name) + "이 " + Math.max(hs, as) + "–" + Math.min(hs, as) + " 승리를 기록했습니다.";
      outcome.replaceChildren(el("strong", "", "경기 결과  "), document.createTextNode(text + " 아래 분석은 이 경기 결과를 제외한 기록으로 계산합니다."));
    }
    $("copyLink").disabled = false;
  }

  function recordSummary(stats) { return stats.played ? stats.w + "승 " + stats.d + "무 " + stats.l + "패" : "기록 없음"; }
  function insight(title, text) {
    const item = el("article", "insight-item"); item.append(el("h3", "", title), el("p", "", text)); return item;
  }
  function renderInsights(a) {
    const home = a.home, away = a.away, h = home.stats, w = away.stats;
    const node = $("insightSummary"); node.replaceChildren();
    let lead, intro;
    if (h.played >= 3 && w.played >= 3) {
      const gap = h.ppg - w.ppg;
      lead = Math.abs(gap) < .35 ? "최근 승점 흐름은 비슷합니다." : (gap > 0 ? home.name : away.name) + "의 최근 흐름이 앞섭니다.";
      intro = home.name + "은 최근 " + h.played + "경기 " + recordSummary(h) + ", " + away.name + "은 " + w.played + "경기 " + recordSummary(w) + "를 기록했습니다. 경기당 승점은 각각 " + decimal(h.ppg) + "점과 " + decimal(w.ppg) + "점입니다.";
    } else {
      lead = "쌓여가는 기록에서 경기의 단서를 찾습니다.";
      intro = "경기 시작 전 확인된 기록은 " + home.name + " " + h.played + "경기, " + away.name + " " + w.played + "경기입니다. 시즌 초반이나 자료가 적은 경기에서는 표본 수와 함께 지표를 살펴보세요.";
    }
    node.append(el("p", "insight-lead", lead), el("p", "insight-intro", intro));
    const list = el("div", "insight-list"), hv = home.venue.stats, av = away.venue.stats;
    list.append(insight("홈·원정 흐름", hv.played && av.played ? "홈팀의 최근 홈 " + hv.played + "경기는 " + recordSummary(hv) + ", 원정팀의 최근 원정 " + av.played + "경기는 " + recordSummary(av) + "입니다. 홈과 원정에서의 경기당 승점은 " + decimal(hv.ppg) + "점, " + decimal(av.ppg) + "점입니다." : "홈 " + hv.played + "경기와 원정 " + av.played + "경기가 확인됐습니다. 양쪽 표본이 쌓이면 장소에 따른 성적 차이를 비교할 수 있습니다."));
    list.append(insight("득점과 실점", h.played && w.played ? home.name + "의 평균 득점·실점은 " + decimal(h.gfAvg) + "·" + decimal(h.gaAvg) + "골, " + away.name + "은 " + decimal(w.gfAvg) + "·" + decimal(w.gaAvg) + "골입니다. 무실점 경기는 각각 " + h.cleanSheetCount + "/" + h.played + "경기, " + w.cleanSheetCount + "/" + w.played + "경기입니다." : "종료 스코어가 확인된 경기에서 평균 득점, 평균 실점과 무실점 빈도를 계산합니다. 기록이 없는 지표는 비워 둡니다."));
    list.append(insight("골이 나온 경기", h.played && w.played ? "양 팀 모두 득점한 경기는 홈팀 표본에서 " + h.bttsCount + "/" + h.played + "경기, 원정팀 표본에서 " + w.bttsCount + "/" + w.played + "경기였습니다. 합산 3골 이상인 경기는 각각 " + h.over25Count + "/" + h.played + "경기와 " + w.over25Count + "/" + w.played + "경기입니다." : "양 팀 득점과 합산 3골 이상 빈도는 과거 경기의 득점 양상을 보여줍니다. 현재 확보된 표본이 늘면 함께 표시됩니다."));
    node.append(list);
    $("overviewContext").textContent = a.coverage.scopeLabel + " · 홈 " + h.played + "경기 · 원정 " + w.played + "경기";
  }
  function distributionPercentages(model) {
    const raw = [model.homeWin, model.draw, model.awayWin].map(n => n * 100), values = raw.map(Math.floor);
    const order = raw.map((n, i) => ({ i, remainder: n - values[i] })).sort((a, b) => b.remainder - a.remainder);
    for (let left = 100 - values.reduce((a, b) => a + b, 0), i = 0; left > 0; left--, i++) values[order[i % 3].i]++;
    return values;
  }
  function renderModel(a) {
    const model = a.model, panel = $("modelPanel"); panel.replaceChildren();
    const heading = el("div", "model-heading");
    heading.append(el("h3", "", "득점 기록으로 본 참고 분포"), el("p", "model-caption", MatchAnalysis.leagueLabel(a.fixture.league) + " · 최근 홈·원정 기록으로 계산")); panel.append(heading);
    if (!model.available) {
      const empty = el("div", "model-empty");
      empty.append(el("strong", "", "참고 분포를 계산할 기록이 더 필요합니다."), el("p", "", model.reason));
      const counts = el("div", "model-minimums");
      [["홈팀 동일 대회", model.homeSample], ["원정팀 동일 대회", model.awaySample]].forEach(([title, count]) => { const item = el("div"); const number = el("strong", "", count); number.append(el("small", "", " 경기")); item.append(el("span", "", title), number); counts.append(item); });
      empty.append(counts, el("p", "", "장소별 표본 · 홈 " + model.homeVenueSample + "경기 / 원정 " + model.awayVenueSample + "경기")); panel.append(empty);
    } else {
      const percentages = distributionPercentages(model), chart = el("div", "model-chart"), labels = el("div", "distribution-labels");
      ["홈 승리", "무승부", "원정 승리"].forEach((title, i) => { const item = el("div"); const number = el("strong", "", percentages[i]); number.append(el("small", "", "%")); item.append(el("span", "", title), number); labels.append(item); });
      const bar = el("div", "distribution-bar"); bar.setAttribute("aria-hidden", "true");
      percentages.forEach(value => { const part = el("span"); part.style.flex = String(value); bar.append(part); });
      chart.append(labels, bar);
      const goals = el("div", "model-goals");
      [["홈 득점 기준값", model.homeLambda], ["원정 득점 기준값", model.awayLambda]].forEach(([title, value]) => { const item = el("span", "", title); item.append(el("strong", "", decimal(value))); goals.append(item); }); chart.append(goals); panel.append(chart);
      const scores = el("div", "model-scorelines"); scores.append(el("p", "model-caption", "분포에서 비중이 큰 스코어"));
      const list = el("div", "scoreline-list");
      model.scorelines.slice(0, 3).forEach(row => { const item = el("div", "scoreline-item"); item.append(el("strong", "", row.home + " : " + row.away), el("span", "", (row.probability * 100).toFixed(1) + "%")); list.append(item); }); scores.append(list); panel.append(scores);
      panel.append(el("p", "model-footnote", "홈 " + model.homeVenueSample + "경기 · 원정 " + model.awayVenueSample + "경기의 득실점으로 계산한 포아송 참고 분포입니다." + (model.retrospective ? " 경기 종료 후 과거 기록으로 재계산한 값이며, 당시 발행한 예측이 아닙니다." : " 선수 구성과 결장은 반영하지 않으며 검증된 예측 확률이 아닙니다.")));
    }
    $("modelMethod").textContent = model.method + " 해당 대회에서 양 팀의 기록이 각 5경기 이상이고 홈·원정 표본이 각각 3경기 이상일 때만 제공합니다. 현재 선택한 최근 " + a.limit + "경기 범위에서 장소별 표본을 별도로 추립니다.";
  }

  function comparisonCell(value, maximum, text, away) {
    const cell = el("td"), line = el("div", "compare-value-line"), number = el("span", "compare-number", text);
    const track = el("span", "compare-bar-track"), bar = el("span", "compare-bar");
    track.setAttribute("aria-hidden", "true"); bar.style.width = Number.isFinite(value) && maximum > 0 ? Math.max(0, Math.min(100, value / maximum * 100)) + "%" : "0%";
    track.append(bar); line.append(number, track); cell.append(line); return cell;
  }
  function renderComparison(a) {
    ["home", "away"].forEach(side => {
      const team = a[side], node = $(side === "home" ? "compareHome" : "compareAway");
      node.replaceChildren(el("span", "compare-team-name", team.name), el("span", "compare-team-count", "확인된 " + team.stats.played + "경기"), formStrip(team.records));
    });
    const rows = $("comparisonRows"); rows.replaceChildren();
    const metrics = [
      ["ppg", "경기당 승점", 3, decimal], ["gfAvg", "평균 득점", null, decimal], ["gaAvg", "평균 실점", null, decimal],
      ["winRate", "승리 비율", 1, percent], ["cleanSheetRate", "무실점 비율", 1, percent], ["bttsRate", "양 팀 득점", 1, percent], ["over25Rate", "합산 3골 이상", 1, percent]
    ];
    metrics.forEach(([key, title, max, formatter]) => {
      const hv = a.home.stats[key], av = a.away.stats[key], maximum = max || Math.max(hv || 0, av || 0, 1);
      const row = el("tr"), metric = el("td", "metric-name", title);
      row.append(comparisonCell(hv, maximum, formatter(hv)), metric, comparisonCell(av, maximum, formatter(av), true)); rows.append(row);
    });
    $("sampleNote").textContent = a.coverage.scopeLabel + " · 경기 시작 이전의 최근 " + a.limit + "경기를 기준으로 합니다. 표본은 홈팀 " + a.home.stats.played + "경기, 원정팀 " + a.away.stats.played + "경기입니다.";
    const venues = $("venueComparison"); venues.replaceChildren();
    ["home", "away"].forEach(side => {
      const team = a[side], stats = team.venue.stats, panel = el("article", "venue-panel"), title = el("h4", "venue-title", team.name);
      title.append(el("span", "", (side === "home" ? "최근 홈 " : "최근 원정 ") + stats.played + "경기")); panel.append(title);
      const metrics = el("dl", "venue-metrics");
      [["승·무·패", stats.played ? stats.w + "·" + stats.d + "·" + stats.l : "—"], ["평균 득점", decimal(stats.gfAvg)], ["평균 실점", decimal(stats.gaAvg)], ["무실점", stats.played ? stats.cleanSheetCount + "/" + stats.played : "—"]].forEach(([label, value], index) => { const box = el("div"); box.append(el("dt", "", label), el("dd", index === 0 ? "small-stat" : "", value)); metrics.append(box); });
      panel.append(metrics, formStrip(team.venue.records)); venues.append(panel);
    });
  }

  function renderRecent(a) {
    ["home", "away"].forEach(side => {
      const team = a[side], node = $(side + "Results"), title = el("div", "results-team-title"); node.replaceChildren();
      const heading = el("h3"); heading.append(team.url ? link(team.name, team.url) : document.createTextNode(team.name));
      title.append(heading, el("p", "", recordSummary(team.stats))); node.append(title);
      if (!team.records.length) { node.append(el("p", "inline-empty", "이 경기 이전에 확인된 " + a.coverage.scopeLabel + " 기록이 없습니다.")); return; }
      const table = el("table", "results-table"), caption = el("caption", "sr-only", team.name + " 최근 " + team.records.length + "경기"), head = el("thead"), hr = el("tr"), body = el("tbody");
      ["날짜", "상대 팀", "득점 : 실점", "결과"].forEach(text => { const th = el("th", "", text); th.scope = "col"; hr.append(th); }); head.append(hr);
      team.records.forEach(record => {
        const row = el("tr"), date = el("td", "result-date", shortDate(record.date)); date.title = record.dateLabel + (record.dateIsKst ? " 한국시간" : "");
        const opponent = el("td", "result-opponent"); opponent.append(el("span", "opponent-name", record.opponent), el("span", "result-comp", (record.isHome ? "홈" : "원정") + " · " + (record.competitionLabel || MatchAnalysis.leagueLabel(record.competition)) + (record.dateIsKst ? "" : " · 원문 날짜")));
        const score = el("td", "result-score"), scoreText = record.goalsFor + " : " + record.goalsAgainst;
        if (record.url) { const anchor = link(scoreText, record.url); anchor.setAttribute("aria-label", record.date + " " + record.home + " 대 " + record.away + " 경기 분석"); score.append(anchor); } else score.textContent = scoreText;
        const result = el("td", "result-badge"); result.append(el("span", "form-chip " + record.result, resultLabels[record.result]));
        row.append(date, opponent, score, result); body.append(row);
      }); table.append(caption, head, body); node.append(table, el("p", "results-footnote", "스코어는 해당 팀의 득점 : 실점 순서입니다. 날짜는 한국시간이며, 시각이 없는 보완 기록에는 원문 날짜를 표시합니다."));
    });
  }
  function renderHeadToHead(a) {
    const node = $("h2hContent"); node.replaceChildren();
    if (!a.h2h.length) {
      const empty = el("div", "h2h-empty"); empty.append(el("h3", "", "이번 경기 이전 맞대결 기록이 없습니다."), el("p", "", "현재 저장된 " + (a.coverage.season || "이번 시즌") + " " + a.coverage.scopeLabel + " 기록에서 확인된 이전 맞대결이 없습니다. 이번 경기와 이후 일정은 맞대결 분석에 포함하지 않습니다.")); node.append(empty); return;
    }
    const layout = el("div", "h2h-layout"), summary = el("div", "h2h-summary");
    [[a.home.name + " 승", a.h2hStats.w], ["무승부", a.h2hStats.d], [a.away.name + " 승", a.h2hStats.l]].forEach(([label, count]) => { const item = el("div"); item.append(el("strong", "", count), el("span", "", label)); summary.append(item); });
    const table = el("table", "h2h-table"), body = el("tbody"); table.append(el("caption", "sr-only", "이 경기 이전 맞대결 결과"));
    a.h2h.forEach(record => {
      const row = el("tr"), score = el("td"); row.append(el("td", "", shortDate(record.date)), el("td", "", record.home));
      if (record.url) score.append(link(record.score.join(" : "), record.url)); else score.textContent = record.score.join(" : ");
      row.append(score, el("td", "", record.away)); row.title = record.dateLabel + " · " + record.competitionLabel; body.append(row);
    }); table.append(body); layout.append(summary, table); node.append(layout);
  }
  function renderStandings(a) {
    const node = $("standingsContent"); node.replaceChildren();
    $("leagueLink").href = "leagues.html?league=" + encodeURIComponent(a.fixture.league);
    $("leagueLink").hidden = !a.standings;
    $("standingsNote").textContent = "아래 순위는 자료 확인 시점의 시즌 스냅샷입니다. 종료 경기의 경기 전 순위를 뜻하지 않으며, 사전 분석 수치에 사용하지 않습니다.";
    const sides = [a.home, a.away].filter(team => team.standing);
    if (!sides.length) { node.append(el("p", "inline-empty", "이 대회의 순위 스냅샷은 아직 연결되지 않았습니다. 최근 경기와 홈·원정 기록은 위에서 확인할 수 있습니다.")); return; }
    const table = el("table", "standings-table"), head = el("thead"), hr = el("tr"), body = el("tbody");
    const columns = [["순위", "rank-cell"], ["구단", "team-cell"], ["경기", ""], ["승", ""], ["무", "optional-col"], ["패", "optional-col"], ["득실차", ""], ["승점", "points-cell"]];
    columns.forEach(([title, cls]) => { const th = el("th", cls, title); th.scope = "col"; hr.append(th); }); head.append(hr);
    sides.forEach(team => {
      const standing = team.standing, data = standing.row, row = el("tr"), club = el("td", "team-cell");
      club.append(team.url ? link(team.name, team.url, "standing-team-link") : document.createTextNode(team.name), el("span", "standing-league", standing.label));
      row.append(el("td", "rank-cell", data.rank), club, el("td", "", data.played), el("td", "", data.won), el("td", "optional-col", data.drawn), el("td", "optional-col", data.lost), el("td", "", data.goalDifference > 0 ? "+" + data.goalDifference : data.goalDifference), el("td", "points-cell", data.points)); body.append(row);
    }); table.append(el("caption", "sr-only", "확인된 시즌 순위"), head, body); node.append(table);
    [a.home, a.away].filter(team => !team.standing).forEach(team => node.append(el("p", "standings-missing", team.name + "의 순위 기록은 확인되지 않았습니다.")));
    const snapshot = sides[0].standing, note = el("p", "standings-updated", "순위 자료 확인 · " + (snapshot.updatedAt || "시각 미제공") + (snapshot.provisional ? " · 잠정 순위" : "") + "  ");
    if (snapshot.sourceUrl) note.append(link("순위 출처", snapshot.sourceUrl, "", true)); node.append(note);
  }
  function renderSources(a) {
    $("dataUpdated").textContent = "자료 확인 · " + verifiedDate(a.coverage.lastUpdated);
    let intro = a.coverage.cutoffIsNow ? "아직 시작하지 않은 경기로, 현재 확보된 종료 기록을 사용합니다. " : "분석 기준 시각은 " + a.coverage.cutoffLabel + "입니다. ";
    intro += "기본 일정과 종료 결과를 먼저 연결하고, 추가 경기 기록을 팀 이름과 경기 날짜로 대조합니다. 같은 경기는 한 번만 포함하며 검증된 스코어를 우선합니다.";
    if (a.coverage.conservativeDates) intro += " 이번 표본에는 경기 시각이 없는 보완 기록 " + a.coverage.conservativeDates + "건이 포함됩니다.";
    if (state.partial.length) intro += " 일부 보완 자료를 불러오지 못해 현재 연결된 기록으로 분석했습니다. 다시 불러오면 보완할 수 있습니다.";
    $("methodIntro").textContent = intro;
    const sources = $("sourceLinks"); sources.replaceChildren();
    a.sources.forEach(source => { if (safeUrl(source.url)) sources.append(link(source.label, source.url, "", true)); });
    if (state.partial.length) { const retry = el("button", "copy-link", "자료 다시 불러오기"); retry.type = "button"; retry.addEventListener("click", load); sources.append(retry); }
  }
  function renderRelated(a) {
    const matches = state.context.matches.filter(match => match.league === a.fixture.league && MatchAnalysis.fixtureId(match) !== a.id);
    const target = Date.parse(a.fixture.date + "T" + a.fixture.time + ":00+09:00");
    matches.sort((x, y) => Math.abs(Date.parse(x.date + "T" + x.time + ":00+09:00") - target) - Math.abs(Date.parse(y.date + "T" + y.time + ":00+09:00") - target));
    const node = $("relatedMatches"); node.replaceChildren();
    matches.slice(0, 3).forEach(match => {
      const row = link("", MatchAnalysis.matchUrl(match), "related-match");
      row.append(el("span", "", shortDate(match.date) + " · " + match.time + " KST"), el("strong", "", (match.homeTeam || match.home) + " vs " + (match.awayTeam || match.away)), el("b", "", isFinished(match) ? match.score.join(" : ") + " · 종료" : matchStatus(match) === "unverified" ? "결과 확인 중" : "경기 분석")); node.append(row);
    });
  }
  function render(full) {
    const a = MatchAnalysis.analyze(state.context, state.match, { limit: state.limit, scope: state.scope });
    state.analysis = a;
    if (full) { renderHeader(a); renderRelated(a); }
    renderInsights(a); renderModel(a); renderComparison(a); renderRecent(a); renderHeadToHead(a); renderStandings(a); renderSources(a);
    document.querySelectorAll("[data-limit]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.limit) === state.limit)));
    $("analysisScope").value = state.scope;
  }

  async function json(path) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(path, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(path + " HTTP " + response.status);
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function error(title, message, retry) {
    $("loadingState").hidden = true; $("matchContent").hidden = true; $("errorState").hidden = false;
    $("errorTitle").textContent = title; $("errorMessage").textContent = message; $("retryButton").hidden = !retry; $("copyLink").disabled = true;
  }
  async function load() {
    if (state.loading) return;
    const id = params.get("id");
    if (!id) { error("분석할 경기를 선택해 주세요.", "경기 목록에서 ‘경기 분석’을 누르면 해당 경기의 기록과 비교 화면으로 이동합니다.", false); return; }
    if (!window.MatchAnalysis) { error("분석 화면을 불러오지 못했습니다.", "화면 파일을 가져오지 못했습니다. 새로고침 후 다시 확인해 주세요.", false); return; }
    state.loading = true; $("errorState").hidden = true; $("matchContent").hidden = true; $("loadingState").hidden = false; $("retryButton").disabled = true;
    try {
      const paths = ["data/match-calendar.json", "data/team-results.json", "data/team-profiles.json", "data/league-data.json", "data/uefa-standings.json"];
      const fetched = await Promise.allSettled(paths.map(json));
      if (fetched[0].status !== "fulfilled" || !Array.isArray(fetched[0].value.matches)) throw new Error("Calendar unavailable");
      const values = fetched.map(item => item.status === "fulfilled" ? item.value : {});
      state.partial = fetched.flatMap((item, index) => item.status === "rejected" ? [paths[index]] : []);
      state.context = MatchAnalysis.createContext({ calendar: values[0], results: values[1], profiles: values[2], standings: values[3], uefa: values[4] });
      state.match = state.context.findMatch(id);
      if (!state.match) { error("해당 경기를 찾지 못했습니다.", "일정이 변경되었거나 경기 주소가 올바르지 않을 수 있습니다. 경기 목록에서 다시 선택해 주세요.", false); return; }
      render(true);
      $("loadingState").hidden = true; $("matchContent").hidden = false;
      const hash = location.hash.slice(1);
      if (["overview", "comparison", "recent", "headtohead", "standings", "sources"].includes(hash)) requestAnimationFrame(() => $(hash).scrollIntoView());
    } catch (failure) { error("경기 기록을 연결하지 못했습니다.", "일정 자료를 불러오는 중 문제가 생겼습니다. 잠시 후 다시 불러오거나 경기 목록에서 확인해 주세요.", true); }
    finally { state.loading = false; $("retryButton").disabled = false; }
  }

  document.querySelectorAll("[data-limit]").forEach(button => button.addEventListener("click", () => { state.limit = Number(button.dataset.limit); if (state.match) render(false); }));
  $("analysisScope").addEventListener("change", event => { state.scope = event.target.value === "competition" ? "competition" : "all"; if (state.match) render(false); });
  $("retryButton").addEventListener("click", load);
  $("menuToggle").addEventListener("click", () => { const open = $("siteNav").classList.toggle("open"); $("menuToggle").setAttribute("aria-expanded", String(open)); $("menuToggle").setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기"); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { $("siteNav").classList.remove("open"); $("menuToggle").setAttribute("aria-expanded", "false"); $("menuToggle").setAttribute("aria-label", "메뉴 열기"); } });
  document.querySelectorAll(".analysis-nav a").forEach(anchor => anchor.addEventListener("click", () => { document.querySelectorAll(".analysis-nav a").forEach(item => item.classList.toggle("active", item === anchor)); }));
  $("copyLink").addEventListener("click", async () => {
    const url = new URL(location.href); ["backDate", "backLeague", "backView", "backStatus"].forEach(key => url.searchParams.delete(key));
    try { await navigator.clipboard.writeText(url.href); $("copyStatus").textContent = "경기 분석 링크를 복사했습니다."; $("copyLink").textContent = "복사 완료"; }
    catch (failure) { const input = el("input"); input.type = "text"; input.readOnly = true; input.value = url.href; input.setAttribute("aria-label", "복사할 경기 분석 링크"); input.style.width = "min(100%, 560px)"; $("copyStatus").replaceChildren(document.createTextNode("링크를 선택해 복사해 주세요. "), input); input.focus(); input.select(); }
  });
  load();
})();
