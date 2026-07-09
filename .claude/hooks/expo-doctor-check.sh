#!/usr/bin/env bash
# Stop hook: catch expo-doctor build issues before they surface later.
#
# Only re-runs expo-doctor when a file that affects the native build
# (package.json/lockfile/app config) has changed since the last check —
# and only speaks up when it actually fails. Silent when nothing relevant
# changed or the check passes, to avoid re-running/annoying on every turn.
STATE_FILE="/tmp/.muscle-exercise-manager-expo-doctor-state"
WATCH_FILES=(package.json package-lock.json app.config.js app.json)

hash_input=""
for f in "${WATCH_FILES[@]}"; do
  if [ -f "$f" ]; then
    hash_input+="$(sha256sum "$f")"
  fi
done
current_hash="$(printf '%s' "$hash_input" | sha256sum | cut -d' ' -f1)"

prev_hash=""
if [ -f "$STATE_FILE" ]; then
  prev_hash="$(cat "$STATE_FILE")"
fi

if [ "$current_hash" = "$prev_hash" ]; then
  exit 0
fi

output="$(CI=1 npx -y expo-doctor 2>&1)"
exit_code=$?

echo "$current_hash" > "$STATE_FILE"

if [ "$exit_code" -ne 0 ]; then
  reason="$(printf '%s' "$output" | tail -c 4000)"
  jq -cn --arg reason "$reason" '{decision:"block", reason: ("expo-doctor phát hiện vấn đề, cần kiểm tra trước khi build:\n\n" + $reason)}'
fi
exit 0
