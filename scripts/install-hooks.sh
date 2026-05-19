#!/usr/bin/env bash
# Install versioned git hooks from .githooks/ into .git/hooks/.
# Run automatically by `pnpm install` via the package.json "prepare" script.

set -e

# Resolve repo root regardless of where the script is invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${REPO_ROOT}/.githooks"
DEST_DIR="${REPO_ROOT}/.git/hooks"

# Skip silently when there is no .git/hooks dir (e.g., npm publish tarball,
# CI checkout without .git, or a fresh `npm pack` extraction).
if [ ! -d "${DEST_DIR}" ]; then
	exit 0
fi

if [ ! -d "${SRC_DIR}" ]; then
	echo "install-hooks: no .githooks directory at ${SRC_DIR}" >&2
	exit 0
fi

for hook in "${SRC_DIR}"/*; do
	[ -e "${hook}" ] || continue
	name="$(basename "${hook}")"
	cp "${hook}" "${DEST_DIR}/${name}"
	chmod +x "${DEST_DIR}/${name}"
done
