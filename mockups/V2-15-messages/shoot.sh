#!/bin/sh
# Screenshot one V2-15 Messages variant at 1280 and 390 wide. Usage: sh shoot.sh a
# Headless Chrome will not open a window narrower than about 500px, so the 390 shot
# renders the page inside a 390px iframe (phone.html) in a 600px window and crops to 390.
# Optional: $2 desktop window height (default 3000), $3 phone frame height (default 6000).
# Reduced motion and an 8 s virtual time budget so entry animations have settled.
# SOURCE: Chrome path as in scripts/build_cards.py; approach copied from mockups/V2-15/shoot.sh
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
D=$(cd "$(dirname "$0")" && pwd -W)
P=$(cd "${TMPDIR:-/tmp}" && pwd -W)/v2-15-msg-shots
mkdir -p "$P"
F="--headless --disable-gpu --hide-scrollbars --force-prefers-reduced-motion --virtual-time-budget=8000"
timeout 90 "$C" $F --user-data-dir=$P/ch1 --screenshot=$D/$1.png --window-size=1280,${2:-3000} "file:///$D/$1.html" >/dev/null 2>&1
timeout 90 "$C" $F --user-data-dir=$P/ch2 --screenshot=$P/phone-full.png --window-size=600,${3:-6000} "file:///$D/phone.html#$1.html&${3:-6000}" >/dev/null 2>&1
python -c "from PIL import Image;im=Image.open('$P/phone-full.png');im.crop((0,0,390,im.height)).save('$D/$1-390.png')"
python "$D/../V2-02/trim.py" "$D/$1.png"
python "$D/../V2-02/trim.py" "$D/$1-390.png"
