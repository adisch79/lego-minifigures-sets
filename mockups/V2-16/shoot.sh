#!/bin/sh
# Screenshot one V2-16 email: desktop client (600 px email + 12 px canvas each side),
# phone (390 px, rendered in an iframe because headless Chrome will not open a window that narrow)
# and the dark-mode render. Usage: sh shoot.sh a   (or a-confirm). Run build.py first.
# SOURCE: Chrome path as in scripts/build_cards.py
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
D=$(cd "$(dirname "$0")" && pwd -W)
P=$(cd "${TMPDIR:-/tmp}" && pwd -W)/v2-16-shots
mkdir -p "$P"
shot() { timeout 60 "$C" --headless --disable-gpu --hide-scrollbars --user-data-dir=$P/$1 --virtual-time-budget=3000 \
  --screenshot=$2 --window-size=$3 "$4" >/dev/null 2>&1; }
shot ch1 "$D/$1.png" 624,2400 "file:///$D/preview/$1.html"
shot ch2 "$D/$1-dark.png" 624,2400 "file:///$D/preview/$1-dark.html"
shot ch3 "$P/phone-full.png" 520,3000 "file:///$D/phone.html#preview/$1.html&3000"
python -c "from PIL import Image;im=Image.open('$P/phone-full.png');im.crop((0,0,390,im.height)).save('$D/$1-390.png')"
for f in "$1" "$1-dark" "$1-390"; do python "$D/../V2-02/trim.py" "$D/$f.png"; done
