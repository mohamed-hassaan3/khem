"""Regenerate KHEM's subset fonts. Usage: python subset_fonts.py <src_dir> <out_dir> <used_chars.txt>"""
import sys, os, io
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
src, out, used_path = sys.argv[1:4]
used = open(used_path, encoding="utf8").read()
def rng(spec):
    cps = set()
    for part in spec.split(","):
        a, _, b = part.partition("-"); cps.update(range(int(a, 16), int(b or a, 16) + 1))
    return cps
arabic = rng("0600-06FF,0750-077F,FB50-FDFF,FE70-FEFF")
LATIN = rng("0020-007E,00A0-017F,0192,02C6-02DC,2000-206F,20A0-20CF,2100-215F,2190-21FF,2200-22FF,25A0-25FF,2713,2726,FE0F")
LATIN |= {ord(c) for c in used if ord(c) >= 0x20 and ord(c) not in arabic}
AR = rng("0020-007E,00A0-00FF,0600-06FF,2000-206F,25CC")
def reload(font):
    b = io.BytesIO(); font.save(b); b.seek(0); return TTFont(b)
def run(name, font, unicodes, features):
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = features
    opts.name_IDs = ["*"]; opts.name_languages = ["*"]; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(unicodes=unicodes); s.subset(font)
    p = f"{out}/{name}.woff2"; font.flavor = "woff2"; font.save(p)
    print(f"{name}: {os.path.getsize(f'{src}/{name}.woff2')//1024} KB -> {os.path.getsize(p)//1024} KB, cmap {len(font.getBestCmap())}")
inter = instancer.instantiateVariableFont(TTFont(f"{src}/inter-variable.woff2"), {"opsz": 14, "wght": (400, 600)})
run("inter-variable", reload(inter), LATIN,
    ["calt","ccmp","locl","mark","mkmk","kern","liga","rlig","rvrn","tnum","ordn","case","lnum","pnum","frac","numr","dnom","sups","sinf","zero"])
# Arabic: every feature a browser applies by default (shaping, marks, kerning,
# ligatures, numerals); only opt-in ones (stylistic sets, discretionary
# ligatures, alternates) are dropped — the site enables none of them.
OPT_IN = ("ss", "cv", "dlig", "salt", "aalt", "swsh", "hlig")
for n in ["amiri-regular","amiri-bold","ibm-plex-sans-arabic-regular","ibm-plex-sans-arabic-medium","ibm-plex-sans-arabic-semibold"]:
    f = TTFont(f"{src}/{n}.woff2")
    feats = sorted({r.FeatureTag for t in ("GSUB", "GPOS") if t in f for r in f[t].table.FeatureList.FeatureRecord})
    run(n, f, AR, [x for x in feats if not x.startswith(OPT_IN)])
t = TTFont(f"{out}/inter-variable.woff2")
print("inter axes:", [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in t["fvar"].axes], "| family:", t["name"].getDebugName(1))
