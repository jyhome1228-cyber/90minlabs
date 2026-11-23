(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { context: null, match: null, analysis: null, editorial: null, limit: 5, scope: "all", partial: [], loading: false };
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
    const holder=el("span","club-badge",initials(team.name));
    holder.setAttribute("aria-hidden","true");
    const profile=team.profile||{};
    if(window.ClubLogos)ClubLogos.badge(holder,{name:team.name,
      searchName:profile.searchName||team.name,wikiTitle:profile.wikiEn||null,
      badgeUrl:profile.badgeUrl||team.badgeUrl,crestId:team.crestId||profile.crestId});
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
      const badge = crest(team);
      badge.setAttribute("aria-hidden", "true");
      club.append(badge, el("span", "club-name", window.NinetyMinI18n?.language === "en" ? team.name : (team.profile?.wikiKo || team.name)));
      node.append(club);
      node.append(el("span", "club-role", side === "home" ? "홈" : "원정"));
    });
    const score = $("scoreHeader"); score.replaceChildren();
    if (status === "finished") {
      const value = el("div", "score-value");
      value.append(el("span", "", match.score[0]), el("span", "score-separator", ":"), el("span", "", match.score[1]));
      value.setAttribute("aria-label", a.home.name + " " + match.score[0] + " 대 " + match.score[1] + " " + a.away.name);
      score.append(value, el("p", "score-subtitle", "FULL TIME"));
    } else { const countdown=el("p","score-subtitle",statusText); if(window.NinetyMinCountdown)window.NinetyMinCountdown.set(countdown,match,status); score.append(el("div","score-value kickoff",status==="postponed"||status==="cancelled"?"—":match.time||"미정"),countdown); }
    if (safeUrl(match.scoreSourceUrl)) score.append(link("스코어 출처", match.scoreSourceUrl, "score-link", true));
    const homeProfile = a.home.profile;
    $("fixtureVenue").textContent = homeProfile && homeProfile.stadium ? "홈 구단 경기장 · " + homeProfile.stadium + (homeProfile.cityKo ? " · " + homeProfile.cityKo : "") : "모든 일정은 한국시간 기준";
    $("fixtureBaseline").textContent = "";
    const outcome = $("fixtureOutcome"); outcome.hidden = status !== "finished";
    if (status === "finished") {
      const hs = match.score[0], as = match.score[1];
      const text = hs === as ? "두 팀은 " + hs + "–" + as + " 무승부로 경기를 마쳤습니다." : (hs > as ? a.home.name : a.away.name) + " · " + Math.max(hs, as) + "–" + Math.min(hs, as) + " 승리";
      outcome.replaceChildren(el("strong", "", "경기 결과  "), document.createTextNode(text));
    }
    $("recordPrediction").hidden = status !== "scheduled" || match.status !== "scheduled";
    $("recordPrediction").href = "mypage.html?match=" + encodeURIComponent(a.id);
    $("copyLink").disabled = false;
  }

  function recordSummary(stats) { return stats.played ? stats.w + "승 " + stats.d + "무 " + stats.l + "패" : "기록 없음"; }
  function englishReport(a,report){
    const h=a.home,w=a.away,hs=h.stats,ws=w.stats,hv=h.venue.stats,av=w.venue.stats;
    const line=(s)=>Number.isFinite(s)?s.toFixed(2):"—";
    const n=(team)=>team.name;
    const summaries=team=>team.stats.played?team.stats.w+" wins, "+team.stats.d+" draws and "+team.stats.l+" losses":"no confirmed earlier results";
    const sentences=[
      "Looking at the last "+a.limit+" matches in the selected scope, "+n(h)+" recorded "+summaries(h)+", while "+n(w)+" recorded "+summaries(w)+".",
      "Their points per match were "+line(hs.ppg)+" and "+line(ws.ppg)+" respectively, a comparison of results rather than a guarantee of the next outcome.",
      n(h)+" averaged "+line(hs.gfAvg)+" goals scored and "+line(hs.gaAvg)+" conceded; "+n(w)+" averaged "+line(ws.gfAvg)+" scored and "+line(ws.gaAvg)+" conceded.",
      "The home team's most recent home sample contains "+hv.played+" matches ("+hv.w+"W "+hv.d+"D "+hv.l+"L), compared with "+av.played+" away matches ("+av.w+"W "+av.d+"D "+av.l+"L) for the visitors.",
      "Clean sheets occurred in "+hs.cleanSheetCount+" of "+hs.played+" matches for the hosts and "+ws.cleanSheetCount+" of "+ws.played+" for the visitors.",
      "If their recent scoring and conceding patterns continue, chances for both teams to score need to be considered alongside the possibility of a close, low-margin result."
    ];
    if(!hs.played||!ws.played)sentences.splice(1,5,"Some of the recent-match data is unavailable; the comparison does not treat missing results as zero goals or zero points.");
    const labels={home:"Slight home advantage",away:"Slight away advantage",draw:"Draw leaning",even:"Closely matched",unknown:"Insufficient evidence"};
    const direction=report?.forecast?.direction;
    sentences.push(direction==="home"?"Based on the available record, the home team has a modest edge, but this remains a conditional assessment.":direction==="away"?"Based on the available record, the away team has a modest edge, but this remains a conditional assessment.":direction==="draw"?"A draw deserves consideration given the similar recorded patterns.":"Taken together, the available statistics suggest a competitive matchup rather than a decisive favorite.");
    if(isFinished(a.fixture))sentences.push("This is a retrospective review using records from before kickoff; the final score was excluded from the comparison.");
    return {
      title:isFinished(a.fixture)?"Pre-match form review":"Match prediction report",
      forecast:{label:labels[direction]||"Balanced matchup"},
      sampleLabel:"Last "+a.limit+" matches · "+(a.scope==="competition"?"Competition only":"All competitions")+" · Home "+hs.played+" / Away "+ws.played,
      paragraphs:[sentences.slice(0,4).join(" "),sentences.slice(4).join(" ")]
    };
  }
  function modelPercentages(model) {
    const values=[model.homeWin,model.draw,model.awayWin];
    if(values.some(value=>!Number.isFinite(value)||value<0||value>1))return null;
    const total=values.reduce((sum,value)=>sum+value,0);
    if(Math.abs(total-1)>.01)return null;
    const raw=values.map(value=>value/total*100);
    const output=raw.map(value=>Math.floor(value));
    let remaining=100-output.reduce((sum,value)=>sum+value,0);
    const order=[0,1,2].sort((a,b)=>(raw[b]-output[b])-(raw[a]-output[a])||a-b);
    for(let i=0;i<remaining;i++)output[order[i%3]]++;
    return output;
  }
  function renderOutcome(a) {
    const english=window.NinetyMinI18n?.language==="en";
    const model=a.model||{},finished=isFinished(a.fixture);
    const title=$("outcomeProbTitle"),body=$("outcomeBars"),note=$("probabilityNote");
    title.textContent=finished?(english?"Pre-match record distribution":"경기 전 기록 기준 참고 비율"):(english?"Win / Draw / Loss estimates":"승·무·패 예상 비율");
    body.replaceChildren();
    const percentages=model.available?modelPercentages(model):null;
    if(!percentages){
      body.append(el("p","outcome-unavailable",english?"Not enough same-competition home and away records to calculate these figures.":"같은 대회의 홈·원정 기록이 부족해 예상 비율을 계산하지 않았습니다."));
      note.textContent=english?"No scores or win rates are generated without a sufficient record sample.":"홈·원정 각각 3경기 이상과 양 팀 동일 대회 5경기 이상의 기록이 필요합니다.";
      return;
    }
    const name=team=>english?team.name:(window.NinetyMinI18n?.team?.(team.name)||team.name);
    const outcomes=[
      {name:english?"Home win":"홈 승",team:name(a.home),value:percentages[0],kind:"home"},
      {name:english?"Draw":"무승부",team:"",value:percentages[1],kind:"draw"},
      {name:english?"Away win":"원정 승",team:name(a.away),value:percentages[2],kind:"away"}
    ];
    for(const item of outcomes){
      const column=el("div","outcome-prob-item outcome-"+item.kind);
      const top=el("div","outcome-prob-top");
      const labels=el("div","outcome-prob-labels");
      labels.append(el("span","",item.name));
      if(item.team)labels.append(el("small","",item.team));
      top.append(labels,el("strong","",item.value+"%"));
      const track=el("div","outcome-prob-track"),fill=el("div","outcome-prob-fill");
      track.setAttribute("aria-label",item.name+" "+item.value+"%");
      fill.style.width=item.value+"%";
      track.append(fill);column.append(top,track);body.append(column);
    }
    note.textContent=finished
      ?(english?"Computed retrospectively from records before kickoff, excluding this result. Not a prediction issued before the game.":"해당 경기 결과를 제외한 이전 기록으로 사후 계산한 참고 분포입니다. 당시 발표된 예측은 아닙니다.")
      :(english?"Reference distribution from recorded goals, not a calibrated prediction or verified accuracy rate.":"기록된 득실점으로 계산한 참고 분포입니다. 검증된 예측 정확도나 실제 승리 확률은 아닙니다.");
  }
  function renderReport(a) {
    const report = window.NinetyMinI18n?.language==="en"?englishReport(a,state.editorial):state.editorial, body = $("reportBody");
    body.replaceChildren();
    $("reportTitle").textContent = report ? report.title : "경기 리포트";
    $("overviewContext").textContent = report ? report.sampleLabel : a.coverage.scopeLabel + " · 홈 " + a.home.stats.played + "경기 · 원정 " + a.away.stats.played + "경기";
    const finished=isFinished(a.fixture),english=window.NinetyMinI18n?.language==="en";
    $("forecastLabel").textContent = finished?(english?"Review conclusion":"경기 전 기록으로 본 의견"):(english?"Final assessment":"최종 의견");
    $("reportForecast").textContent = report ? report.forecast.label : "판단 유보";
    const reason=state.editorial?.forecast?.reason;
    $("forecastReason").textContent = english
      ?(state.editorial?.forecast?.direction==="home"?"Available past records lean toward the home side.":state.editorial?.forecast?.direction==="away"?"Available past records lean toward the away side.":state.editorial?.forecast?.direction==="draw"?"Prior records suggest a draw deserves consideration.":"The prior record does not support a confident favorite.")
      :(reason||"현재 확인된 기록만으로 한쪽의 우세를 단정하기 어렵습니다.");
    renderOutcome(a);
    if (report) report.paragraphs.forEach(paragraph => body.append(el("p", "", paragraph)));
    else body.append(el("p", "", "경기 리포트를 불러오지 못했습니다. 아래에서 최근 경기와 양 팀의 성적을 확인할 수 있습니다."));
  }

  function comparisonCell(value, maximum, text, comparison) {
    const cell = el("td"), line = el("div", "compare-value-line"), number = el("span", "compare-number", text);
    const track = el("span", "compare-bar-track"), bar = el("span", "compare-bar");
    track.setAttribute("aria-hidden", "true");
    bar.style.width = Number.isFinite(value) && maximum > 0 ? Math.max(0, Math.min(100, value / maximum * 100)) + "%" : "0%";
    if (comparison === "stronger" || comparison === "weaker") {
      cell.classList.add("is-" + comparison);
      if (comparison === "stronger") cell.append(el("span", "sr-only", "상대보다 우세"));
    }
    track.append(bar); line.append(number, track); cell.append(line); return cell;
  }
  function renderComparison(a) {
    ["home", "away"].forEach(side => {
      const team = a[side], node = $(side === "home" ? "compareHome" : "compareAway");
      node.replaceChildren(el("span", "compare-team-name", team.name), el("span", "compare-team-count", "확인된 " + team.stats.played + "경기"), formStrip(team.records));
    });
    const rows = $("comparisonRows"); rows.replaceChildren();
    // Colour only comparative performance. BTTS/over-2.5 are descriptive statistics.
    const metrics = [
      ["ppg", "경기당 승점", 3, decimal, "higher"],
      ["gfAvg", "평균 득점", null, decimal, "higher"],
      ["gaAvg", "평균 실점", null, decimal, "lower"],
      ["winRate", "승리 비율", 1, percent, "higher"],
      ["cleanSheetRate", "무실점 비율", 1, percent, "higher"],
      ["bttsRate", "양 팀 득점", 1, percent, null],
      ["over25Rate", "합산 3골 이상", 1, percent, null]
    ];
    metrics.forEach(([key, title, max, formatter, direction]) => {
      const hv = a.home.stats[key], av = a.away.stats[key];
      const maximum = max || Math.max(hv || 0, av || 0, 1);
      const comparable = a.home.stats.played > 0 && a.away.stats.played > 0 &&
        Number.isFinite(hv) && Number.isFinite(av) && Math.abs(hv - av) > .005 && Boolean(direction);
      const homeBetter = direction === "higher" ? hv > av : hv < av;
      const homeStyle = comparable ? (homeBetter ? "stronger" : "weaker") : "neutral";
      const awayStyle = comparable ? (homeBetter ? "weaker" : "stronger") : "neutral";
      const row = el("tr"), metric = el("td", "metric-name", title);
      row.append(comparisonCell(hv, maximum, formatter(hv), homeStyle), metric,
        comparisonCell(av, maximum, formatter(av), awayStyle));
      rows.append(row);
    });
    $("sampleNote").textContent = a.coverage.scopeLabel + " · 홈 " + a.home.stats.played + "경기 · 원정 " + a.away.stats.played + "경기";
    const venues = $("venueComparison"); venues.replaceChildren();
    ["home", "away"].forEach(side => {
      const team = a[side], stats = team.venue.stats, panel = el("article", "venue-panel"), title = el("h4", "venue-title", team.name);
      title.append(el("span", "", (side === "home" ? "최근 홈 " : "최근 원정 ") + stats.played + "경기")); panel.append(title);
      const metrics = el("dl", "venue-metrics");
      [["승·무·패", null], ["평균 득점", decimal(stats.gfAvg)], ["평균 실점", decimal(stats.gaAvg)], ["무실점", stats.played ? stats.cleanSheetCount + "/" + stats.played : "—"]].forEach(([label, value], index) => {
        const box = el("div"), definition = el("dd", index === 0 ? "small-stat" : "");
        if (index === 0 && stats.played) {
          const breakdown = el("span", "venue-form-breakdown");
          [["승", stats.w, "win"], ["무", stats.d, "draw"], ["패", stats.l, "loss"]].forEach(([caption, count, mood]) => {
            breakdown.append(el("span", "venue-form-" + mood, count + caption));
          });
          definition.append(breakdown);
        } else definition.textContent = value === null ? "—" : value;
        box.append(el("dt", "", label), definition); metrics.append(box);
      });
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
      }); table.append(caption, head, body); node.append(table, el("p", "results-footnote", "해당 팀 기준 득점 : 실점 · 한국시간 (원문 날짜 별도 표시)"));
    });
  }
  function renderHeadToHead(a) {
    const node = $("h2hContent"); node.replaceChildren();
    if (!a.h2h.length) {
      const empty = el("div", "h2h-empty"); empty.append(el("h3", "", "이번 경기 이전 맞대결 기록이 없습니다."), el("p", "", "현재 저장된 " + (a.coverage.season || "이번 시즌") + " " + a.coverage.scopeLabel + " 기록에서 확인된 이전 맞대결이 없습니다.")); node.append(empty); return;
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
    $("standingsNote").textContent = "현재 시즌 순위 · 종료 경기의 경기 전 순위와 다를 수 있습니다.";
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
    state.editorial = null;
    if (window.MatchEditorial) {
      try { state.editorial = window.MatchEditorial.build(a, { profiles: state.context.profiles }); } catch (failure) { state.editorial = null; }
    }
    if (full) { renderHeader(a); renderRelated(a); }
    renderReport(a); renderComparison(a); renderRecent(a); renderHeadToHead(a); renderStandings(a);
    document.querySelectorAll("[data-limit]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.limit) === state.limit)));
    $("analysisScope").value = state.scope;
  }

  async function json(path) {
    if(window.NinetyMinData)return window.NinetyMinData.get(path,{timeoutMs:12000});
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(path, { cache:"no-cache", signal: controller.signal });
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
    state.loading = true; $("errorState").hidden = true; $("matchContent").hidden = true; $("loadingState").hidden = false; $("retryButton").disabled = true; document.body.classList.add("is-match-loading");
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
      const requestedHash = location.hash.slice(1);
      const hash = /^report/.test(requestedHash) ? "overview" : requestedHash;
      if (["overview", "comparison", "recent", "headtohead", "standings"].includes(hash)) {
        const target = $(hash);
        if (target) requestAnimationFrame(() => target.scrollIntoView());
      }
    } catch (failure) { error("경기 기록을 연결하지 못했습니다.", "일정 자료를 불러오는 중 문제가 생겼습니다. 잠시 후 다시 불러오거나 경기 목록에서 확인해 주세요.", true); }
    finally { state.loading = false; $("retryButton").disabled = false; document.body.classList.remove("is-match-loading"); }
  }

  document.querySelectorAll("[data-limit]").forEach(button => button.addEventListener("click", () => { state.limit = Number(button.dataset.limit); if (state.match) render(false); }));
  $("analysisScope").addEventListener("change", event => { state.scope = event.target.value === "competition" ? "competition" : "all"; if (state.match) render(false); });
  $("retryButton").addEventListener("click", load);
  window.addEventListener("ninetymin:languagechange",()=>{if(state.match)render(false);});
  document.querySelectorAll(".analysis-nav a").forEach(anchor => anchor.addEventListener("click", () => { document.querySelectorAll(".analysis-nav a").forEach(item => item.classList.toggle("active", item === anchor)); }));
  $("copyLink").addEventListener("click", async () => {
    const url = new URL(location.href); ["backDate", "backLeague", "backView", "backStatus"].forEach(key => url.searchParams.delete(key));
    try { await navigator.clipboard.writeText(url.href); $("copyStatus").textContent = "경기 분석 링크를 복사했습니다."; $("copyLink").textContent = "복사 완료"; }
    catch (failure) { const input = el("input"); input.type = "text"; input.readOnly = true; input.value = url.href; input.setAttribute("aria-label", "복사할 경기 분석 링크"); input.style.width = "min(100%, 560px)"; $("copyStatus").replaceChildren(document.createTextNode("링크를 선택해 복사해 주세요. "), input); input.focus(); input.select(); }
  });
  load();
})();
