#!/usr/bin/env bash
# iOS Debug build + Metro hot-reload loop for the caregiver app (simulator only).
#
#   scripts/ios-debug.sh setup [--clean]   prebuild (if needed), .xcode.env.local, pod install, sanity checks
#   scripts/ios-debug.sh build             xcodebuild -configuration Debug into ios/build-debug
#   scripts/ios-debug.sh install           boot the simulator, install and launch the Debug app
#   scripts/ios-debug.sh metro             Metro in the foreground (file watching ON)
#   scripts/ios-debug.sh dev [--clean]     setup + build, then Metro in the foreground and the app
#                                          installed and launched as soon as Metro is ready
#
# Recipe and background: docs/sop/2026-11-07-caregiver-ios-debug-build.md (monorepo root).
#
# Environment (all optional):
#   SIM_NAME             simulator to use when none is booted   (default: iPhone 17 Pro)
#   SIM_UDID             exact simulator UDID, wins over SIM_NAME and over "whatever is booted"
#   EXPO_PUBLIC_API_URL  backend the app talks to               (default: http://localhost:8000)
#   METRO_PORT           Metro port; the Debug app looks on 8081 unless told otherwise (default 8081)

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$APP_DIR/ios"
WORKSPACE="OaklyHealthCaregiver.xcworkspace"
SCHEME="OaklyHealthCaregiver"
BUNDLE_ID="com.oakly.oaklycaregiver"
DERIVED="$IOS_DIR/build-debug"
SIM_NAME="${SIM_NAME:-iPhone 17 Pro}"
METRO_PORT="${METRO_PORT:-8081}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://localhost:8000}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "'$1' not found on PATH"; }

# --- setup ------------------------------------------------------------------

setup() {
  local clean=0
  [[ "${1:-}" == "--clean" ]] && clean=1
  need node; need pod; need xcodebuild

  cd "$APP_DIR"
  if [[ $clean -eq 1 || ! -d "$IOS_DIR" ]]; then
    log "expo prebuild (ios is regenerated; it is git-ignored)"
    rm -rf "$IOS_DIR"
    # CI=1 only stops prebuild from prompting. Never set CI for Metro: it turns file watching off.
    CI=1 EXPO_NO_TYPESCRIPT_SETUP=1 npx expo prebuild --platform ios --no-install
  fi

  # Xcode's script phases read NODE_BINARY from here. A stale pin (a Node version that was
  # uninstalled) makes "Bundle React Native code and images" fail, so always rewrite it.
  log "pin NODE_BINARY=$(command -v node)"
  printf 'export NODE_BINARY=%s\n' "$(command -v node)" > "$IOS_DIR/.xcode.env.local"

  log "pod install (downloads the React Native, Hermes and dependencies prebuilts for BOTH Debug and Release)"
  (cd "$IOS_DIR" && LANG=en_US.UTF-8 pod install)

  verify_pods
}

# A Debug link needs the *debug* React Native prebuilt. `pod install` downloads both tarballs and an
# Xcode script phase swaps the right one in per configuration. If a tarball is missing (an old or
# offline `pod install`, a hand-copied Pods folder) the Debug link fails with "missing getDebugProps".
verify_pods() {
  local pods="$IOS_DIR/Pods" f missing=0
  for f in ReactNativeCore-artifacts/reactnative-core-*-debug.tar.gz \
           ReactNativeCore-artifacts/reactnative-core-*-release.tar.gz \
           ReactNativeDependencies-artifacts/reactnative-dependencies-*-debug.tar.gz \
           hermes-engine-artifacts/hermes-ios-*-debug.tar.gz; do
    # shellcheck disable=SC2086
    ls $pods/$f >/dev/null 2>&1 || { echo "missing: Pods/$f"; missing=1; }
  done
  # Every device/simulator slice of the xcframework must carry its React binary.
  local slice
  for slice in "$pods"/React-Core-prebuilt/React.xcframework/ios-arm64 \
               "$pods"/React-Core-prebuilt/React.xcframework/ios-arm64_x86_64-simulator; do
    [[ -e "$slice/React.framework/React" || -e "$slice/React" ]] || { echo "missing React binary in ${slice#"$pods"/}"; missing=1; }
  done
  [[ $missing -eq 0 ]] || die "Pods are incomplete. Run: scripts/ios-debug.sh setup --clean"
}

# --- simulator --------------------------------------------------------------

sim_udid() {
  if [[ -n "${SIM_UDID:-}" ]]; then echo "$SIM_UDID"; return; fi
  local booted
  booted="$(xcrun simctl list devices booted | grep -Eo '[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}' | head -1 || true)"
  if [[ -n "$booted" ]]; then echo "$booted"; return; fi
  xcrun simctl list devices available | grep -F "$SIM_NAME (" | grep -Eo '[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}' | head -1
}

# --- build ------------------------------------------------------------------

build() {
  [[ -d "$IOS_DIR/Pods" ]] || die "No ios/Pods. Run: scripts/ios-debug.sh setup"
  verify_pods
  local udid; udid="$(sim_udid)"; [[ -n "$udid" ]] || die "No simulator found for '$SIM_NAME'"
  log "xcodebuild Debug for simulator $udid (first build is slow: React Native C++ and the Expo modules compile; later builds are incremental)"
  local started=$SECONDS logfile="$IOS_DIR/build-debug.log"
  if ! (cd "$IOS_DIR" && xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Debug \
          -destination "id=$udid" -derivedDataPath "$DERIVED" build > "$logfile" 2>&1); then
    grep -E "error:" "$logfile" | head -20 || true
    die "xcodebuild failed; full log: $logfile"
  fi
  log "BUILD SUCCEEDED in $((SECONDS - started))s"
}

app_path() { echo "$DERIVED/Build/Products/Debug-iphonesimulator/$SCHEME.app"; }

install_and_launch() {
  [[ -d "$(app_path)" ]] || die "No Debug app at $(app_path). Run: scripts/ios-debug.sh build"
  local udid; udid="$(sim_udid)"
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true   # boots it if needed
  open -a Simulator >/dev/null 2>&1 || true
  log "install + launch $BUNDLE_ID on $udid"
  xcrun simctl terminate "$udid" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$udid" "$(app_path)"
  xcrun simctl launch "$udid" "$BUNDLE_ID"
}

# --- metro ------------------------------------------------------------------

metro_up() { [[ "$(curl -s --max-time 2 "http://localhost:$METRO_PORT/status" || true)" == "packager-status:running" ]]; }

metro() {
  cd "$APP_DIR"
  if metro_up; then
    log "Metro already running on :$METRO_PORT, reusing it"
    return
  fi
  if lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    die "Port $METRO_PORT is in use by something that is not Metro"
  fi
  log "Metro on :$METRO_PORT (EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL)"
  # `env -u CI`: with CI set Expo CLI turns file watching off and hot reload silently does nothing.
  exec env -u CI EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --localhost --port "$METRO_PORT"
}

dev() {
  setup "$@"
  build
  if ! metro_up; then
    (
      for _ in $(seq 1 90); do metro_up && break; sleep 2; done
      metro_up && install_and_launch
    ) &
  else
    install_and_launch
  fi
  metro
}

case "${1:-}" in
  setup)   shift; setup "$@" ;;
  build)   build ;;
  install) install_and_launch ;;
  metro)   metro ;;
  dev)     shift; dev "$@" ;;
  *) sed -n '2,19p' "${BASH_SOURCE[0]}"; exit 2 ;;
esac
