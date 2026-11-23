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
