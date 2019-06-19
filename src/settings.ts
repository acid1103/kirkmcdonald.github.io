import d3 = require("d3");
import $ = require("jquery");
import { colorSchemes } from "./color";
import { BeltIcon } from "./display";
import { addInputs, makeDropdown } from "./dropdown";
import {
    changeBelt,
    changeDefaultBeacon,
    changeDefaultModule,
    changeFuel,
    changeFurnace,
    changeMin,
    changeOil,
    displayRateHandler,
} from "./events";
import { getImage } from "./icon";
import { belts, fuel, shortModules, solver, spec, } from "./init";
import { moduleDropdown } from "./module";
import { one, RationalFromFloat, RationalFromFloats, RationalFromString, zero } from "./rational";
import { pipeThroughput } from "./steps";
import { IObjectMap } from "./utility-types";
import { SettingsState } from "./window-interface";

// data set
class Modification {
    public name: string;
    public filename: string;
    public legacy: boolean;
    public sheetSize: [number, number];
    constructor(name: string, filename: string, legacy?: boolean, sheetSize?: [number, number]) {
        this.name = name;
        this.filename = filename;
        this.legacy = legacy;
        this.sheetSize = sheetSize;
    }
}

SettingsState.MODIFICATIONS = {
    "0-16-51": new Modification("Vanilla 0.16.51", "vanilla-0.16.51.json", true, [480, 512]),
    "0-16-51x": new Modification("Vanilla 0.16.51 - Expensive", "vanilla-0.16.51-expensive.json", true, [480, 512]),
    "0-17-1": new Modification("Vanilla 0.17.1", "vanilla-0.17.1.json", false, [480, 512]),
    "0-17-1x": new Modification("Vanilla 0.17.1 - Expensive", "vanilla-0.17.1-expensive.json", false, [480, 512]),
    "017science": new Modification("0.16.51 w/ 0.17 science mod", "017science-0.16.51.json", true, [480, 512]),
    "bobs-0-16-51":
        new Modification("(EXPERIMENTAL) Bob's Mods + base 0.16.51", "bobs-0.16.51.json", true, [800, 832]),
};

SettingsState.DEFAULT_MODIFICATION = "0-16-51";

function addOverrideOptions(version: string) {
    const tag = "local-" + version.replace(/\./g, "-");
    SettingsState.MODIFICATIONS[tag] = new Modification("Local game data " + version, "local-" + version + ".json");
    SettingsState.MODIFICATIONS[tag + "x"] = new Modification("Local game data " + version + " - Expensive", "local-" +
        version + "-expensive.json");
    SettingsState.DEFAULT_MODIFICATION = tag;
}

// Ideally we'd write this as a generalized function, but for now we can hard-
// code these version upgrades.
SettingsState.modUpdates = {
    "0-16-37": "0-16-51",
    "0-16-37x": "0-16-51x",
    "bobs-0-16-37": "bobs-0-16-51",
};

function normalizeDataSetName(modName: string) {
    const newName = SettingsState.modUpdates[modName];
    if (newName) {
        return newName;
    }
    return modName;
}

function renderDataSetOptions(settings: IObjectMap<string>) {
    const modSelector = document.getElementById("data_set");
    const configuredMod = normalizeDataSetName(settings.data);
    for (const modName in SettingsState.MODIFICATIONS) {
        const mod = SettingsState.MODIFICATIONS[modName];
        const option = document.createElement("option");
        option.textContent = mod.name;
        option.value = modName;
        if (configuredMod && configuredMod === modName || !configuredMod && modName === SettingsState.DEFAULT_MODIFICATION) {
            option.selected = true;
        }
        modSelector.appendChild(option);
    }
}

// Returns currently-selected data set.
function currentMod() {
    const elem = document.getElementById("data_set") as HTMLSelectElement;
    return elem.value;
}

// color scheme
SettingsState.DEFAULT_COLOR_SCHEME = "default";
SettingsState.colorScheme = null;

function renderColorScheme(settings: IObjectMap<string>) {
    let color = SettingsState.DEFAULT_COLOR_SCHEME;
    if ("c" in settings) {
        color = settings.c;
    }
    setColorScheme(color);
    const colorSelector = document.getElementById("color_scheme");
    if (!colorSelector.hasChildNodes()) {
        for (let i = 0; i < colorSchemes.length; i++) {
            const scheme = colorSchemes[i];
            const option = document.createElement("option");
            option.textContent = scheme.displayName;
            option.value = scheme.name;
            if (scheme.name === color) {
                option.selected = true;
            }
            colorSelector.appendChild(option);
        }
    }
}

