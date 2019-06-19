import d3 = require("d3");
import $ = require("jquery");
import { renderDebug } from "./debug";
import {
    beaconCountHandler,
    BeaconHandler,
    copyAllHandler,
    IgnoreHandler,
    ModuleCopyHandler,
    ModuleHandler,
} from "./events";
import { Factory } from "./factory";
import { formatSettings } from "./fragment";
import { getImage, IIconned } from "./icon";
import { recipeTable, solver, spec, useLegacyCalculations } from "./init";
import { Item } from "./item";
import { Module, moduleDropdown } from "./module";
import { one, Rational, RationalFromFloat, zero } from "./rational";
import { Recipe } from "./recipe";
import {
    maxPipeThroughput,
    preferredBelt,
    preferredBeltSpeed,
    preferredFuel,
    State as SettingsState,
} from "./settings";
import { sorted } from "./sort";
import { pipeLength } from "./steps";
import { Totals } from "./totals";
import { IObjectMap } from "./utility-types";
import { renderGraph } from "./visualize";
import { EventsState, TargetState } from "./window-interface";

const State = {} as {
    sortOrder: string;
};

function formatName(name: string) {
    name = name.replace(new RegExp("-", "g"), " ");
    return name[0].toUpperCase() + name.slice(1);
}

function displayRate(x: Rational) {
    x = x.mul(SettingsState.displayRateFactor);
    if (SettingsState.displayFormat === "rational") {
        return x.toMixed();
    } else {
        return x.toDecimal(SettingsState.ratePrecision);
    }
}

function displayCount(x: Rational) {
    if (SettingsState.displayFormat === "rational") {
        return x.toMixed();
    } else {
        return x.toUpDecimal(SettingsState.countPrecision);
    }
}

function align(s: string, prec: number) {
    if (SettingsState.displayFormat === "rational") {
        return s;
    }
    let idx = s.indexOf(".");
    if (idx === -1) {
        idx = s.length;
    }
    let toAdd = prec - s.length + idx;
    if (prec > 0) {
        toAdd += 1;
    }
    while (toAdd > 0) {
        s += "\u00A0";
        toAdd--;
    }
    return s;
}

function alignRate(x: Rational) {
    return align(displayRate(x), SettingsState.ratePrecision);
}

function alignCount(x: Rational) {
    return align(displayCount(x), SettingsState.countPrecision);
}

const powerSuffixes = ["\u00A0W", "kW", "MW", "GW", "TW", "PW"];

function alignPower(x: Rational, prec?: number) {
    if (prec === undefined) {
        prec = SettingsState.countPrecision;
    }
    const thousand = RationalFromFloat(1000);
    let i = 0;
    while (thousand.less(x) && i < powerSuffixes.length - 1) {
        x = x.div(thousand);
        i++;
    }
    return align(displayCount(x), prec) + " " + powerSuffixes[i];
}

State.sortOrder = "topo";

function pruneSpec(totals: Totals) {
    let drop: string[] = [];
    for (const name in spec.spec) {
        if (!(name in totals.totals)) {
            drop.push(name);
        }
    }
    for (const specIdx of drop) {
        delete spec.spec[specIdx];
    }
    drop = [];
    for (const name in spec.ignore) {
        if (!(name in totals.totals)) {
            drop.push(name);
        }
    }
    for (const ignoreIdx of drop) {
        delete spec.ignore[ignoreIdx];
    }
}

let globalTotals: Totals;

// The main top-level calculation function. Called whenever the solution
// requires recalculation.
//
// This function obtains the set of item-rates to solve for from build_targets,
// the set of modules from spec, and obtains a solution from solver. The
// factory counts are then obtained from the solution using the spec.
function itemUpdate() {
    const rates: IObjectMap<Rational> = {};
    for (const target of TargetState.build_targets) {
        const rate = target.getRate();
        rates[target.itemName] = rate;
    }
    globalTotals = solver.solve(rates, spec.ignore, spec);
    display();
}

function Header(name: string, colSpan?: number) {
    if (!colSpan) {
        colSpan = 1;
    }
    return { name, colSpan };
}

const NO_MODULE = "no module";

function pipeValues(rate: Rational) {
    const pipes = rate.div(maxPipeThroughput).ceil();
    const perPipeRate = rate.div(pipes);
    const length = pipeLength(perPipeRate).floor();
    return { pipes, length };
}

class ItemIcon implements IIconned {
    public item: Item;
    public name: string;
    public extra: HTMLSpanElement;
    public span: HTMLSpanElement;
    public icon_col: number;
    public icon_row: number;
    constructor(item: Item, canIgnore: boolean) {
        this.item = item;
        this.name = item.name;
        this.extra = null;
        if (canIgnore) {
            this.extra = document.createElement("span");
            this.span = document.createElement("span");
            this.extra.appendChild(this.span);
            this.extra.appendChild(document.createElement("br"));
        }
        this.icon_col = item.icon_col;
        this.icon_row = item.icon_row;
    }

