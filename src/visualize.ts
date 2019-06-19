import d3 = require("d3");
import { sprintf } from "sprintf-js";
import { BoxLineGraphEdge, BoxLineGraphNode, renderBoxGraph } from "./boxline";
import { CirclePath, makeCurve } from "./circlepath";
import { displayCount, displayRate, formatName } from "./display";
import { GraphClickHandler, GraphMouseLeaveHandler, GraphMouseOverHandler } from "./events";
import { Factory, FactoryDef } from "./factory";
import { IIconned, PX_HEIGHT, PX_WIDTH, sheet_hash } from "./icon";
import { solver, spec, spriteSheetSize } from "./init";
import { Item } from "./item";
import { one, Rational, zero } from "./rational";
import { Ingredient, Recipe } from "./recipe";
import { preferredBeltSpeed, State as SettingsState } from "./settings";
import { Totals } from "./totals";
import { IObjectMap } from "./utility-types";
import { TargetState } from "./window-interface";

const colorList = [
    "#1f77b4", // blue
    "#8c564b", // brown
    "#2ca02c", // green
    "#d62728", // red
    "#9467bd", // purple
    "#e377c2", // pink
    "#17becf", // cyan
    "#7f7f7f", // gray
    "#bcbd22", // yellow
    "#ff7f0e", // orange
];

class OutputRecipe {
    public ingredients: Ingredient[];
    public products: Ingredient[];
    constructor() {
        this.ingredients = [];
        for (let i = 0; i < TargetState.build_targets.length; i++) {
            const target = TargetState.build_targets[i];
            const item = solver.items[target.itemName];
            const ing = new Ingredient(target.getRate(), item);
            this.ingredients.push(ing);
        }
        this.products = [];
    }
}

class SurplusRecipe {
    public ingredients: Ingredient[];
    public products: Ingredient[];
    constructor(totals: Totals) {
        this.ingredients = [];
        for (const itemName in totals.waste) {
            const rate = totals.waste[itemName];
            const item = solver.items[itemName];
            const ing = new Ingredient(rate, item);
            this.ingredients.push(ing);
        }
        this.products = [];
    }
}

let image_id = zero;

function makeGraph(totals: Totals, ignore: IObjectMap<boolean>) {
    const outputRecipe = new OutputRecipe();
    const nodes = [new GraphNode(
        "output",
        outputRecipe as Recipe,
        null,
        zero,
        null,
    )];
    const nodeMap = new Map();
    nodeMap.set("output", nodes[0]);
    if (Object.keys(totals.waste).length > 0) {
        const surplusRecipe = new SurplusRecipe(totals);
        nodes.push(new GraphNode(
            "surplus",
            surplusRecipe as Recipe,
            null,
            zero,
            null,
        ));
        nodeMap.set("surplus", nodes[1]);
    }
    for (const recipeName in totals.totals) {
        const rate = totals.totals[recipeName];
        const recipe = solver.recipes[recipeName];
        const factory = spec.getFactory(recipe);
        const factoryCount = spec.getCount(recipe, rate);
        const node = new GraphNode(
            recipeName,
            recipe,
            factory,
            factoryCount,
            rate,
        );
        nodes.push(node);
        nodeMap.set(recipeName, node);
    }
    const links = [];
    for (const node of nodes) {
        const recipe = node.recipe;
        if (ignore[recipe.name]) {
            continue;
        }
        let ingredients: Ingredient[] = [];
        if (recipe.fuelIngredient) {
            ingredients = recipe.fuelIngredient(spec);
        }
        const fuelIngCount = ingredients.length;
        ingredients = ingredients.concat(recipe.ingredients);
        for (const [i, ing] of ingredients.entries()) {
            const fuel = i < fuelIngCount;
            let totalRate = zero;
            for (const subRecipe of ing.item.recipes) {
                if (subRecipe.name in totals.totals) {
                    totalRate = totalRate.add(totals.totals[subRecipe.name].mul(subRecipe.gives(ing.item, spec)));
                }
            }
            for (const subRecipe of ing.item.recipes) {
                if (subRecipe.name in totals.totals) {
                    let rate;
                    if (node.name === "output" || node.name === "surplus") {
                        rate = ing.amount;
                    } else {
                        rate = totals.totals[recipe.name].mul(ing.amount);
                    }
                    const ratio = rate.div(totalRate);
                    const subRate = totals.totals[subRecipe.name].mul(subRecipe.gives(ing.item, spec)).mul(ratio);
                    let value = subRate.toFloat();
                    if (ing.item.phase === "fluid") {
                        value /= 10;
                    }
                    let beltCount = null;
                    if (ing.item.phase === "solid") {
                        beltCount = subRate.div(preferredBeltSpeed);
                    }
                    const extra = subRecipe.products.length > 1;
                    links.push(new GraphEdge(
                        nodeMap.get(subRecipe.name),
                        node,
                        value,
                        ing.item,
                        subRate,
                        fuel,
                        beltCount,
                        extra,
                    ));
                }
            }
        }
    }
    return { nodes, links };
}

