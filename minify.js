const process = require("process")
const fs = require("fs")

const { minify: jsMinify } = require("terser");
const CleanCSS = require('clean-css');

const cssMinifier = new CleanCSS({})
const jsMinifyCfg = {
    compress: {
        booleans_as_integers: true,
        passes: 3,
    },
    mangle: {
        module: true,
        properties: false,
    },
    ecma: 2025,
    enclose: true,
    toplevel: true,
}

async function processFile(logPrefix, file, action) {
    console.log(`+ ${logPrefix}: ${file}`)
    const input = fs.readFileSync(file, { encoding: "utf-8" })
    fs.writeFileSync(file, await action(input))
}

async function main() {
    for (const file of process.argv.slice(2)) {
        const stat = fs.statSync(file)
        if (stat.isDirectory())
            console.log("- skipping directory:", file)
        else if (file.match(/\.css$/i))
            processFile("css", file, (data) => cssMinifier.minify(data).styles)
        else if (file.match(/\.[mc]?js$/i))
            processFile("js", file, async (data) => (await jsMinify(data, jsMinifyCfg)).code)
        else
            console.log("- skipping unknown:", file)
    }

    console.log("minify finished")
}

if (require.main === module)
    main()
