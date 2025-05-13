const { stdout, env } = require("process")
const compData = require("./we-data/compositor-registry")
const protoData = require("./we-data/protocol-registry")

function objIncr(obj, key, incrBy, init) {
    incrBy ??= 1
    if (obj[key] == null)
        obj[key] = (init ?? 0) + incrBy
    else
        obj[key] += incrBy
}

const SUPPORT_FULL = "full"
const SUPPORT_PARTIAL = "partial"
const SUPPORT_NONE = "none"

const DEPRECATED_FULL = "deprecated"

function protoPercentageFilter(p) {
    // exclude compositor specific protocols from percentage
    return ![
        'kde-protocols',
        'hyprland-protocols',
        'cosmic-protocols',
        'weston-protocols',
        'treeland-protocols',
    ].includes(p.source)
}

function createDescriptions() {
    const descriptions = []

    function getTitle(titleProp) {
        if (titleProp == null)
            return null
        if (typeof titleProp === "string")
            return { text: titleProp }
        return titleProp
    }

    return {
        descriptions,
        add(text, opts) {
            if (typeof text !== "string")
                text = text?.text
            if (text == null)
                return

            const descriptionObj = {
                title: getTitle(opts.title),
                subTitle: getTitle(opts.subTitle),
                text: text.replace(/(\w)\r?\n(\w)/g, "$1 $2"),
                textOpts: { secondary: opts.textSecondary },
            }

            descriptions.push(descriptionObj)
            return descriptionObj
        }
    }
}

let protocolsTotal = 0
const protocols = []
const protocolInterfaceMap = {}
const protocolSupportByComp = {}
protoData.waylandProtocolRegistry.protocols.forEach((p) => {
    const xml = p.protocol
    const deprecations = p.deprecated
        ? Object.fromEntries(p.deprecated.map((d) => [d.name, d.reason]))
        : null

    const descriptions = createDescriptions()
    descriptions.add(xml.description, { title: p.name, subTitle: { text: p.id, mono: true } })
    for (const interface of xml.interfaces)
        descriptions.add(interface.description, { title: { text: interface.name, mono: true } })
    descriptions.add(xml.copyright, { title: { text: "Protocol copyright", level: 2 }, textSecondary: true })

    const protocolPrepared = {
        id: p.id,
        name: p.name,
        desc: xml.description?.summary,
        descFull: descriptions.descriptions,
        tags: {
            source: p.source.replace(/-protocols$/, ""),
            stability: p.stability,
        },
        source: p.source,
        supportIf: {},
        supportSum: {},
        countSupportSumAny: 0,
        countSupportSumFull: 0,
        defaultExpand: false,
        deprecations,
    }

    xml?.interfaces.forEach((iface) => {
        protocolInterfaceMap[iface.name] = protocolPrepared
    })
    protocols.push(protocolPrepared)

    if (protoPercentageFilter(protocolPrepared))
        protocolsTotal += 1
})

const compositors = []
const compositorsById = {}
compData.compositorRegistry.forEach((c) => {
    const shortData = {
        id: c.id,
        name: c.name,
        icon: c.icon,
        supportedPercent: 0,
    }
    compositors.push(shortData)
    compositorsById[c.id] = shortData
    for (let compProto of c.info.globals) {
        const ifName = compProto.interface
        const protoCompSupport = protocolInterfaceMap[ifName]?.supportIf
        if (protoCompSupport == null)
            continue
        (protoCompSupport[ifName] ??= {})[c.id] = 1
    }
})

function deprecationStatus(p) {
    const d = p.deprecations
    if (!d || d.length == 0)
        return null
    if (Object.keys(p.supportIf).length == 0)
        return DEPRECATED_FULL

    const supportedDeprecated = new Set()
    const supportedInterfaces = Object.keys(p.supportIf)
    for (const interface of supportedInterfaces) {
        if (d[interface] != null)
            supportedDeprecated.add(interface)
    }
    if (supportedDeprecated.size == supportedInterfaces.length)
        return DEPRECATED_FULL

    return null
}

protocols.forEach((p) => {
    let ifTotal = 0
    let hasNonFull = false
    const compCount = {}
    for (const compSet of Object.values(p.supportIf)) {
        ifTotal += 1
        for (const compName of Object.keys(compSet))
            objIncr(compCount, compName)
    }
    for (const [compId, cnt] of Object.entries(compCount)) {
        const supportGrade =
            cnt >= ifTotal
                ? SUPPORT_FULL
                : cnt > 0
                    ? SUPPORT_PARTIAL
                    : SUPPORT_NONE
        p.supportSum[compId] = supportGrade
        if (supportGrade != SUPPORT_FULL)
            hasNonFull = true
        if (supportGrade !== SUPPORT_NONE)
            p.countSupportSumAny += 1
        if (supportGrade === SUPPORT_FULL)
            p.countSupportSumFull += 1
        if (supportGrade != SUPPORT_NONE && protoPercentageFilter(p))
            objIncr(protocolSupportByComp, compId, supportGrade == SUPPORT_FULL ? 1 : 0.5)
    }
    p.defaultExpand = hasNonFull

    const deprecation = deprecationStatus(p)
    if (deprecation === DEPRECATED_FULL) {
        p.tags.deprecated = deprecation
        p.deprecatedFull = true
    }
})

for (const [compId, supported] of Object.entries(protocolSupportByComp)) {
    compositorsById[compId].supportedPercent = Math.round(supported / protocolsTotal * 100)
    // TODO unused, remove later when private protocols filter is implemented on client
}

const dataOut = { compositors, protocols }
stdout.write(JSON.stringify(dataOut, null, env["PRETTY"] === "1" ? 4 : null))