function setColorScheme(schemeName: string) {
    for (let i = 0; i < colorSchemes.length; i++) {
        if (colorSchemes[i].name === schemeName) {
            SettingsState.colorScheme = colorSchemes[i];
            SettingsState.colorScheme.apply();
            return;
        }
    }
}

// display rate
SettingsState.seconds = one;
SettingsState.minutes = RationalFromFloat(60);
SettingsState.hours = RationalFromFloat(3600);
SettingsState.displayRates = {
    h: SettingsState.hours,
    m: SettingsState.minutes,
    s: SettingsState.seconds,
};
SettingsState.longRateNames = {
    h: "hour",
    m: "minute",
    s: "second",
};
SettingsState.DEFAULT_RATE = "m";
SettingsState.displayRateFactor = SettingsState.displayRates[SettingsState.DEFAULT_RATE];
SettingsState.rateName = SettingsState.DEFAULT_RATE;

function renderRateOptions(settings: IObjectMap<string>) {
    SettingsState.rateName = SettingsState.DEFAULT_RATE;
    if ("rate" in settings) {
        SettingsState.rateName = settings.rate;
    }
    SettingsState.displayRateFactor = SettingsState.displayRates[SettingsState.rateName];
    const oldNode = document.getElementById("display_rate");
    const cell = oldNode.parentNode;
    const node = document.createElement("form");
    node.id = "display_rate";
    for (const name in SettingsState.displayRates) {
        const rate = SettingsState.displayRates[name];
        const input = document.createElement("input");
        input.id = name + "_rate";
        input.type = "radio";
        input.name = "rate";
        input.value = name;
        if (rate.equal(SettingsState.displayRateFactor)) {
            input.checked = true;
        }
        $(input).change(displayRateHandler);
        node.appendChild(input);
        const label = document.createElement("label");
        label.htmlFor = name + "_rate";
        label.textContent = "items/" + SettingsState.longRateNames[name];
        node.appendChild(label);
        node.appendChild(document.createElement("br"));
    }
    cell.replaceChild(node, oldNode);
}

// precisions
SettingsState.DEFAULT_RATE_PRECISION = 3;
SettingsState.ratePrecision = SettingsState.DEFAULT_RATE_PRECISION;
SettingsState.DEFAULT_COUNT_PRECISION = 1;
SettingsState.countPrecision = SettingsState.DEFAULT_COUNT_PRECISION;

function renderPrecisions(settings: IObjectMap<string>) {
    SettingsState.ratePrecision = SettingsState.DEFAULT_RATE_PRECISION;
    if ("rp" in settings) {
        SettingsState.ratePrecision = Number(settings.rp);
    }
    (document.getElementById("rprec") as HTMLInputElement).value = String(SettingsState.ratePrecision);
    SettingsState.countPrecision = SettingsState.DEFAULT_COUNT_PRECISION;
    if ("cp" in settings) {
        SettingsState.countPrecision = Number(settings.cp);
    }
    (document.getElementById("fprec") as HTMLInputElement).value = String(SettingsState.countPrecision);
}

// minimum assembler
SettingsState.DEFAULT_MINIMUM = "1";
SettingsState.minimumAssembler = SettingsState.DEFAULT_MINIMUM;

