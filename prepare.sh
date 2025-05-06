#!/usr/bin/env bash
set -eo pipefail

log() {
    echo "|" "$@" 1>&2
}

if [[ $SKIP_SUBMODULES != 1 ]]; then
    log Updating submodules
    git submodule update --init --depth=1
fi

pushd we-data
log Compiling Typescript registry modules
tsc compositor-registry.ts protocol-registry.ts
popd

log Copying logo svgs
logo_dst=web/logos
mkdir -v "$logo_dst" || true
rm -v "$logo_dst"/* || true
cp -v wayland-explorer/public/logos/* "$logo_dst"/
touch "$logo_dst"/.keep

log Running data.json prepare script
node prepare-data.js

log Finished
