import d3 = require("d3");
import $ = require("jquery");
import { ColorScheme, colorSchemes } from "./color";
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
import { Fuel } from "./fuel";
import { getImage } from "./icon";
import { belts, fuel, shortModules, solver, spec } from "./init";
import { moduleDropdown } from "./module";
import { one, Rational, RationalFromFloat, RationalFromFloats, RationalFromString, zero } from "./rational";
import { pipeThroughput } from "./steps";
import { IObjectMap } from "./utility-types";

const State = {} as {
    countPrecision: number;
    DEFAULT_FURNACE: string;
    displayFormat: string;
    displayRateFactor: Rational;
    linkLength: number;
    maxNodeHeight: number;
    rateName: string;
    ratePrecision: number;
    showDebug: boolean;
    tooltipsEnabled: boolean;
    visDirection: string;
    visualizer: string;
};

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

const MODIFICATIONS: IObjectMap<Modification> = {
    "0-16-51": new Modification("Vanilla 0.16.51", "vanilla-0.16.51.json", true, [480, 512]),
    "0-16-51x": new Modification("Vanilla 0.16.51 - Expensive", "vanilla-0.16.51-expensive.json", true, [480, 512]),
    "0-17-1": new Modification("Vanilla 0.17.1", "vanilla-0.17.1.json", false, [480, 512]),
    "0-17-1x": new Modification("Vanilla 0.17.1 - Expensive", "vanilla-0.17.1-expensive.json", false, [480, 512]),
    "017science": new Modification("0.16.51 w/ 0.17 science mod", "017science-0.16.51.json", true, [480, 512]),
    "bobs-0-16-51":
        new Modification("(EXPERIMENTAL) Bob's Mods + base 0.16.51", "bobs-0.16.51.json", true, [800, 832]),
};

let DEFAULT_MODIFICATION = "0-16-51";

function addOverrideOptions(version: string) {
    const tag = "local-" + version.replace(/\./g, "-");
    MODIFICATIONS[tag] = new Modification("Local game data " + version, "local-" + version + ".json");
    MODIFICATIONS[tag + "x"] = new Modification("Local game data " + version + " - Expensive", "local-" +
        version + "-expensive.json");
    DEFAULT_MODIFICATION = tag;
}

// Ideally we'd write this as a generalized function, but for now we can hard-
// code these version upgrades.
const modUpdates: IObjectMap<string> = {
    "0-16-37": "0-16-51",
    "0-16-37x": "0-16-51x",
    "bobs-0-16-37": "bobs-0-16-51",
};

function normalizeDataSetName(modName: string) {
    const newName = modUpdates[modName];
    if (newName) {
        return newName;
    }
    return modName;
}