function renderMinimumAssembler(settings: IObjectMap<string>) {
    let min = SettingsState.DEFAULT_MINIMUM;
    // Backward compatibility.
    if ("use_3" in settings && settings.use_3 === "true") {
        min = "3";
    }
    const assemblers = spec.factories.crafting;
    if ("min" in settings && Number(min) >= 1 && Number(min) <= assemblers.length) {
        min = settings.min;
    }
    setMinimumAssembler(min);
    const oldNode = document.getElementById("minimum_assembler");
    const cell = oldNode.parentNode;
    const node = document.createElement("span");
    node.id = "minimum_assembler";
    const dropdown = makeDropdown(d3.select(node));
    const inputs = dropdown.selectAll("div").data(assemblers).join("div");
    const labels = addInputs(
        inputs,
        "assembler_dropdown",
        (d, i) => String(i + 1) === min,
        (d, i) => changeMin(String(i + 1)),
    );
    labels.append((d: any) => getImage(d, false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

function setMinimumAssembler(min: string) {
    spec.setMinimum(min);
    SettingsState.minimumAssembler = min;
}

// furnace

// Assigned during FactorySpec initialization.
SettingsState.DEFAULT_FURNACE = null;

function renderFurnace(settings: IObjectMap<string>) {
    let furnaceName = SettingsState.DEFAULT_FURNACE;
    if ("furnace" in settings) {
        furnaceName = settings.furnace;
    }
    if (furnaceName !== spec.furnace.name) {
        spec.setFurnace(furnaceName);
    }
    const oldNode = document.getElementById("furnace");
    const cell = oldNode.parentNode;
    const node = document.createElement("span");
    node.id = "furnace";
    const furnaces = spec.factories.smelting;
    const dropdown = makeDropdown(d3.select(node));
    const inputs = dropdown.selectAll("div").data(furnaces).join("div");
    const labels = addInputs(
        inputs,
        "furnace_dropdown",
        (d) => d.name === furnaceName,
        changeFurnace,
    );
    labels.append((d: any) => getImage(d, false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

// fuel
SettingsState.DEFAULT_FUEL = "coal";
SettingsState.preferredFuel = null;

function renderFuel(settings: IObjectMap<string>) {
    let fuelName = SettingsState.DEFAULT_FUEL;
    if ("fuel" in settings) {
        fuelName = settings.fuel;
    }
    setPreferredFuel(fuelName);
    const oldNode = document.getElementById("fuel");
    const cell = oldNode.parentNode;
    const node = document.createElement("span");
    node.id = "fuel";
    const dropdown = makeDropdown(d3.select(node));
    const inputs = dropdown.selectAll("div").data(fuel).join("div");
    const labels = addInputs(
        inputs,
        "fuel_dropdown",
        (d) => d.name === fuelName,
        changeFuel,
    );
    labels.append((d: any) => {
        const im = getImage(d, false, dropdown.node());
        im.title += " (" + d.valueString() + ")";
        return im;
    });
    cell.replaceChild(node, oldNode);
}

function setPreferredFuel(name: string) {
    for (let i = 0; i < fuel.length; i++) {
        const f = fuel[i];
        if (f.name === name) {
            SettingsState.preferredFuel = f;
        }
    }
}

// oil
class Oil {
    public name: string;
    public priority: string;
    constructor(recipeName: string, priorityName: string) {
        this.name = recipeName;
        this.priority = priorityName;
    }
}

SettingsState.OIL_OPTIONS = [
    new Oil("advanced-oil-processing", "default"),
    new Oil("basic-oil-processing", "basic"),
    new Oil("coal-liquefaction", "coal"),
];
SettingsState.DEFAULT_OIL = "default";
SettingsState.OIL_EXCLUSION = {
    basic: { "advanced-oil-processing": true },
    coal: { "advanced-oil-processing": true, "basic-oil-processing": true },
    default: {},
};
SettingsState.oilGroup = SettingsState.DEFAULT_OIL;

function renderOil(settings: IObjectMap<string>) {
    let oil = SettingsState.DEFAULT_OIL;
    // Named "p" for historical reasons.
    if ("p" in settings) {
        oil = settings.p;
    }
    setOilRecipe(oil);
    const oldNode = document.getElementById("oil");
    const cell = oldNode.parentNode;
    const node = document.createElement("span");
    node.id = "oil";
    const dropdown = makeDropdown(d3.select(node));
    const inputs = dropdown.selectAll("div").data(SettingsState.OIL_OPTIONS).join("div");
    const labels = addInputs(
        inputs,
        "oil_dropdown",
        (d) => d.priority === oil,
        changeOil,
    );
    labels.append((d: any) => getImage(solver.recipes[d.name], false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

function setOilRecipe(name: string) {
    solver.removeDisabledRecipes(SettingsState.OIL_EXCLUSION[SettingsState.oilGroup]);
    SettingsState.oilGroup = name;
    solver.addDisabledRecipes(SettingsState.OIL_EXCLUSION[SettingsState.oilGroup]);
}

// kovarex
SettingsState.DEFAULT_KOVAREX = true;
SettingsState.kovarexEnabled = false;

function renderKovarex(settings: IObjectMap<string>) {
    let k = SettingsState.DEFAULT_KOVAREX;
    if ("k" in settings) {
        k = settings.k !== "off";
    }
    setKovarex(k);
    const input = document.getElementById("kovarex") as HTMLInputElement;
    input.checked = k;
}

function setKovarex(enabled: boolean) {
    SettingsState.kovarexEnabled = enabled;
    if (enabled) {
        solver.removeDisabledRecipes({ "kovarex-enrichment-process": true });
    } else {
        solver.addDisabledRecipes({ "kovarex-enrichment-process": true });
    }
}

// belt
SettingsState.DEFAULT_BELT = "transport-belt";
SettingsState.preferredBelt = SettingsState.DEFAULT_BELT;
SettingsState.preferredBeltSpeed = null;

function renderBelt(settings: IObjectMap<string>) {
    let pref = SettingsState.DEFAULT_BELT;
    if ("belt" in settings) {
        pref = settings.belt;
    }
    setPreferredBelt(pref);
    const oldNode = document.getElementById("belt");
    const cell = oldNode.parentNode;
    const node = document.createElement("span");
    node.id = "belt";
    const dropdown = makeDropdown(d3.select(node));
    const inputs = dropdown.selectAll("div").data(belts).join("div");
    const labels = addInputs(
        inputs,
        "belt_dropdown",
        (d) => d.name === SettingsState.preferredBelt,
        changeBelt,
    );
    labels.append((d: any) => getImage(new BeltIcon(solver.items[d.name], d.speed), false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

function setPreferredBelt(name: string) {
    for (let i = 0; i < belts.length; i++) {
        const belt = belts[i];
        if (belt.name === name) {
            SettingsState.preferredBelt = name;
            SettingsState.preferredBeltSpeed = belt.speed;
        }
    }
}

// pipe
SettingsState.DEFAULT_PIPE = RationalFromFloat(17);
SettingsState.minPipeLength = SettingsState.DEFAULT_PIPE;
SettingsState.maxPipeThroughput = null;

function renderPipe(settings: IObjectMap<string>) {
    let pipe = SettingsState.DEFAULT_PIPE.toDecimal(0);
    if ("pipe" in settings) {
        pipe = settings.pipe;
    }
    setMinPipe(pipe);
    (document.getElementById("pipe_length") as HTMLInputElement).value = SettingsState.minPipeLength.toDecimal(0);
}

function setMinPipe(lengthString: string) {
    SettingsState.minPipeLength = RationalFromString(lengthString);
    SettingsState.maxPipeThroughput = pipeThroughput(SettingsState.minPipeLength);
}

// mining productivity bonus
SettingsState.DEFAULT_MINING_PROD = "0";

function renderMiningProd(settings: IObjectMap<string>) {
    let mprod = SettingsState.DEFAULT_MINING_PROD;
    if ("mprod" in settings) {
        mprod = settings.mprod;
    }
    const mprodInput = document.getElementById("mprod") as HTMLInputElement;
    mprodInput.value = mprod;
    spec.miningProd = getMprod();
}

function getMprod() {
    const mprod = (document.getElementById("mprod") as HTMLInputElement).value;
    return RationalFromFloats(Number(mprod), 100);
}

// default module
function renderDefaultModule(settings: IObjectMap<string>) {
    let defaultModule: any = null;
    if ("dm" in settings) {
        defaultModule = shortModules[settings.dm];
    }
    spec.setDefaultModule(defaultModule);

    const oldDefMod = document.getElementById("default_module");
    const cell = oldDefMod.parentNode;
    const node = document.createElement("span");
    node.id = "default_module";
    moduleDropdown(
        d3.select(node),
        "default_module_dropdown",
        (d) => d === defaultModule,
        changeDefaultModule,
    );
    cell.replaceChild(node, oldDefMod);
}

// default beacon
function renderDefaultBeacon(settings: IObjectMap<string>) {
    let defaultBeacon: any = null;
    let defaultCount = zero;
    if ("db" in settings) {
        defaultBeacon = shortModules[settings.db];
    }
    if ("dbc" in settings) {
        defaultCount = RationalFromString(settings.dbc);
    }
    spec.setDefaultBeacon(defaultBeacon, defaultCount);

    const dbcField = document.getElementById("default_beacon_count") as HTMLInputElement;
    dbcField.value = defaultCount.toDecimal(0);

    const oldDefMod = document.getElementById("default_beacon");
    const cell = oldDefMod.parentNode;
    const node = document.createElement("span");
    node.id = "default_beacon";
    moduleDropdown(
        d3.select(node),
        "default_beacon_dropdown",
        (d: any) => d === defaultBeacon,
        changeDefaultBeacon,
        (d) => d === null || d.canBeacon(),
    );
    cell.replaceChild(node, oldDefMod);
}

// visualizer settings
SettingsState.DEFAULT_VISUALIZER = "sankey";
SettingsState.visualizer = SettingsState.DEFAULT_VISUALIZER;

function renderVisualizerType(settings: IObjectMap<string>) {
    SettingsState.visualizer = SettingsState.DEFAULT_VISUALIZER;
    if ("vis" in settings) {
        SettingsState.visualizer = settings.vis;
    }
    const input = document.getElementById("vis_" + SettingsState.visualizer) as HTMLInputElement;
    input.checked = true;
}

SettingsState.DEFAULT_DIRECTION = "right";
SettingsState.visDirection = SettingsState.DEFAULT_DIRECTION;

function renderVisualizerDirection(settings: IObjectMap<string>) {
    SettingsState.visDirection = SettingsState.DEFAULT_DIRECTION;
    if ("vd" in settings) {
        SettingsState.visDirection = settings.vd;
    }
    const input = document.getElementById("visdir_" + SettingsState.visDirection) as HTMLInputElement;
    input.checked = true;
}

SettingsState.DEFAULT_NODE_BREADTH = 175;
SettingsState.maxNodeHeight = SettingsState.DEFAULT_NODE_BREADTH;

function renderNodeBreadth(settings: IObjectMap<string>) {
    SettingsState.maxNodeHeight = SettingsState.DEFAULT_NODE_BREADTH;
    if ("nh" in settings) {
        SettingsState.maxNodeHeight = Number(settings.nh);
    }
    const input = document.getElementById("vis-node-breadth") as HTMLInputElement;
    input.value = String(SettingsState.maxNodeHeight);
}

SettingsState.DEFAULT_LINK_LENGTH = 200;
SettingsState.linkLength = SettingsState.DEFAULT_LINK_LENGTH;

function renderLinkLength(settings: IObjectMap<string>) {
    SettingsState.linkLength = SettingsState.DEFAULT_LINK_LENGTH;
    if ("ll" in settings) {
        SettingsState.linkLength = Number(settings.ll);
    }
    const input = document.getElementById("vis-link-length") as HTMLInputElement;
    input.value = String(SettingsState.linkLength);
}

// value format
SettingsState.DEFAULT_FORMAT = "decimal";
SettingsState.displayFormat = SettingsState.DEFAULT_FORMAT;
SettingsState.displayFormats = {
    d: "decimal",
    r: "rational",
};

function renderValueFormat(settings: IObjectMap<string>) {
    SettingsState.displayFormat = SettingsState.DEFAULT_FORMAT;
    if ("vf" in settings) {
        SettingsState.displayFormat = SettingsState.displayFormats[settings.vf];
    }
    const input = document.getElementById(SettingsState.displayFormat + "_format") as HTMLInputElement;
    input.checked = true;
}

// tooltips
SettingsState.DEFAULT_TOOLTIP = true;
SettingsState.tooltipsEnabled = SettingsState.DEFAULT_TOOLTIP;

function renderTooltip(settings: IObjectMap<string>) {
    SettingsState.tooltipsEnabled = SettingsState.DEFAULT_TOOLTIP;
    if ("t" in settings) {
        SettingsState.tooltipsEnabled = settings.t !== "off";
    }
    const input = document.getElementById("tooltip") as HTMLInputElement;
    input.checked = SettingsState.tooltipsEnabled;
}

// debug tab
SettingsState.DEFAULT_DEBUG = false;
SettingsState.showDebug = SettingsState.DEFAULT_DEBUG;

function renderShowDebug(settings: IObjectMap<string>) {
    SettingsState.showDebug = SettingsState.DEFAULT_DEBUG;
    if ("debug" in settings) {
        SettingsState.showDebug = settings.debug === "on";
    }
    const debug = document.getElementById("render_debug") as HTMLInputElement;
    debug.checked = SettingsState.showDebug;
}

// all
function renderSettings(settings: IObjectMap<string>) {
    renderTooltip(settings);
    renderColorScheme(settings);
    renderRateOptions(settings);
    renderPrecisions(settings);
    renderMinimumAssembler(settings);
    renderFurnace(settings);
    renderFuel(settings);
    renderOil(settings);
    renderKovarex(settings);
    renderBelt(settings);
    renderPipe(settings);
    renderMiningProd(settings);
    renderDefaultModule(settings);
    renderDefaultBeacon(settings);
    renderVisualizerType(settings);
    renderVisualizerDirection(settings);
    renderNodeBreadth(settings);
    renderLinkLength(settings);
    renderValueFormat(settings);
}

export {
    Modification,
    Oil,
    addOverrideOptions,
    renderDataSetOptions,
    currentMod,
    setColorScheme,
    setMinimumAssembler,
    setPreferredFuel,
    setOilRecipe,
    setKovarex,
    setPreferredBelt,
    setMinPipe,
    getMprod,
    renderSettings,
};
