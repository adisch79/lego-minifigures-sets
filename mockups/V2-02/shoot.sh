#!/bin/sh
# Screenshot one direction at 1280 and 390 wide, then trim the empty board tail.
# Usage: sh shoot.sh a
# Headless Chrome will not open a window narrower than about 500px, so the 390 shot
# renders the page inside a 390px iframe (phone.html) and crops to 390.
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
D=E:/Dev/lego-minifigures-sets/mockups/V2-02
P=C:/Users/adisc/AppData/Local/Temp/claude/42b7d28e94b32802/1607fb1c-0510-4e24-8eda-6a78045f578f/scratchpad
timeout 60 "$C" --headless --disable-gpu --hide-scrollbars --user-data-dir=$P/ch1 --virtual-time-budget=3000 \
  --screenshot=$D/$1-1280.png --window-size=1280,7000 "file:///$D/$1.html" >/dev/null 2>&1
timeout 60 "$C" --headless --disable-gpu --hide-scrollbars --user-data-dir=$P/ch2 --virtual-time-budget=3000 \
  --screenshot=$P/phone-full.png --window-size=520,8000 "file:///$D/phone.html?$1.html&8000" >/dev/null 2>&1
python -c "from PIL import Image;im=Image.open('$P/phone-full.png');im.crop((0,0,390,im.height)).save('$D/$1-390.png')"
python $D/trim.py $D/$1-1280.png
python $D/trim.py $D/$1-390.png
