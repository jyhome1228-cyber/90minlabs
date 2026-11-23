# 90MIN LABS

축구 경기 전 전망과 팀 정보를 제공하는 비상업적 독립 축구 연구 사이트입니다. 광고, 베팅 접수, 사설 베팅 사이트 연결은 지원하지 않습니다.

## 화면 구성

- `index.html`: 메인 페이지, 경기 전망, 경기 일정, 칼럼 초안 작성
- `leagues.html`: 프리미어리그, 세리에 A, 분데스리가, 리그앙 순위표와 득점왕
- `team.html?league=epl&team=Arsenal`: 구단 개별 페이지. 구단명과 리그 키를 URL에서 받아 렌더링합니다.

## 구단 페이지 데이터

- `data/team-profiles.json`: 76개 구단의 팀명, 구단 역사 링크, 소재지, 경기장, 감독 및 출처
- `data/team-results.json`: 76개 구단의 2026/27 시즌 최근 리그 10경기 보관 자료
- `data/league-data.json`: 리그별 순위와 득점왕 자료. 리그별 마지막 확인 시각과 출처 포함

구단 상세 화면은 축구팀 소개, 연고지, 경기장 지도, 감독과 확인 가능한 일부 선수단, 최근 리그 10경기, 승무패 추세, 소속 대회 및 관련 뉴스 링크를 표시합니다.

구단 역사에는 작성한 소개 또는 한국어 위키백과 요약을 사용합니다. 모든 구단의 역사 서술이 편집 검수까지 완료된 것은 아닙니다.

### 외부 데이터 소스

