#!/usr/bin/env bash
# בדיקת סודות בקוד. רצה ב-CI על כל PR, ואפשר גם מקומית:
#   .github/scripts/check-secrets.sh
#
# מה נבדק:
#   1. מפתחות Google (AIza...) שאינם ברשימת המזהים הציבוריים המותרים
#   2. מפתחות Anthropic, טוקני OAuth של Google, מפתחות AWS
#   3. מפתחות פרטיים בפורמט PEM
set -uo pipefail
cd "$(dirname "$0")/../.."

ALLOW=.github/allowed-public-keys.txt
EXCLUDE=(":(exclude)$ALLOW" ":(exclude).github/scripts/check-secrets.sh")
fail=0

note() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; fail=1; }

# --- 1. מפתחות Google ---
mapfile -t keys < <(git grep -ohE 'AIza[0-9A-Za-z_-]{35}' -- . "${EXCLUDE[@]}" | sort -u)
for k in "${keys[@]:-}"; do
  [ -z "$k" ] && continue
  if ! grep -qxF "$k" "$ALLOW"; then
    note "מפתח Google שאינו ברשימת המותרים: ${k:0:10}…"
    git grep -nE -e "$k" -- . "${EXCLUDE[@]}" | sed 's/^/    /'
    echo "    אם זה מזהה ציבורי מכוון — להוסיף ל-$ALLOW עם הסבר."
    echo "    אם זה מפתח אמיתי — לבטל אותו בקונסולה ולהנפיק חדש. מחיקת השורה אינה מספיקה."
  fi
done

# --- 2. סודות אחרים ---
scan() { # תיאור, ביטוי
  local hits
  hits=$(git grep -nE -e "$2" -- . "${EXCLUDE[@]}" || true)
  if [ -n "$hits" ]; then
    note "$1"
    echo "$hits" | sed 's/^/    /'
  fi
}
scan "מפתח Anthropic בקוד"            'sk-ant-[A-Za-z0-9_-]{20,}'
scan "טוקן OAuth של Google בקוד"      'ya29\.[A-Za-z0-9_-]{20,}'
scan "מפתח AWS בקוד"                  'AKIA[0-9A-Z]{16}'
scan "מפתח פרטי (PEM) בקוד"           '^-----BEGIN [A-Z ]*PRIVATE KEY-----'

if [ "$fail" -eq 0 ]; then
  printf '\033[1;32m✓ לא נמצאו סודות בקוד\033[0m\n'
fi
exit "$fail"
