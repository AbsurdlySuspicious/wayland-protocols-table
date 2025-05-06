const { stdout } = require("process")
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

let protocolsTotal = 0
const protocols = []
const protocolInterfaceMap = {}
const protocolSupportByComp = {}
protoData.waylandProtocolRegistry.protocols.forEach((p) => {
    const protocol = {
        id: p.id,
        name: p.name,
        desc: p.protocol.description?.summary,
        tags: [
            p.source.replace(/-protocols$/, ""), 
            p.stability
        ],
        source: p.source,
        supportIf: {},
        supportSum: {},
        defaultExpand: false,
    }
    p.protocol?.interfaces?.forEach((iface) => {
        protocolInterfaceMap[iface.name] = protocol
    })
    protocols.push(protocol)
    if (protoPercentageFilter(protocol)) 
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
        if (supportGrade != SUPPORT_NONE && protoPercentageFilter(p))
            objIncr(protocolSupportByComp, compId, supportGrade == SUPPORT_FULL ? 1 : 0.5)
    }
    p.defaultExpand = hasNonFull
})

for (const [compId, supported] of Object.entries(protocolSupportByComp)) {
    compositorsById[compId].supportedPercent = Math.round(supported / protocolsTotal * 100)
}

const dataOut = { compositors, protocols }
stdout.write(JSON.stringify(dataOut))