    public setText(text: string) {
        this.span.textContent = text;
    }

    public renderTooltip() {
        return this.item.renderTooltip(this.extra);
    }
}

class BeltIcon implements IIconned {
    public item: Item;
    public speed: Rational;
    public name: string;
    public icon_col: number;
    public icon_row: number;
    constructor(beltItem?: Item, beltSpeed?: Rational) {
        if (!beltItem) {
            beltItem = solver.items[preferredBelt];
        }
        if (!beltSpeed) {
            beltSpeed = preferredBeltSpeed;
        }
        this.item = beltItem;
        this.speed = beltSpeed;
        this.name = this.item.name;
        this.icon_col = this.item.icon_col;
        this.icon_row = this.item.icon_row;
    }

    public renderTooltip() {
        const t = document.createElement("div");
        t.classList.add("frame");
        const title = document.createElement("h3");
        const im = getImage(this, true);
        title.appendChild(im);
        title.appendChild(new Text(formatName(this.name)));
        t.appendChild(title);
        const b = document.createElement("b");
        b.textContent = "Max throughput: ";
        t.appendChild(b);
        t.appendChild(new Text(displayRate(this.speed) + " items/" + SettingsState.rateName));
        return t;
    }
}

interface IRow {
    name: string;
    updateDisplayedModules: () => void;
    groupMatches: (group: RecipeGroup) => boolean;
    appendTo: (node: HTMLElement) => void;
    setRates: (totals: Totals, items: IObjectMap<Rational>) => void;
    remove: () => void;
    totalPower: () => Rational;
    csv: () => string[];
    hasModules: () => boolean;
    setUpDownArrow: () => void;
    setDownArrow: () => void;
    setUpArrow: () => void;
}

class ItemRow implements IRow {
    public name: string;
    public item: Item;
    public itemIcon: ItemIcon;
    public image: HTMLImageElement;
    public rateNode: HTMLElement;
    public beltCell: HTMLTableDataCellElement;
    public beltCountNode: HTMLElement;
    public pipeNode: HTMLElement;
    public wasteNode: HTMLElement;
    public updateDisplayedModules: () => void;
    public groupMatches: (group: RecipeGroup) => boolean;
    public appendTo: (node: HTMLElement) => void;
    public setRates: (totals: Totals, items: IObjectMap<Rational>) => void;
    public remove: () => void;
    public totalPower: () => Rational;
    public csv: () => string[];
    public hasModules: () => boolean;
    public setUpDownArrow: () => void;
    public setDownArrow: () => void;
    public setUpArrow: () => void;

    constructor(row: HTMLTableRowElement, item: Item, canIgnore: boolean) {
        this.item = item;
        const nameCell = document.createElement("td");
        nameCell.className = "right-align";
        this.itemIcon = new ItemIcon(item, canIgnore);
        const im = getImage(this.itemIcon);
        im.classList.add("display");
        if (canIgnore) {
            if (spec.ignore[item.name]) {
                this.itemIcon.setText("(Click to unignore.)");
            } else {
                this.itemIcon.setText("(Click to ignore.)");
            }
            im.classList.add("recipe-icon");
        }
        this.image = im;
        nameCell.appendChild(im);
        row.appendChild(nameCell);

        const rateCell = document.createElement("td");
        rateCell.classList.add("right-align", "pad-right");
        let tt = document.createElement("tt");
        rateCell.appendChild(tt);
        this.rateNode = tt;
        row.appendChild(rateCell);

        if (item.phase === "solid") {
            this.beltCell = document.createElement("td");
            row.appendChild(this.beltCell);
            const beltCountCell = document.createElement("td");
            beltCountCell.classList.add("right-align", "pad-right");
            this.beltCountNode = document.createElement("tt");
            beltCountCell.appendChild(this.beltCountNode);
            row.appendChild(beltCountCell);
            // Wire off pipe icon in 0.17 for now.
        } else if (item.phase === "fluid" && useLegacyCalculations) {
            const pipeCell = document.createElement("td");
            pipeCell.colSpan = 2;
            pipeCell.classList.add("pad-right");
            row.appendChild(pipeCell);
            const pipeItem = solver.items.pipe;
            pipeCell.appendChild(getImage(pipeItem, true));
            this.pipeNode = document.createElement("tt");
            pipeCell.appendChild(this.pipeNode);
        } else {
            row.appendChild(document.createElement("td"));
            row.appendChild(document.createElement("td"));
        }

        const wasteCell = document.createElement("td");
        wasteCell.classList.add("right-align", "pad-right", "waste");
        tt = document.createElement("tt");
        wasteCell.appendChild(tt);
        this.wasteNode = tt;
        row.appendChild(wasteCell);
    }

