"""Foreground mask from a segmentation model (BiRefNet) for crowd photos (V2-11).

Why: colour thresholds (prep_group.py "white"/"shadow") cannot tell white figure parts (karate gi, surfboard,
mummy) from a white background, so the card colour showed through the figures (owner, 2026-11-14).
BiRefNet is a dichotomous image segmentation model: it separates the objects from the background by shape.

Install: pip install -r requirements-images.txt   (torch is installed separately; CUDA is used when present)
The model weights (about 900 MB) download once into the Hugging Face cache on first use.
Usage (from prep_group.py, method "model"): alpha = model_alpha(rgb)  -> float array 0..1, same size as rgb.
CLI check: python scripts/seg_model.py <image> <out.png>   (writes the cut-out on magenta for review)
"""
import sys
import numpy as np
from PIL import Image

# SOURCE: https://huggingface.co/ZhengPeng7/BiRefNet (model card: 1024x1024 input, ImageNet normalisation)
MODEL_ID = "ZhengPeng7/BiRefNet"
# Pinned remote-code revision (first download 2026-11-14), so a changed birefnet.py is never run unreviewed.
REVISION = "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4"
SIZE = 1024
MEAN, STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)

_model = None


def _load():
    global _model
    if _model is None:
        import torch
        from transformers import AutoModelForImageSegmentation
        _model = AutoModelForImageSegmentation.from_pretrained(MODEL_ID, revision=REVISION, trust_remote_code=True)
        _model.to("cuda" if torch.cuda.is_available() else "cpu").eval()
        torch.set_float32_matmul_precision("high")
    return _model


def model_alpha(rgb):
    """Soft foreground alpha (0..1) for an RGB uint8 array."""
    import torch
    model = _load()
    h, w = rgb.shape[:2]
    x = np.asarray(Image.fromarray(rgb).resize((SIZE, SIZE), Image.BICUBIC), np.float32) / 255
    x = (x - MEAN) / STD
    p = next(model.parameters())                      # weights may load as float16: match dtype and device
    t = torch.from_numpy(x.transpose(2, 0, 1)).unsqueeze(0).to(device=p.device, dtype=p.dtype)
    with torch.no_grad():
        pred = model(t)[-1].sigmoid()[0, 0].float().cpu().numpy()
    return np.asarray(Image.fromarray((pred * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255


def main():
    src, dst = sys.argv[1], sys.argv[2]
    rgb = np.asarray(Image.open(src).convert("RGB"))
    a = model_alpha(rgb)
    im = Image.fromarray(rgb).convert("RGBA")
    im.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
    bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
    bg.alpha_composite(im)
    bg.convert("RGB").save(dst)


if __name__ == "__main__":
    main()
