#!/usr/bin/env bash
# Build the README demo from three screenshots: Spotify, X, DoorDash.
# Produces docs/media/demo.mp4 (high quality) and docs/media/demo.gif (inline-renderable on GitHub).
# Usage: scripts/make_demo.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${SRC:-$HOME/.claude/image-cache/dd631e3c-2158-48ce-a7b5-12df8cfef72e}"
OUT="$REPO/docs/media"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/demo.XXXXXX")"
FONT="/System/Library/Fonts/Supplemental/Arial.ttf"
mkdir -p "$OUT"

# image -> caption
build_frame () {
  local img="$1" caption="$2" out="$3"
  # Fit within 1000x960, pad to that on dark bg, add an 88px caption strip on top.
  ffmpeg -y -loglevel error -i "$img" -vf "
    scale=1000:960:force_original_aspect_ratio=decrease,
    pad=1000:960:(ow-iw)/2:(oh-ih)/2:color=0x0d1117,
    pad=1000:1048:0:88:color=0x0d1117,
    drawtext=fontfile='$FONT':text='$caption':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=26
  " -frames:v 1 "$out"
}

build_frame "$SRC/2.png" "Play music on Spotify"                    "$WORK/f1.png"
build_frame "$SRC/3.png" "Reply to your favorite researcher on X"   "$WORK/f2.png"
build_frame "$SRC/4.png" "Order Molly Tea on DoorDash"              "$WORK/f3.png"

# 3s per frame, concat into mp4 (h264, even dims, yuv420p for broad playback).
cat > "$WORK/list.txt" <<EOF
file '$WORK/f1.png'
duration 3
file '$WORK/f2.png'
duration 3
file '$WORK/f3.png'
duration 3
file '$WORK/f3.png'
EOF

ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/list.txt" \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30" -pix_fmt yuv420p \
  "$OUT/demo.mp4"

# GIF for inline rendering in the README (relative path plays on GitHub).
ffmpeg -y -loglevel error -i "$OUT/demo.mp4" \
  -vf "fps=12,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  "$OUT/demo.gif"

rm -rf "$WORK"
echo "Wrote:"
ls -lh "$OUT/demo.mp4" "$OUT/demo.gif"