    public setIgnore(ignore: boolean) {
        if (ignore) {
            this.itemIcon.setText("(Click to unignore.)");
        } else {
            this.itemIcon.setText("(Click to ignore.)");
        }
    }

    public setBelt(itemRate: Rational) {
        while (this.beltCell.hasChildNodes()) {
            this.beltCell.removeChild(this.beltCell.lastChild);
        }
        const beltImage = getImage(new BeltIcon());
        this.beltCell.appendChild(beltImage);
        this.beltCell.appendChild(new Text(" \u00d7"));
        const beltCount = itemRate.div(preferredBeltSpeed);
        this.beltCountNode.textContent = alignCount(beltCount);
    }

    public setPipe(itemRate: Rational) {
        // 0.17 changes these fluid calculations, but the new model is not yet
        // fully known. Wire it off in 0.17 for now.
        if (useLegacyCalculations) {
            if (itemRate.equal(zero)) {
                this.pipeNode.textContent = " \u00d7 0";
                return;
            }
            const pipe = pipeValues(itemRate);
            let pipeString = "";
            if (one.less(pipe.pipes)) {
                pipeString += " \u00d7 " + pipe.pipes.toDecimal(0);
            }
            pipeString += " \u2264 " + pipe.length.toDecimal(0);
            this.pipeNode.textContent = pipeString;
        }
    }

    public setRate(itemRate: Rational, waste: Rational) {
        this.rateNode.textContent = alignRate(itemRate);
        this.wasteNode.textContent = alignRate(waste);
        if (this.item.phase === "solid") {
            this.setBelt(itemRate);
        } else if (this.item.phase === "fluid") {
            this.setPipe(itemRate);
        }
    }
}

function makePopOutCell() {
    const popOutCell = document.createElement("td");
    popOutCell.classList.add("pad");
    const popOutLink = document.createElement("a");
    popOutLink.target = "_blank";
    popOutLink.title = "Open this item in separate window.";
    popOutCell.appendChild(popOutLink);
    const popOutSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    popOutSVG.classList.add("popout");
    popOutSVG.setAttribute("viewBox", "0 0 24 24");
    popOutSVG.setAttribute("width", "16");
    popOutSVG.setAttribute("height", "16");
    popOutLink.appendChild(popOutSVG);
    const popOutUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
    popOutUse.setAttribute("href", "images/icons.svg#popout");
    popOutSVG.appendChild(popOutUse);
    return popOutCell;
}

class RecipeRow implements IRow {
    public name: string;
    public recipe: Recipe;
    public rate: Rational;
    public node: HTMLTableRowElement;
    public item: Item;
    public itemRow: ItemRow;
    public factoryRow: FactoryRow;
    public popOutLink: HTMLAnchorElement;
    public groupMatches: (group: RecipeGroup) => boolean;

    constructor(recipeName: string, rate: Rational, itemRate: Rational, waste: Rational) {
        this.name = recipeName;
        this.recipe = solver.recipes[recipeName];
        this.rate = rate;
        this.node = document.createElement("tr");
        this.node.classList.add("recipe-row");
        this.node.classList.add("display-row");
        const canIgnore = this.recipe.canIgnore();
        if (spec.ignore[recipeName]) {
            if (!canIgnore) {
                delete spec.ignore[recipeName];
            } else {
                this.node.classList.add("ignore");
            }
        }

        this.item = this.recipe.products[0].item;
        this.itemRow = new ItemRow(this.node, this.item, canIgnore);
        if (canIgnore) {
            $(this.itemRow.image).click(IgnoreHandler(this));
        }

        this.factoryRow = new FactoryRow(this.node, this.recipe);

        const popOutCell = makePopOutCell();
        this.node.appendChild(popOutCell);
        this.popOutLink = popOutCell.firstChild as HTMLAnchorElement;

        // Set values.
        if (canIgnore) {
            this.setIgnore(spec.ignore[recipeName]);
        }
        this.setRate(rate, itemRate, waste);
        this.factoryRow.updateDisplayedModules();
    }

    public appendTo(parentNode: HTMLElement) {
        parentNode.appendChild(this.node);
    }

    // Call whenever this recipe's status in the ignore list changes.
    public setIgnore(ignore: boolean) {
        if (ignore) {
            this.node.classList.add("ignore");
        } else {
            this.node.classList.remove("ignore");
        }
        this.itemRow.setIgnore(ignore);
    }

    public hasModules() {
        return !this.node.classList.contains("no-mods");
    }

    public setDownArrow() {
        this.factoryRow.downArrow.textContent = "\u2193";
    }

    public setUpDownArrow() {
        this.factoryRow.downArrow.textContent = "\u2195";
    }