- 경기 기록: [open-matchday](https://github.com/oladeeayo/open-matchday), 정보 제공 및 비상업적 이용 목적, 출처 명시 필수. 원천 제공자의 이용 조건도 적용됩니다.
- 일부 팀 기본정보, 구단 로고와 선수 명단: [TheSportsDB](https://www.thesportsdb.com), 무료 공개 데이터가 누락되거나 제한될 수 있습니다.
- 구단 로고 보완: [football-data.org](https://www.football-data.org). 로고 권리자는 각 구단이며 해당 서비스 사용 허가로 해석할 수 없습니다.
- 감독 자료: 프리미어리그 [공식 감독 명단](https://www.premierleague.com/en/news/4325264/list-of-202627-premier-league-club-managers), 그 외 [세리에 A](https://en.wikipedia.org/wiki/2026%E2%80%9327_Serie_A), [분데스리가](https://en.wikipedia.org/wiki/2026%E2%80%9327_Bundesliga), [리그앙](https://en.wikipedia.org/wiki/2026%E2%80%9327_Ligue_1)의 2026/27 시즌 명단. 감독은 2026-11-23 기준으로 기록되어 있으며 이후 인사 변경이 생길 수 있습니다.

경기 중단, 취소, 미확인 스코어는 결과로 판단하지 않습니다. `team-results.json`은 검증된 리그 경기 결과에 한정하며 컵대회, 유럽대항전, 친선경기는 포함하지 않습니다. 페이지는 동적 CSV를 불러올 수 있을 때만 최근 자료로 갱신하고, 실패하면 저장된 스냅샷을 유지합니다. 클럽 직원 및 선수단 명단의 정확성과 완전성을 보장하지 않습니다.

## 자료 업데이트

1. **순위/득점왕:** `data/league-data.json`을 수정합니다. 구단명은 `team-profiles.json`의 `name`과 동일하게 유지하고, `updatedAt`과 `sourceUrl`을 함께 갱신합니다.
2. **감독/경기장:** `data/team-profiles.json`의 `manager`, `managerVerifiedAt`, `managerSourceUrl`, `stadium`을 검토해 갱신합니다.
3. **최근 리그 경기:** `open-matchday` 자료가 갱신되면 팀 페이지에서 최신 CSV를 불러오도록 되어 있으나, 서비스 중단과 CDN 캐시에 대비해 `data/team-results.json`의 백업도 주기적으로 갱신합니다.
4. **팀 추가:** `team-profiles.json`과 `team-results.json`에 동일한 `league:teamName` 키를 추가하고, `league-data.json`에 동일 팀 이름으로 등록합니다.
5. **최근 소식:** 현재는 구단 공식 사이트와 뉴스 검색 링크를 제공합니다. 기사 목록 자동 게시·검수 기능은 추후 개발 대상입니다.

## 배포

GitHub Pages > Deploy from a branch > `main` > `/(root)` 설정을 사용합니다.

- 메인: https://jyhome1228-cyber.github.io/90minlabs/
- 리그: https://jyhome1228-cyber.github.io/90minlabs/leagues.html
- 예시 구단: https://jyhome1228-cyber.github.io/90minlabs/team.html?team=Arsenal&league=epl

## 주의

- 공개 데이터 소스의 정보와 현재 구단 명단이 다를 수 있습니다. 출처와 확인 시각을 반드시 표기합니다.
- 비상업적 사용도 로고의 상표권·저작권 이용허락을 자동으로 부여하지 않습니다.
- 해당 사이트는 어떤 리그, 구단, UEFA와도 공식 제휴 관계가 없습니다.

## MATCHES 페이지

`index.html#matches`는 현재 2026/27 시즌 경기 일정 및 종료 결과 페이지로 연결됩니다.

- 6개 대회 선택: 프리미어리그, 잉글랜드 챔피언십(2부), 세리에 A, 분데스리가, 리그앙, UEFA 챔피언스리그
- 한국시간 기준 현재 날짜와 오늘의 경기 기본 표시
- 날짜 선택기, 이전 날·다음 날, 오늘 경기 버튼, 하루·주간 모드 전환
- 전체, 예정, 종료, 결과 미확인 상태 필터
- 구단 로고와 구단 프로필 링크
- 펼쳐보기: 두 팀의 직전 리그 5경기 승무패와 자료 출처
- 종료된 경기는 최종 스코어 표시, 확인되지 않은 경기는 점수 미표시

파일:
- `assets/matches.css`: 반응형 경기 목록 스타일. 흑백 UI에 구단 엠블럼만 원색.
- `assets/matches.js`: 경기 목록과 대회·상태·날짜 전환.
- `data/match-calendar.json`: 2026-11-23 기준 2026/27 시즌 공개 경기 일정·결과 스냅샷(잉글랜드 챔피언십 포함).

일정 및 종료 스코어는 비상업적 이용 조건의 [open-matchday](https://github.com/oladeeayo/open-matchday)를 근거로 작성했습니다. 소스는 주기적으로 바뀌지만 `data/match-calendar.json`은 현재 자동 갱신되지 않습니다. 최신 데이터 갱신과 공식 일정 대조를 운영 과제로 남깁니다. 경기 중 실시간 스코어나 확정되지 않은 경기 결과는 제공하지 않습니다.

추후 경기 예측 리포트를 발행할 때는 경기의 고유 ID와 예측 보고서를 연결하여, 해당 경기에서만 "경기 전망 보기" 링크를 활성화하는 것을 권장합니다.

추가로 잉글랜드에서는 2부 **EFL Championship**까지 경기 일정을 제공하며, League One 이하의 하위 리그는 제공하지 않습니다. 리그 순위와 구단 상세페이지는 현재 기존 4대 리그 기준이며, 챔피언십 팀 상세 정보는 별도 확장 대상입니다.

## 현재 날짜 및 경기 자료 확인

MATCHES는 방문 시 한국시간(Asia/Seoul)의 **오늘 날짜**를 기본 선택하고, 헤더 영역에 날짜와 현재 시각을 표시합니다. 페이지가 열린 동안 시각을 30초마다 다시 확인하며 날짜가 바뀌면 오늘 경기 선택도 업데이트합니다. 달력에서는 하루/주간 보기와 날짜 직접 선택이 가능합니다.

2026년 11월 23일 오전 11시 56분(한국시간)에 open-matchday의 6개 대회 CSV와 저장된 스냅샷의 경기 수 및 종료 스코어를 대조했습니다. 확인된 종료 기록 676경기(챔피언십 포함)의 스코어 불일치는 없었습니다. 이 확인 시각은 `data/match-calendar.json`의 `verifiedAtKst`에 저장되며, 화면의 현재 시각과 별도로 표시합니다.

**중요:** 이 검증은 실시간 데이터 수집이 아니라 그 시각의 공개 소스 대조입니다. 소스가 결과를 아직 제공하지 않은 경기는 '결과 확인 필요'로 표시하고, 진행 중 스코어를 추정해 보여주지 않습니다. 자료는 자동으로 다시 수집되지 않으므로 이후 최신 결과 갱신은 추가로 설정해야 합니다.