function renderDataSetOptions(settings: IObjectMap<string>) {
    const modSelector = document.getElementById("data_set");
    const configuredMod = normalizeDataSetName(settings.data);
    for (const modName of Object.keys(MODIFICATIONS)) {
        const mod = MODIFICATIONS[modName];
        const option = document.createElement("option");
        option.textContent = mod.name;
        option.value = modName;
        if (configuredMod && configuredMod === modName || !configuredMod && modName === DEFAULT_MODIFICATION) {
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
const DEFAULT_COLOR_SCHEME = "default";

let colorScheme: ColorScheme;

function renderColorScheme(settings: IObjectMap<string>) {
    let color = DEFAULT_COLOR_SCHEME;
    if ("c" in settings) {
        color = settings.c;
    }
    setColorScheme(color);
    const colorSelector = document.getElementById("color_scheme");
    if (!colorSelector.hasChildNodes()) {
        for (const scheme of colorSchemes) {
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
    for (const scheme of colorSchemes) {
        if (scheme.name === schemeName) {
            colorScheme = scheme;
            colorScheme.apply();
            return;
        }
    }
}

// display rate
const seconds = one;
const minutes = RationalFromFloat(60);
const hours = RationalFromFloat(3600);

const displayRates: IObjectMap<Rational> = {
    h: hours,
    m: minutes,
    s: seconds,
};
const longRateNames: IObjectMap<string> = {
    h: "hour",
    m: "minute",
    s: "second",
};

const DEFAULT_RATE = "m";

State.displayRateFactor = displayRates[DEFAULT_RATE];
State.rateName = DEFAULT_RATE;

function renderRateOptions(settings: IObjectMap<string>) {
    State.rateName = DEFAULT_RATE;
    if ("rate" in settings) {
        State.rateName = settings.rate;
    }
    State.displayRateFactor = displayRates[State.rateName];
    const oldNode = document.getElementById("display_rate");
    const cell = oldNode.parentNode;
    const node = document.createElement("form");
    node.id = "display_rate";
    for (const name of Object.keys(displayRates)) {
        const rate = displayRates[name];
        const input = document.createElement("input");
        input.id = name + "_rate";
        input.type = "radio";
        input.name = "rate";
        input.value = name;
        if (rate.equal(State.displayRateFactor)) {
            input.checked = true;
        }
        $(input).change(displayRateHandler);
        node.appendChild(input);
        const label = document.createElement("label");
        label.htmlFor = name + "_rate";
        label.textContent = "items/" + longRateNames[name];
        node.appendChild(label);
        node.appendChild(document.createElement("br"));
    }
    cell.replaceChild(node, oldNode);
}

// precisions
const DEFAULT_RATE_PRECISION = 3;
State.ratePrecision = DEFAULT_RATE_PRECISION;

const DEFAULT_COUNT_PRECISION = 1;
State.countPrecision = DEFAULT_COUNT_PRECISION;

function renderPrecisions(settings: IObjectMap<string>) {
    State.ratePrecision = DEFAULT_RATE_PRECISION;
    if ("rp" in settings) {
        State.ratePrecision = Number(settings.rp);
    }
    (document.getElementById("rprec") as HTMLInputElement).value = String(State.ratePrecision);
    State.countPrecision = DEFAULT_COUNT_PRECISION;
    if ("cp" in settings) {
        State.countPrecision = Number(settings.cp);
    }
    (document.getElementById("fprec") as HTMLInputElement).value = String(State.countPrecision);
}

// minimum assembler
const DEFAULT_MINIMUM = "1";

let minimumAssembler = DEFAULT_MINIMUM;

function renderMinimumAssembler(settings: IObjectMap<string>) {
    let min = DEFAULT_MINIMUM;
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
    minimumAssembler = min;
}

// furnace

// Assigned during FactorySpec initialization.
State.DEFAULT_FURNACE = null;

function renderFurnace(settings: IObjectMap<string>) {
    let furnaceName = State.DEFAULT_FURNACE;
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
const DEFAULT_FUEL = "coal";

let preferredFuel: Fuel;

function renderFuel(settings: IObjectMap<string>) {
    let fuelName = DEFAULT_FUEL;
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
    for (const f of fuel) {
        if (f.name === name) {
            preferredFuel = f;
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

const OIL_OPTIONS = [
    new Oil("advanced-oil-processing", "default"),
    new Oil("basic-oil-processing", "basic"),
    new Oil("coal-liquefaction", "coal"),
];

const DEFAULT_OIL = "default";

const OIL_EXCLUSION: IObjectMap<IObjectMap<boolean>> = {
    basic: { "advanced-oil-processing": true },
    coal: { "advanced-oil-processing": true, "basic-oil-processing": true },
    default: {},
};

let oilGroup = DEFAULT_OIL;

function renderOil(settings: IObjectMap<string>) {
    let oil = DEFAULT_OIL;
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
    const inputs = dropdown.selectAll("div").data(OIL_OPTIONS).join("div");
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
    solver.removeDisabledRecipes(OIL_EXCLUSION[oilGroup]);
    oilGroup = name;
    solver.addDisabledRecipes(OIL_EXCLUSION[oilGroup]);
}

// kovarex
const DEFAULT_KOVAREX = true;

let kovarexEnabled: boolean;

function renderKovarex(settings: IObjectMap<string>) {
    let k = DEFAULT_KOVAREX;
    if ("k" in settings) {
        k = settings.k !== "off";
    }
    setKovarex(k);
    const input = document.getElementById("kovarex") as HTMLInputElement;
    input.checked = k;
}

function setKovarex(enabled: boolean) {
    kovarexEnabled = enabled;
    if (enabled) {
        solver.removeDisabledRecipes({ "kovarex-enrichment-process": true });
    } else {
        solver.addDisabledRecipes({ "kovarex-enrichment-process": true });
    }
}

// belt
const DEFAULT_BELT = "transport-belt";

let preferredBelt = DEFAULT_BELT;
let preferredBeltSpeed: Rational = null;

function renderBelt(settings: IObjectMap<string>) {
    let pref = DEFAULT_BELT;
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
        (d) => d.name === preferredBelt,
        changeBelt,
    );
    labels.append((d: any) => getImage(new BeltIcon(solver.items[d.name], d.speed), false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

function setPreferredBelt(name: string) {
    for (const belt of belts) {
        if (belt.name === name) {
            preferredBelt = name;
            preferredBeltSpeed = belt.speed;
        }
    }
}

// pipe
const DEFAULT_PIPE = RationalFromFloat(17);

let minPipeLength = DEFAULT_PIPE;
let maxPipeThroughput: Rational = null;

function renderPipe(settings: IObjectMap<string>) {
    let pipe = DEFAULT_PIPE.toDecimal(0);
    if ("pipe" in settings) {
        pipe = settings.pipe;
    }
    setMinPipe(pipe);
    (document.getElementById("pipe_length") as HTMLInputElement).value = minPipeLength.toDecimal(0);
}

function setMinPipe(lengthString: string) {
    minPipeLength = RationalFromString(lengthString);
    maxPipeThroughput = pipeThroughput(minPipeLength);
}

// mining productivity bonus
const DEFAULT_MINING_PROD = "0";

function renderMiningProd(settings: IObjectMap<string>) {
    let mprod = DEFAULT_MINING_PROD;
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
const DEFAULT_VISUALIZER = "sankey";

State.visualizer = DEFAULT_VISUALIZER;

function renderVisualizerType(settings: IObjectMap<string>) {
    State.visualizer = DEFAULT_VISUALIZER;
    if ("vis" in settings) {
        State.visualizer = settings.vis;
    }
    const input = document.getElementById("vis_" + State.visualizer) as HTMLInputElement;
    input.checked = true;
}

const DEFAULT_DIRECTION = "right";

State.visDirection = DEFAULT_DIRECTION;

function renderVisualizerDirection(settings: IObjectMap<string>) {
    State.visDirection = DEFAULT_DIRECTION;
    if ("vd" in settings) {
        State.visDirection = settings.vd;
    }
    const input = document.getElementById("visdir_" + State.visDirection) as HTMLInputElement;
    input.checked = true;
}

const DEFAULT_NODE_BREADTH = 175;

State.maxNodeHeight = DEFAULT_NODE_BREADTH;

function renderNodeBreadth(settings: IObjectMap<string>) {
    State.maxNodeHeight = DEFAULT_NODE_BREADTH;
    if ("nh" in settings) {
        State.maxNodeHeight = Number(settings.nh);
    }
    const input = document.getElementById("vis-node-breadth") as HTMLInputElement;
    input.value = String(State.maxNodeHeight);
}

const DEFAULT_LINK_LENGTH = 200;

State.linkLength = DEFAULT_LINK_LENGTH;

function renderLinkLength(settings: IObjectMap<string>) {
    State.linkLength = DEFAULT_LINK_LENGTH;
    if ("ll" in settings) {
        State.linkLength = Number(settings.ll);
    }
    const input = document.getElementById("vis-link-length") as HTMLInputElement;
    input.value = String(State.linkLength);
}

// value format
const DEFAULT_FORMAT = "decimal";

State.displayFormat = DEFAULT_FORMAT;

const displayFormats: IObjectMap<string> = {
    d: "decimal",
    r: "rational",
};

function renderValueFormat(settings: IObjectMap<string>) {
    State.displayFormat = DEFAULT_FORMAT;
    if ("vf" in settings) {
        State.displayFormat = displayFormats[settings.vf];
    }
    const input = document.getElementById(State.displayFormat + "_format") as HTMLInputElement;
    input.checked = true;
}

// tooltips
const DEFAULT_TOOLTIP = true;

State.tooltipsEnabled = DEFAULT_TOOLTIP;

function renderTooltip(settings: IObjectMap<string>) {
    State.tooltipsEnabled = DEFAULT_TOOLTIP;
    if ("t" in settings) {
        State.tooltipsEnabled = settings.t !== "off";
    }
    const input = document.getElementById("tooltip") as HTMLInputElement;
    input.checked = State.tooltipsEnabled;
}

// debug tab
const DEFAULT_DEBUG = false;

State.showDebug = DEFAULT_DEBUG;

function renderShowDebug(settings: IObjectMap<string>) {
    State.showDebug = DEFAULT_DEBUG;
    if ("debug" in settings) {
        State.showDebug = settings.debug === "on";
    }
    const debug = document.getElementById("render_debug") as HTMLInputElement;
    debug.checked = State.showDebug;
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
    State,
    MODIFICATIONS,
    DEFAULT_MODIFICATION,
    addOverrideOptions,
    renderDataSetOptions,
    currentMod,
    DEFAULT_COLOR_SCHEME,
    colorScheme,
    setColorScheme,
    displayRates,
    longRateNames,
    DEFAULT_RATE,
    DEFAULT_RATE_PRECISION,
    DEFAULT_COUNT_PRECISION,
    DEFAULT_MINIMUM,
    minimumAssembler,
    setMinimumAssembler,
    DEFAULT_FUEL,
    preferredFuel,
    setPreferredFuel,
    Oil,
    DEFAULT_OIL,
    oilGroup,
    setOilRecipe,
    DEFAULT_KOVAREX,
    kovarexEnabled,
    setKovarex,
    DEFAULT_BELT,
    preferredBelt,
    preferredBeltSpeed,
    setPreferredBelt,
    DEFAULT_PIPE,
    minPipeLength,
    maxPipeThroughput,
    setMinPipe,
    getMprod,
    DEFAULT_VISUALIZER,
    DEFAULT_DIRECTION,
    DEFAULT_NODE_BREADTH,
    DEFAULT_LINK_LENGTH,
    DEFAULT_FORMAT,
    DEFAULT_TOOLTIP,
    DEFAULT_DEBUG,
    renderSettings,
};
