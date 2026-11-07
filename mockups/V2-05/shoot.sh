#!/bin/sh
# Screenshot one V2-05 direction at 1280 and 390 wide. Usage: sh shoot.sh a [query] [suffix]
# Headless Chrome will not open a window narrower than about 500px, so the 390 shot
# renders the page inside a 390px iframe (phone.html) and crops to 390.
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
D=E:/Dev/lego-minifigures-sets/mockups/V2-05
P=C:/Users/adisc/AppData/Local/Temp/claude/42b7d28e94b32802/ef5994f4-c061-4c3a-8c96-958c3ae30585/scratchpad
N=$1$3
timeout 60 "$C" --headless --disable-gpu --hide-scrollbars --user-data-dir=$P/ch1 --virtual-time-budget=3000 \
  --screenshot=$D/$N.png --window-size=1280,2600 "file:///$D/$1.html$2" >/dev/null 2>&1
timeout 60 "$C" --headless --disable-gpu --hide-scrollbars --user-data-dir=$P/ch2 --virtual-time-budget=3000 \
  --screenshot=$P/phone-full.png --window-size=520,5000 "file:///$D/phone.html#$1.html$2&5000" >/dev/null 2>&1
python -c "from PIL import Image;im=Image.open('$P/phone-full.png');im.crop((0,0,390,im.height)).save('$D/$N-390.png')"
python E:/Dev/lego-minifigures-sets/mockups/V2-02/trim.py $D/$N.png
python E:/Dev/lego-minifigures-sets/mockups/V2-02/trim.py $D/$N-390.png