    public setUpArrow() {
        this.factoryRow.downArrow.textContent = "\u2191";
    }

    public updateDisplayedModules() {
        this.factoryRow.updateDisplayedModules();
    }

    public totalPower() {
        if (this.factoryRow.power && this.factoryRow.power.fuel === "electric") {
            return this.factoryRow.power.power;
        }
        return zero;
    }

    public csv() {
        const rate = this.rate.mul(this.recipe.gives(this.item, spec));
        let parts = [
            this.name,
            displayRate(rate),
        ];
        parts = parts.concat(this.factoryRow.csv());
        return [parts.join(",")];
    }

    // Sets the new recipe-rate for a recipe, and updates the factory count.
    public setRate(recipeRate: Rational, itemRate: Rational, waste: Rational) {
        this.rate = recipeRate;
        this.itemRow.setRate(itemRate, waste);
        this.factoryRow.displayFactory(recipeRate);
        const rate: IObjectMap<Rational> = {};
        rate[this.item.name] = itemRate;
        const link = "#" + formatSettings(rate);
        this.popOutLink.href = link;
    }

    public setRates(totals: Totals, items: IObjectMap<Rational>) {
        const recipeRate = totals.get(this.name);
        const itemRate = items[this.item.name];
        const waste = totals.getWaste(this.item.name);
        this.setRate(recipeRate, itemRate, waste);
    }

    public remove() {
        this.node.parentElement.removeChild(this.node);
    }
}

class FactoryRow implements IRow {
    public name: string;
    public downArrow: HTMLButtonElement;
    public power: { fuel: string; power: Rational; };
    public node: HTMLTableRowElement;
    public recipe: Recipe;
    public factory: Factory;
    public count: Rational;
    public factoryCell: HTMLTableDataCellElement;
    public countNode: HTMLElement;
    public modulesCell: HTMLTableDataCellElement;
    public copyButton: HTMLButtonElement;
    public dropdowns: HTMLElement[];
    public modules: Array<IObjectMap<HTMLInputElement>>;
    public beacon: IObjectMap<HTMLInputElement>;
    public beaconCount: HTMLInputElement;
    public fuelCell: HTMLTableDataCellElement;
    public powerNode: HTMLElement;
    public groupMatches: (group: RecipeGroup) => boolean;
    public appendTo: (node: HTMLElement) => void;
    public setRates: (totals: Totals, items: IObjectMap<Rational>) => void;
    public remove: () => void;
    public totalPower: () => Rational;
    public hasModules: () => boolean;
    public setUpDownArrow: () => void;
    public setDownArrow: () => void;
    public setUpArrow: () => void;

    constructor(row: HTMLTableRowElement, recipe: Recipe) {
        this.node = row;
        const recipeName = recipe.name;
        this.recipe = recipe;
        this.factory = null;
        this.count = zero;
        this.power = null;

        this.factoryCell = document.createElement("td");
        this.factoryCell.classList.add("pad", "factory", "right-align", "leftmost");
        this.node.appendChild(this.factoryCell);

        const countCell = document.createElement("td");
        countCell.classList.add("factory", "right-align");
        let tt = document.createElement("tt");
        countCell.appendChild(tt);
        this.countNode = tt;
        this.node.appendChild(countCell);

        this.modulesCell = document.createElement("td");
        this.modulesCell.classList.add("pad", "module", "factory");
        this.node.appendChild(this.modulesCell);

        this.copyButton = document.createElement("button");
        this.copyButton.classList.add("ui", "copy");
        this.copyButton.textContent = "\u2192";
        this.copyButton.title = "copy to rest of modules";
        $(this.copyButton).click(ModuleCopyHandler(this));
        this.modulesCell.appendChild(this.copyButton);

        this.dropdowns = [];
        this.modules = [];

        const beaconCell = document.createElement("td");
        beaconCell.classList.add("pad", "module", "factory");
        const { inputs } = moduleDropdown(
            d3.select(beaconCell),
            "mod-" + recipeName + "-beacon",
            (d) => d === null,
            BeaconHandler(recipeName),
            (d) => d === null || d.canBeacon(),
        );
        this.beacon = inputs;
        const beaconX = document.createElement("span");
        beaconX.appendChild(new Text(" \u00D7 "));
        beaconCell.appendChild(beaconX);

        this.beaconCount = document.createElement("input");
        $(this.beaconCount).change(beaconCountHandler(recipeName));
        this.beaconCount.type = "number";
        this.beaconCount.value = String(0);
        this.beaconCount.classList.add("beacon");
        this.beaconCount.title = "The number of broadcasted modules which will affect this factory.";
        beaconCell.appendChild(this.beaconCount);
        this.node.appendChild(beaconCell);

        const downArrowCell = document.createElement("td");
        downArrowCell.classList.add("module", "factory");
        this.downArrow = document.createElement("button");
        this.downArrow.classList.add("ui");
        this.downArrow.textContent = "\u2195";
        this.downArrow.title = "copy this recipe's modules to all other recipes";
        $(this.downArrow).click(copyAllHandler(recipeName));
        downArrowCell.appendChild(this.downArrow);
        this.node.appendChild(downArrowCell);

        this.fuelCell = document.createElement("td");
        this.fuelCell.classList.add("pad", "factory");
        this.node.appendChild(this.fuelCell);
        const powerCell = document.createElement("td");
        powerCell.classList.add("factory", "right-align");
        tt = document.createElement("tt");
        powerCell.appendChild(tt);
        this.powerNode = tt;
        this.node.appendChild(powerCell);
    }

