
// === Utils ===

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
                el.addEventListener(event.toLocaleLowerCase(), cb)
            }
        }
        else if (name.startsWith('on') && name.toLowerCase() in window) {
            el.addEventListener(name.toLowerCase().substring(2), value)
        }
        else if (name === "class" && Array.isArray(value)) {
            if (value.length > 0)
                sa(name, value.join(" "))
        }
        else if (name === "data") {
            for (const [dataName, dataValue] of Object.entries(value)) {
                el.dataset[dataName] = dataValue
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

function findParent(child, selector, opts) {
    let skipParents = opts?.skip ?? 0
    while (child != null && (skipParents > 0 || !child.matches(selector))) {
        if (skipParents > 0)
            skipParents--
        child = child.parentElement
    }
    return child ?? null
}

function setDisplay(el, visible) {
    if (visible)
        el.style.removeProperty("display")
    else
        el.style["display"] = "none"
}

// === Defs ===

const tagColors = {
    core: ["rgb(220 252 231)", "rgb(22 101 52)"],
    wayland: ["rgb(219 234 254)", "rgb(30 64 175)"],
    wlr: ["rgb(254 226 226)", "rgb(153 27 27)"],
    kde: ["rgb(243 232 255)", "rgb(107 33 168)"],
    hyprland: ["rgb(224 242 254)", "rgb(7 89 133)"],
    cosmic: ["rgb(254 226 226)", "rgb(146 64 14)"],
    weston: ["rgb(254 249 195)", "rgb(133 77 14)"],
    treeland: ["rgb(207 250 254)", "rgb(21 94 117)"],
    external: ["rgb(244 244 245)", "rgb(39 39 42)"],

    stable: ["rgb(220 252 231)", "rgb(22 101 52)"],
    staging: ["rgb(254 226 226)", "rgb(153 27 27)"],
    unstable: ["rgb(252 231 243)", "rgb(157 23 77)"],

    __default: ["rgb(244 244 245)", "rgb(39 39 42)"],
}

const SUPPORT_FULL = "full"
const SUPPORT_PARTIAL = "partial"
const SUPPORT_NONE = "none"

function pageCompositorTable(targetContainer, data) {
    const compCount = data.compositors.length

    // === State sync ===

    

    // === Root elements ===

    const tableFix = e("div",
        { class: ["comp-table", "comp-header-fix-inner"] },
        [e("div", { class: "comp-table-dummy" })]
    )

    const tableFixOuter = e("div",
        { class: ["comp-header-fix"] },
        [tableFix]
    )

    const table = e("div",
        { class: "comp-table" },
        [e("div", { class: "comp-table-dummy" })]
    )

    const bottomPaddingBlock = e("div",
        { class: "comp-table-bottom-pad" }
    )

    const root = e("div",
        { class: "comp-table-root", style: { "--cols": compCount + 1 } },
        [tableFixOuter, table, bottomPaddingBlock]
    )

    // === Table handlers ===

    function filterByCompClickHandler(ev) {
        const headSelectedClass = "comp-table-name-selected"

        const targetHeadCell = ev.currentTarget
        const targetComp = targetHeadCell.dataset.comp
        const clear = targetHeadCell.classList.contains(headSelectedClass)

        for (const [headCell, meta] of lookupCellsWithData("type", "head")) {
            headCell.classList.toggle(headSelectedClass, !clear && meta.comp.id == targetComp)
        }
        for (const [rowCell, meta] of lookupCellsWithData("type", "row")) {
            const show = clear || meta.compSupport.has(targetComp)
            setDisplay(rowCell, show)
            lookupCells("data-proto", meta.proto.id).forEach((dataCell) => {
                setDisplay(dataCell, show)
            })
        }
    }

    function descButtonStateGetSet(type, protoId, opts) {
        const isExpandedKey = `${type}:${protoId}`
        let isExpanded = isExpandedMap.get(isExpandedKey) ?? null
        const wasExpanded = isExpanded
        if (opts?.set != null)
            isExpanded = opts.set
        if (opts?.toggle)
            isExpanded = !isExpanded
        if (isExpanded !== wasExpanded) {
            isExpandedMap.set(isExpandedKey, isExpanded)
            for (const rowCell of lookupCells("row-proto", protoId)) {
                const button = rowCell.querySelector(`.comp-db-${type}`)
                button?.classList?.toggle("comp-table-db-active", isExpanded)
            }
        }
        return [wasExpanded, isExpanded]
    }

    function descButtonGetProtoId(ev) {
        const button = ev.currentTarget
        const descCell = findParent(button, ".comp-table-desc")
        return descCell.dataset.proto
    }

    function interfacesExpand(protoId, opts) {
        const [, expand] = descButtonStateGetSet(EXPAND_STATE_INTERFACES, protoId, opts)
        lookupCells("if-proto", protoId).forEach((cell) => setDisplay(cell, expand))
    }

    function interfacesExpandClickHandler(ev) {
        const protoId = descButtonGetProtoId(ev)
        interfacesExpand(protoId, { toggle: true })
    }

    // === Table populate ===

    for (const c of data.compositors) {
        /* Setup headings (normal & fixed/floating) */
        const headerCell = () => {
            const headCell = e("div",
                {
                    class: "comp-table-name",
                    data: { comp: c.id },
                    onClick: filterByCompClickHandler,
                },
                [
                    e("div", { class: "comp-table-name-text" }, [c.name]),
                    c.icon == null
                        ? e("div", { class: ["comp-icon", "comp-icon-dummy"] })
                        : e("img", { class: ["comp-icon", "comp-icon-img"], src: `./logos/${c.icon}.svg` }),
                ]
            )
            setCellData(headCell, { type: "head", comp: c })
            return headCell
        }
        table.appendChild(headerCell())
        tableFix.appendChild(headerCell())
    }

    table.appendChild(
        /* Additional dummy for percentages */
        e("div", { class: "comp-table-dummy" })
    )

    for (const c of data.compositors) {
        /* Setup support percentages */
        const percent = c.supportedPercent
        table.appendChild(
            e("div", {
                class: ["comp-table-cell", "comp-table-cell-no-border"],
                style: { "--prc": percent / 100 },
            }, [
                e("div", {
                    class: ["comp-table-cell-prc"],
                }, [
                    `${percent}%`,
                    e("div", { class: ["comp-table-cell-prc-bg"] }),
                ]),
            ])
        )
    }

    for (const p of data.protocols) {
        /* Setup protocol row titles */

        const tags = p.tags.map((t) => {
            const [bg, fg] = tagColors[t] ?? tagColors.__default
            return e("div", { class: ["comp-table-tag"], style: { "--tag-bg": bg, "--tag-fg": fg } }, [t])
        })
        const descCell = e("div", { class: "comp-table-desc", data: { proto: p.id } }, [
            e("div", { class: "comp-table-desc-name", data: { proto: p.id } }, [
                e("a", { href: `https://wayland.app/protocols/${p.id}`, target: "_blank" }, [p.name]),
            ]),
            e("div", { class: ["comp-table-tag-box"] }, [
                e("div", { class: ["comp-table-db", "comp-db-interfaces"], onClick: interfacesExpandClickHandler }, ["I"]),
                e("div", { class: ["comp-table-db", "comp-db-description"] }, ["D"]),
                ...tags,
            ]),
        ])
        const compSupportSum = new Set()
        table.appendChild(descCell)
        setCellData(descCell, { type: "row", proto: p, compSupport: compSupportSum  })

        function createDataCell(c, opts) {
            const interface = opts.interface
            const isSummary = interface == null

            const support =
                isSummary
                    ? p.supportSum[c.id] ?? SUPPORT_NONE
                    : p.supportIf[interface][c.id]
                        ? SUPPORT_FULL
                        : SUPPORT_NONE

            const [cellClass, cellText] =
                support === SUPPORT_FULL
                    ? ["comp-table-cell-full", "+"]
                    : support === SUPPORT_PARTIAL
                        ? ["comp-table-cell-part", "~"]
                        : support === SUPPORT_NONE
                            ? ["comp-table-cell-no", "X"]
                            : ["", "?"]

            if (opts.supportSet != null && support != SUPPORT_NONE)
                opts.supportSet.add(c.id)

            const cellClasses = ["comp-table-cell-content", cellClass]
            if (!isSummary)
                cellClasses.push("comp-table-cell-interface")
            const cell = e("div", { class: ["comp-table-cell", "comp-table-cell-data"], data: { comp: c.id } }, [
                e("div", { class: cellClasses, title: c.name }, [cellText])
            ])

            table.appendChild(cell)
            setCellData(cell, { type: "data", comp: c, proto: p, summary: isSummary })
        }

        for (const c of data.compositors) {
            /* Setup data cells (summary) */
            createDataCell(c, {supportSet: compSupportSum})
        }

        for (const interfaceId of Object.keys(p.supportIf)) {
            /* Setup interface row titles */
            const intetfaceCell = e("div", { class: ["comp-table-desc", "comp-table-desc-interface"] }, [
                e("div", { class: ["comp-table-desc-name", "comp-table-desc-name-interface"] }, [interfaceId]),
            ])
            const compSupportIf = new Set()
            table.appendChild(intetfaceCell)
            setCellData(intetfaceCell, { type: "row", proto: p, interface: interfaceId, compSupport: compSupportIf })

            for (const c of data.compositors) {
                /* Setup data cells (interfaces) */
                createDataCell(c, { interface: interfaceId, supportSet: compSupportIf })
            }
        }

        interfacesExpand(p.id, { set: p.defaultExpand })
    }

    // === Setup hover handling ===

    function mouseMoveHandlerSet(...elements) {
        const hoverClass = "comp-table-cell-hover"

        let lastCompId = ""

        function mouseMovementHandler(ev) {

            const hoverElement = document.elementFromPoint(ev.clientX, ev.clientY)
            const targetElement = findParent(hoverElement, ".comp-table-cell")
            const compId = targetElement?.dataset?.comp ?? ""

            if (lastCompId == compId)
                return
            lastCompId = compId

            const included = lookupCellSet("data-comp", compId)
            lookupCells("type", "data")
                .forEach((cell) => cell.classList.toggle(hoverClass, included.has(cell)))
        }

        elements.forEach((el) => {
            if (el != null)
                el.addEventListener("mousemove", mouseMovementHandler)
        })
    }

    mouseMoveHandlerSet(
        table,
        root,
        targetContainer,
        document.querySelector("body")
    )

    // === Populate page ===

    targetContainer.innerHTML = ""
    targetContainer.appendChild(root)

    // === Setup fixed header

    function setFixWidthVar(name, sel) {
        if (typeof sel === "string")
            sel = table.querySelector(sel)
        const width = sel.clientWidth
        tableFix.style.setProperty(name, width + "px")
        return width
    }

    setTimeout(() => {
        const dummyWidth = setFixWidthVar("--dummy-w", ".comp-table-dummy")
        setFixWidthVar("--head-w", ".comp-table-name")
        table.querySelector(".comp-table-dummy").style["width"] = dummyWidth + "px"

        const fixStyle = tableFixOuter.style

        function fixVisibilityCallback() {
            const offset = table.getBoundingClientRect().y
            const show = offset < -100
            if (show)
                fixStyle["visibility"] = "visible"
            fixStyle["opacity"] = show ? 1 : 0
        }

        tableFixOuter.addEventListener("transitionend", () => {
            const opacity = tableFixOuter.style["opacity"] ?? 0
            tableFixOuter.style["visibility"] = opacity > 0 ? "visible" : "hidden"
        })

        document.addEventListener("scroll", fixVisibilityCallback)
        fixVisibilityCallback()
    }, 0)
}

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("content")
    const dataResp = await fetch("./data.json")
    const data = await dataResp.json()
    pageCompositorTable(container, data)
})
