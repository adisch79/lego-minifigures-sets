# Phone-width screenshots of the dev server with the ?demo collection (V2-03).
import sys
from playwright.sync_api import sync_playwright
D = "E:/Dev/lego-minifigures-sets/mockups/V2-03/"
pages = [("build-home-390.png", "http://localhost:5179/?demo"),
         ("build-series-390.png", "http://localhost:5179/?demo#series/71048")]
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    for name, url in pages:
        pg.goto(url)
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1500)
        pg.screenshot(path=D + name, clip={"x": 0, "y": 0, "width": 390, "height": 2400}, full_page=True)
        print(name, pg.url)
    b.close()
