
// === Utils ===

function childrenAppend(target, elements_) {
    for (const c of (elements_ || [])) {
        if (c == null || c === false)
            continue
        if (Array.isArray(c))
            childrenAppend(target, c)
        else if (typeof c === "string")
            target.appendChild(document.createTextNode(c))
        else
            target.appendChild(c)
    }
}

function attributesSet(target, attrs) {
    const el = target
    const sa = (name, value) => el.setAttribute(name, value)

    for (let [name, value] of Object.entries(attrs || {})) {
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
                sa(name, value.filter((c) => c != null).join(" "))
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
}

function e(elementName, opts, children) {
    const el = document.createElement(elementName)
    attributesSet(el, opts)
    childrenAppend(el, children)
    return el
}

const createMaterialIcons = () => ({
    baseUrl: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200",
    usedIcons: new Set(),
    getIconLazy(name) {
        this.usedIcons.add(name)
        return () => e("span", { class: "material-symbols-outlined" }, [name])
    },
    initIcons() {
        if (this.usedIcons.size == 0)
            return
        const icons = this.usedIcons.values()
            .toArray().sort().join(",")
        const url = new URL(this.baseUrl)
        url.searchParams.set("icon_names", icons)
        document.querySelector("head").appendChild(
            e("link", { rel: "stylesheet", href: url.toString() })
        )
    },
})

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

function stateToggleBool(map, key, force, default_) {
    const newState = force != null ? force : !(map.get(key) ?? default_)
    map.set(key, newState)
    return newState
}

function stateAdd(map, key, value, default_) {
    default_ ??= 0
    const oldValue = map.get(key)
    const newValue = (oldValue ?? default_) + value
    map.set(key, newValue)
    return newValue
}

// === Defs ===

const SUPPORT_FULL = "full"
const SUPPORT_PARTIAL = "partial"
const SUPPORT_NONE = "none"

const KEY_EXPAND_INTERFACES = "interfaces"
const KEY_EXPAND_FULLDESC = "fulldesc"
const KEY_EXPAND_FILTERS = "filters"

const SYNC_DUE_TO_MOUSEMOVE = 1

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
    deprecated: ["rgb(252, 236, 231)", "rgb(157, 61, 23)", ["striped-bg", "comp-table-tag-deprecated"]],

    __default: ["rgb(244 244 245)", "rgb(39 39 42)"]
}


function isProtocolPrivate(proto) {
    return proto.tags.source != "wayland" && proto.countSupportSumAny <= 1
}

