#!/usr/bin/env python3
"""Rebuild the committed native fonts from the app's existing Fontsource packages.

One-time maintenance tool: python -m pip install fonttools==4.60.2
Run after npm ci. Neither Python nor FontTools is required for Xcode builds.
WOFF containers are unpacked without changing glyphs, names or weights.
"""
from pathlib import Path
import shutil
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'node_modules/@fontsource'
OUTPUT = ROOT / 'ios/App/PatchWidget/Fonts'
FONTS = [
    ('nunito-sans', 'latin', 700, 'NunitoSans-Bold'),
    ('m-plus-rounded-1c', 'latin', 700, 'MPLUSRounded1c-Bold'),
    ('inter', 'latin', 400, 'Inter-Regular'),
    ('noto-sans-jp', 'japanese', 400, 'NotoSansJP-Regular'),
]
OUTPUT.mkdir(parents=True, exist_ok=True)
for family, subset, weight, filename in FONTS:
    font = TTFont(SOURCE / family / 'files' / f'{family}-{subset}-{weight}-normal.woff')
    font.flavor = None
    font.save(OUTPUT / f'{filename}.ttf')
    shutil.copy(SOURCE / family / 'LICENSE', OUTPUT / f'{family}-LICENSE.txt')
    print(filename, font['name'].getDebugName(6), font['OS/2'].usWeightClass)
