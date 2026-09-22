#!/usr/bin/env python3
"""Render native Small Widget parts and assert fonts/copy/state mapping on a simulator.

Usage: python3 scripts/check-small-widget.py [booted-simulator-UUID]
Requires a booted iOS simulator and Xcode. Does not install the production app,
read an App Group snapshot, or change signing/project settings.
This is a SwiftUI ImageRenderer check, not a SpringBoard WidgetKit-host test.
"""
from pathlib import Path
import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
DEVICE = sys.argv[1] if len(sys.argv) > 1 else 'booted'
OUTPUT = Path(tempfile.mkdtemp(prefix='patch-small-widget-qa-'))
APP = OUTPUT / 'PatchWidgetQA.app'
APP.mkdir()
WIDGET = ROOT / 'ios/App/PatchWidget'
SOURCE = (WIDGET / 'PatchWidget.swift').read_text().split('@main struct PatchWidget: Widget')[0]
(OUTPUT / 'WidgetViews.swift').write_text(SOURCE)
shutil.copytree(WIDGET / 'Fonts', APP / 'Fonts')
shutil.copy(WIDGET / 'companion.jpeg', APP)
FONTS = plistlib.loads((WIDGET / 'Info.plist').read_bytes())['UIAppFonts']
(APP / 'Info.plist').write_bytes(plistlib.dumps({
    'CFBundleIdentifier': 'com.patch.smallwidgetqa', 'CFBundleExecutable': 'PatchWidgetQA',
    'CFBundleName': 'Widget QA', 'CFBundlePackageType': 'APPL', 'CFBundleVersion': '1',
    'CFBundleShortVersionString': '1.0', 'MinimumOSVersion': '17.0',
    'UILaunchScreen': {}, 'UIAppFonts': FONTS, 'UIDeviceFamily': [1, 2],
}))

def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)

SDK = run('xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path', capture_output=True).stdout.strip()
# Compile the same dedicated catalog as the extension; never substitute loose PNGs.
run('xcrun', 'actool', str(WIDGET / 'Assets.xcassets'), '--compile', str(APP),
    '--platform', 'iphonesimulator', '--minimum-deployment-target', '17.0',
    '--target-device', 'iphone', '--target-device', 'ipad')
run('xcrun', 'swiftc', '-sdk', SDK, '-target', 'arm64-apple-ios17.0-simulator',
    '-module-cache-path', str(OUTPUT / 'modules'), str(OUTPUT / 'WidgetViews.swift'),
    str(ROOT / 'ios/App/Shared/RetentionSnapshot.swift'),
    str(ROOT / 'tests/native/PatchSmallWidgetQA.swift'), '-o', str(APP / 'PatchWidgetQA'),
    env={**os.environ, 'SDKROOT': SDK})
subprocess.run(['xcrun', 'simctl', 'terminate', DEVICE, 'com.patch.smallwidgetqa'], capture_output=True)
run('xcrun', 'simctl', 'install', DEVICE, str(APP))
CONTAINER = Path(run('xcrun', 'simctl', 'get_app_container', DEVICE, 'com.patch.smallwidgetqa', 'data', capture_output=True).stdout.strip())
RESULT = CONTAINER / 'Documents/result.txt'
RESULT.unlink(missing_ok=True)
run('xcrun', 'simctl', 'launch', DEVICE, 'com.patch.smallwidgetqa')
for _ in range(60):
    if RESULT.exists():
        shutil.copytree(CONTAINER / 'Documents', OUTPUT / 'results')
        print(RESULT.read_text())
        print('Screenshots:', OUTPUT / 'results')
        break
    time.sleep(1)
else:
    raise SystemExit('QA did not finish: inspect the simulator crash log for a failed precondition.')