class GraphEdge {
    public source: GraphNode;
    public target: GraphNode;
    public value: number;
    public item: Item;
    public rate: Rational;
    public fuel: boolean;
    public beltCount: Rational;
    public extra: boolean;
    public elements: SVGGElement[];
    public nodeHighlighters: Set<GraphNode>;
    constructor(
        source: GraphNode,
        target: GraphNode,
        value: number,
        item: Item,
        rate: Rational,
        fuel: boolean,
        beltCount: Rational,
        extra: boolean,
    ) {
        this.source = source;
        this.target = target;
        this.value = value;
        this.item = item;
        this.rate = rate;
        this.fuel = fuel;
        this.beltCount = beltCount;
        this.extra = extra;
        this.elements = [];
        this.nodeHighlighters = new Set();
    }
    public hasHighlighters() {
        return this.nodeHighlighters.size > 0;
    }
    public highlight(node: GraphNode) {
        if (!this.hasHighlighters()) {
            for (const element of this.elements) {
                element.classList.add("edgePathHighlight");
            }
        }
        this.nodeHighlighters.add(node);
    }
    public unhighlight(node: GraphNode) {
        this.nodeHighlighters.delete(node);
        if (!this.hasHighlighters()) {
            for (const element of this.elements) {
                element.classList.remove("edgePathHighlight");
            }
        }
    }
}

class GraphNode {
    public recipe: Recipe;
    public name: string;
    public ingredients: Ingredient[];
    public factory: FactoryDef;
    public count: Rational;
    public rate: Rational;
    public sourceLinks: GraphEdge[];
    public element: SVGRectElement;
    public width: number;
    public targetLinks: GraphEdge[];
    constructor(name: string, recipe: Recipe, factory: Factory, count: Rational, rate: Rational) {
        this.name = name;
        this.ingredients = recipe.ingredients;
        this.recipe = recipe;
        this.factory = factory ? factory.factory : null;
        this.count = count;
        this.rate = rate;
        //this.edgeHighlighters = []
    }
    public links() {
        return this.sourceLinks.concat(this.targetLinks);
    }
    public text() {
        if (this.rate === null) {
            return this.name;
        } else if (this.count.isZero()) {
            return sprintf(" \u00d7 %s/%s", displayRate(this.rate), SettingsState.rateName);
        } else {
            return sprintf(" \u00d7 %s", displayCount(this.count));
        }
    }
    public labelWidth(text: d3.Selection<SVGTextElement, unknown, HTMLElement, any>, margin: number) {
        text.text(this.text());
        const textWidth = text.node().getBBox().width;
        let nodeWidth = textWidth + margin * 2;
        if (this.factory !== null) {
            nodeWidth += iconSize * 2 + colonWidth + 3;
        } else if (this.rate !== null) {
            nodeWidth += iconSize + 3;
        }
        return nodeWidth;
    }
    public highlight() {
        this.element.classList.add("nodeHighlight");
        for (const edge of this.links()) {
            edge.highlight(this);
        }
    }
    public unhighlight() {
        this.element.classList.remove("nodeHighlight");
        for (const edge of this.links()) {
            edge.unhighlight(this);
        }
    }
}

