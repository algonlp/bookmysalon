#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
PM2_APP_NAME="${PM2_APP_NAME:-bookmysalon}"
RUNTIME_FILES=(
  "data/appointments.json"
  "data/client-platform.json"
)
STASH_MESSAGE="server runtime data"

cd "$APP_DIR"

echo "Deploying in: $APP_DIR"

stash_created=0

if [[ -n "$(git status --porcelain -- "${RUNTIME_FILES[@]}")" ]]; then
  echo "Stashing runtime data files"
  git stash push -m "$STASH_MESSAGE" -- "${RUNTIME_FILES[@]}"
  stash_created=1
fi

echo "Pulling latest code from ${REMOTE}/${BRANCH}"
git pull --ff-only "$REMOTE" "$BRANCH"

if [[ "$stash_created" -eq 1 ]]; then
  echo "Restoring runtime data files"

  if ! git stash pop; then
    echo "Stash pop conflicted. Keeping server runtime data files."

    for runtime_file in "${RUNTIME_FILES[@]}"; do
      if [[ -f "$runtime_file" ]]; then
        cp "$runtime_file" "/tmp/$(basename "$runtime_file").conflicted.bak"
      fi
    done

    git restore --source=stash@{0} --staged --worktree "${RUNTIME_FILES[@]}"
    git restore --staged "${RUNTIME_FILES[@]}"
    git stash drop stash@{0}
  fi
fi

echo "Installing dependencies"
npm ci

echo "Building project"
npm run build

echo "Restarting PM2 app: $PM2_APP_NAME"
pm2 restart "$PM2_APP_NAME" --update-env

echo
echo "Latest commits:"
git log --oneline -2

echo
echo "PM2 status:"
pm2 status

echo
echo "Git status:"
git status --short
