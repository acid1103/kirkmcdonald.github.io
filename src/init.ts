import $ = require("jquery");
import { window as TEMP_WINDOW_STORAGE } from "./globals";
import { addOverrideOptions, currentMod, renderDataSetOptions, renderSettings, SettingsState } from "./settings";
import { IObjectMap } from "./utility-types";

// postpone initing until the DOM has been fully loaded
const readyStateCheckInterval = setInterval(() => {
    if (document.readyState === "complete") {
        clearInterval(readyStateCheckInterval);
        init();
    }
}, 10);

class InitState {
    public static recipeTable: any = null; // TODO RecipeTable type instead of any
    // Contains collections of items and recipes. (solve.js)
    public static solver: any = null; // TODO Solver type instead of any
    // Contains module and factory settings, as well as other settings. (factory.js)
    public static spec: any = null; // TODO FactorySpec type instead of any
    // Map from module name to Module object.
    public static modules: any = null; // TODO IObjectMap<Modules> type instead of any
    // Array of modules, sorted by 'order'.
    public static sortedModules: string[] = null;
    // Map from short module name to Module object.
    public static shortModules: any = null; // TODO IObjectMap<Module> type instead of any
    // Array of arrays of modules, separated by category and sorted.
    public static moduleRows: any = null; // TODO Module[][] type instead of any
    // Array of Belt objects, sorted by speed.
    public static belts: any = null; // TODO Belt[] type instead of any
    // Array of Fuel objects, sorted by value.
    public static fuel: any = null; // TODO Fuel[] type instead of any
    // Array of item groups, in turn divided into subgroups. For display purposes.
    public static itemGroups: any = null; // TODO Item[][][] type instead of any
    // Boolean with whether to use old (0.16) calculations.
    public static useLegacyCalculations: boolean = false;
    // Size of the sprite sheet, as [x, y] array.
    public static spriteSheetSize: number[] = null;
    public static initDone: boolean = false;
}

