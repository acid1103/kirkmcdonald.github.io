import d3 = require("d3");
import $ = require("jquery");
import { Belt, getBelts } from "./belt";
import { Data } from "./data";
import { globalTotals, itemUpdate, pruneSpec, RecipeTable } from "./display";
import {
    changeColor,
    changeDefaultBeaconCount,
    changeFormat,
    changeFPrec,
    changeKovarex,
    changeLinkLength,
    changeMod,
    changeMprod,
    changeNodeBreadth,
    changePipeLength,
    changeRPrec,
    changeSortOrder,
    changeTooltip,
    changeVisualizerDirection,
    changeVisualizerType,
    clickTab,
    clickVisualize,
    plusHandler,
    State as EventsState,
    toggleDebug,
    toggleVisible,
    toggleVisualizerSettings,
} from "./events";
import { FactorySpec, getFactories } from "./factory";
import { formatSettings, loadSettings } from "./fragment";
import { Fuel, getFuel } from "./fuel";
import { getItemGroups } from "./group";
import { getSprites } from "./icon";
import { Item } from "./item";
import { getModules, Module } from "./module";
import { RationalFromFloat } from "./rational";
import { getRecipeGraph } from "./recipe";
import {
    addOverrideOptions,
    currentMod,
    DEFAULT_MODIFICATION,
    MODIFICATIONS,
    renderDataSetOptions,
    renderSettings,
} from "./settings";
import { Solver } from "./solve";
import { sorted } from "./sort";
import { addTarget, State as TargetState } from "./target";
import { IObjectMap } from "./utility-types";

(window as any).d3 = d3;

// postpone initing until the DOM has been fully loaded
const readyStateCheckInterval = setInterval(() => {
    if (document.readyState === "complete") {
        clearInterval(readyStateCheckInterval);
        init();
    }
}, 10);

let recipeTable: RecipeTable = null;
// Contains collections of items and recipes. (solve.js)
let solver: Solver = null;
// Contains module and factory settings, as well as other settings. (factory.js)
let spec: FactorySpec = null;
// Map from module name to Module object.
let modules: IObjectMap<Module> = null;
// Array of modules, sorted by 'order'.
let sortedModules: string[] = null;
// Map from short module name to Module object.
let shortModules: IObjectMap<Module> = null;
// Array of arrays of modules, separated by category and sorted.
let moduleRows: Module[][] = null;
// Array of Belt objects, sorted by speed.
let belts: Belt[] = null;
// Array of Fuel objects, sorted by value.
let fuel: Fuel[] = null;
// Array of item groups, in turn divided into subgroups. For display purposes.
let itemGroups: Item[][][] = null;
// Boolean with whether to use old (0.16) calculations.
let useLegacyCalculations: boolean = false;
// Size of the sprite sheet, as [x, y] array.
let spriteSheetSize: number[] = null;
let initDone: boolean = false;
let OVERRIDE: string = null;

// Set the page back to a state immediately following initial setup, but before
// the dataset is loaded for the first time.
//
// This is intended to be called when the top-level dataset is changed.
// Therefore, it also resets the fragment and settings.
function reset() {
    window.location.hash = "";

    TargetState.build_targets = [];
    const targetList = $("#targets");
    const plus = $("#targets").children(":last-child");
    const newTargetList = $('<ul id="targets" class="targets">');
    newTargetList.append(plus);
    targetList.replaceWith(newTargetList);

    const oldSteps = $("#steps");
    const newSteps = $('<table id="steps">');
    oldSteps.replaceWith(newSteps);

    const oldTotals = $("#totals");
    const newTotals = $('<table id="totals">');
    oldTotals.replaceWith(newTotals);
}

function loadDataRunner(modName: string, callback: (data: Data) => void) {
    const xobj = new XMLHttpRequest();
    let mod = MODIFICATIONS[modName];
    if (!mod) {
        mod = MODIFICATIONS[DEFAULT_MODIFICATION];
    }
    spriteSheetSize = mod.sheetSize;
    useLegacyCalculations = mod.legacy;
    const filename = "data/" + mod.filename;
    xobj.overrideMimeType("application/json");
    xobj.open("GET", filename, true);
    xobj.onreadystatechange = function() {
        if (xobj.readyState === 4 && xobj.status === 200) {
            const data = JSON.parse(xobj.responseText);
            callback(data);
        }
    };
    xobj.send(null);
}

