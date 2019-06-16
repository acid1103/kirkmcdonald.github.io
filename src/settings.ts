import { window } from "./globals";
import { InitState } from "./init";
import { IObjectMap } from "./utility-types";

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

class Oil {
    public name: string;
    public priority: string;
    constructor(recipeName: string, priorityName: string) {
        this.name = recipeName;
        this.priority = priorityName;
    }
}

class SettingsState {
    public static MODIFICATIONS: IObjectMap<Modification> = {
        "0-16-51": new Modification("Vanilla 0.16.51", "vanilla-0.16.51.json", true, [480, 512]),
        "0-16-51x": new Modification("Vanilla 0.16.51 - Expensive", "vanilla-0.16.51-expensive.json", true, [480, 512]),
        "0-17-1": new Modification("Vanilla 0.17.1", "vanilla-0.17.1.json", false, [480, 512]),
        "0-17-1x": new Modification("Vanilla 0.17.1 - Expensive", "vanilla-0.17.1-expensive.json", false, [480, 512]),
        "017science": new Modification("0.16.51 w/ 0.17 science mod", "017science-0.16.51.json", true, [480, 512]),
        "bobs-0-16-51":
            new Modification("(EXPERIMENTAL) Bob's Mods + base 0.16.51", "bobs-0.16.51.json", true, [800, 832]),
    };
    public static DEFAULT_MODIFICATION = "0-16-51";
    // Ideally we'd write this as a generalized function, but for now we can hard-
    // code these version upgrades.
    public static modUpdates: IObjectMap<string> = {
        "0-16-37": "0-16-51",
        "0-16-37x": "0-16-51x",
        "bobs-0-16-37": "bobs-0-16-51",
    };
    public static DEFAULT_COLOR_SCHEME = "default";
    public static colorScheme: any = null; // TODO ColorScheme type instead of any type
    public static seconds = window.one;
    public static minutes = window.RationalFromFloat(60);
    public static hours = window.RationalFromFloat(3600);
    public static displayRates: IObjectMap<any> = {
        h: SettingsState.hours,
        m: SettingsState.minutes,
        s: SettingsState.seconds,
    };
    public static longRateNames: IObjectMap<string> = {
        h: "hour",
        m: "minute",
        s: "second",
    };
    public static DEFAULT_RATE = "m";
    public static displayRateFactor = SettingsState.displayRates[SettingsState.DEFAULT_RATE];
    public static rateName = SettingsState.DEFAULT_RATE;
    public static DEFAULT_RATE_PRECISION = 3;
    public static ratePrecision = SettingsState.DEFAULT_RATE_PRECISION;
    public static DEFAULT_COUNT_PRECISION = 1;
    public static countPrecision = SettingsState.DEFAULT_COUNT_PRECISION;
    public static DEFAULT_MINIMUM = "1";
    public static minimumAssembler = SettingsState.DEFAULT_MINIMUM;
    public static DEFAULT_FURNACE: string = null;
    public static DEFAULT_FUEL = "coal";
    public static preferredFuel: any = null; // TODO Fuel type instead of any type
    public static OIL_OPTIONS = [
        new Oil("advanced-oil-processing", "default"),
        new Oil("basic-oil-processing", "basic"),
        new Oil("coal-liquefaction", "coal"),
    ];
    public static DEFAULT_OIL = "default";
    public static OIL_EXCLUSION: IObjectMap<IObjectMap<boolean>> = {
        basic: { "advanced-oil-processing": true },
        coal: { "advanced-oil-processing": true, "basic-oil-processing": true },
        default: {},
    };
    public static oilGroup = SettingsState.DEFAULT_OIL;
    public static DEFAULT_KOVAREX = true;
    public static kovarexEnabled: boolean = false;
    public static DEFAULT_BELT = "transport-belt";
    public static preferredBelt = SettingsState.DEFAULT_BELT;
    public static preferredBeltSpeed: any = null; // TODO Rational type instead of any type
    public static DEFAULT_PIPE = window.RationalFromFloat(17);
    public static minPipeLength = SettingsState.DEFAULT_PIPE;
    public static maxPipeThroughput: any = null; // TODO Rational type instead of any type
    public static DEFAULT_MINING_PROD = "0";
    public static DEFAULT_VISUALIZER = "sankey";
    public static visualizer = SettingsState.DEFAULT_VISUALIZER;
    public static DEFAULT_DIRECTION = "right";
    public static visDirection = SettingsState.DEFAULT_DIRECTION;
    public static DEFAULT_NODE_BREADTH = 175;
    public static maxNodeHeight = SettingsState.DEFAULT_NODE_BREADTH;
    public static DEFAULT_LINK_LENGTH = 200;
    public static linkLength = SettingsState.DEFAULT_LINK_LENGTH;
    public static DEFAULT_FORMAT = "decimal";
    public static displayFormat = SettingsState.DEFAULT_FORMAT;
    public static displayFormats: IObjectMap<string> = {
        d: "decimal",
        r: "rational",
    };
    public static DEFAULT_TOOLTIP = true;
    public static tooltipsEnabled = SettingsState.DEFAULT_TOOLTIP;
    public static DEFAULT_DEBUG = false;
    public static showDebug = SettingsState.DEFAULT_DEBUG;
}

