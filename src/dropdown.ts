import d3 = require("d3");

const dropdownLocal: d3.Local<{
    dropdownNode: HTMLElement,
    onOpen: (d: d3.Selection<HTMLElement, unknown, null, undefined>) => void,
    onClose: (d: d3.Selection<HTMLElement, unknown, null, undefined>) => void,
}> = d3.local();

function toggleDropdown() {
    const { dropdownNode, onOpen, onClose } = dropdownLocal.get(this);
    const dropdown = d3.select(dropdownNode);
    const classes = dropdownNode.classList;
    if (classes.contains("open")) {
        classes.remove("open");
        if (onClose) {
            onClose(dropdown);
        }
    } else {
        const selected = dropdown.select("input:checked + label");
        dropdown.select(".spacer")
            .style("width", selected.style("width"))
            .style("height", selected.style("height"));
        classes.add("open");
        if (onOpen) {
            onOpen(dropdown);
        }
    }
}

// Appends a dropdown to the selection, and returns a selection over the div
// for the content of the dropdown.
function makeDropdown<A extends d3.BaseType, B, C extends d3.BaseType, D>(
    selector: d3.Selection<A, B, C, D>,
    onOpen?: (d: d3.Selection<HTMLElement, unknown, null, undefined>) => void,
    onClose?: (d: d3.Selection<HTMLElement, unknown, null, undefined>) => void,
) {
    const dropdown = selector.append("div")
        .classed("dropdownWrapper", true)
        .each(function() {
            const dropdownNode = this;
            dropdownLocal.set(this, { dropdownNode, onOpen, onClose });
        });
    dropdown.append("div")
        .classed("clicker", true)
        .on("click", toggleDropdown);
    const dropdownInner = dropdown.append("div")
        .classed("dropdown", true)
        .on("click", toggleDropdown);
    dropdown.append("div")
        .classed("spacer", true);
    return dropdownInner;
}

let inputId = 0;
let labelFor = 0;

// Appends a dropdown input to the selection.
//
// Args:
//   name: Should be unique to the dropdown.
//   checked: Should be true when a given input is the selected one.
//   callback: Called when the selected item is changed.
//
// Returns:
//   Selection with the input's label.
function addInputs<A extends d3.BaseType, B, C extends d3.BaseType, D>(
    selector: d3.Selection<A, B, C, D>,
    name: string,
    checked: boolean | d3.ValueFn<HTMLInputElement, B, boolean>,
    callback: (
        this: HTMLInputElement,
        d: B,
        i?: number,
        nodes?: HTMLInputElement[] | d3.ArrayLike<HTMLInputElement>,
    ) => void,
) {
    selector.append("input")
        .on("change", function(d, i, nodes) {
            toggleDropdown.call(this);
            callback.call(this, d, i, nodes);
        })
        .attr("id", () => "input-" + (inputId++))
        .attr("name", name)
        .attr("type", "radio")
        .property("checked", checked);
    const label = selector.append("label")
        .attr("for", () => "input-" + (labelFor++));
    return label;
}

// never used?
// Wrapper around makeDropdown/addInputs to create an input for each item in
// data.
// function dropdownInputs<A extends d3.BaseType, B, C extends d3.BaseType, D>(
//     selector: d3.Selection<A, B, C, D>,
//     data: any,
//     name: any,
//     checked: boolean,
//     callback: (d: any, i?: any, nodes?: any) => void,
// ) {
//     const dd = makeDropdown(selector)
//         .selectAll("div")
//         .data(data)
//         .join("div");
//     return addInputs(dd, name, checked, callback);
// }

export {
    toggleDropdown,
    makeDropdown,
    addInputs,
};
