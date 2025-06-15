<h1 align="center">Wayland protocol support table</h1>

<div align="center"><img src="repo-imgs/s-scroll.png" width="80%"></div>

<p align="center">
<br>
Convenient way to explore current Wayland protocols and how well they are supported<br>
Try and explore at <b><a href="https://absurdlysuspicious.github.io/wayland-protocols-table/">GitHub Pages</a></b>
</p>

## Features

### Protocol descriptions

<img src="repo-imgs/s-desc.png" width="45%" align="left">
View protocol descriptions and author information right from table view by clicking on document icon, or click on protocol name and read full description and API specification on wayland.app
<br clear="all">

### Interfaces listings

<img src="repo-imgs/s-interfaces.png" width="45%" align="left">
View interfaces list for each of protocols by clicking on bullet list icon and see full compositor support matrix for each interface. Interfaces are automatically expanded if any of compositors have partial support for given protocol. Full API spec is available on wayland.app by clicking on protocol name
<br clear="all">

### Open/close all toggles

You can toggle all descriptions or interface listings at once by clicking on respective icons in header

### Supported protocols percentage

<img src="repo-imgs/s-percentage.png" width="45%" align="left">
See how many of protocols each compositor supports. You can also exclude non-standard protocols from percentages by toggling respective option under Settings button
<br clear="all">

### Filter protocols by compositor

<img src="repo-imgs/s-filtering-excl.png" width="48%">
<img src="repo-imgs/s-filtering-incl.png" width="48%">
<br clear="all"><br>
Filter protocols by clicking on its name in header. First click will show only protocols supported by this compositor. Clicking again will invert the filter and show only unsupported protocols. Third click will reset the filter

### Hover helpers

<img src="repo-imgs/s-hover1.png" width="48%">
<img src="repo-imgs/s-hover2.png" width="48%">
<br clear="all"><br>
Hover highlights will help with visual navigation within the table. Colored dots under compositor names duplicate support status for currently highlighted protocol row

## Building

Run `prepare.sh` and it will:

- Initialize and checkout wayland-explorer submodule
- Compile necessary typescript files with information about protocols and compositors
- Prepare static website in `dist` directory

Also note that:

- You will need Node and TypeScript compiler installed
- Prepare script needs bash to run and is most likely linux-only

## Why no React, Webpack, etc. ?

Initial goal for this project was to make it with as little dependencies as possible. Even `tsc` is optional if you use precompiled `data.json`. This goal was met at current MVP stage, so any further improvements and refactors are welcome as contributions even if it will involve adding more dependencies.
