#!/bin/sh
# Screenshot one V2-10 variant at 1280 and 390 wide. Usage: sh shoot.sh a
# Headless Chrome will not open a window narrower than about 500px, so the 390 shot
# renders the page inside a 390px iframe (phone.html) and crops to 390.
# SOURCE: Chrome path as in scripts/build_cards.py
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
D=$(cd "$(dirname "$0")" && pwd -W)
P=$(cd "${TMPDIR:-/tmp}" && pwd -W)/v2-10-shots
mkdir -p "$P"
timeout 60 "$C" --headless --disable-gpu --hide-scrollbars --user-data-dir=$P/ch1 --virtual-time-budget=3000 \
  --screenshot=$D/$1.png --window-size=1280,2400 "file:///$D/$1.html" >/dev/null 2>&1
timeout 60 "$C" --headless --disable-gpu --hide-scrollbars --user-data-dir=$P/ch2 --virtual-time-budget=3000 \
  --screenshot=$P/phone-full.png --window-size=520,4200 "file:///$D/phone.html#$1.html&4200" >/dev/null 2>&1
python -c "from PIL import Image;im=Image.open('$P/phone-full.png');im.crop((0,0,390,im.height)).save('$D/$1-390.png')"
python "$D/../V2-02/trim.py" "$D/$1.png"
python "$D/../V2-02/trim.py" "$D/$1-390.png"
