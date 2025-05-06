#!/usr/bin/env bash
set -eo pipefail

log() {
    echo "|" "$@" 1>&2
}

if [[ $SKIP_SUBMODULES != 1 ]]; then
    log Updating submodules
    git submodule update --init --depth=1
fi

log Compiling Typescript registry modules
pushd we-data
tsc compositor-registry.ts protocol-registry.ts
popd

log Preparing 'dist' directory
rm -r dist || true
mkdir -v dist
cp -rv web/* dist

log Copying logo svgs
mkdir -v dist/logos || true
cp -v wayland-explorer/public/logos/* dist/logos/

log Running data.json prepare script
node prepare-data.js | tee generated/data_last.json dist/data.json >/dev/null

log Finished
