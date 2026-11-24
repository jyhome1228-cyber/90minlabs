/* Shared, dependency-free match analysis. All aggregates use records before kickoff. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MatchAnalysis = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DAY = 86400000;
  const KST = 9 * 3600000;
  const LABELS = {
    epl: "프리미어리그", championship: "챔피언십", laliga: "라리가",
    seriea: "세리에 A", bundesliga: "분데스리가", ligue1: "리그 1",
    ucl: "챔피언스리그", uel: "유로파리그", uecl: "컨퍼런스리그"
  };

  function normalize(value) {
    return String(value || "").toLowerCase()
      .replace(/ø/g, "o").replace(/ł/g, "l").replace(/đ/g, "d")
      .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ı/g, "i")
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9가-힣]/g, "");
  }

  function fixtureId(match) {
    return [match.league, match.date, match.time || "", match.home, match.away]
      .map(value => encodeURIComponent(String(value || "")).replace(/~/g, "%7E")).join("~");
  }

  function matchUrl(match) {
    return "match.html?id=" + encodeURIComponent(fixtureId(match));
  }

  function validDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return false;
    const value = Date.parse(date + "T00:00:00Z");
    return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date;
  }

  function kickoff(match) {
    if (!validDate(match.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(match.time || "")) return null;
    return Date.parse(match.date + "T" + match.time + ":00+09:00");
  }

  function validScore(score) {
    return Array.isArray(score) && score.length === 2 && score.every(value => Number.isInteger(value) && value >= 0);
  }

  function safeUrl(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
  }

  function label(competition) {
    return LABELS[competition] || (String(competition).startsWith("domestic:") ? "국내 리그" : competition || "대회");
  }

  function stats(records) {
    const usable = (records || []).filter(row => Number.isInteger(row.goalsFor) && row.goalsFor >= 0 && Number.isInteger(row.goalsAgainst) && row.goalsAgainst >= 0);
    const value = { played: usable.length, w: 0, d: 0, l: 0, points: 0, gf: 0, ga: 0, cleanSheetCount: 0, bttsCount: 0, over25Count: 0, scoredCount: 0 };
    usable.forEach(row => {
      const gf = row.goalsFor, ga = row.goalsAgainst;
      value.gf += gf; value.ga += ga;
      if (gf > ga) value.w++;
      else if (gf === ga) value.d++;
      else value.l++;
      if (ga === 0) value.cleanSheetCount++;
      if (gf > 0) value.scoredCount++;
      if (gf > 0 && ga > 0) value.bttsCount++;
      if (gf + ga >= 3) value.over25Count++;
    });
    value.points = value.w * 3 + value.d;
    value.ppg = value.played ? value.points / value.played : null;
    value.gfAvg = value.played ? value.gf / value.played : null;
    value.gaAvg = value.played ? value.ga / value.played : null;
    value.goalDifference = value.gf - value.ga;
    value.winRate = value.played ? value.w / value.played : null;
    value.cleanSheetRate = value.played ? value.cleanSheetCount / value.played : null;
    value.bttsRate = value.played ? value.bttsCount / value.played : null;
    value.over25Rate = value.played ? value.over25Count / value.played : null;
    value.scoredRate = value.played ? value.scoredCount / value.played : null;
    value.btts = value.bttsCount;
    value.over25 = value.over25Count;
    value.scored = value.scoredCount;
    return value;
  }

  function createContext(input) {
    input = input || {};
    const calendar = input.calendar || {};
    const results = input.results || {};
    const profiles = input.profiles || {};
    const clubs = profiles.clubs || {};
    const matches = Array.isArray(calendar.matches) ? calendar.matches : [];
    const descriptors = new Map(), aliases = new Map(), scopedAliases = new Map();
    const fixtureMap = new Map(), calendarRows = [], pairRows = new Map(), allEvents = new Map();

    function descriptor(key, name, league, profile) {
      if (!descriptors.has(key)) descriptors.set(key, {
        name, key, profileLeague: league, profile: profile || null,
        crestId: profile && profile.crestId || null,
        url: profile ? "team.html?league=" + encodeURIComponent(league) + "&team=" + encodeURIComponent(name) : null
      });
      return descriptors.get(key);
    }

    function register(alias, key, scope) {
      const normal = normalize(alias);
      if (!normal) return;
      if (!aliases.has(normal)) aliases.set(normal, new Set());
      aliases.get(normal).add(key);
      if (scope) {
        const scoped = scope + ":" + normal;
        if (!scopedAliases.has(scoped)) scopedAliases.set(scoped, new Set());
        scopedAliases.get(scoped).add(key);
      }
    }

    function resolve(name, competition) {
      const normal = normalize(name);
      const scoped = scopedAliases.get(competition + ":" + normal);
      if (scoped && scoped.size === 1) return Array.from(scoped)[0];
      const global = aliases.get(normal);
      return global && global.size === 1 ? Array.from(global)[0] : null;
    }

    Object.keys(clubs).forEach(key => {
      const profile = clubs[key], league = profile.league || key.split(":")[0];
      const name = profile.name || key.slice(key.indexOf(":") + 1);
      descriptor(key, name, league, profile);
      [name, profile.searchName, profile.wikiEn, profile.wikiKo].forEach(alias => register(alias, key, league));
      (profile.uefaCompetitions || []).forEach(comp => register(name, key, comp));
    });

    Object.keys(results.teams || {}).forEach(key => {
      const team = results.teams[key];
      descriptor(key, team.team, team.league, clubs[key]);
      [team.team, team.matchName].forEach(alias => register(alias, key, team.league));
    });

    const european = Object.assign({}, profiles.uefaCompetitions || {});
    if (!european.ucl && profiles.uclParticipants) european.ucl = profiles.uclParticipants;
    Object.keys(european).forEach(comp => (european[comp].teams || []).forEach(team => {
      const key = team.league + ":" + team.team;
      descriptor(key, team.team, team.league, clubs[key]);
      [team.name, team.team, team.displayName].forEach(alias => register(alias, key, comp));
    }));

    // Explicit calendar canonical names are the authoritative cross-competition join.
    matches.forEach(match => ["home", "away"].forEach(side => {
      const name = match[side + "Team"], league = match[side + "TeamLeague"];
      if (!name || !league) return;
      const key = league + ":" + name;
      const team = descriptor(key, name, league, clubs[key]);
      if (!team.crestId && match[side + "Crest"]) team.crestId = match[side + "Crest"];
      [name, match[side]].forEach(alias => {
        register(alias, key, league);
        register(alias, key, match.league);
      });
    }));

    function teamFor(match, side) {
      const explicit = match[side + "Team"] && match[side + "TeamLeague"]
        ? match[side + "TeamLeague"] + ":" + match[side + "Team"] : null;
      const key = explicit || resolve(match[side], match.league) || match.league + ":" + match[side];
      const team = descriptor(key, match[side + "Team"] || match[side], match[side + "TeamLeague"] || match.league, clubs[key]);
      if (!team.crestId && match[side + "Crest"]) team.crestId = match[side + "Crest"];
      return team;
    }

    function sourceFor(competition) {
      const source = calendar.sourceByLeague && calendar.sourceByLeague[competition];
      return safeUrl(source && (/\.csv(?:\?|$)/.test(source) ? source : source.replace(/\/?$/, "/") + "results_2627.csv")) || safeUrl(calendar.providerUrl);
    }

    function pairKey(competition, homeKey, awayKey) {
      return JSON.stringify([competition, homeKey, awayKey]);
    }

    // Calendar-only clubs (for example Championship teams) still need exact aliases.
    matches.forEach(match => ["home", "away"].forEach(side => {
      const team = teamFor(match, side);
      register(match[side], team.key, match.league);
      register(team.name, team.key, match.league);
    }));

    matches.forEach(match => {
      const id = fixtureId(match);
      if (fixtureMap.has(id)) throw new Error("Duplicate fixture identifier: " + id);
      fixtureMap.set(id, match);
      const home = teamFor(match, "home"), away = teamFor(match, "away"), ms = kickoff(match);
      const row = {
        id, url: matchUrl(match), date: match.date, dateLabel: match.date,
        time: match.time || "", dateIsKst: true, datePrecision: ms === null ? "date" : "kickoff",
        kickoffMs: ms, upperBoundMs: ms === null && validDate(match.date) ? Date.parse(match.date + "T23:59:59.999+09:00") : ms,
        sortMs: ms === null ? Date.parse(match.date + "T12:00:00+09:00") : ms,
        home: home.name, away: away.name, homeKey: home.key, awayKey: away.key,
        score: validScore(match.score) ? match.score.slice() : null,
        competition: match.league, competitionLabel: label(match.league), round: match.round || null,
        sourceUrl: safeUrl(match.scoreSourceUrl) || sourceFor(match.league),
        verified: Boolean(match.scoreSourceUrl), origin: "calendar", status: match.status
      };
      calendarRows.push(row);
      const pair = pairKey(row.competition, row.homeKey, row.awayKey);
      if (!pairRows.has(pair)) pairRows.set(pair, []);
      pairRows.get(pair).push(row);
      if (match.status === "finished" && row.score) allEvents.set(id, row);
    });

    function resultCompetition(result, team, profile) {
      const value = result.competition;
      if (!value) return team.league;
      const lower = String(value).toLowerCase();
      if (LABELS[lower]) return lower;
      if (value === "국내 리그") {
        if (LABELS[team.league] && !["ucl", "uel", "uecl"].includes(team.league)) return team.league;
        const source = (team.sources || []).find(item => item.kind === "국내 리그");
        const code = source && source.url && source.url.match(/\/data\/([^/]+)\//);
        return "domestic:" + (code ? code[1] : profile && profile.countryKo || team.league);
      }
      return lower;
    }

    Object.keys(results.teams || {}).forEach(ownerKey => {
      const team = results.teams[ownerKey], profile = clubs[ownerKey];
      (team.matches || []).forEach(result => {
        const score = [result.homeScore, result.awayScore];
        if (!validDate(result.date) || !validScore(score)) return;
        const competition = resultCompetition(result, team, profile);
        let homeKey = resolve(result.home, competition), awayKey = resolve(result.away, competition);
        const ownNames = [team.team, team.matchName, profile && profile.name, profile && profile.searchName].filter(Boolean).map(normalize);
        if (!homeKey && ownNames.includes(normalize(result.home))) homeKey = ownerKey;
        if (!awayKey && ownNames.includes(normalize(result.away))) awayKey = ownerKey;
        // Never silently decide that an unrecognised alias is the away team.
        if ((homeKey === ownerKey) === (awayKey === ownerKey)) return;
        homeKey = homeKey || competition + ":" + normalize(result.home);
        awayKey = awayKey || competition + ":" + normalize(result.away);
        const pair = pairKey(competition, homeKey, awayKey);
        const sourceDay = Date.parse(result.date + "T00:00:00Z");
        const corresponding = (pairRows.get(pair) || []).filter(row => Math.abs(Date.parse(row.date + "T00:00:00Z") - sourceDay) <= DAY)
          .sort((a, b) => Math.abs(Date.parse(a.date + "T00:00:00Z") - sourceDay) - Math.abs(Date.parse(b.date + "T00:00:00Z") - sourceDay));
        const known = corresponding.length === 1 ? corresponding[0] : null;
        if (known && allEvents.has(known.id)) return; // Calendar is the final-score source of truth.
        const kind = competition.startsWith("domestic:") ? "국내 리그" : "유럽대항전";
        const groupSource = (team.sources || []).find(item => item.kind === kind);
        const sourceUrl = safeUrl(result.verificationUrl) || safeUrl(groupSource && groupSource.url) || safeUrl(team.sourceUrl) || safeUrl(results.sourceUrl);
        const id = known ? known.id : "history:" + [competition, result.date, homeKey, awayKey].map(encodeURIComponent).join("~");
        const existing = allEvents.get(id);
        if (existing && (existing.verified || !result.verificationUrl)) return;
        const bound = sourceDay + 2 * DAY - KST - 1;
        const row = known ? Object.assign({}, known, { score, sourceUrl, verified: Boolean(result.verificationUrl), origin: "results", status: "finished" }) : {
          id, url: null, date: result.date, dateLabel: result.date + " · 원문 날짜",
          time: "", dateIsKst: false, datePrecision: "source-date", kickoffMs: null,
          // Source dates have no timezone/time. Even the following KST day must have ended.
          upperBoundMs: bound, sortMs: sourceDay + DAY / 2,
          home: descriptors.has(homeKey) ? descriptors.get(homeKey).name : result.home,
          away: descriptors.has(awayKey) ? descriptors.get(awayKey).name : result.away,
          homeKey, awayKey, score, competition, competitionLabel: label(competition), round: result.round || null,
          sourceUrl, verified: Boolean(result.verificationUrl), origin: "results", status: "finished"
        };
        allEvents.set(id, row);
      });
    });

    // Validated per-fixture packs carry exactly the same normalized historical
    // event rows as the complete calendar. Keep all downstream analysis unchanged.
    const records = Array.isArray(input.normalizedRecords)
      ? input.normalizedRecords.slice().sort((a,b)=>b.sortMs-a.sortMs||a.id.localeCompare(b.id))
      : Array.from(allEvents.values()).sort((a, b) => b.sortMs - a.sortMs || a.id.localeCompare(b.id));

    function table(competition) {
      const domestic = input.standings && (input.standings.leagues || input.standings)[competition];
      const europe = input.uefa && (input.uefa.competitions || {})[competition];
      const snapshot = domestic && (domestic.standings || domestic) || europe;
      return snapshot && Array.isArray(snapshot.rows) ? {
        league: competition, label: label(competition), rows: snapshot.rows,
        updatedAt: snapshot.updatedAt || (europe && input.uefa.capturedAtKst) || null,
        sourceUrl: safeUrl(snapshot.sourceUrl), provisional: Boolean(snapshot.provisional), current: true
      } : null;
    }

    function standing(team, competition) {
      const snapshot = table(competition);
      if (!snapshot) return null;
      const row = snapshot.rows.find(item => resolve(item.team, competition) === team.key || normalize(item.team) === normalize(team.name));
      return row ? {
        row, league: competition, label: snapshot.label, updatedAt: snapshot.updatedAt,
        sourceUrl: snapshot.sourceUrl, provisional: snapshot.provisional, current: true
      } : null;
    }

    return {
      matches, records, calendar, results, profiles,
      findMatch: id => fixtureMap.get(id) || null,
      teamFor, standing, table,
      lastUpdated: calendar.verifiedAtKst || calendar.capturedAtKst || results.supplementalVerifiedAtKst || results.capturedAt || null
    };
  }

  function perspective(row, key) {
    const isHome = row.homeKey === key;
    const goalsFor = row.score[isHome ? 0 : 1], goalsAgainst = row.score[isHome ? 1 : 0];
    return Object.assign({}, row, {
      isHome, opponent: isHome ? row.away : row.home,
      opponentKey: isHome ? row.awayKey : row.homeKey,
      goalsFor, goalsAgainst, result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D"
    });
  }

  function poissonModel(home, away, competition, limit, retrospective) {
    const homeAll = home._prior.filter(row => row.competition === competition);
    const awayAll = away._prior.filter(row => row.competition === competition);
    const homeSample = homeAll.slice(0, limit), awaySample = awayAll.slice(0, limit);
    const homeVenue = homeAll.filter(row => row.isHome).slice(0, limit);
    const awayVenue = awayAll.filter(row => !row.isHome).slice(0, limit);
    const base = {
      available: false, reason: "동일 대회 최근 기록이 양 팀 각 5경기 이상, 홈·원정 기록이 각각 3경기 이상일 때 계산합니다.",
      homeWin: null, draw: null, awayWin: null, homeLambda: null, awayLambda: null, scorelines: [],
      homeSample: homeSample.length, awaySample: awaySample.length,
      homeVenueSample: homeVenue.length, awayVenueSample: awayVenue.length,
      competition, competitionLabel: label(competition), retrospective: Boolean(retrospective), calibrated: false,
      method: "홈 득점 기준값 = (홈팀의 최근 홈 평균 득점 + 원정팀의 최근 원정 평균 실점) ÷ 2. 원정 득점 기준값은 반대로 계산합니다. 두 득점을 독립 포아송 분포로 가정합니다.",
      note: "기록된 득실점으로 계산한 참고 분포이며 실제 xG 또는 검증된 승리 확률이 아닙니다. 상대 수준, 선수 구성과 부상은 반영하지 않습니다."
    };
    if (homeSample.length < 5 || awaySample.length < 5 || homeVenue.length < 3 || awayVenue.length < 3) return base;
    const hs = stats(homeVenue), as = stats(awayVenue);
    const homeLambda = (hs.gfAvg + as.gaAvg) / 2, awayLambda = (as.gfAvg + hs.gaAvg) / 2;
    if (!Number.isFinite(homeLambda) || !Number.isFinite(awayLambda) || Math.max(homeLambda, awayLambda) > 30) return base;
    const max = Math.max(12, Math.ceil(Math.max(homeLambda, awayLambda) + 10 * Math.sqrt(Math.max(homeLambda, awayLambda) + 1)));
    function probabilities(lambda) {
      const values = [Math.exp(-lambda)];
      for (let i = 1; i <= max; i++) values.push(values[i - 1] * lambda / i);
      return values;
    }
    const hp = probabilities(homeLambda), ap = probabilities(awayLambda), scorelines = [];
    let homeWin = 0, draw = 0, awayWin = 0, total = 0;
    hp.forEach((h, i) => ap.forEach((a, j) => {
      const probability = h * a;
      total += probability;
      if (i > j) homeWin += probability;
      else if (i < j) awayWin += probability;
      else draw += probability;
      scorelines.push({ home: i, away: j, probability });
    }));
    if (!total) return base;
    scorelines.sort((a, b) => b.probability - a.probability || (a.home + a.away) - (b.home + b.away) || a.home - b.home);
    return Object.assign(base, {
      available: true, reason: null, homeLambda, awayLambda,
      homeWin: homeWin / total, draw: draw / total, awayWin: awayWin / total,
      scorelines: scorelines.slice(0, 6).map(row => Object.assign({}, row, { probability: row.probability / total })),
      retainedProbabilityMass: total
    });
  }

  function analyze(context, match, options) {
    options = options || {};
    if (!match || !context || !context.teamFor) throw new Error("A known match and analysis context are required.");
    const id = fixtureId(match), limit = Number(options.limit) === 10 ? 10 : 5;
    const scope = options.scope === "competition" ? "competition" : "all";
    const now = Date.now(), start = kickoff(match);
    const safeStart = start === null && validDate(match.date) ? Date.parse(match.date + "T00:00:00+09:00") : start;
    const cutoffMs = Math.min(safeStart === null ? now : safeStart, now);
    const prior = context.records.filter(row => row.id !== id && row.upperBoundMs !== null && Number.isFinite(row.upperBoundMs) && row.upperBoundMs < cutoffMs);
    function side(which) {
      const team = Object.assign({}, context.teamFor(match, which));
      const allPrior = prior.filter(row => row.homeKey === team.key || row.awayKey === team.key).map(row => perspective(row, team.key));
      const allRecords = allPrior.filter(row => scope === "all" || row.competition === match.league);
      const records = allRecords.slice(0, limit);
      const venueAll = allRecords.filter(row => row.isHome === (which === "home"));
      const venueRecords = venueAll.slice(0, limit);
      return Object.assign(team, {
        allRecords, records, stats: stats(records), last5: allRecords.slice(0, 5),
        venue: { records: venueRecords, allRecords: venueAll, stats: stats(venueRecords), isHome: which === "home" },
        standing: context.standing(team, match.league),
        domesticStanding: team.profileLeague !== match.league ? context.standing(team, team.profileLeague) : null,
        _prior: allPrior
      });
    }
    const home = side("home"), away = side("away");
    const h2h = prior.filter(row => ((row.homeKey === home.key && row.awayKey === away.key) || (row.homeKey === away.key && row.awayKey === home.key)) && (scope === "all" || row.competition === match.league))
      .map(row => perspective(row, home.key)).slice(0, 10);
    const model = poissonModel(home, away, match.league, limit, match.status === "finished");
    const sourceMap = new Map();
    function source(url, text) { if (safeUrl(url) && !sourceMap.has(url)) sourceMap.set(url, { label: text, url }); }
    source(match.scoreSourceUrl, "최종 스코어 검증");
    const sourceRecords = home.allRecords.concat(away.allRecords, h2h);
    sourceRecords.forEach(row => source(row.sourceUrl, row.verified ? row.competitionLabel + " · 검증된 경기 결과" : row.competitionLabel + " · 경기 기록"));
    const sourceBase = context.calendar.sourceByLeague && context.calendar.sourceByLeague[match.league];
    source(sourceBase || context.calendar.providerUrl, label(match.league) + " · 일정 및 결과");
    [home.standing, away.standing].forEach(snapshot => { if (snapshot) source(snapshot.sourceUrl, snapshot.label + " · 현재 순위"); });
    const selected = home.records.concat(away.records, home.venue.records, away.venue.records);
    const cutoffDate = new Date(cutoffMs + KST).toISOString();
    const coverage = {
      homeCount: home.records.length, awayCount: away.records.length,
      homeAvailable: home.allRecords.length, awayAvailable: away.allRecords.length,
      homeVenueCount: home.venue.records.length, awayVenueCount: away.venue.records.length,
      lastUpdated: context.lastUpdated, cutoffMs,
      cutoffLabel: cutoffDate.slice(0, 10) + " " + cutoffDate.slice(11, 16) + " (한국시간)",
      cutoffIsNow: start !== null && start > now,
      conservativeDates: new Set(selected.filter(row => row.datePrecision === "source-date").map(row => row.id)).size,
      scopeLabel: scope === "competition" ? label(match.league) : "전체 대회",
      season: context.calendar.season || context.results.season || null,
      note: "확인된 종료 기록만 사용하며, 분석 대상 경기와 이후 경기는 제외합니다. 킥오프 시각이 없는 원문 날짜 기록은 하루 이상 여유를 두고 반영합니다."
    };
    delete home._prior; delete away._prior;
    return { fixture: match, id, home, away, limit, scope, cutoffMs, h2h, h2hStats: stats(h2h), model, sources: Array.from(sourceMap.values()), coverage, standings: context.table(match.league) };
  }

  return { createContext, fixtureId, matchUrl, normalize, stats, analyze, leagueLabel: label };
});