function addOverrideOptions(version: string) {
    const tag = "local-" + version.replace(/\./g, "-");
    SettingsState.MODIFICATIONS[tag] = new Modification("Local game data " + version, "local-" + version + ".json");
    SettingsState.MODIFICATIONS[tag + "x"] = new Modification("Local game data " + version + " - Expensive", "local-" +
        version + "-expensive.json");
    SettingsState.DEFAULT_MODIFICATION = tag;
}

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

function renderColorScheme(settings: IObjectMap<string>) {
    let color = SettingsState.DEFAULT_COLOR_SCHEME;
    if ("c" in settings) {
        color = settings.c;
    }
    setColorScheme(color);
    const colorSelector = document.getElementById("color_scheme");
    if (!colorSelector.hasChildNodes()) {
        for (let i = 0; i < window.colorSchemes.length; i++) {
            const scheme = window.colorSchemes[i];
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
    for (let i = 0; i < window.colorSchemes.length; i++) {
        if (window.colorSchemes[i].name === schemeName) {
            SettingsState.colorScheme = window.colorSchemes[i];
            SettingsState.colorScheme.apply();
            return;
        }
    }
}

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
        input.addEventListener("change", window.displayRateHandler);
        node.appendChild(input);
        const label = document.createElement("label");
        label.htmlFor = name + "_rate";
        label.textContent = "items/" + SettingsState.longRateNames[name];
        node.appendChild(label);
        node.appendChild(document.createElement("br"));
    }
    cell.replaceChild(node, oldNode);
}

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

