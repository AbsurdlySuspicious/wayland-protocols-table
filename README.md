<h1 align="center">Wayland protocol support table</h1>

<div align="center"><img src="repo-imgs/s-scroll.png" width="80%"></div>

<p align="center">
<br>
A convenient way to explore current Wayland protocols and their support status.<br>
Try it out on <b><a href="https://absurdlysuspicious.github.io/wayland-protocols-table/">GitHub Pages</a></b>
</p>

## Features

### Protocol descriptions

<img src="repo-imgs/s-desc.png" width="45%" align="left">
Click the document icon to view a protocol’s description and author information directly in the table.  
Or click its name to read the full description and API specification on <a href="https://wayland.app">Wayland explorer</a>
<br clear="all">

### Interfaces listings

<img src="repo-imgs/s-interfaces.png" width="45%" align="left">
Click the bullet-list icon to view the list of interfaces for each protocol, along with the full compositor support matrix for each interface.  
Interfaces will auto-expand if any compositor has only partial support.  
For the complete API specification, click the protocol name to go to <a href="https://wayland.app">Wayland explorer</a>
<br clear="all">

### Open/close all toggles

Toggle all descriptions or interface listings at once using the corresponding icons in the header

### Supported protocols percentage

<img src="repo-imgs/s-percentage.png" width="45%" align="left">
See what percentage of listed protocols each compositor supports.  
You can exclude non-standard protocols from these calculations by toggling the option under Settings button in header
<br clear="all">

### Filter protocols by compositor

<img src="repo-imgs/s-filtering-excl.png" width="45%" align="left">
<img src="repo-imgs/s-filtering-incl.png" width="45%" align="left">
<br clear="all"><br>

Filter the table by clicking a compositor’s name in the header:

- First click shows only supported protocols
- Second click shows only unsupported protocols
- Third click clears the filter

Support percentages in the header are also updated according to active filter

### Hover helpers

<img src="repo-imgs/s-hover1.png" width="45%" align="left">
<img src="repo-imgs/s-hover2.png" width="45%" align="left">
<br clear="all"><br>
Hover highlights help with visual navigation within the table. Colored dots beneath compositor names reflect the support status of the currently highlighted protocol row

## Building

Run `prepare.sh` and it will:

- Initialize and checkout `wayland-explorer` submodule
- Compile the necessary TypeScript files containing protocol and compositor data
- Generate the static website in the `dist` directory

Also note that:

- Node.js and TypeScript are required to generate `data.json` file
  - You can use one included in repo, though it may be outdated since it's not updated during CI. Use `SKIP_TSC=1` and/or `SKIP_PREP=1` environment variables to skip ts compile stage, or preparation js script altogether, respectively
- `prepare.sh` needs bash to run and is most likely linux-only

## Why not React, Webpack, etc. ?

Initial goal for this project was to make it with as little dependencies as possible. Even `tsc` is optional if you use precompiled `data.json`. Now that we have a working MVP, any contributions, including refactors that require new dependencies, are welcome

## Acknowledgments

Many thanks to people behind Wayland Explorer (aka wayland.app) project: https://github.com/vially/wayland-explorer  
This project uses precompiled .ts registry files from wayland-explorer as data source, and also links to wayland.app for full protocol descriptions
