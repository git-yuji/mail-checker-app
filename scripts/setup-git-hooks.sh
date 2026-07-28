#!/bin/sh

set -eu

git config core.hooksPath .githooks
git config commit.template .gitmessage

echo "Gitのコミットフックとテンプレートを有効化しました。"
