#!/usr/bin/env bash
# Provision D1 + the API tester each labs world (not huge/vast — D1 latency makes those a day).
set -euo pipefail
cd "$(dirname "$0")/.."
bash labs/api/iterate.sh tiny shop campus platform
echo "done — .testing/api/runs/labs/{tiny,shop,campus,platform}"
