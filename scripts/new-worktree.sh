#!/usr/bin/env bash
# Create a feature branch + worktree + shared tasks/ symlink.
#
# Usage: scripts/new-worktree.sh <slug>
#   e.g. scripts/new-worktree.sh ch-03-attention
#        → branch  feat/ch-03-attention
#        → worktree .worktrees/feat-ch-03-attention/
#        → symlink  .worktrees/feat-ch-03-attention/tasks → ../../tasks/

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <slug>" >&2
  echo "  e.g. $0 ch-03-attention" >&2
  exit 1
fi

slug="$1"
branch="feat/${slug}"
dir_name="feat-${slug}"

# Run from repo root (the dir containing this script's parent).
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
cd "${repo_root}"

worktree_path=".worktrees/${dir_name}"

if [[ -e "${worktree_path}" ]]; then
  echo "error: ${worktree_path} already exists" >&2
  exit 1
fi

mkdir -p .worktrees

# Create branch off main if it doesn't exist, then add the worktree.
if git show-ref --verify --quiet "refs/heads/${branch}"; then
  echo "branch ${branch} already exists — checking it out into worktree"
  git worktree add "${worktree_path}" "${branch}"
else
  git worktree add -b "${branch}" "${worktree_path}" main
fi

# Relative symlink so the worktree sees the same tasks/ as main.
# From .worktrees/feat-<slug>/, ../../tasks/ resolves to repo_root/tasks/.
ln -s ../../tasks "${worktree_path}/tasks"

cat <<EOF

Worktree ready.

  branch:   ${branch}
  path:     ${worktree_path}
  tasks/:   symlinked to repo root tasks/

Next steps:
  cd ${worktree_path}
  # read GOAL.md and tasks/_shared.md
  # create tasks/${branch//\//-}.md for your branch notes
  # work, commit incrementally (one logical change per commit)
  # when done: cd back to main, git merge --no-ff ${branch}, then
  #   git worktree remove ${worktree_path}
  #   git branch -d ${branch}

EOF