    public setPower(power: { fuel: string; power: Rational; }) {
        while (this.fuelCell.hasChildNodes()) {
            this.fuelCell.removeChild(this.fuelCell.lastChild);
        }
        if (power.fuel === "electric") {
            this.powerNode.textContent = alignPower(power.power);
        } else if (power.fuel === "chemical") {
            const fuelImage = getImage(preferredFuel);
            this.fuelCell.appendChild(fuelImage);
            this.fuelCell.appendChild(new Text(" \u00d7"));
            this.powerNode.textContent = alignRate(power.power.div(preferredFuel.value)) + "/" + SettingsState.rateName;
        }
    }

    public setHasModules() {
        this.node.classList.remove("no-mods");
    }

    public setHasNoModules() {
        this.node.classList.add("no-mods");
    }

    // Call whenever the minimum factory or factory count might change (e.g. in
    // response to speed modules being added/removed).
    //
    // This may change the factory icon, factory count, number (or presence)
    // of module slots, presence of the beacon info, and/or presence of the
    // module-copy buttons.
    public displayFactory(rate: Rational) {
        this.count = spec.getCount(this.recipe, rate);
        if (this.count.isZero()) {
            this.setHasNoModules();
            return;
        }
        this.factory = spec.getFactory(this.recipe);
        const image = getImage(this.factory.factory);
        image.classList.add("display");
        while (this.factoryCell.hasChildNodes()) {
            this.factoryCell.removeChild(this.factoryCell.lastChild);
        }
        if (this.recipe.displayGroup !== null || this.recipe.name !== this.recipe.products[0].item.name) {
            this.factoryCell.appendChild(getImage(this.recipe));
            this.factoryCell.appendChild(new Text(" : "));
        }
        this.factoryCell.appendChild(image);
        this.factoryCell.appendChild(new Text(" \u00d7"));
        this.countNode.textContent = alignCount(this.count);

        const moduleDelta = this.factory.modules.length - this.modules.length;
        if (moduleDelta < 0) {
            this.modules.length = this.factory.modules.length;
            for (let i = moduleDelta; i < 0; i++) {
                this.dropdowns.pop().remove();
            }
        } else if (moduleDelta > 0) {
            for (let i = 0; i < moduleDelta; i++) {
                const self = this;
                const index = this.dropdowns.length;
                const installedModule = this.factory.modules[index];
                const { dropdown, inputs } = moduleDropdown(
                    d3.select(this.modulesCell),
                    "mod-" + this.recipe.name + "-" + index,
                    (d) => d === installedModule,
                    ModuleHandler(this, index),
                    (d) => d === null || d.canUse(self.recipe),
                );
                this.dropdowns.push(dropdown.parentNode as HTMLElement);
                this.modules.push(inputs);
            }
        }
        if (moduleDelta !== 0) {
            if (this.dropdowns.length > 1) {
                this.modulesCell.insertBefore(this.copyButton, this.dropdowns[1]);
            } else {
                this.modulesCell.appendChild(this.copyButton);
            }
        }
        if (this.modules.length > 0) {
            this.setHasModules();
        } else {
            this.setHasNoModules();
        }
        this.power = this.factory.powerUsage(spec, this.count);
        this.setPower(this.power);
    }

    public updateDisplayedModules() {
        const moduleCount = spec.moduleCount(this.recipe);
        if (moduleCount === 0) {
            return;
        }
        for (let i = 0; i < moduleCount; i++) {
            const module = spec.getModule(this.recipe, i);
            this.setDisplayedModule(i, module);
        }
        // XXX
        const beacon = spec.getBeaconInfo(this.recipe);
        this.setDisplayedBeacon(beacon.module, beacon.count);
    }

    public setDisplayedModule(index: number, module: Module) {
        let name;
        if (module) {
            name = module.name;
        } else {
            name = NO_MODULE;
        }
        this.modules[index][name].checked = true;
    }

