#!/usr/bin/env bash
# Create one actionable GitHub issue on sync failure and close it after recovery.
set -euo pipefail
mode="${1:-failed}"
title="[운영 알림] 90MIN LABS 결과 자동 갱신 점검"
url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
stamp="$(date -u +'%Y-%m-%d %H:%M UTC')"
existing="$(gh issue list --state open --limit 100 --json number,title \
  --jq '.[] | select(.title == "[운영 알림] 90MIN LABS 결과 자동 갱신 점검") | .number' | head -1)"
if [[ "${mode}" == "failed" ]]; then
  body="GitHub 자동 점검 또는 데이터 게시가 실패했습니다.

- 시각: ${stamp}
- 실행 기록: ${url}
- 조치: 실행 로그를 열어 원천 데이터, 저장 충돌, 마지막 점검 시각을 확인하세요.
- 정책: 결과가 확인되지 않은 경기를 임의로 종료 처리하지 마세요."
  if [[ -n "${existing}" ]]; then
    gh issue comment "${existing}" --body "${body}"
  else
    gh issue create --title "${title}" --body "${body}"
  fi
elif [[ "${mode}" == "healthy" ]]; then
  if [[ -n "${existing}" ]]; then
    gh issue close "${existing}" --comment "자동 점검이 정상 완료되었습니다. ${stamp} · ${url}"
  fi
else
  echo "Unsupported incident mode: ${mode}" >&2
  exit 2
fi