function loadData(modName: string, settings?: IObjectMap<string>) {
    recipeTable = new RecipeTable($("#totals")[0]);
    if (!settings) {
        settings = {};
    }
    loadDataRunner(modName, function(data) {
        getSprites(data);
        const graph = getRecipeGraph(data);
        modules = getModules(data);
        sortedModules = sorted(modules, (m: string) => modules[m].order);
        moduleRows = [];
        let category = null;
        for (const moduleName of sortedModules) {
            const module = modules[moduleName];
            if (module.category !== category) {
                category = module.category;
                moduleRows.push([]);
            }
            moduleRows[moduleRows.length - 1].push(module);
        }
        shortModules = {};
        for (const moduleName in modules) {
            const module = modules[moduleName];
            shortModules[module.shortName()] = module;
        }
        const factories = getFactories(data);
        spec = new FactorySpec(factories);
        if ("ignore" in settings) {
            const ignore = settings.ignore.split(",");
            for (let i = 0; i < ignore.length; i++) {
                spec.ignore[ignore[i]] = true;
            }
        }

        const items = graph[0];
        const recipes = graph[1];

        belts = getBelts(data);
        fuel = getFuel(data, items).chemical;

        itemGroups = getItemGroups(items, data);
        solver = new Solver(items, recipes);

        renderSettings(settings);

        solver.findSubgraphs(spec);

        if ("items" in settings && settings.items !== "") {
            const targets = settings.items.split(",");
            for (let i = 0; i < targets.length; i++) {
                const targetString = targets[i];
                const parts = targetString.split(":");
                const name = parts[0];
                const target = addTarget(name);
                const type = parts[1];
                if (type === "f") {
                    const j = parts[2].indexOf(";");
                    if (j === -1) {
                        target.setFactories(0, parts[2]);
                    } else {
                        const count = parts[2].slice(0, j);
                        const idx = Number(parts[2].slice(j + 1));
                        target.setFactories(idx, count);
                        target.displayRecipes();
                    }
                } else if (type === "r") {
                    target.setRate(parts[2]);
                } else {
                    throw new Error("unknown target type");
                }
            }
        } else {
            addTarget();
        }
        if ("modules" in settings && settings.modules !== "") {
            const moduleSettings = settings.modules.split(",");
            for (let i = 0; i < moduleSettings.length; i++) {
                const bothSettings = moduleSettings[i].split(";");
                const factoryModuleSettings = bothSettings[0];
                let beaconSettings = bothSettings[1];

                const singleModuleSettings = factoryModuleSettings.split(":");
                const recipeName = singleModuleSettings[0];
                const recipe = recipes[recipeName];
                const moduleNameList = singleModuleSettings.slice(1);
                for (let j = 0; j < moduleNameList.length; j++) {
                    const moduleName = moduleNameList[j];
                    if (moduleName) {
                        let module;
                        if (moduleName in modules) {
                            module = modules[moduleName];
                        } else if (moduleName in shortModules) {
                            module = shortModules[moduleName];
                        } else if (moduleName === "null") {
                            module = null;
                        }
                        if (module !== undefined) {
                            spec.setModule(recipe, j, module);
                        }
                    }
                }
                if (beaconSettings) {
                    const beaconSettingsSplit = beaconSettings.split(":");
                    const moduleName = beaconSettingsSplit[0];
                    let module;
                    if (moduleName in modules) {
                        module = modules[moduleName];
                    } else if (moduleName in shortModules) {
                        module = shortModules[moduleName];
                    } else if (moduleName === "null") {
                        module = null;
                    }
                    const factory = spec.getFactory(recipe);
                    if (factory) {
                        const count = RationalFromFloat(Number(beaconSettingsSplit[1]));
                        factory.beaconModule = module;
                        factory.beaconCount = count;
                    }
                }
            }
        }
        initDone = true;
        itemUpdate();

        // Prune factory spec after first solution is calculated.
        pruneSpec(globalTotals);
        window.location.hash = "#" + formatSettings();
    });
}

function init() {
    $("#add_item").click(plusHandler);

    $("#totals_button").click(() => clickTab("totals_tab"));
    $("#graph_button").click(() => clickVisualize("graph_tab"));
    $("#settings_button").click(() => clickTab("settings_tab"));
    $("#faq_button").click(() => clickTab("faq_tab"));
    $("#about_button").click(() => clickTab("about_tab"));
    $("#debug_button").click(() => clickTab("debug_tab"));

    $("#csv_button").click(() => toggleVisible("csv_box"));

    $("#visualizer_settings_toggle").click(toggleVisualizerSettings);

    $("#vis_sankey").change(changeVisualizerType);
    $("#vis_box").change(changeVisualizerType);

    $("#visdir_right").change(changeVisualizerDirection);
    $("#visdir_down").change(changeVisualizerDirection);

    $("#vis-node-breadth").change(changeNodeBreadth);
    $("#vis-link-length").change(changeLinkLength);

    $("#data_set").change(changeMod);
    $("#color_scheme").change(changeColor);
    $("#rprec").change(changeRPrec);
    $("#fprec").change(changeFPrec);
    $("#kovarex").change(changeKovarex);
    $("#pipe_length").change(changePipeLength);
    $("#mprod").change(changeMprod);
    $("#default_beacon_count").change(changeDefaultBeaconCount);
    $("#topo_order").change(changeSortOrder);
    $("#alpha_order").change(changeSortOrder);
    $("#decimal_format").change(changeFormat);
    $("#rational_format").change(changeFormat);
    $("#tooltip").change(changeTooltip);

    $("#render_debug").change(toggleDebug);

    const settings = loadSettings(window.location.hash);
    if (OVERRIDE !== null) {
        addOverrideOptions(OVERRIDE);
    }
    renderDataSetOptions(settings);
    if ("tab" in settings) {
        EventsState.currentTab = settings.tab + "_tab";
    }
    loadData(currentMod(), settings);
    // We don't need to call clickVisualize here, as we will properly render
    // the graph when we call itemUpdate() at the end of initialization.
    clickTab(EventsState.currentTab);
}

export {
    reset,
    loadData,
    recipeTable,
    solver,
    spec,
    shortModules,
    moduleRows,
    belts,
    fuel,
    itemGroups,
    useLegacyCalculations,
    spriteSheetSize,
    initDone,
};