    public setDisplayedBeacon(module: Module, count: Rational) {
        let name;
        if (module) {
            name = module.name;
        } else {
            name = NO_MODULE;
        }
        this.beacon[name].checked = true;
        this.beaconCount.value = count.toString();
    }

    public csv() {
        const parts = [];
        if (this.count.isZero()) {
            parts.push("");
            parts.push("");
        } else {
            parts.push(this.factory.name);
            parts.push(displayCount(this.count));
        }
        if (this.factory && this.factory.modules.length > 0) {
            const modules = [];
            for (const module of this.factory.modules) {
                if (module) {
                    modules.push(module.shortName());
                } else {
                    modules.push("");
                }
            }
            parts.push(modules.join("/"));
            if (this.factory.beaconModule && !this.factory.beaconCount.isZero()) {
                parts.push(this.factory.beaconModule.shortName());
                parts.push(displayCount(this.factory.beaconCount));
            } else {
                parts.push("");
                parts.push("");
            }
        } else {
            parts.push("");
            parts.push("");
            parts.push("");
        }
        if (this.factory) {
            parts.push(displayCount(this.power.power));
        } else {
            parts.push("");
        }
        return [parts.join(",")];
    }
}

class GroupRow implements IRow {
    public name: string;
    public group: RecipeGroup;
    public items: IObjectMap<Item>;
    public itemNames: string[];
    public rows: HTMLTableRowElement[];
    public itemRows: ItemRow[];
    public itemRates: Rational[];
    public factoryRows: FactoryRow[];
    constructor(group: RecipeGroup, itemRates: IObjectMap<Rational>, totals: Totals) {
        this.name = group.id;
        this.group = group;
        this.items = {};
        for (const recipe of group.recipes) {
            for (const ing of recipe.products) {
                this.items[ing.item.name] = ing.item;
            }
        }
        this.itemNames = Object.keys(this.items);
        const recipeCount = group.recipes.length;
        const tableRows = Math.max(this.itemNames.length, recipeCount);
        this.rows = [];
        this.itemRows = [];
        this.itemRates = [];
        this.factoryRows = [];
        let row: HTMLTableRowElement;
        for (let i = 0; i < tableRows; i++) {
            row = document.createElement("tr");
            row.classList.add("display-row");
            row.classList.add("group-row");
            if (i < this.itemNames.length) {
                this.itemRows.push(new ItemRow(row, this.items[this.itemNames[i]], false));
            } else {
                row.appendChild(document.createElement("td"));
                row.appendChild(document.createElement("td"));
                row.appendChild(document.createElement("td"));
                row.appendChild(document.createElement("td"));
                const dummyWaste = document.createElement("td");
                dummyWaste.classList.add("waste");
                row.appendChild(dummyWaste);
            }
            if (i < recipeCount) {
                const recipe = group.recipes[i];
                this.factoryRows.push(new FactoryRow(row, recipe));
            } else {
                for (let j = 0; j < 7; j++) {
                    const cell = document.createElement("td");
                    cell.classList.add("factory");
                    if (j === 0) {
                        cell.classList.add("leftmost");
                    }
                    row.appendChild(cell);
                }
            }
            this.rows.push(row);
            // TODO: Making this work properly with GroupRow reqires a little more
            //       thought. Dummy it out for now.
            /*if (i === 0) {
                var popOutCell = makePopOutCell()
                row.appendChild(popOutCell)
                this.popOutLink = popOutCell.firstChild
            } else {*/
            row.appendChild(document.createElement("td"));
            /*}*/
        }
        this.rows[0].classList.add("group-top-row");
        row.classList.add("group-bottom-row");
        this.setRates(totals, itemRates);
        this.updateDisplayedModules();
    }

    public appendTo(parentNode: HTMLElement) {
        for (const row of this.rows) {
            parentNode.appendChild(row);
        }
    }

    public groupMatches(group: RecipeGroup) {
        return this.group.equal(group);
    }

    public setRates(totals: Totals, itemRates: IObjectMap<Rational>) {
        this.itemRates = [];
        const rates: IObjectMap<Rational> = {};
        for (let i = 0; i < this.itemNames.length; i++) {
            const itemName = this.itemNames[i];
            let rate = itemRates[itemName];
            rates[itemName] = rate;
            this.itemRates.push(rate);
            const waste = totals.getWaste(itemName);
            rate = rate.sub(waste);
            this.itemRows[i].setRate(rate, waste);
        }
        for (const row of this.factoryRows) {
            const recipeName = row.recipe.name;
            row.displayFactory(totals.get(recipeName));
        }
    }

    public totalPower() {
        let power = zero;
        for (const row of this.factoryRows) {
            const p = row.power;
            if (p.fuel === "electric") {
                power = power.add(p.power);
            }
        }
        return power;
    }

