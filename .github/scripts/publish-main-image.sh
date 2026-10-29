#!/usr/bin/env bash
# Main-channel publication is production authority. Only CI-passed main builds
# reach this step; the workflow serializes publishers and rechecks freshness.
set -euo pipefail
image=ghcr.io/namcheai/brand-studio
[[ "$HEAD_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid source SHA' >&2; exit 1; }
[[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo 'Invalid image digest' >&2; exit 1; }
current=$(gh api "repos/$GITHUB_REPOSITORY/branches/main" --jq '.commit.sha')
[[ "$current" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid main response' >&2; exit 1; }
if [ "$current" != "$HEAD_SHA" ]; then
  echo '::notice::Build superseded; leaving the main image channel unchanged.'
  exit 0
fi
docker buildx imagetools create --prefer-index=false --tag "$image:main" "$image@$DIGEST"
