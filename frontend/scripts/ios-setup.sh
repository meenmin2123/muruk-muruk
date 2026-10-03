#!/usr/bin/env bash
# 아이폰 앱 빌드 준비를 한 번에.
#
#   ./scripts/ios-setup.sh 799206979966-xxxxx.apps.googleusercontent.com
#
# 구글 iOS 클라이언트 ID 하나만 주면 나머지는 알아서 한다.
#   · .env.production 과 Info.plist 를 같은 값으로 맞춘다(둘이 어긋나면 로그인이 멈춘다)
#   · 정적 export → cap sync → pod install → Xcode 열기
# 여러 번 돌려도 된다. ID 를 바꿔 다시 돌리면 그 값으로 덮어쓴다.
set -euo pipefail

cd "$(dirname "$0")/.."

say()  { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 0. 들어온 값 검사 ──────────────────────────────────────────────
CLIENT_ID="${1:-}"
if [ -z "$CLIENT_ID" ]; then
  cat <<'USAGE'
쓰는 법:
  ./scripts/ios-setup.sh <구글 iOS 클라이언트 ID>

  예) ./scripts/ios-setup.sh 799206979966-abc123.apps.googleusercontent.com

ID 만드는 곳: https://console.cloud.google.com/apis/credentials
  웹과 '같은 프로젝트' ▸ 사용자 인증 정보 만들기 ▸ OAuth 클라이언트 ID
  ▸ 유형 'iOS' ▸ 번들 ID 는 com.muruk.app
USAGE
  exit 1
fi

case "$CLIENT_ID" in
  *여기에*)                          die "플레이스홀더를 그대로 넣으셨습니다. 실제 ID 를 주세요." ;;
  *.apps.googleusercontent.com)      : ;;
  *)                                 die "ID 가 .apps.googleusercontent.com 으로 끝나야 합니다: $CLIENT_ID" ;;
esac

# 역순 스킴 — 구글이 앱으로 돌아올 때 쓰는 통로
REVERSED="com.googleusercontent.apps.${CLIENT_ID%.apps.googleusercontent.com}"

say "클라이언트 ID  $CLIENT_ID"
printf '  리다이렉트 스킴  %s\n' "$REVERSED"

# ── 1. 두 파일을 같은 값으로 ───────────────────────────────────────
ENV_FILE=".env.production"
PLIST="ios/App/App/Info.plist"
[ -f "$ENV_FILE" ] || die "$ENV_FILE 이 없습니다. 저장소 최신본을 받으셨나요?"
[ -f "$PLIST" ]    || die "$PLIST 가 없습니다. 저장소 최신본을 받으셨나요?"

say "설정 파일 두 곳 맞추는 중"
# 플레이스홀더든 이전 값이든 상관없이 통째로 교체한다(두 번째 실행도 안전).
python3 - "$ENV_FILE" "$PLIST" "$CLIENT_ID" "$REVERSED" <<'PY'
import re, sys
env_path, plist_path, cid, rev = sys.argv[1:5]

with open(env_path, encoding="utf-8") as f:
    env = f.read()
env2, n = re.subn(r"(?m)^NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=.*$",
                  "NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=" + cid, env)
if n != 1:
    sys.exit(f"{env_path}: NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID 줄을 {n}개 찾았습니다(1개여야 함)")
open(env_path, "w", encoding="utf-8").write(env2)

with open(plist_path, encoding="utf-8") as f:
    plist = f.read()
# 주석 안의 설명용 예시는 건드리지 않도록 <string> 안쪽만 바꾼다.
plist2, n = re.subn(r"<string>com\.googleusercontent\.apps\.[^<]*</string>",
                    f"<string>{rev}</string>", plist)
if n != 1:
    sys.exit(f"{plist_path}: 리다이렉트 스킴 <string> 을 {n}개 찾았습니다(1개여야 함)")
open(plist_path, "w", encoding="utf-8").write(plist2)
print("  .env.production  ✓")
print("  Info.plist       ✓")
PY

# 정말 짝이 맞는지 파일을 다시 읽어 확인한다 — 여기가 어긋나면 로그인이 조용히 멈춘다.
say "짝 맞는지 확인"
ENV_ID=$(sed -n 's/^NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=//p' "$ENV_FILE")
PLIST_SCHEME=$(python3 -c "
import plistlib,sys
d=plistlib.load(open('$PLIST','rb'))
print(d['CFBundleURLTypes'][0]['CFBundleURLSchemes'][0])
")
EXPECT="com.googleusercontent.apps.${ENV_ID%.apps.googleusercontent.com}"
[ "$PLIST_SCHEME" = "$EXPECT" ] || die "두 파일이 어긋납니다:
  .env.production  $ENV_ID
  Info.plist       $PLIST_SCHEME  (기대값 $EXPECT)"
printf '  %s  ↔  %s  ✓\n' "$ENV_ID" "$PLIST_SCHEME"

# ── 2. 빌드 ───────────────────────────────────────────────────────
say "의존성 설치"
npm install

say "웹 자산 빌드(정적 export)"
npm run build:app
[ -f out/index.html ] || die "out/index.html 이 안 생겼습니다. 위 빌드 로그를 보세요."

say "네이티브로 동기화"
npx cap sync ios

say "CocoaPods"
if ! command -v pod >/dev/null 2>&1; then
  die "pod 명령이 없습니다. 먼저:  sudo gem install cocoapods"
fi
( cd ios/App && pod install )

# ── 3. 끝 ─────────────────────────────────────────────────────────
cat <<EOF

────────────────────────────────────────────────────────────
준비 끝. Xcode 를 엽니다.

Xcode 에서 할 일
  1) 왼쪽 맨 위 App ▸ TARGETS 의 App ▸ Signing & Capabilities
  2) Team 을 본인 Apple 계정으로 지정
  3) 상단에서 기기 선택 후 ▶︎ Run
  4) 실기기 첫 실행이면 아이폰에서
     설정 ▸ 일반 ▸ VPN 및 기기 관리 ▸ 본인 계정 ▸ 신뢰

EOF

warn "아직 남은 수동 단계가 하나 있습니다 — 이건 제가 못 합니다."
cat <<EOF
  Render ▸ muruk-backend ▸ Environment ▸ GOOGLE_CLIENT_ID 를
  '기존 웹 ID' 뒤에 쉼표로 아래를 이어 붙이세요:

      ,$CLIENT_ID

  안 하면 '로그인은 되는데 목표가 하나도 안 보이는' 상태가 됩니다.
  (백엔드가 앱 토큰을 거부하는데 앱 쪽에는 아무 오류도 안 뜹니다)
────────────────────────────────────────────────────────────
EOF

npx cap open ios