// Set the page back to a state immediately following initial setup, but before
// the dataset is loaded for the first time.
//
// This is intended to be called when the top-level dataset is changed.
// Therefore, it also resets the fragment and settings.
function reset() {
    TEMP_WINDOW_STORAGE.location.hash = "";

    TEMP_WINDOW_STORAGE.build_targets = [];
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

// TODO change callback type to (data: Data) => void instead of (data: any) => void
function loadDataRunner(modName: string, callback: (data: any) => void) {
    const xobj = new XMLHttpRequest();
    let mod = SettingsState.MODIFICATIONS[modName];
    if (!mod) {
        mod = SettingsState.MODIFICATIONS[SettingsState.DEFAULT_MODIFICATION];
    }
    InitState.spriteSheetSize = mod.sheetSize;
    InitState.useLegacyCalculations = mod.legacy;
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
    InitState.recipeTable = new TEMP_WINDOW_STORAGE.RecipeTable($("#totals")[0]);
    if (!settings) {
        settings = {};
    }
    loadDataRunner(modName, function(data: any) { // remove data type after changing loadDataRunner signature
        TEMP_WINDOW_STORAGE.getSprites(data);
        const graph = TEMP_WINDOW_STORAGE.getRecipeGraph(data);
        InitState.modules = TEMP_WINDOW_STORAGE.getModules(data);
        InitState.sortedModules = TEMP_WINDOW_STORAGE.sorted(InitState.modules, (m: string) => InitState.modules[m].order);
        InitState.moduleRows = [];
        let category = null;
        for (const moduleName of InitState.sortedModules) {
            const module = InitState.modules[moduleName];
            if (module.category !== category) {
                category = module.category;
                InitState.moduleRows.push([]);
            }
            InitState.moduleRows[InitState.moduleRows.length - 1].push(module);
        }
        InitState.shortModules = {};
        for (const moduleName in InitState.modules) {
            const module = InitState.modules[moduleName];
            InitState.shortModules[module.shortName()] = module;
        }
        const factories = TEMP_WINDOW_STORAGE.getFactories(data);
        InitState.spec = new TEMP_WINDOW_STORAGE.FactorySpec(factories);
        if ("ignore" in settings) {
            const ignore = settings.ignore.split(",");
            for (let i = 0; i < ignore.length; i++) {
                InitState.spec.ignore[ignore[i]] = true;
            }
        }

        const items = graph[0];
        const recipes = graph[1];

        InitState.belts = TEMP_WINDOW_STORAGE.getBelts(data);
        InitState.fuel = TEMP_WINDOW_STORAGE.getFuel(data, items).chemical;

        InitState.itemGroups = TEMP_WINDOW_STORAGE.getItemGroups(items, data);
        InitState.solver = new TEMP_WINDOW_STORAGE.Solver(items, recipes);

        renderSettings(settings);

        InitState.solver.findSubgraphs(InitState.spec);

        if ("items" in settings && settings.items !== "") {
            const targets = settings.items.split(",");
            for (let i = 0; i < targets.length; i++) {
                const targetString = targets[i];
                const parts = targetString.split(":");
                const name = parts[0];
                const target = TEMP_WINDOW_STORAGE.addTarget(name);
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
            TEMP_WINDOW_STORAGE.addTarget();
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
                        if (moduleName in InitState.modules) {
                            module = InitState.modules[moduleName];
                        } else if (moduleName in InitState.shortModules) {
                            module = InitState.shortModules[moduleName];
                        } else if (moduleName === "null") {
                            module = null;
                        }
                        if (module !== undefined) {
                            InitState.spec.setModule(recipe, j, module);
                        }
                    }
                }
                if (beaconSettings) {
                    const beaconSettingsSplit = beaconSettings.split(":");
                    const moduleName = beaconSettingsSplit[0];
                    let module;
                    if (moduleName in InitState.modules) {
                        module = InitState.modules[moduleName];
                    } else if (moduleName in InitState.shortModules) {
                        module = InitState.shortModules[moduleName];
                    } else if (moduleName === "null") {
                        module = null;
                    }
                    const factory = InitState.spec.getFactory(recipe);
                    if (factory) {
                        const count = TEMP_WINDOW_STORAGE.RationalFromFloat(Number(beaconSettingsSplit[1]));
                        factory.beaconModule = module;
                        factory.beaconCount = count;
                    }
                }
            }
        }
        InitState.initDone = true;
        TEMP_WINDOW_STORAGE.itemUpdate();

        // Prune factory spec after first solution is calculated.
        TEMP_WINDOW_STORAGE.pruneSpec(TEMP_WINDOW_STORAGE.globalTotals);
        TEMP_WINDOW_STORAGE.location.hash = "#" + TEMP_WINDOW_STORAGE.formatSettings();
    });
}

function init() {
    const settings = TEMP_WINDOW_STORAGE.loadSettings(TEMP_WINDOW_STORAGE.location.hash);
    if (TEMP_WINDOW_STORAGE.OVERRIDE !== null) {
        addOverrideOptions(TEMP_WINDOW_STORAGE.OVERRIDE);
    }
    renderDataSetOptions(settings);
    if ("tab" in settings) {
        TEMP_WINDOW_STORAGE.currentTab = settings.tab + "_tab";
    }
    loadData(currentMod(), settings);
    // We don't need to call clickVisualize here, as we will properly render
    // the graph when we call itemUpdate() at the end of initialization.
    TEMP_WINDOW_STORAGE.clickTab(TEMP_WINDOW_STORAGE.currentTab);
}

// export vars to window
(() => {
    for (const key of Object.keys(InitState)) {
        moveObjToWindow(InitState, key);
    }
    moveFnToWindow(reset);
    moveFnToWindow(loadDataRunner);
    moveFnToWindow(loadData);
    function moveFnToWindow(fn: (..._: any[]) => any) {
        (window as unknown as any)[fn.name] = fn;
    }
    function moveObjToWindow(obj: any, key: string) {
        (window as unknown as any)[key] = obj[key];
    }
})();

export {
    InitState,
    reset,
    loadDataRunner,
    loadData,
};