function renderMinimumAssembler(settings: IObjectMap<string>) {
    let min = SettingsState.DEFAULT_MINIMUM;
    // Backward compatibility.
    if ("use_3" in settings && settings.use_3 === "true") {
        min = "3";
    }
    const assemblers = InitState.spec.factories.crafting;
    if ("min" in settings && Number(min) >= 1 && Number(min) <= assemblers.length) {
        min = settings.min;
    }
    setMinimumAssembler(min);
    const oldNode = document.getElementById("minimum_assembler");
    const cell = oldNode.parentNode;
    const node = document.createElement("span");
    node.id = "minimum_assembler";
    const dropdown = window.makeDropdown(window.d3.select(node));
    const inputs = dropdown.selectAll("div").data(assemblers).join("div");
    const labels = window.addInputs(
        inputs,
        "assembler_dropdown",
        (d, i) => String(i + 1) === min,
        (d, i) => window.changeMin(String(i + 1)),
    );
    labels.append((d: any) => window.getImage(d, false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

function setMinimumAssembler(min: string) {
    InitState.spec.setMinimum(min);
    SettingsState.minimumAssembler = min;
}

function renderFurnace(settings: IObjectMap<string>) {
    let furnaceName = SettingsState.DEFAULT_FURNACE;
    if ("furnace" in settings) {
        furnaceName = settings.furnace;
    }
    if (furnaceName !== InitState.spec.furnace.name) {
        InitState.spec.setFurnace(furnaceName);
    }
    const oldNode = document.getElementById("furnace");
    const cell = oldNode.parentNode;
    const node = document.createElement("span");
    node.id = "furnace";
    const furnaces = InitState.spec.factories.smelting;
    const dropdown = window.makeDropdown(window.d3.select(node));
    const inputs = dropdown.selectAll("div").data(furnaces).join("div");
    const labels = window.addInputs(
        inputs,
        "furnace_dropdown",
        (d) => d.name === furnaceName,
        window.changeFurnace,
    );
    labels.append((d: any) => window.getImage(d, false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

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
    const dropdown = window.makeDropdown(window.d3.select(node));
    const inputs = dropdown.selectAll("div").data(InitState.fuel).join("div");
    const labels = window.addInputs(
        inputs,
        "fuel_dropdown",
        (d) => d.name === fuelName,
        window.changeFuel,
    );
    labels.append((d: any) => {
        const im = window.getImage(d, false, dropdown.node());
        im.title += " (" + d.valueString() + ")";
        return im;
    });
    cell.replaceChild(node, oldNode);
}

function setPreferredFuel(name: string) {
    for (let i = 0; i < InitState.fuel.length; i++) {
        const f = InitState.fuel[i];
        if (f.name === name) {
            SettingsState.preferredFuel = f;
        }
    }
}

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
    const dropdown = window.makeDropdown(window.d3.select(node));
    const inputs = dropdown.selectAll("div").data(SettingsState.OIL_OPTIONS).join("div");
    const labels = window.addInputs(
        inputs,
        "oil_dropdown",
        (d) => d.priority === oil,
        window.changeOil,
    );
    labels.append((d: any) => window.getImage(InitState.solver.recipes[d.name], false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

function setOilRecipe(name: string) {
    InitState.solver.removeDisabledRecipes(SettingsState.OIL_EXCLUSION[SettingsState.oilGroup]);
    SettingsState.oilGroup = name;
    InitState.solver.addDisabledRecipes(SettingsState.OIL_EXCLUSION[SettingsState.oilGroup]);
}

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
        InitState.solver.removeDisabledRecipes({ "kovarex-enrichment-process": true });
    } else {
        InitState.solver.addDisabledRecipes({ "kovarex-enrichment-process": true });
    }
}

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
    const dropdown = window.makeDropdown(window.d3.select(node));
    const inputs = dropdown.selectAll("div").data(InitState.belts).join("div");
    const labels = window.addInputs(
        inputs,
        "belt_dropdown",
        (d) => d.name === SettingsState.preferredBelt,
        window.changeBelt,
    );
    labels.append((d: any) => window.getImage(new window.BeltIcon(InitState.solver.items[d.name], d.speed), false, dropdown.node()));
    cell.replaceChild(node, oldNode);
}

function setPreferredBelt(name: string) {
    for (let i = 0; i < InitState.belts.length; i++) {
        const belt = InitState.belts[i];
        if (belt.name === name) {
            SettingsState.preferredBelt = name;
            SettingsState.preferredBeltSpeed = belt.speed;
        }
    }
}

function renderPipe(settings: IObjectMap<string>) {
    let pipe = SettingsState.DEFAULT_PIPE.toDecimal(0);
    if ("pipe" in settings) {
        pipe = settings.pipe;
    }
    setMinPipe(pipe);
    (document.getElementById("pipe_length") as HTMLInputElement).value = SettingsState.minPipeLength.toDecimal(0);
}

function setMinPipe(lengthString: string) {
    SettingsState.minPipeLength = window.RationalFromString(lengthString);
    SettingsState.maxPipeThroughput = window.pipeThroughput(SettingsState.minPipeLength);
}

function renderMiningProd(settings: IObjectMap<string>) {
    let mprod = SettingsState.DEFAULT_MINING_PROD;
    if ("mprod" in settings) {
        mprod = settings.mprod;
    }
    const mprodInput = document.getElementById("mprod") as HTMLInputElement;
    mprodInput.value = mprod;
    InitState.spec.miningProd = getMprod();
}

function getMprod() {
    const mprod = (document.getElementById("mprod") as HTMLInputElement).value;
    return window.RationalFromFloats(Number(mprod), 100);
}

// default module
function renderDefaultModule(settings: IObjectMap<string>) {
    let defaultModule: any = null;
    if ("dm" in settings) {
        defaultModule = InitState.shortModules[settings.dm];
    }
    InitState.spec.setDefaultModule(defaultModule);

    const oldDefMod = document.getElementById("default_module");
    const cell = oldDefMod.parentNode;
    const node = document.createElement("span");
    node.id = "default_module";
    window.moduleDropdown(
        window.d3.select(node),
        "default_module_dropdown",
        (d) => d === defaultModule,
        window.changeDefaultModule,
    );
    cell.replaceChild(node, oldDefMod);
}

// default beacon
function renderDefaultBeacon(settings: IObjectMap<string>) {
    let defaultBeacon: any = null;
    let defaultCount = window.zero;
    if ("db" in settings) {
        defaultBeacon = InitState.shortModules[settings.db];
    }
    if ("dbc" in settings) {
        defaultCount = window.RationalFromString(settings.dbc);
    }
    InitState.spec.setDefaultBeacon(defaultBeacon, defaultCount);

    const dbcField = document.getElementById("default_beacon_count") as HTMLInputElement;
    dbcField.value = defaultCount.toDecimal(0);

    const oldDefMod = document.getElementById("default_beacon");
    const cell = oldDefMod.parentNode;
    const node = document.createElement("span");
    node.id = "default_beacon";
    window.moduleDropdown(
        window.d3.select(node),
        "default_beacon_dropdown",
        (d: any) => d === defaultBeacon,
        window.changeDefaultBeacon,
        (d) => d === null || d.canBeacon(),
    );
    cell.replaceChild(node, oldDefMod);
}

function renderVisualizerType(settings: IObjectMap<string>) {
    SettingsState.visualizer = SettingsState.DEFAULT_VISUALIZER;
    if ("vis" in settings) {
        SettingsState.visualizer = settings.vis;
    }
    const input = document.getElementById("vis_" + SettingsState.visualizer) as HTMLInputElement;
    input.checked = true;
}

function renderVisualizerDirection(settings: IObjectMap<string>) {
    SettingsState.visDirection = SettingsState.DEFAULT_DIRECTION;
    if ("vd" in settings) {
        SettingsState.visDirection = settings.vd;
    }
    const input = document.getElementById("visdir_" + SettingsState.visDirection) as HTMLInputElement;
    input.checked = true;
}

function renderNodeBreadth(settings: IObjectMap<string>) {
    SettingsState.maxNodeHeight = SettingsState.DEFAULT_NODE_BREADTH;
    if ("nh" in settings) {
        SettingsState.maxNodeHeight = Number(settings.nh);
    }
    const input = document.getElementById("vis-node-breadth") as HTMLInputElement;
    input.value = String(SettingsState.maxNodeHeight);
}

function renderLinkLength(settings: IObjectMap<string>) {
    SettingsState.linkLength = SettingsState.DEFAULT_LINK_LENGTH;
    if ("ll" in settings) {
        SettingsState.linkLength = Number(settings.ll);
    }
    const input = document.getElementById("vis-link-length") as HTMLInputElement;
    input.value = String(SettingsState.linkLength);
}

function renderValueFormat(settings: IObjectMap<string>) {
    SettingsState.displayFormat = SettingsState.DEFAULT_FORMAT;
    if ("vf" in settings) {
        SettingsState.displayFormat = SettingsState.displayFormats[settings.vf];
    }
    const input = document.getElementById(SettingsState.displayFormat + "_format") as HTMLInputElement;
    input.checked = true;
}

function renderTooltip(settings: IObjectMap<string>) {
    SettingsState.tooltipsEnabled = SettingsState.DEFAULT_TOOLTIP;
    if ("t" in settings) {
        SettingsState.tooltipsEnabled = settings.t !== "off";
    }
    const input = document.getElementById("tooltip") as HTMLInputElement;
    input.checked = SettingsState.tooltipsEnabled;
}

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

// export vars to window
(() => {
    for (const key of Object.keys(SettingsState)) {
        moveObjToWindow(SettingsState, key);
    }
    moveFnToWindow(Modification);
    moveFnToWindow(Oil);
    moveFnToWindow(addOverrideOptions);
    moveFnToWindow(normalizeDataSetName);
    moveFnToWindow(renderDataSetOptions);
    moveFnToWindow(currentMod);
    moveFnToWindow(renderColorScheme);
    moveFnToWindow(setColorScheme);
    moveFnToWindow(renderRateOptions);
    moveFnToWindow(renderPrecisions);
    moveFnToWindow(renderMinimumAssembler);
    moveFnToWindow(setMinimumAssembler);
    moveFnToWindow(renderFurnace);
    moveFnToWindow(renderFuel);
    moveFnToWindow(setPreferredFuel);
    moveFnToWindow(renderOil);
    moveFnToWindow(setOilRecipe);
    moveFnToWindow(renderKovarex);
    moveFnToWindow(setKovarex);
    moveFnToWindow(renderBelt);
    moveFnToWindow(setPreferredBelt);
    moveFnToWindow(renderPipe);
    moveFnToWindow(setMinPipe);
    moveFnToWindow(renderMiningProd);
    moveFnToWindow(getMprod);
    moveFnToWindow(renderDefaultModule);
    moveFnToWindow(renderDefaultBeacon);
    moveFnToWindow(renderVisualizerType);
    moveFnToWindow(renderVisualizerDirection);
    moveFnToWindow(renderNodeBreadth);
    moveFnToWindow(renderLinkLength);
    moveFnToWindow(renderValueFormat);
    moveFnToWindow(renderTooltip);
    moveFnToWindow(renderShowDebug);
    moveFnToWindow(renderSettings);
    function moveFnToWindow(fn: { name: string }) {
        (window as unknown as any)[fn.name] = fn;
    }
    function moveObjToWindow(obj: any, key: string) {
        (window as unknown as any)[key] = obj[key];
    }
})();

export {
    Modification,
    Oil,
    SettingsState,
    addOverrideOptions,
    normalizeDataSetName,
    renderDataSetOptions,
    currentMod,
    renderColorScheme,
    setColorScheme,
    renderRateOptions,
    renderPrecisions,
    renderMinimumAssembler,
    setMinimumAssembler,
    renderFurnace,
    renderFuel,
    setPreferredFuel,
    renderOil,
    setOilRecipe,
    renderKovarex,
    setKovarex,
    renderBelt,
    setPreferredBelt,
    renderPipe,
    setMinPipe,
    renderMiningProd,
    getMprod,
    renderDefaultModule,
    renderDefaultBeacon,
    renderVisualizerType,
    renderVisualizerDirection,
    renderNodeBreadth,
    renderLinkLength,
    renderValueFormat,
    renderTooltip,
    renderShowDebug,
    renderSettings,
};
