# Screenshot the dev Messages page at phone width with Playwright (system Chrome).
import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1, reduced_motion="reduce")
    pg.goto("http://localhost:5191/?demo=admin&messages#admin")
    pg.wait_for_selector("text=Lena Hartmann", timeout=20000)
    if len(sys.argv) > 2: pg.click(f"text={sys.argv[2]}")
    pg.wait_for_timeout(800)
    pg.screenshot(path=out, full_page=True)
    b.close()