function renderPageCompositorTable(targetContainer, data) {
    const compCount = data.compositors.length

    // === Page state ===

    const expandDefaultState = {
        [KEY_EXPAND_INTERFACES]: false,
        [KEY_EXPAND_FULLDESC]: false,
        [KEY_EXPAND_FILTERS]: false,
    }

    const materialIcons = createMaterialIcons()

    let initHeaderWidthSet = false

    let highlightColumn = null
    let highlightRow = null
    let highlightSourceCellMetadata = null

    let compFilter = null
    let compFilterInvert = false

    const expandState = new Map()
    const expandAllIsChanged = new Map()

    const filterOpts = {}

    function expandRowStateToggle(type, protoId) {
        return stateToggleBool(expandState, stateKey(type, protoId), null, expandDefaultState[type])
    }

    function isCompFiltered(compId) {
        return compFilter != null && compFilter === compId
    }

    function compFilterStateSetToggle(compId) {
        if (isCompFiltered(compId)) {
            if (!compFilterInvert)
                compFilterInvert = true
            else
                compFilter = null
        }
        else {
            compFilter = compId
            compFilterInvert = false
        }
    }

    function getCompositorSupport(compId, proto, interface) {
        return interface == null
            ? proto.supportSum[compId] ?? SUPPORT_NONE
            : proto.supportIf[interface]?.[compId]
                ? SUPPORT_FULL : SUPPORT_NONE
    }

    function getRowKey(m) {
        if (m?.proto == null)
            return null
        return `${m.proto.id};${m.interface ?? ""}`
    }

    function updateHeadSupportIndicator(inidicator, support) {
        const style = inidicator.style
        const target = "--color"
        if (support != null)
            style.setProperty(target, `var(--cell-support-${support}-bg)`)
        else
            style.removeProperty(target)
    }

    // === Adjust header widths ===

    function setFixWidthVar(name, sel) {
        if (typeof sel === "string")
            sel = table.querySelector(sel)
        const width = sel.clientWidth
        tableFix.style.setProperty(name, width + "px")
        return width
    }

    function updateFixedHeaderPosition() {
        tableFixOuter.style['left'] = table.getBoundingClientRect().x + "px"
    }

    function updateHeaderWidth() {
        const dummyWidth = setFixWidthVar("--dummy-w", ".comp-table-dummy")
        setFixWidthVar("--head-w", ".comp-table-name")
        if (!initHeaderWidthSet) {
            table.querySelector(".comp-table-dummy").style["width"] = dummyWidth + "px"
            table.style['width'] = "min-content"
            initHeaderWidthSet = true
        }
        updateFixedHeaderPosition()
    }


    // === State sync ===

    const dynState = new WeakMap()
    const dynElements = new Set()

    function dynRegister(element, metadata) {
        dynState.set(element, metadata)
        dynElements.add(new WeakRef(element))
        return element
    }

    function dynRegisterAll(elements, metadata) {
        const iterElements =
            elements[Symbol.iterator] == null
                ? Object.values(elements) : elements
        for (const el of iterElements)
            dynRegister(el, { ...metadata })
        return elements
    }

    const syncState = (() => {

        function createSupportPercentStore() {
            const init = () => ({
                supportPercentIndicators: new Map(),
                supportCount: new Map(),
                supportTotal: 0,
            })

            return {
                state: init(),
                countAdd(compId, value) {
                    stateAdd(this.state.supportCount, compId, value)
                },
                countGet(compId) {
                    return this.state.supportCount.get(compId)
                },
                totalInc() {
                    this.state.supportTotal += 1
                },
                indicatorAssociate(compId, element) {
                    this.state.supportPercentIndicators.set(compId, element)
                },
                exportAndReset() {
                    const state = this.state
                    this.state = init()
                    const total = state.supportTotal
                    if (total === 0)
                        return []
                    return state.supportPercentIndicators.entries().map(([compId, indicator]) => {
                        const count = state.supportCount.get(compId)
                        return { compId, indicator, count, value: count / total }
                    })
                }
            }
        }

        const hoverColumnClass = "comp-table-cell-hover"
        const hoverRowClass = "comp-table-row-hover"
        const headSelectedClass = "comp-table-name-selected"
        const headSelectedInvClass = "comp-table-name-selected-inv"
        const descButtonActiveClass = "comp-table-db-active"

        let lastHighlight = {}

        const supportPercentStore = createSupportPercentStore()

        function changeVisibility(el, m, visible) {
            if (m.visible === visible)
                return
            visible = visible ?? false
            setDisplay(el, visible)
            m.visible = visible
        }

        function expandGetState(expandType, ...keys) {
            const key = stateKey(expandType, ...keys)
            if (expandAllIsChanged.get(expandType)) {
                expandState.delete(key)
                return expandDefaultState[expandType]
            }
            return expandState.get(key) ?? expandDefaultState[expandType]
        }

        function expandRowGetState(expandType, m) {
            return expandGetState(expandType, m.proto.id)
        }

        function isExcludedBySupportFilter(m) {
            let supportExclude = false
            if (compFilter != null) {
                const supportComp =
                    getCompositorSupport(compFilter, m.proto, m.interface)
                if (compFilterInvert)
                    supportExclude = supportComp === SUPPORT_FULL
                else
                    supportExclude = supportComp === SUPPORT_NONE
            }
            return supportExclude
        }

        function protoHide(shouldHide, m) {
            if (m.interface != null) {
                shouldHide = shouldHide
                    || !expandRowGetState(KEY_EXPAND_INTERFACES, m)
            }

            const supportExclude = isExcludedBySupportFilter(m)
            shouldHide = shouldHide || supportExclude

            if (
                !supportExclude && m.interface != null
                && (!filterOpts.excludePrivate || !isProtocolPrivate(m.proto))
            ) {
                if (m.type == "data") {
                    const compId = m.comp.id
                    const supportCell = getCompositorSupport(compId, m.proto, m.interface)
                    supportPercentStore.countAdd(compId,
                        supportCell === SUPPORT_FULL
                            ? 1
                            : supportCell === SUPPORT_PARTIAL ? 0.5 : 0
                    )
                }
                else if (m.type === "row") {
                    supportPercentStore.totalInc()
                }
            }

            return shouldHide
        }

        function mouseMoveCell(el, m) {
            if (lastHighlight.col != highlightColumn)
                el.classList.toggle(hoverColumnClass, m.comp == null ? false : highlightColumn == m.comp.id)
            if (lastHighlight.row != highlightRow)
                el.classList.toggle(hoverRowClass, highlightRow == getRowKey(m))
        }

        function mouseMoveHeaderSupportInd(el, m) {
            const hlM = highlightSourceCellMetadata
            const support = highlightRow != null && hlM.proto
                ? getCompositorSupport(m.comp.id, hlM.proto, hlM.interface)
                : null
            updateHeadSupportIndicator(el, support)
        }

        return (dueTo) => {
            let rowVisibilityChanged = false

            if (!dueTo)
                highlightColumn = null

            for (const elWeak of dynElements.values()) {
                const el = elWeak.deref()
                const m = dynState.get(el)
                if (el === undefined || m === undefined) {
                    dynElements.delete(elWeak)
                    continue
                }

                if (dueTo == SYNC_DUE_TO_MOUSEMOVE) {
                    if (m.type === "headHoverSupport")
                        mouseMoveHeaderSupportInd(el, m)
                    if (m.visible && (m.type === "data" || m.type === "row"))
                        mouseMoveCell(el, m)
                    continue
                }

                if (m.type === "data") {
                    let shouldHide = protoHide(false, m)
                    changeVisibility(el, m, !shouldHide)
                    mouseMoveCell(el, m)
                }
                else if (m.type === "row") {
                    let shouldHide = protoHide(false, m)
                    changeVisibility(el, m, !shouldHide)
                    rowVisibilityChanged = true  // actually detect if changed?
                    mouseMoveCell(el, m)
                }
                else if (m.type === "head") {
                    const cl = el.classList
                    if (isCompFiltered(m.comp.id)) {
                        cl.add(headSelectedClass)
                        cl.toggle(headSelectedInvClass, compFilterInvert)
                    }
                    else {
                        cl.remove(headSelectedClass, headSelectedInvClass)
                    }

                }
                else if (m.type === "descButton") {
                    const active = expandRowGetState(m.buttonType, m)
                    if (active !== m.active) {
                        m.active = active
                        el.classList.toggle(descButtonActiveClass, active)
                    }
                }
                else if (m.type === "supportPercent") {
                    supportPercentStore.indicatorAssociate(m.comp.id, el)
                }
                else if (m.type === "descFull") {
                    let shouldHide = !expandRowGetState(KEY_EXPAND_FULLDESC, m)
                    shouldHide = shouldHide || isExcludedBySupportFilter(m)
                    changeVisibility(el, m, !shouldHide)
                }
                else if (m.type === "headHoverSupport") {
                    mouseMoveHeaderSupportInd(el, m)
                }
                else if (m.type === "filterWindow") {
                    changeVisibility(el, m, expandGetState(KEY_EXPAND_FILTERS))
                }
            }

            lastHighlight.col = highlightColumn
            lastHighlight.row = highlightRow
            expandAllIsChanged.clear()

            for (const { indicator, value } of supportPercentStore.exportAndReset()) {
                indicator.querySelector(".i-value").innerText = Math.round(value * 100) + "%"
                indicator.querySelector(".i-bg").style.setProperty("--prc", value)
            }

            if (!dueTo)
                updateHeaderWidth()

            if (rowVisibilityChanged) {
                setTimeout(async () => {
                    const cells =
                        document.querySelectorAll(":is(.comp-table-desc, .comp-table-cell)")
                    let i = 0
                    for (const cell of cells) {
                        const m = dynState.get(cell)
                        if (!m || !m.visible)
                            continue
                        if (m.type == "row" && m.interface == null)
                            i++
                        cell.classList.toggle("comp-table-even-odd", i % 2 == 0)
                    }
                }, 0)
            }
        }
    })();

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
        expandRowStateToggle(KEY_EXPAND_INTERFACES, protoId)
        syncState()
    }

    function fullDescExpandClickHandler(ev) {
        const protoId = descButtonGetProtoId(ev)
        expandRowStateToggle(KEY_EXPAND_FULLDESC, protoId)
        syncState()
    }

    function expandAllClickHandler(ev, key) {
        const shouldExpand = !expandDefaultState[key]
        expandDefaultState[key] = shouldExpand
        expandAllIsChanged.set(key, true)
        syncState()
    }

    function toggleFilterWindow(force) {
        stateToggleBool(expandState, KEY_EXPAND_FILTERS, force)
        syncState()
    }

    // === Table populate ===

    const icSupportCell = {
        [SUPPORT_FULL]: "+",
        [SUPPORT_PARTIAL]: "~",
        [SUPPORT_NONE]: "X",

        __default: "?"
    }

    const icFilters = materialIcons.getIconLazy("tune")
    const icInterfaces = materialIcons.getIconLazy("format_list_bulleted")
    const icDescription = materialIcons.getIconLazy("description")

    const filterWindow = dynRegisterAll({
        backdrop: e("div", {
            class: ["comp-table-filter", "m-backdrop"],
            onClick: () => toggleFilterWindow(false),
        }, []),
        wnd: e("div", { class: ["comp-table-filter", "m-wnd"] }, [
            e("label", {}, [
                e("input", {
                    type: "checkbox",
                    onChange: (ev) => {
                        filterOpts.excludePrivate = ev.currentTarget.checked
                        syncState()
                    }
                }),
                "Exclude compositor‑specific protocols from the percentage calculation"
            ]),
        ]),
    }, { type: "filterWindow" })

    function getTableFirstCell(opts) {
        return e("div", { class: "comp-table-dummy" }, [
            e("div", { class: ["comp-table-tag-box"] }, [
                !opts?.fixedHeader ? [
                    filterWindow.wnd,
                    e("div", {
                        class: ["comp-table-db"],
                        onClick: toggleFilterWindow,
                    }, [icFilters(), "Settings"]),
                ] : null,
                e("div", {
                    class: ["comp-table-db"],
                    onClick: (ev) => expandAllClickHandler(ev, KEY_EXPAND_INTERFACES)
                }, [(icInterfaces())]),
                e("div", {
                    class: ["comp-table-db"],
                    onClick: (ev) => expandAllClickHandler(ev, KEY_EXPAND_FULLDESC)
                }, [icDescription()]),
            ])
        ])
    }

    const tableFix = e("div",
        { class: ["comp-table", "comp-header-fix-inner"] },
        [getTableFirstCell({ fixedHeader: true })]
    )

    const table = e("div",
        { class: ["comp-table", "comp-table-main"] },
        [filterWindow.backdrop, getTableFirstCell()]
    )

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
                    dynRegister(
                        e("div", { class: "i-support-indicator" }),
                        { type: "headHoverSupport", comp: c }
                    ),
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

    for (const c of data.compositors) {
        /* Setup support percentages */
        table.appendChild(
            dynRegister(
                e("div", {
                    class: ["comp-table-cell", "comp-table-cell-prc", "comp-table-cell-no-border"],
                }, [
                    e("div", {
                        class: ["comp-table-cell-prc-content"],
                    }, [
                        e("div", { class: ["i-value"] }, ["?"]),
                        e("div", { class: ["i-bg", "comp-table-cell-prc-bg"] }),
                    ]),
                ]),
                { type: "supportPercent", comp: c }
            )
        )
    }

    for (const p of data.protocols) {
        /* Setup protocol row titles */

        const tags = ['source', 'deprecated', 'stability']
            .map((t) => p.tags[t])
            .filter((t) => t != null)
            .map((t) => {
                const [bg, fg, classes] = tagColors[t] ?? tagColors.__default
                return e("div", {
                    class: ["comp-table-tag", ...(classes ?? [])],
                    style: { "--tag-bg": bg, "--tag-fg": fg }
                }, [t])
            })

        const descCell = e("div", { class: "comp-table-desc", data: { proto: p.id } }, [
            e("div", { class: "comp-table-desc-name", data: { proto: p.id } }, [
                e("a", { href: `https://wayland.app/protocols/${p.id}`, target: "_blank" }, [p.name]),
            ]),
            e("div", { class: "comp-table-desc-id" }, [p.id]),
            e("div", { class: ["comp-table-tag-box", "m-outer"] }, [
                ...tags,
                e("div", { class: ["comp-table-tag-box"], style: "margin-left: auto;" }, [
                    dynRegister(
                        e("div", {
                            class: ["comp-table-db", "comp-db-interfaces"],
                            onClick: interfacesExpandClickHandler
                        }, [icInterfaces()]),
                        { type: "descButton", buttonType: KEY_EXPAND_INTERFACES, proto: p }
                    ),
                    dynRegister(
                        e("div", {
                            class: ["comp-table-db", "comp-db-description"],
                            onClick: fullDescExpandClickHandler
                        }, [icDescription()]),
                        { type: "descButton", buttonType: KEY_EXPAND_FULLDESC, proto: p }
                    ),
                ]),
            ]),
        ])
        table.appendChild(descCell)
        dynRegister(descCell, { type: "row", proto: p })

        function createDataCell(c, opts) {
            const interface = opts?.interface

            const support =
                getCompositorSupport(c.id, p, interface)

            const cellContentClass = `comp-table-cell-support-${support}`
            const cellText = icSupportCell[support] ?? icSupportCell.__default

            const cellClasses = ["comp-table-cell", "comp-table-cell-data"]
            const cellContentClasses = ["comp-table-cell-content", cellContentClass]
            if (interface != null) {
                cellClasses.push("comp-table-interface")
                cellContentClasses.push("comp-table-cell-interface-content")
            }

            const cell = e("div", { class: cellClasses, data: { comp: c.id } }, [
                e("div", { class: cellContentClasses, title: c.name }, [cellText])
            ])

            table.appendChild(cell)
            dynRegister(cell, { type: "data", comp: c, proto: p, interface })
        }

        for (const c of data.compositors) {
            /* Setup data cells (summary) */
            createDataCell(c)
        }

        function getDescriptionTextElements(d) {
            const elements = []

            function addTitle(title, class_) {
                if (title == null)
                    return
                elements.push(e(`h${title.level ?? 1}`, {
                    class: ["i-heading", title.mono ? "m-mono" : null, class_]
                }, [title.text]))
            }

            addTitle(d.title)
            addTitle(d.subTitle, "m-sub")

            elements.push(e("div", {
                class: ["i-text", d.textOpts?.secondary ? "m-sec" : null]
            }, [d.text]),)

            return elements
        }

        if (p.descFull != null) {
            const fullDescCell = dynRegister(
                e("div", { class: ["comp-table-cell", "comp-table-fulldesc"] }, [
                    e("div", { class: ["i-wrapper"] }, [
                        p.descFull.flatMap((d) => getDescriptionTextElements(d))
                    ])
                ]),
                { type: "descFull", proto: p }
            )
            table.appendChild(fullDescCell)
        }

        const interfacesToShow = []
        const hasAnyDeprecations = p.deprecations != null
        let hasVisibleDeprecations = false

        for (const interfaceId of Object.keys(p.supportIf)) {
            const data = { id: interfaceId }
            const interfaceDeprecation = p.deprecations?.[interfaceId]
            if (interfaceDeprecation) {
                hasVisibleDeprecations = true
                data.deprecated = interfaceDeprecation
            }
            interfacesToShow.push(data)
        }

        if (interfacesToShow.length == 0 && hasAnyDeprecations) {
            for (const [interfaceId, reason] of Object.entries(p.deprecations)) {
                const data = { id: interfaceId, deprecated: reason }
                interfacesToShow.push(data)
            }
        }

        for (const interface of interfacesToShow) {
            /* Setup interface row titles */
            const interfaceId = interface.id

            const intetfaceCell = e("div", { class: ["comp-table-desc", "comp-table-interface"] }, [
                e("div", { class: ["comp-table-desc-name", "comp-table-desc-name-interface"] }, [
                    interfaceId.replace(/_/g, "\u200b_"),
                ]),
                interface.deprecated
                    ? e("div", { class: ["comp-table-interface-deprecation"] }, [
                        e("b", {}, ["Deprecated: "]),
                        e("span", {}, [interface.deprecated])
                    ])
                    : null,
            ])
            table.appendChild(intetfaceCell)
            dynRegister(intetfaceCell, { type: "row", proto: p, interface: interfaceId })

            for (const c of data.compositors) {
                /* Setup data cells (interfaces) */
                createDataCell(c, { interface: interfaceId })
            }
        }

        if ((hasVisibleDeprecations && !p.deprecatedFull) || p.defaultExpand)
            expandState.set(stateKey(KEY_EXPAND_INTERFACES, p.id), true)
    }

    // === Root elements ===

    const tableFixOuter = e("div",
        { class: ["comp-header-fix"] },
        [tableFix]
    )

    const root = e("div",
        { class: "comp-table-root", style: { "--cols": compCount + 1 } },
        [tableFixOuter, table]
    )

    // === Setup hover handling ===

    function mouseMoveHandlerSet(...elements) {
        let lastHoverElement = null
        let lastCursorPos = null

        function highlightHandler(cursorX, cursorY) {
            const hoverElement = document.elementFromPoint(cursorX, cursorY)
            const targetElement = findParent(hoverElement, ":is(.comp-table-cell, .comp-table-desc)")

            if (targetElement == null) {
                const hadLast = lastHoverElement != null
                lastHoverElement = null
                highlightColumn = null
                highlightRow = null
                if (hadLast)
                    syncState(SYNC_DUE_TO_MOUSEMOVE)
            }
            else if (lastHoverElement == null || lastHoverElement.deref() != targetElement) {
                const m = dynState.get(targetElement)
                highlightColumn = m?.comp?.id ?? null
                highlightRow = getRowKey(m)
                highlightSourceCellMetadata = m
                if (targetElement != null)
                    lastHoverElement = new WeakRef(targetElement)
                syncState(SYNC_DUE_TO_MOUSEMOVE)
            }
        }

        function mouseMovementHighlightHandler(ev) {
            lastCursorPos = [ev.clientX, ev.clientY]
            highlightHandler(ev.clientX, ev.clientY)
        }

        function scrollHighlightHandler(ev) {
            if (lastCursorPos == null)
                return
            const [x, y] = lastCursorPos
            highlightHandler(x, y)
        }

        elements.forEach((el) => {
            if (el != null)
                el.addEventListener("mousemove", mouseMovementHighlightHandler)
        })

        document.addEventListener("scroll", scrollHighlightHandler)
    }

    mouseMoveHandlerSet(
        table,
        root,
        targetContainer,
        document.querySelector("body")
    )

    // === Setup fixed header scroll handling ===

    const fixStyle = tableFixOuter.style

    function fixedHeaderVisibilityCallback() {
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

    document.addEventListener("scroll", fixedHeaderVisibilityCallback)
    fixedHeaderVisibilityCallback()

    window.addEventListener("resize", updateHeaderWidth)
    document.addEventListener("scroll", updateFixedHeaderPosition)

    // === Populate page ===

    targetContainer.innerHTML = ""
    targetContainer.appendChild(root)

    materialIcons.initIcons()
    syncState()
}

(() => {
    const boot = () => setTimeout(async () => {
        // === Setup page ===

        const container = document.getElementById("content")
        const statusText = document.getElementById("loading-status")
        const setStatus = (text) => { if (statusText) statusText.innerText = text }

        setStatus("Downloading data.json...")
        const dataResp = await fetch("./data.json")
        const data = await dataResp.json()

        setStatus("Rendering page...")
        renderPageCompositorTable(container, data)
    }, 0)

    switch (document.readyState) {
        case "complete":
        case "interactive":
        case "loaded":
            boot()
            break
        default:
            document.addEventListener("DOMContentLoaded", boot)
    }
})();
