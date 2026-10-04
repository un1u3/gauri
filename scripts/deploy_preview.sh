#!/bin/sh
# Publishes the hosted preview to GitHub Pages (branch gh-pages → https://un1u3.github.io/gauri/).
# The preview has no AI behind it: it runs in demo mode and says so on every screen.
set -e
npm run build:preview
cd dist-preview
touch .nojekyll
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Hosted preview (demo mode: no AI runs on a public page)"
git push -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
echo "Published. In GitHub: Settings → Pages → Source: branch gh-pages, folder / (root). Then open https://un1u3.github.io/gauri/"
