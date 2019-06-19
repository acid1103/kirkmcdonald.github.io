import d3 = require("d3");
import dagre = require("dagre");
import { displayRate, formatName } from "./display";
import { GraphClickHandler, GraphMouseLeaveHandler, GraphMouseOverHandler } from "./events";
import { sheet_hash } from "./icon";
import { State as SettingsState } from "./settings";
import { IObjectMap } from "./utility-types";
import { colorList, getColorMaps, GraphEdge, GraphNode, iconSize, imageViewBox, renderNode } from "./visualize";

function edgePath(edge: BoxLineGraphEdge) {
    const start = edge.points[0];
    const parts = [`M ${start.x},${start.y}`];
    for (const point of edge.points.slice(1)) {
        parts.push(`L ${point.x},${point.y}`);
    }
    return parts.join(" ");
}

function edgeName(link: BoxLineGraphEdge) {
    return `link-${link.index}`;
}

function renderBoxGraph(
    { nodes, links }: {
        nodes: BoxLineGraphNode[],
        links: BoxLineGraphEdge[],
    },
    direction: string,
    ignore: IObjectMap<boolean>,
    sheetWidth: number,
    sheetHeight: number,
) {
    const [itemColors, recipeColors] = getColorMaps(nodes, links);
    if (direction === "down") {
        direction = "TB";
    } else {
        direction = "LR";
    }
    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: direction });
    g.setDefaultEdgeLabel(() => undefined);

    const testSVG = d3.select("body").append("svg");
    const text = testSVG.append("text");
    for (const node of nodes) {
        const width = node.labelWidth(text, 10);
        const height = 52;
        const label = { node, width, height };
        g.setNode(node.name, label);
        node.linkObjs = [];
        node.links = function() { return this.linkObjs; };
    }

    for (const [i, link] of links.entries()) {
        link.index = i;
        const s = ` \u00d7 ${displayRate(link.rate)}/${SettingsState.rateName}`;
        text.text(s);
        const textWidth = text.node().getBBox().width;
        const width = 32 + 10 + textWidth;
        const height = 32 + 10;
        const label = {
            link,
            labelpos: "c",
            width,
            height,
            text: s,
            x: undefined as number,
            y: undefined as number,
        };
        g.setEdge(link.source.name, link.target.name, label, edgeName(link));
        link.label = label;
        link.source.linkObjs.push(link);
        link.target.linkObjs.push(link);
    }
    text.remove();
    testSVG.remove();

    dagre.layout(g);
    for (const nodeName of g.nodes()) {
        const dagreNode = g.node(nodeName);
        const node = dagreNode.node;
        node.x0 = dagreNode.x - dagreNode.width / 2;
        node.y0 = dagreNode.y - dagreNode.height / 2;
        node.x1 = node.x0 + dagreNode.width;
        node.y1 = node.y0 + dagreNode.height;
    }
    for (const edgeName of g.edges()) {
        const dagreEdge = g.edge(edgeName);
        const link = dagreEdge.link;
        link.points = dagreEdge.points;
    }

    const { width, height } = g.graph();
    const svg = d3.select("svg#graph")
        .classed("sankey", false)
        .attr("viewBox", `-25,-25,${width + 50},${height + 50}`)
        .style("width", width + 50)
        .style("height", height + 50);
    svg.selectAll("g").remove();

    const edges = svg.append("g")
        .classed("edges", true)
        .selectAll("g")
        .data(links)
        .join("g")
        .classed("edge", true)
        .classed("edgePathFuel", (d) => d.fuel)
        .each(function(d) { d.elements.push(this as SVGGElement); });
    edges.append("path")
        .classed("highlighter", true)
        .attr("fill", "none")
        .attr("stroke", (d) => colorList[itemColors.get(d.item) % 10])
        .attr("stroke-width", 3)
        .attr("d", edgePath)
        .attr("marker-end", (d) => `url(#arrowhead-${edgeName(d)})`);
    edges.append("defs")
        .append("marker")
        .attr("id", (d) => "arrowhead-" + edgeName(d))
        .attr("viewBox", "0 0 10 10")
        .attr("refX", "9")
        .attr("refY", "5")
        .attr("markerWidth", "16")
        .attr("markerHeight", "12")
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .classed("highlighter", true)
        .attr("d", "M 0,0 L 10,5 L 0,10 z")
        .attr("stroke-width", 1)
        .attr("stroke", (d) => colorList[itemColors.get(d.item) % 10])
        .attr("fill", (d) => d3.color(colorList[itemColors.get(d.item) % 10]).darker().toString());

    const edgeLabels = svg.append("g")
        .classed("edgeLabels", true)
        .selectAll("g")
        .data(links)
        .join("g")
        .classed("edgeLabel", true)
        .each(function(d) { d.elements.push(this as SVGGElement); });
    edgeLabels.append("rect")
        .classed("highlighter", true)
        .attr("x", (d) => {
            const edge = d.label;
            return edge.x - edge.width / 2;
        })
        .attr("y", (d) => {
            const edge = d.label;
            return edge.y - edge.height / 2;
        })
        .attr("width", (d) => d.label.width)
        .attr("height", (d) => d.label.height)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("fill", (d) => d3.color(colorList[itemColors.get(d.item) % 10]).darker().toString())
        .attr("fill-opacity", 0)
        .attr("stroke", "none");
    edgeLabels.append("svg")
        .attr("viewBox", (d) => imageViewBox(d.item))
        .attr("x", (d) => {
            const edge = d.label;
            return edge.x - (edge.width / 2) + 5 + 0.5;
        })
        .attr("y", (d) => {
            const edge = d.label;
            return edge.y - iconSize / 2 + 0.5;
        })
        .attr("width", iconSize)
        .attr("height", iconSize)
        .append("image")
        .attr("xlink:href", "images/sprite-sheet-" + sheet_hash + ".png")
        .attr("width", sheetWidth)
        .attr("height", sheetHeight);
    edgeLabels.append("text")
        .attr("x", (d) => {
            const edge = d.label;
            return edge.x - (edge.width / 2) + 5 + iconSize;
        })
        .attr("y", (d) => d.label.y)
        .attr("dy", "0.35em")
        .text((d) => d.label.text);

    const rects = svg.append("g")
        .classed("nodes", true)
        .selectAll("g")
        .data(nodes)
        .join("g")
        .classed("node", true);
    renderNode(
        rects as d3.Selection<SVGGElement, BoxLineGraphNode, SVGGElement, unknown>,
        10,
        "left",
        ignore,
        sheetWidth,
        sheetHeight,
        recipeColors,
    );

    svg.append("g")
        .classed("overlay", true)
        .selectAll("rect")
        .data(nodes)
        .join("rect")
        .attr("stroke", "none")
        .attr("fill", "transparent")
        .attr("x", (d) => d.x0)
        .attr("y", (d) => d.y0)
        .attr("width", (d) => d.x1 - d.x0)
        .attr("height", (d) => d.y1 - d.y0)
        .on("mouseover", (d) => GraphMouseOverHandler(d))
        .on("mouseout", (d) => GraphMouseLeaveHandler(d))
        .on("click", (d) => GraphClickHandler(d))
        .append("title")
        .text((d) => formatName(d.name));
}

type BoxLineGraphEdge = GraphEdge & {
    index: number,
    label: {
        link: BoxLineGraphEdge,
        labelpos: string,
        width: number,
        height: number,
        text: string,
        x: number,
        y: number,
    },
    source: BoxLineGraphNode,
    target: BoxLineGraphNode,
    points: Array<{
        x: number,
        y: number,
    }>,
};
type BoxLineGraphNode = GraphNode & {
    linkObjs: BoxLineGraphEdge[],
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    labelX: number,
};

export {
    renderBoxGraph,
    BoxLineGraphEdge,
    BoxLineGraphNode,
};
