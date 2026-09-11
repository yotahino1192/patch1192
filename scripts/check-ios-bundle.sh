#!/bin/sh
set -eu
bundle="$SRCROOT/App/public"
if [ ! -f "$bundle/index.html" ] || [ ! -f "$bundle/patch-build.json" ]; then
  echo "error: Missing mobile bundle. Run npm run ios:sync:local (Debug) or npm run ios:sync (Release)."
  exit 1
fi
if [ "$CONFIGURATION" = "Release" ]; then
  mode=$(/usr/bin/plutil -extract mode raw -o - "$bundle/patch-build.json")
  origin=$(/usr/bin/plutil -extract apiOrigin raw -o - "$bundle/patch-build.json")
  if [ "$mode" != "production" ]; then
    echo "error: Release requires npm run ios:sync with a production PATCH_API_URL. Local development bundles cannot be archived."
    exit 1
  fi
  case "$origin" in
    https://*) ;;
    *) echo "error: Release requires an HTTPS API origin."; exit 1 ;;
  esac
fi