function renderNode(
    selection: d3.Selection<d3.BaseType, LabeledPositionedGraphNode, SVGGElement, unknown>,
    margin: number,
    justification: string,
    ignore: IObjectMap<boolean>,
    sheetWidth: number,
    sheetHeight: number,
    recipeColors: Map<Recipe, number>,
) {
    selection.each((d) => {
        if (justification === "left") {
            d.labelX = d.x0;
        } else {
            d.labelX = (d.x0 + d.x1) / 2 - d.width / 2;
        }
    });
    selection.append("rect")
        .attr("x", (d) => d.x0)
        .attr("y", (d) => d.y0)
        .attr("height", (d) => d.y1 - d.y0)
        .attr("width", (d) => d.x1 - d.x0)
        .attr("fill", (d) => d3.color(colorList[recipeColors.get(d.recipe) % 10]).darker().toString())
        .attr("stroke", (d) => colorList[recipeColors.get(d.recipe) % 10])
        .each(function(d) { d.element = this; });
    selection.filter((d) => d.rate === null)
        .append("text")
        .attr("x", (d) => (d.x0 + d.x1) / 2)
        .attr("y", (d) => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text((d) => d.text());
    const labeledNode = selection.filter((d) => d.rate !== null);
    labeledNode.append("svg")
        .attr("viewBox", (d) => imageViewBox(d.recipe))
        .attr("x", (d) => d.labelX + margin + 0.5)
        .attr("y", (d) => (d.y0 + d.y1) / 2 - iconSize / 2 + 0.5)
        .attr("width", iconSize)
        .attr("height", iconSize)
        .append("image")
        .classed("ignore", (d) => ignore[d.recipe.name])
        .attr("xlink:href", "images/sprite-sheet-" + sheet_hash + ".png")
        .attr("width", sheetWidth)
        .attr("height", sheetHeight);
    labeledNode.append("text")
        .attr("x", (d) => d.labelX + iconSize + (d.factory === null ? 0 : colonWidth + iconSize) + margin + 3)
        .attr("y", (d) => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .text((d) => d.text());
    const factoryNode = selection.filter((d) => d.factory !== null);
    factoryNode.append("circle")
        .classed("colon", true)
        .attr("cx", (d) => d.labelX + iconSize + colonWidth / 2 + margin)
        .attr("cy", (d) => (d.y0 + d.y1) / 2 - 4)
        .attr("r", 1);
    factoryNode.append("circle")
        .classed("colon", true)
        .attr("cx", (d) => d.labelX + iconSize + colonWidth / 2 + margin)
        .attr("cy", (d) => (d.y0 + d.y1) / 2 + 4)
        .attr("r", 1);
    factoryNode.append("svg")
        .attr("viewBox", (d) => imageViewBox(d.factory))
        .attr("x", (d) => d.labelX + iconSize + colonWidth + margin + 0.5)
        .attr("y", (d) => (d.y0 + d.y1) / 2 - iconSize / 2 + 0.5)
        .attr("width", iconSize)
        .attr("height", iconSize)
        .append("image")
        .attr("xlink:href", "images/sprite-sheet-" + sheet_hash + ".png")
        .attr("width", sheetWidth)
        .attr("height", sheetHeight);
}

const iconSize = 32;
const nodePadding = 32;
const colonWidth = 12;

const color = d3.scaleOrdinal(colorList);

function imageViewBox(obj: IIconned) {
    const x1 = obj.icon_col * PX_WIDTH + 0.5;
    const y1 = obj.icon_row * PX_HEIGHT + 0.5;
    return `${x1} ${y1} ${PX_WIDTH - 1} ${PX_HEIGHT - 1}`;
}

function itemNeighbors(item: Item, fuelLinks: Map<Item, Recipe[]>) {
    const touching = new Set();
    let recipes = item.recipes.concat(item.uses);
    const fuelUsers = fuelLinks.get(item);
    if (fuelUsers !== undefined) {
        recipes = recipes.concat(fuelUsers);
    }
    for (const recipe of recipes) {
        let ingredients = recipe.ingredients.concat(recipe.products);
        if (recipe.fuelIngredient) {
            ingredients = ingredients.concat(recipe.fuelIngredient(spec));
        }
        for (const ing of ingredients) {
            touching.add(ing.item);
        }
    }
    return touching;
}

function itemDegree(item: Item, fuelLinks: Map<Item, Recipe[]>) {
    return itemNeighbors(item, fuelLinks).size;
}

function getColorMaps(nodes: GraphNode[], links: GraphEdge[]): [Map<Item, number>, Map<Recipe, number>] {
    const itemColors = new Map();
    const recipeColors = new Map();
    const fuelLinks = new Map();
    const items = [];
    for (const link of links) {
        items.push(link.item);
        if (link.fuel) {
            let fuelUsers = fuelLinks.get(link.item);
            if (fuelUsers === undefined) {
                fuelUsers = [];
                fuelLinks.set(link.item, fuelUsers);
            }
            fuelUsers.push(link.target.recipe);
        }
    }
    items.sort((a, b) => itemDegree(b, fuelLinks) - itemDegree(a, fuelLinks));
    const itemsSet = new Set(items);
    while (itemsSet.size > 0) {
        let chosenItem = null;
        let usedColors = null;
        let max = -1;
        for (const item of itemsSet) {
            const neighbors = itemNeighbors(item, fuelLinks);
            const colors = new Set();
            for (const neighbor of neighbors) {
                if (itemColors.has(neighbor)) {
                    colors.add(itemColors.get(neighbor));
                }
            }
            if (colors.size > max) {
                max = colors.size;
                usedColors = colors;
                chosenItem = item;
            }
        }
        itemsSet.delete(chosenItem);
        let color = 0;
        while (usedColors.has(color)) {
            color++;
        }
        itemColors.set(chosenItem, color);
    }
    // This is intended to be taken modulo the number of colors when it is
    // actually used.
    let recipeColor = 0;
    for (const node of nodes) {
        const recipe = node.recipe;
        if (recipe.products.length === 1) {
            recipeColors.set(recipe, itemColors.get(recipe.products[0].item));
        } else {
            recipeColors.set(recipe, recipeColor++);
        }
    }
    return [itemColors, recipeColors];
}

function selfPath(d: SankeyGraphEdge) {
    const x0 = d.source.x1;
    const y0 = d.y0;
    const x1 = d.source.x1;
    const y1 = d.source.y1 + d.width / 2 + 10;
    const r1 = (y1 - y0) / 2;
    const x2 = d.target.x0;
    const y2 = d.target.y1 + d.width / 2 + 10;
    const x3 = d.target.x0;
    const y3 = d.y1;
    const r2 = (y3 - y2) / 2;
    return new CirclePath(1, 0, [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x3, y: y3 },
    ]);
}

function backwardPath(d: SankeyGraphEdge) {
    // start point
    const x0 = d.source.x1;
    const y0 = d.y0;
    // end point
    const x3 = d.target.x0;
    const y3 = d.y1;
    const y2a = d.source.y0 - d.width / 2 - 10;
    const y2b = d.source.y1 + d.width / 2 + 10;
    const y3a = d.target.y0 - d.width / 2 - 10;
    const y3b = d.target.y1 + d.width / 2 + 10;
    const points = [{ x: x0, y: y0 }];
    let starty;
    let endy;
    if (y2b < y3a) {
        // draw start arc down, end arc up
        starty = y2b;
        endy = y3a;
    } else if (y2a > y3b) {
        // draw start arc up, end arc down
        starty = y2a;
        endy = y3b;
    } else {
        // draw both arcs down
        starty = y2b;
        endy = y3b;
    }
    const curve = makeCurve(-1, 0, x0, starty, x3, endy);
    for (const { x, y } of curve.points) {
        points.push({ x, y });
    }
    points.push({ x: x3, y: y3 });
    return new CirclePath(1, 0, points);
}

function linkPath(d: SankeyGraphEdge) {
    if (d.direction === "self") {
        return selfPath(d);
    } else if (d.direction === "backward") {
        return backwardPath(d);
    }
    const x0 = d.source.x1;
    const y0 = d.y0;
    const x1 = d.target.x0;
    const y1 = d.y1;
    return makeCurve(1, 0, x0, y0, x1, y1, d.width);
}

function linkTitle(d: SankeyGraphEdge) {
    let itemName = "";
    if (d.source.name !== d.item.name) {
        itemName = `${formatName(d.item.name)} \u00d7 `;
    }
    let fuel = "";
    if (d.fuel) {
        fuel = " (fuel)";
    }
    return `${formatName(d.source.name)} \u2192 ${formatName(d.target.name)}${fuel}\n${itemName}` +
        `${displayRate(d.rate)}/${SettingsState.rateName}`;
}

function renderGraph(totals: Totals, ignore: IObjectMap<boolean>) {
    const direction = SettingsState.visDirection;
    const [sheetWidth, sheetHeight] = spriteSheetSize;
    const data = makeGraph(totals, ignore);
    if (SettingsState.visualizer === "box") {
        renderBoxGraph(
            data as {
                nodes: BoxLineGraphNode[],
                links: BoxLineGraphEdge[],
            },
            direction,
            ignore,
            sheetWidth,
            sheetHeight,
        );
        return;
    }

    let maxNodeWidth = 0;
    const testSVG = d3.select("body").append("svg")
        .classed("sankey", true);
    const text = testSVG.append("text");
    for (const node of data.nodes) {
        const nodeWidth = node.labelWidth(text, 2);
        if (nodeWidth > maxNodeWidth) {
            maxNodeWidth = nodeWidth;
        }
        node.width = nodeWidth;
    }
    text.remove();
    testSVG.remove();

    let nw, np;
    if (direction === "down") {
        nw = 36;
        np = maxNodeWidth;
    } else if (direction === "right") {
        nw = maxNodeWidth;
        np = nodePadding;
    }
    const d3sankey = (window as any).d3sankey;
    const sankey = d3sankey.sankey()
        .nodeWidth(nw)
        .nodePadding(np)
        .nodeAlign(d3sankey.sankeyRight)
        .maxNodeHeight(SettingsState.maxNodeHeight)
        .linkLength(SettingsState.linkLength);
    const { nodes, links } = sankey(data) as {
        nodes: SankeyGraphNode[],
        links: SankeyGraphEdge[],
    };
    const [itemColors, recipeColors] = getColorMaps(nodes, links);

    for (const link of links) {
        link.curve = linkPath(link);
        if (direction === "down") {
            link.curve = link.curve.transpose();
        }
        const belts: Array<{
            item: Item,
            curve: CirclePath,
        }> = [];
        if (link.beltCount !== null) {
            const dy = link.width / link.beltCount.toFloat();
            // Only render belts if there are at least three pixels per belt.
            if (dy > 3) {
                for (let i = one; i.less(link.beltCount); i = i.add(one)) {
                    const offset = i.toFloat() * dy - link.width / 2;
                    const beltCurve = link.curve.offset(offset);
                    belts.push({ item: link.item, curve: beltCurve });
                }
            }
        }
        link.belts = belts;
    }

    let width = 0;
    let height = 0;
    for (const node of nodes) {
        if (direction === "down") {
            [node.x0, node.y0] = [node.y0, node.x0];
            [node.x1, node.y1] = [node.y1, node.x1];
        }
        if (node.x1 > width) {
            width = node.x1;
        }
        if (node.y1 > height) {
            height = node.y1;
        }
    }

    let margin = 25;
    if (direction === "down") {
        margin += maxNodeWidth / 2;
    }

    const svg = d3.select("svg#graph")
        .classed("sankey", true)
        .attr("viewBox", `${-margin},-25,${width + margin * 2},${height + 50}`)
        .style("width", width + margin * 2)
        .style("height", height + 50);
    svg.selectAll("g").remove();

    const rects = svg.append("g")
        .classed("nodes", true)
        .selectAll("g")
        .data(nodes)
        .join("g")
        .classed("node", true);

    let nodeJust = "left";
    if (direction === "down") {
        nodeJust = "center";
    }
    renderNode(rects, 2, nodeJust, ignore, sheetWidth, sheetHeight, recipeColors);

    const link = svg.append("g")
        .classed("links", true)
        .selectAll("g")
        .data(links)
        .join("g")
        .classed("link", true)
        .each(function(d) { d.elements.push(this as SVGGElement); });
    link.append("path")
        .classed("highlighter", (d) => d.width < 3)
        .attr("fill", "none")
        .attr("stroke-opacity", 0.3)
        .attr("d", (d) => d.curve.path())
        .attr("stroke", (d) => colorList[itemColors.get(d.item) % 10])
        .attr("stroke-width", (d) => Math.max(1, d.width));
    link.filter((d) => d.width >= 3)
        .append("g")
        .selectAll("path")
        .data((d) => [
            d.curve.offset(-d.width / 2),
            d.curve.offset(d.width / 2),
        ])
        .join("path")
        .classed("highlighter", true)
        .attr("fill", "none")
        .attr("d", (d) => d.path())
        .attr("stroke", "none")
        .attr("stroke-width", 1);
    link.append("g")
        .classed("belts", true)
        .selectAll("path")
        .data((d) => d.belts)
        .join("path")
        .classed("belt", true)
        .attr("fill", "none")
        .attr("stroke-opacity", 0.3)
        .attr("d", (d) => d.curve.path())
        .attr("stroke", (d) => colorList[itemColors.get(d.item) % 10])
        .attr("stroke-width", 1);
    link.append("title")
        .text(linkTitle);
    const extraLinkLabel = link.filter((d) => d.extra);
    const linkIcon = extraLinkLabel.append("svg")
        .attr("viewBox", (d) => imageViewBox(d.item))
        .attr("x", (d) => d.source.x1 + 2.25)
        .attr("y", (d) => d.y0 - iconSize / 4 + 0.25)
        .attr("width", iconSize / 2)
        .attr("height", iconSize / 2);
    linkIcon.append("image")
        .attr("xlink:href", "images/sprite-sheet-" + sheet_hash + ".png")
        .attr("width", sheetWidth)
        .attr("height", sheetHeight);
    if (direction === "down") {
        linkIcon
            .attr("x", (d) => d.y0 - iconSize / 4 + 0.25)
            .attr("y", (d) => d.source.y1 + 2.25);
    }
    const linkLabel = link.append("text")
        .attr("x", (d) => d.source.x1 + 2 + (d.extra ? 16 : 0))
        .attr("y", (d) => d.y0)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .text((d) => (d.extra ? "\u00d7 " : "") + `${displayRate(d.rate)}/${SettingsState.rateName}`);
    if (direction === "down") {
        linkLabel
            .attr("x", null)
            .attr("y", null)
            .attr("transform", (d) => {
                const x = d.y0;
                const y = d.source.y1 + 2 + (d.extra ? 16 : 0);
                return `translate(${x},${y}) rotate(90)`;
            });
    }

    const rectElements = svg.selectAll("g.node rect").nodes() as SVGRectElement[];
    const overlayData = [];
    const graphTab = d3.select("#graph_tab") as d3.Selection<HTMLElement, unknown, HTMLElement, any>;
    const origDisplay = d3.style(graphTab.node(), "display");
    graphTab.style("display", "block");
    for (const [i, node] of nodes.entries()) {
        const rect = rectElements[i].getBBox();
        const recipe = node.recipe;
        overlayData.push({ rect, node, recipe });
    }
    graphTab.style("display", origDisplay);
    svg.append("g")
        .classed("overlay", true)
        .selectAll("rect")
        .data(overlayData)
        .join("rect")
        .attr("stroke", "none")
        .attr("fill", "transparent")
        .attr("x", (d) => Math.min(d.rect.x, d.rect.x + d.rect.width / 2 - d.node.width / 2))
        .attr("y", (d) => Math.min(d.rect.y, d.rect.y + d.rect.height / 2 - 16))
        .attr("width", (d) => Math.max(d.rect.width, d.node.width))
        .attr("height", (d) => Math.max(d.rect.height, 32))
        .on("mouseover", (d) => GraphMouseOverHandler(d.node))
        .on("mouseout", (d) => GraphMouseLeaveHandler(d.node))
        .on("click", (d) => GraphClickHandler(d.node))
        .append("title")
        .text((d) => formatName(d.node.name));
}

type SankeyGraphEdge = GraphEdge & {
    source: SankeyGraphNode,
    target: SankeyGraphNode,
    index: number,
    direction: string,
    width: number,
    y1: number,
    y0: number,
    curve: CirclePath,
    belts: Array<{
        item: Item,
        curve: CirclePath,
    }>,
};
type SankeyGraphNode = GraphNode & {
    index: number,
    sourceLinks: SankeyGraphEdge[],
    targetLinks: SankeyGraphEdge[],
    value: number,
    depth: number,
    height: number,
    layer: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    labelX: number,
};
type LabeledPositionedGraphNode = GraphNode & {
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    labelX: number,
};

export {
    colorList,
    GraphEdge,
    GraphNode,
    renderNode,
    iconSize,
    imageViewBox,
    getColorMaps,
    renderGraph,
    SankeyGraphEdge,
    SankeyGraphNode,
};
