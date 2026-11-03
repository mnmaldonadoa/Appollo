"""Reemplaza íconos y splash de Android por los de Appollo (usa dist/icons)."""
from pathlib import Path
from PIL import Image
RES = Path(__file__).parent / "android/app/src/main/res"
ICONS = Path(__file__).parent / "dist/icons"
BG = (23, 32, 27, 255)
full, mask = Image.open(ICONS/"icon-512.png").convert("RGBA"), Image.open(ICONS/"maskable-512.png").convert("RGBA")
for d, s in {"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}.items():
    for n in ("ic_launcher.png","ic_launcher_round.png"):
        full.resize((s,s), Image.LANCZOS).save(RES/f"mipmap-{d}"/n)
    f = s*108//48
    mask.resize((f,f), Image.LANCZOS).save(RES/f"mipmap-{d}"/"ic_launcher_foreground.png")
(RES/"values/ic_launcher_background.xml").write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#17201B</color>\n</resources>\n')
for p in RES.glob("drawable*/splash.png"):
    w,h = Image.open(p).size
    img = Image.new("RGBA",(w,h),BG); t = int(min(w,h)*0.32)
    img.paste(full.resize((t,t),Image.LANCZOS),((w-t)//2,(h-t)//2)); img.save(p)
print("ok")
