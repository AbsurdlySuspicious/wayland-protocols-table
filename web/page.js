
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

function pageCompositorTable(targetContainer, data) {
    const compCount = data.compositors.length
    const columnCellsByComp = {}
    const allColumnCells = []
    const rowCellsSupportedByComp = {}
    const allRowCells = []
    const headerCellsByComp = {}

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

    function filterByCompClickHandler(ev) {
        const headSelectedClass = "comp-table-name-selected"
        allRowCells.forEach((cell) => {
            cell.style["display"] = "none"
        })
        document.querySelectorAll(".comp-table-name").forEach((headCell) => {
            headCell.classList.remove(headSelectedClass)
        })

        const targetComp = ev.currentTarget.dataset.comp
        const compRows = rowCellsSupportedByComp[targetComp]
        if (compRows == null)
            return
        compRows.forEach((row) => {
            row.forEach((cell) => cell.style.removeProperty("display"))
        })
        headerCellsByComp[targetComp].forEach((headCell) => {
            headCell.classList.add(headSelectedClass)
        })
    }

    for (const c of data.compositors) {
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
                ; (headerCellsByComp[c.id] ??= []).push(headCell)
            return headCell
        }
        table.appendChild(headerCell())
        tableFix.appendChild(headerCell())
    }

    table.appendChild(
        e("div", { class: "comp-table-dummy" })
    )
    for (const c of data.compositors) {
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
        const tags = p.tags.map((t) => {
            const [bg, fg] = tagColors[t] ?? tagColors.__default
            return e("div", { class: ["comp-table-tag"], style: { "--tag-bg": bg, "--tag-fg": fg } }, [t])
        })
        const descCell = e("div", { class: "comp-table-desc" }, [
            e("div", { class: "comp-table-desc-name" }, [
                e("a", { href: `https://wayland.app/protocols/${p.id}`, target: "_blank" }, [p.name]),
            ]),
            e("div", { class: ["comp-table-tag-box"] }, tags),
        ])
        table.appendChild(descCell)
        allRowCells.push(descCell)
        const currentProtoCells = [descCell]

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
            const cell = e("div", { class: "comp-table-cell", data: { comp: c.id } }, [
                e("div", { class: ["comp-table-cell-content", cellClass], title: c.name }, [cellText])
            ])
            if (support != "none") {
                (rowCellsSupportedByComp[c.id] ??= []).push(currentProtoCells)
            }
            allColumnCells.push(cell)
            allRowCells.push(cell)
            currentProtoCells.push(cell)
                ; (columnCellsByComp[c.id] ??= []).push(cell)
            table.appendChild(cell)
        }
    }

    function mouseMoveHandler(ev) {
        const hoverClass = "comp-table-cell-hover"
        allColumnCells.forEach((cell) => cell.classList.remove(hoverClass))

        const hoverElement = document.elementFromPoint(ev.clientX, ev.clientY)
        const targetElement = findParent(hoverElement, ".comp-table-cell")
        if (targetElement == null)
            return

        const column = columnCellsByComp[targetElement.dataset.comp]
        if (!column)
            return

        column.forEach((cell) => cell.classList.add(hoverClass))
    }

    function mouseMoveSet(...elements) {
        elements.forEach((el) => {
            if (el != null)
                el.addEventListener("mousemove", mouseMoveHandler)
        })
    }

    mouseMoveSet(
        table,
        root,
        targetContainer,
        document.querySelector("body")
    )

    targetContainer.innerHTML = ""
    targetContainer.appendChild(root)

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
