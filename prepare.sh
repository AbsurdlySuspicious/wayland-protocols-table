#!/usr/bin/env bash
set -eo pipefail

log() {
    echo "|" "$@"  # 1>&2
}

update_submodules() {
    local upd_default=(--init --recursive)
    local upd

    run_update() {
        [[ $upd == 'default' ]] && upd=("${upd_default[@]}")
        log "- Updating $path with ${upd[*]}"
        git submodule update "${upd[@]}" "${path}"
    }

    while read -r path; do
        case "$path" in
            'wayland-explorer')
                upd=(--init --depth=1)
                [[ $WE_PULL == 1 ]] && upd+=(--remote)
                run_update
                ;;
            *)
                # shellcheck disable=SC2178
                upd="default"
                run_update
                ;;
        esac
    done < <(git config --file .gitmodules --get-regexp path | cut -d' ' -f2 )
}

template_replace() {
    local content file=$1
    content=$(<"$file")
    sed "
        s/{{COMMIT}}/$(git rev-parse --short HEAD)/g;
        s/{{COMMIT_WE}}/$(git -C wayland-explorer rev-parse --short HEAD)/g;
    " >"$file" <<<"$content"
}

if [[ $SKIP_SUBMODULES != 1 ]]; then
    log Updating submodules
    update_submodules
    log - Submodules updated
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
else
    log Using existing compiled js files as data source '[SKIP_TSC]'
fi

log Preparing 'dist' directory
rm -r dist || true
mkdir -v dist
cp -rv web/* dist

log Replacing build data in index.html
template_replace dist/index.html

log Copying logo svgs
mkdir -v dist/logos || true
cp -v wayland-explorer/public/logos/* dist/logos/

if [[ $SKIP_PREP != 1 ]]; then
    log Running data.json prepare script
    node prepare-data.js | tee generated/data_last.json dist/data.json >/dev/null
else
    log Copying data.json from repo '[SKIP_PREP]'
    cp generated/data_last.json dist/data.json
fi

if [[ $PRETTY != 1 ]]; then
    log Minifying dist files
    node minify.js dist/*
fi

log Finished
