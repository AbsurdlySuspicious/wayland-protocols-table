const { writeFileSync } = require("fs")
const compData = require("./we-data/compositor-registry")
const protoData = require("./we-data/protocol-registry")

const protocols = {}
const protocolInterfaceMap = {}
protoData.waylandProtocolRegistry.protocols.forEach((p) => {
    const protocol = {
        id: p.id,
        name: p.name,
        desc: p.protocol.description?.summary,
        tags: [p.source, p.stability],
        support: {},
    }
    p.protocol?.interfaces?.forEach((iface) => {
        protocolInterfaceMap[iface.name] = protocol
    })
    protocols[protocol.id] = protocol
})

const compositors = []
compData.compositorRegistry.forEach((c) => {
    const shortData = {
        id: c.id,
        name: c.name,
        icon: c.icon,
    }
    compositors.push(shortData)
    for (let compProto of c.info.globals) {
        const ifName = compProto.interface
        const protoCompSupport = protocolInterfaceMap[ifName]?.support
        if (protoCompSupport == null) 
            continue
        const supportedInterfaces = protoCompSupport[c.id]
        if (supportedInterfaces == null)
            protoCompSupport[c.id] = [ifName]
        else if (!supportedInterfaces.includes(ifName))
            supportedInterfaces.push(ifName)
    }
})

const dataOut = { compositors, protocols }
writeFileSync("web/data/data.json", JSON.stringify(dataOut))
