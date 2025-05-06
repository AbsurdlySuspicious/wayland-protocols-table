
function e(elementName, opts, children) {
    const el = document.createElement(elementName)
    const sa = (name, value) => el.setAttribute(name, value)

    for (let [name, value] of Object.entries(opts || {})) {
        if (value == null || value === false) { }
        else if (value === true) {
            sa(name, "")
        }
        else if (name == 'on') {
            for (const [event, cb] of Object.entries(value)) {
                element.addEventListener(event.toLocaleLowerCase(), cb)
            }
        }
        else if (name.startsWith('on') && name.toLowerCase() in window) {
            element.addEventListener(name.toLowerCase().substring(2), value)
        }
        else if (name === "class" && Array.isArray(value)) {
            if (value.length > 0)
                sa(name, value.join(" "))
        }
        else if (name === "data") {
            for (const [dataName, dataValue] of Object.entries(value)) {
                element.dataset[dataName] = dataValue
            }
        }
        else if (name === "style") {
            const t = typeof (value)
            if (t === "string") { }
            else if (Array.isArray(value))
                value = value.map(i => i.replace(/;*$/, ";")).join("")
            else if (t === "object")
                value = Object.entries(value).map(([k, v]) => `${k}: ${v};`).join("")
            else
                value = value.toString()
            sa(name, value)
        }
        else
            sa(name, value.toString())
    }

    for (const c of (children || [])) {
        if (typeof c === "string")
            el.appendChild(document.createTextNode(c))
        else
            el.appendChild(c)
    }

    return el
}

function pageCompositorTable(targetContainer, data) {
    const compCount = data.compositors.length

    const root = e("div",
        { class: "comp-table", style: { "--cols": compCount + 1 } },
        [e("div", { class: "comp-table-dummy" })]
    )

    for (const c of data.compositors) {
        root.appendChild(e("div", { class: "comp-table-name" }, [
            c.icon == null
                ? e("div", { class: ["comp-icon", "comp-icon-dummy"] })
                : e("img", { class: ["comp-icon", "comp-icon-img"], src: `./logos/${c.icon}.svg` }),
            e("div", { class: "comp-table-name-text" }, [c.name]),
        ]))
    }

    for (const p of data.protocols) {
        root.appendChild(
            e("div", { class: "comp-table-desc" }, [
                e("a", { href: `https://wayland.app/protocols/${p.id}`, target: "_blank" }, [p.name])
            ])
        )
        for (const c of data.compositors) {
            const support = p.supportSum[c.id] ?? "none"
            const [cellClass, cellText] =
                support === "full"
                    ? ["comp-table-cell-full", "+"]
                    : support === "partial"
                        ? ["comp-table-cell-part", "~"]
                        : support === "none"
                            ? ["comp-table-cell-no", "X"]
                            : ["", "?"]
            root.appendChild(
                e("div", { class: "comp-table-cell" }, [
                    e("div", { class: ["comp-table-cell-content", cellClass], title: c.name }, [cellText])
                ])
            )
        }
    }

    targetContainer.innerHTML = ""
    targetContainer.appendChild(root)
}

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("content")
    const dataResp = await fetch("./data.json")
    const data = await dataResp.json()
    pageCompositorTable(container, data)
})