    public csv() {
        const lines = [];
        for (let i = 0; i < this.itemNames.length; i++) {
            const itemName = this.itemNames[i];
            const rate = displayRate(this.itemRates[i]);
            const parts = [itemName, rate, "", "", "", "", "", ""];
            lines.push(parts.join(","));
        }
        return lines;
    }

    public hasModules() {
        for (const row of this.factoryRows) {
            if (row.modules.length > 0) {
                return true;
            }
        }
        return false;
    }

    public setDownArrow() {
        for (const row of this.factoryRows) {
            if (row.modules.length > 0) {
                row.downArrow.textContent = "\u2193";
                return;
            }
        }
    }

    public setUpDownArrow() {
        for (const row of this.factoryRows) {
            row.downArrow.textContent = "\u2195";
        }
    }

    public setUpArrow() {
        for (let i = this.factoryRows.length - 1; i >= 0; i--) {
            const row = this.factoryRows[i];
            if (row.modules.length > 0) {
                row.downArrow.textContent = "\u2191";
                return;
            }
        }
    }

    public updateDisplayedModules() {
        for (const row of this.factoryRows) {
            row.updateDisplayedModules();
        }
    }

    public remove() {
        for (const row of this.rows) {
            row.parentElement.removeChild(row);
        }
    }
}

class RecipeGroup {
    public id: string;
    public recipes: Recipe[];
    constructor(id: string) {
        this.id = id;
        this.recipes = [];
    }

    public equal(other: RecipeGroup) {
        if (this.id !== other.id) {
            return false;
        }
        if (this.recipes.length !== other.recipes.length) {
            return false;
        }
        for (let i = 0; i < this.recipes.length; i++) {
            if (this.recipes[i].name !== other.recipes[i].name) {
                return false;
            }
        }
        return true;
    }
}

class RecipeTable {
    public node: HTMLElement;
    public recipeHeader: HTMLTableHeaderCellElement;
    public wasteHeader: HTMLTableHeaderCellElement;
    public totalRow: HTMLTableRowElement;
    public totalNode: HTMLElement;
    public rowArray: IRow[];
    public rows: IObjectMap<IRow>;
    constructor(node: HTMLElement) {
        this.node = node;
        const headers = [
            Header("items/" + SettingsState.rateName, 2),
            Header("belts", 2),
            Header("surplus/" + SettingsState.rateName),
            Header("factories", 2),
            Header("modules", 1),
            Header("beacons", 1),
            Header(""),
            Header("power", 2),
            Header(""),
        ];
        const header = document.createElement("tr");
        header.classList.add("factory-header");
        for (let i = 0; i < headers.length; i++) {
            const th = document.createElement("th");
            if (i === 0) {
                this.recipeHeader = th;
            }
            if (i === 2) {
                this.wasteHeader = th;
                th.classList.add("waste");
            }
            th.textContent = headers[i].name;
            th.colSpan = headers[i].colSpan;
            if (i > 0) {
                th.classList.add("pad");
            }
            header.appendChild(th);
        }
        node.appendChild(header);
        this.totalRow = document.createElement("tr");
        this.totalRow.classList.add("display-row");
        const dummyWaste = document.createElement("td");
        dummyWaste.classList.add("waste");
        this.totalRow.appendChild(dummyWaste);
        const totalLabelCell = document.createElement("td");
        totalLabelCell.colSpan = 10;
        totalLabelCell.classList.add("right-align");
        const totalLabel = document.createElement("b");
        totalLabel.textContent = "total power:";
        totalLabelCell.appendChild(totalLabel);
        this.totalRow.appendChild(totalLabelCell);
        const totalCell = document.createElement("td");
        totalCell.classList.add("right-align");
        this.totalNode = document.createElement("tt");
        totalCell.appendChild(this.totalNode);
        this.totalRow.appendChild(totalCell);

        this.rowArray = [];
        this.rows = {};
    }

    public setRecipeHeader() {
        this.recipeHeader.textContent = "items/" + SettingsState.rateName;
        this.wasteHeader.textContent = "surplus/" + SettingsState.rateName;
    }

    public updateDisplayedModules() {
        for (const row of this.rowArray) {
            row.updateDisplayedModules();
        }
    }

