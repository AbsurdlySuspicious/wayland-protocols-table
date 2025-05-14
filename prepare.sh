#!/usr/bin/env bash
set -eo pipefail

log() {
    echo "|" "$@"  # 1>&2
}

if [[ $SKIP_SUBMODULES != 1 ]]; then
    log Updating submodules
    git submodule update --init --depth=1
    log Submodules updated
fi

[[ -n $WE_DATA_PATH ]] \
    || export WE_DATA_PATH=./wayland-explorer/src/data
log Using data path: "$WE_DATA_PATH"
[[ -L $WE_DATA_PATH ]] \
    && log Data path is a symlink to: "$(readlink "$WE_DATA_PATH")"

if [[ $SKIP_TSC != 1 ]]; then
    log Compiling Typescript registry modules
    pushd "$WE_DATA_PATH"
    tsc compositor-registry.ts protocol-registry.ts
    popd
fi

log Preparing 'dist' directory
rm -r dist || true
mkdir -v dist
cp -rv web/* dist

log Copying logo svgs
mkdir -v dist/logos || true
cp -v wayland-explorer/public/logos/* dist/logos/

log Running data.json prepare script
node prepare-data.js | tee generated/data_last.json dist/data.json >/dev/null

if [[ $PRETTY != 1 ]]; then
    log Minifying dist files
    node minify.js dist/*
fi

log Finished
