
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

function stateKey(...keys) {
    return keys.join(":")
}

function stateToggleBool(map, key, default_) {
    const newState = !(map.get(key) ?? default_)
    map.set(key, newState)
    return newState
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

const KEY_EXPAND_INTERFACES = "interfaces"

const SYNC_DUE_TO_MOUSEMOVE = 1

function pageCompositorTable(targetContainer, data) {
    const compCount = data.compositors.length
    const expandDefaultState = {
        [KEY_EXPAND_INTERFACES]: false,
    }

    // === Page state ===

    let columnHighlightComp = null
    let compFilter = null
    const rowExpandState = new Map()

    function expandStateToggle(type, protoId) {
        return stateToggleBool(rowExpandState, stateKey(type, protoId), expandDefaultState[type])
    }

    function isCompFiltered(compId) {
        return compFilter != null && compFilter === compId
    }

    function compFilterStateSetToggle(compId) {
        if (isCompFiltered(compId))
            compFilter = null
        else
            compFilter = compId
    }

    // === State sync ===

    const dynState = new WeakMap()
    const dynElements = new Set()

    function dynRegister(element, metadata) {
        dynState.set(element, metadata)
        dynElements.add(new WeakRef(element))
        return element
    }

    const syncState = (() => {
        const hoverClass = "comp-table-cell-hover"
        const headSelectedClass = "comp-table-name-selected"
        const descButtonActiveClass = "comp-table-db-active"

        let lastHighlightComp = null

        function changeVisibility(el, m, visible) {
            if (m.visible === visible)
                return
            visible = visible ?? false
            setDisplay(el, visible)
            m.visible = visible
        }

        function expandGetState(expandType, m) {
            return rowExpandState.get(stateKey(expandType, m.proto.id)) ?? expandDefaultState[expandType]
        }

        function protoHide(shouldHide, m) {
            if (m.interface != null) {
                shouldHide = shouldHide
                    || !expandGetState(KEY_EXPAND_INTERFACES, m)
            }

            if (!shouldHide && compFilter != null) {
                const support =
                    m.interface == null
                        ? m.proto.supportSum[compFilter]
                        : m.proto.supportIf[m.interface][compFilter]
                shouldHide = !(support != null && support !== SUPPORT_NONE)
            }

            return shouldHide
        }

        function mouseMoveData(el, m) {
            if (m.visible) {
                if (lastHighlightComp != columnHighlightComp)
                    el.classList.toggle(hoverClass, columnHighlightComp == m.comp.id)
            }
        }

        return (dueTo) => {
            for (const elWeak of dynElements.values()) {
                const el = elWeak.deref()
                const m = dynState.get(el)
                if (el === undefined || m === undefined) {
                    dynElements.delete(elWeak)
                    continue
                }

                if (dueTo == SYNC_DUE_TO_MOUSEMOVE) {
                    if (m.type === "data")
                        mouseMoveData(el, m)
                    return
                }

                if (m.type === "data") {
                    shouldHide = protoHide(false, m)
                    changeVisibility(el, m, !shouldHide)
                    mouseMoveData(el, m)
                }
                else if (m.type === "row") {
                    shouldHide = protoHide(false, m)
                    changeVisibility(el, m, !shouldHide)
                }
                else if (m.type === "head") {
                    el.classList.toggle(headSelectedClass, isCompFiltered(m.comp.id))
                }
                else if (m.type === "descButton") {
                    const active = expandGetState(m.buttonType, m)
                    if (active !== m.active) {
                        m.active = active
                        el.classList.toggle(descButtonActiveClass, active)
                    }
                }
            }

            lastHighlightComp = columnHighlightComp
        }
    })();

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
        const targetHeadCell = ev.currentTarget
        const targetComp = targetHeadCell.dataset.comp
        compFilterStateSetToggle(targetComp)
        syncState()
    }

    function descButtonGetProtoId(ev) {
        const button = ev.currentTarget
        const descCell = findParent(button, ".comp-table-desc")
        return descCell.dataset.proto
    }

    function interfacesExpandClickHandler(ev) {
        const protoId = descButtonGetProtoId(ev)
        expandStateToggle(KEY_EXPAND_INTERFACES, protoId)
        syncState()
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
            dynRegister(headCell, { type: "head", comp: c })
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
                dynRegister(
                    e("div", {
                        class: ["comp-table-db", "comp-db-interfaces"],
                        onClick: interfacesExpandClickHandler
                    }, ["I"]),
                    { type: "descButton", buttonType: KEY_EXPAND_INTERFACES, proto: p }
                ),
                e("div", {
                    class: ["comp-table-db", "comp-db-description"]
                }, ["D"]),
                ...tags,
            ]),
        ])
        table.appendChild(descCell)
        dynRegister(descCell, { type: "row", proto: p })

        function createDataCell(c, opts) {
            const interface = opts?.interface
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

            const cellClasses = ["comp-table-cell-content", cellClass]
            if (!isSummary)
                cellClasses.push("comp-table-cell-interface")
            const cell = e("div", { class: ["comp-table-cell", "comp-table-cell-data"], data: { comp: c.id } }, [
                e("div", { class: cellClasses, title: c.name }, [cellText])
            ])

            table.appendChild(cell)
            dynRegister(cell, { type: "data", comp: c, proto: p, interface })
        }

        for (const c of data.compositors) {
            /* Setup data cells (summary) */
            createDataCell(c)
        }

        for (const interfaceId of Object.keys(p.supportIf)) {
            /* Setup interface row titles */
            const intetfaceCell = e("div", { class: ["comp-table-desc", "comp-table-desc-interface"] }, [
                e("div", { class: ["comp-table-desc-name", "comp-table-desc-name-interface"] }, [interfaceId]),
            ])
            table.appendChild(intetfaceCell)
            dynRegister(intetfaceCell, { type: "row", proto: p, interface: interfaceId })

            for (const c of data.compositors) {
                /* Setup data cells (interfaces) */
                createDataCell(c, { interface: interfaceId })
            }
        }

        if (p.defaultExpand)
            rowExpandState.set(stateKey(KEY_EXPAND_INTERFACES, p.id), true)
    }

    // === Setup hover handling ===

    function mouseMoveHandlerSet(...elements) {
        function mouseMovementHandler(ev) {
            const hoverElement = document.elementFromPoint(ev.clientX, ev.clientY)
            const targetElement = findParent(hoverElement, ".comp-table-cell")
            const compId = targetElement?.dataset?.comp ?? null
            if (compId != columnHighlightComp) {
                columnHighlightComp = compId
                syncState()
            }
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

    syncState()
}

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("content")
    const dataResp = await fetch("./data.json")
    const data = await dataResp.json()
    pageCompositorTable(container, data)
})
