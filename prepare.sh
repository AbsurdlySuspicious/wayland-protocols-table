#!/usr/bin/env bash
set -eo pipefail
pushd we-data
tsc compositor-registry.ts protocol-registry.ts
popd
rm -rfv web/logos
cp -rv wayland-explorer/public/logos web/