    public displaySolution(totals: Totals) {
        this.setRecipeHeader();
        let sortedTotals;
        if (State.sortOrder === "topo") {
            sortedTotals = totals.topo;
        } else {
            sortedTotals = sorted(totals.totals);
        }
        // var itemOrder = []
        const items: IObjectMap<Rational> = {};
        const groups: RecipeGroup[] = [];
        const groupMap: IObjectMap<RecipeGroup> = {};
        let group: RecipeGroup;
        for (const recipeName of sortedTotals) {
            const recipeRate = totals.totals[recipeName];
            const recipe = solver.recipes[recipeName];
            for (const ing of recipe.products) {
                if (!(ing.item.name in items)) {
                    // itemOrder.push(ing.item.name)
                    items[ing.item.name] = zero;
                }
                items[ing.item.name] = items[ing.item.name].add(recipeRate.mul(recipe.gives(ing.item, spec)));
            }
            if (recipe.displayGroup === null) {
                group = new RecipeGroup(null);
                groups.push(group);
            } else {
                if (recipe.displayGroup in groupMap) {
                    group = groupMap[recipe.displayGroup];
                } else {
                    group = new RecipeGroup(recipe.displayGroup);
                    groupMap[recipe.displayGroup] = group;
                    groups.push(group);
                }
            }
            group.recipes.push(recipe);
        }
        // XXX: Rework this, too.
        // displaySteps(items, itemOrder, totals)
        let last;
        const newRowArray: IRow[] = [];
        let downArrowShown = false;
        let sameRows = true;
        let totalPower = zero;
        const csvLines = ["item,item rate,factory,count,modules,beacon module,beacon count,power"];
        let csvWidth = csvLines[0].length;
        const knownRows: IObjectMap<boolean> = {};
        const drop: string[] = [];
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            // XXX: Bluh
            let rowName = group.id;
            if (!rowName) {
                rowName = group.recipes[0].name;
            }
            knownRows[rowName] = true;
            let row: IRow = this.rows[rowName];
            let groupMatch = false;
            if (group.id === null || row && row.groupMatches(group)) {
                groupMatch = true;
            }
            if (row && groupMatch) {
                if (sameRows && rowName !== this.rowArray[i].name) {
                    sameRows = false;
                }
                // Don't rearrange the DOM if we don't need to.
                if (!sameRows) {
                    row.appendTo(this.node);
                }
                row.setRates(totals, items);
            } else {
                if (group.id === null) {
                    const rate = totals.get(rowName);
                    const recipe = group.recipes[0];
                    const itemName = recipe.products[0].item.name;
                    const itemRate = items[itemName];
                    const waste = totals.getWaste(rowName);
                    row = new RecipeRow(rowName, rate, itemRate, waste);
                } else {
                    if (row) {
                        row.remove();
                    }
                    row = new GroupRow(group, items, totals);
                }
                row.appendTo(this.node);
                this.rows[rowName] = row;
                sameRows = false;
            }
            totalPower = totalPower.add(row.totalPower());
            const newCSVLines = row.csv();
            for (const csvLine of newCSVLines) {
                if (csvLine.length > csvWidth) {
                    csvWidth = csvLine.length;
                }
                csvLines.push(csvLine);
            }
            newRowArray.push(row);
            if (row.hasModules()) {
                last = row;
                if (downArrowShown) {
                    row.setUpDownArrow();
                } else {
                    downArrowShown = true;
                    row.setDownArrow();
                }
            }
        }
        this.rowArray = newRowArray;
        if (last) {
            last.setUpArrow();
        }
        for (const recipeName in this.rows) {
            if (!(recipeName in knownRows)) {
                drop.push(recipeName);
            }
        }
        for (const toDrop of drop) {
            this.rows[toDrop].remove();
            delete this.rows[toDrop];
        }
        this.node.appendChild(this.totalRow);
        this.totalNode.textContent = alignPower(totalPower);
        const csv = $("#csv");
        csv.val(csvLines.join("\n") + "\n");
        csv.prop("cols", csvWidth + 2);
        csv.prop("rows", csvLines.length + 2);

        const wasteCells = document.querySelectorAll("td.waste, th.waste");
        const showWaste = Object.keys(totals.waste).length > 0;
        for (const cell of wasteCells) {
            if (showWaste) {
                cell.classList.remove("waste-hide");
            } else {
                cell.classList.add("waste-hide");
            }
        }
    }
}

let timesDisplayed = zero;

// Re-renders the current solution, without re-computing it.
function display() {
    // Update the display of the target rate text boxes, if needed.
    for (const target of TargetState.build_targets) {
        target.getRate();
    }
    const totals = globalTotals;

    window.location.hash = "#" + formatSettings();

    if (EventsState.currentTab === "graph_tab") {
        renderGraph(totals, spec.ignore);
    }
    recipeTable.displaySolution(totals);
    if (SettingsState.showDebug) {
        renderDebug();
    }

    timesDisplayed = timesDisplayed.add(one);
    const dc = document.getElementById("display_count");
    dc.textContent = timesDisplayed.toDecimal();
}

export {
    State,
    formatName,
    displayRate,
    displayCount,
    alignRate,
    alignCount,
    alignPower,
    pruneSpec,
    globalTotals,
    itemUpdate,
    Header,
    NO_MODULE,
    BeltIcon,
    RecipeRow,
    FactoryRow,
    RecipeTable,
    display,
};
