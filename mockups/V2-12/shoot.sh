#!/bin/sh
# Screenshot the V2-12 icon sheet to sheet.png. Usage: sh shoot.sh
# SOURCE: Chrome path as in scripts/build_cards.py
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
D=$(cd "$(dirname "$0")" && pwd -W)
P=$(cd "${TMPDIR:-/tmp}" && pwd -W)/v2-12-shots
mkdir -p "$P"
timeout 60 "$C" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir=$P/ch \
  --virtual-time-budget=3000 --screenshot=$D/sheet.png --window-size=1600,1400 "file:///$D/sheet.html" >/dev/null 2>&1
python "$D/../V2-02/trim.py" "$D/sheet.png"
