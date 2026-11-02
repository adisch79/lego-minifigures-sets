"""Probe BrickLink CMF codes per series by checking figure images exist.

Candidates are BrickLink naming conventions (colNN, themed codes). A code is
verified when <code>-1.png and <code>-<maxNo>.png both return 200.
Rate: 1 request / 2 s, each URL once. Output: docs/spike/V1-03-bricklink-codes.json
"""
import json, time, urllib.request, urllib.error, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
IMG = "https://img.bricklink.com/ItemImage/SN/0/{code}-{n}.png"
NUMBERED = ["8683", "8684", "8803", "8804", "8805", "8827", "8831", "8833", "71000", "71001",
            "71002", "71007", "71008", "71010", "71011", "71013", "71018", "71021", "71025",
            "71027", "71029", "71032", "71034", "71037", "71045", "71046", "71048", "71051", "71052"]
CANDIDATES = {s: "col%02d" % (i + 1) for i, s in enumerate(NUMBERED)}
CANDIDATES.update({
    "8909": "coltgb", "71004": "coltlm", "71005": "colsim", "71009": "colsim2",
    "71012": "coldis", "71014": "coldfb", "71017": "coltlbm", "71020": "coltlbm2",
    "71022": "colhp", "71023": "coltlm2", "71024": "coldis2", "71026": "coldc",
    "71028": "colhp2", "71030": "collt", "71033": "colmup", "71039": "colmar2",
    "71047": "coldnd", "71049": "colf1", "71050": "colsm", "71053": "colshr",
    "71038": "coldis100", "71031": "colmar", "71019": "coltlnm",
})
last = [0.0]

def status(url):
    wait = 2.0 - (time.time() - last[0])
    if wait > 0:
        time.sleep(wait)
    last[0] = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return str(e)

def main():
    cat = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))
    out, reqs = {}, 0
    for s in cat["series"]:
        code = s["bricklinkCode"] or CANDIDATES.get(s["id"])
        if not code:
            out[s["id"]] = {"code": None, "verified": False}
            continue
        mx = max(f["no"] for f in s["figures"])
        ns = [1, mx] + ([17, 19] if s["id"] == "71001" else [])
        res = {}
        for n in dict.fromkeys(ns):
            res[n] = status(IMG.format(code=code, n=n)); reqs += 1
        out[s["id"]] = {"code": code, "maxNo": mx, "status": res,
                        "verified": all(v == 200 for v in res.values())}
        print(s["id"], code, res, flush=True)
    dest = ROOT / "docs/spike/V1-03-bricklink-codes.json"
    dest.write_text(json.dumps({"requests": reqs, "series": out}, indent=1), encoding="utf-8")
    print("requests", reqs)

if __name__ == "__main__":
    main()
