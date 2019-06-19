import d3 = require("d3");
import $ = require("jquery");
import { Belt } from "./belt";
import { display, FactoryRow, globalTotals, itemUpdate, RecipeRow, State as DisplayState } from "./display";
import { FactoryDef } from "./factory";
import { formatSettings } from "./fragment";
import { Fuel } from "./fuel";
import {
    initDone,
    loadData,
    recipeTable,
    reset,
    solver,
    spec,
} from "./init";
import { Item } from "./item";
import { Module } from "./module";
import { RationalFromString } from "./rational";
import {
    currentMod,
    displayRates,
    getMprod,
    Oil,
    setColorScheme,
    setKovarex,
    setMinimumAssembler,
    setMinPipe,
    setOilRecipe,
    setPreferredBelt,
    setPreferredFuel,
    State as SettingsState,
} from "./settings";
import { PipeConfig } from "./steps";
import { addTarget, BuildTarget, isFactoryTarget, State as TargetState } from "./target";
import { IObjectMap } from "./utility-types";
import { GraphNode, renderGraph } from "./visualize";

const State = {} as {
    currentTab: string;
};

// build target events

// The "+" button to add a new target.
function plusHandler() {
    addTarget();
    itemUpdate();
}

// Triggered when the item dropdown box opens.
function resetSearch(dropdown: HTMLElement) {
    (dropdown.getElementsByClassName("search")[0] as HTMLInputElement).value = "";

    // unhide all child nodes
    const elems = dropdown.querySelectorAll("label, hr") as NodeListOf<HTMLElement>;
    for (const elem of elems) {
        elem.style.display = "";
    }
}

// Triggered when user is searching target
function searchTargets(this: HTMLInputElement) {
    const ev = d3.event;
    const search = this;
    let search_text = search.value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const dropdown = d3.select(search.parentNode as HTMLElement);

    if (!search_text) {
        resetSearch(search.parentNode as HTMLElement);
        return;
    }

    // handle enter key press (select target if only one is visible)
    if (ev.keyCode === 13) {
        const labels = (dropdown.selectAll("label") as d3.Selection<HTMLLabelElement, unknown, HTMLElement, unknown>)
            .filter(function() {
                return this.style.display !== "none";
            });
        // don't do anything if more than one icon is visible
        if (labels.size() === 1) {
            const input = $(`#${labels.attr("for")}`).prop("checked", true);
            input.change();
        }
        return;
    }

    // hide non-matching labels & icons
    let currentHrHasContent = false;
    let lastHrWithContent: HTMLLabelElement = null;
    (dropdown.selectAll("hr, label") as d3.Selection<HTMLLabelElement, unknown, HTMLElement, unknown>)
        .each(function(item) {
            if (this.tagName === "HR") {
                if (currentHrHasContent) {
                    this.style.display = "";
                    lastHrWithContent = this;
                } else {
                    this.style.display = "none";
                }
                currentHrHasContent = false;
            } else {
                const title = (item as any).name.replace(/-/g, ""); // TODO what type is item?
                if (title.indexOf(search_text) === -1) {
                    this.style.display = "none";
                } else {
                    this.style.display = "";
                    currentHrHasContent = true;
                }
            }
        });
    if (!currentHrHasContent && lastHrWithContent) {
        lastHrWithContent.style.display = "none";
    }
}

// Triggered when a build target's item is changed.
function ItemHandler(target: BuildTarget) {
    return (item: Item) => {
        target.itemName = item.name;
        target.recipeIndex = 0;
        target.displayRecipes();
        itemUpdate();
    };
}

// Triggered when a build target's recipe selector is changed.
function RecipeSelectorHandler(target: BuildTarget, i: number) {
    target.recipeIndex = i;
    itemUpdate();
}

// The "x" button to remove a target.
function RemoveHandler(target: BuildTarget) {
    return () => {
        TargetState.build_targets.splice(target.index, 1);
        for (let i = target.index; i < TargetState.build_targets.length; i++) {
            TargetState.build_targets[i].index--;
        }
        target.element.remove();
        itemUpdate();
    };
}

// Triggered when a "Factories:" text box is changed.
function FactoryHandler(target: BuildTarget) {
    return () => {
        target.factoriesChanged();
        itemUpdate();
    };
}

// Triggered when a "Rate:" text box is changed.
function RateHandler(target: BuildTarget) {
    return () => {
        target.rateChanged();
        itemUpdate();
    };
}

// settings events

// Obtains current data set from UI element, and resets the world with the new
// data.
function changeMod() {
    const modName = currentMod();

    reset();
    loadData(modName);
}

function changeColor(event: JQuery.ChangeEvent<any, any, any, HTMLSelectElement>) {
    setColorScheme(event.target.value);
    display();
}

// Triggered when the display rate is changed.
function displayRateHandler(event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) {
    const value = event.target.value;
    SettingsState.displayRateFactor = displayRates[value];
    SettingsState.rateName = value;
    display();
}

function changeRPrec(event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) {
    SettingsState.ratePrecision = Number(event.target.value);
    display();
}

function changeFPrec(event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) {
    SettingsState.countPrecision = Number(event.target.value);
    display();
}

// Triggered when the "minimum assembling machine" setting is changed.
function changeMin(min: string) {
    setMinimumAssembler(min);
    itemUpdate();
}

// Triggered when the furnace is changed.
function changeFurnace(furnace: FactoryDef) {
    spec.setFurnace(furnace.name);
    solver.findSubgraphs(spec);
    itemUpdate();
}

// Triggered when the preferred fuel is changed.
function changeFuel(fuel: Fuel) {
    setPreferredFuel(fuel.name);
    solver.findSubgraphs(spec);
    itemUpdate();
}

// Triggered when the preferred oil recipe is changed.
function changeOil(oil: Oil) {
    setOilRecipe(oil.priority);
    itemUpdate();
}

// Triggered when the Kovarex checkbox is toggled.
function changeKovarex(event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) {
    setKovarex(event.target.checked);
    itemUpdate();
}

// Triggered when the preferred belt is changed.
function changeBelt(belt: Belt) {
    setPreferredBelt(belt.name);
    display();
}

// Triggered when the minimum pipe length is changed.
function changePipeLength(event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) {
    setMinPipe(event.target.value);
    display();
}

// Triggered when the mining productivity bonus is changed.
function changeMprod() {
    spec.miningProd = getMprod();
    itemUpdate();
}

// Triggered when the default module is changed.
function changeDefaultModule(module: Module) {
    spec.setDefaultModule(module);
    recipeTable.updateDisplayedModules();
    itemUpdate();
}

// Triggered when the default beacon module is changed.
function changeDefaultBeacon(module: Module) {
    spec.setDefaultBeacon(module, spec.defaultBeaconCount);
    recipeTable.updateDisplayedModules();
    itemUpdate();
}

// Triggered when the default beacon count is changed.
function changeDefaultBeaconCount(
    event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>
) {
    const count = RationalFromString(event.target.value);
    spec.setDefaultBeacon(spec.defaultBeacon, count);
    recipeTable.updateDisplayedModules();
    itemUpdate();
}

// Triggered when the visualizer setting box is toggled.
function toggleVisualizerSettings() {
    $("#graph-wrapper").toggleClass("open");
}

// Triggered when the visualizer type is changed.
function changeVisualizerType(event: JQuery.ChangeEvent<any, any, any, HTMLInputElement>) {
    SettingsState.visualizer = event.target.value;
    display();
}

// Triggered when the visualizer direction is changed.
function changeVisualizerDirection(event: JQuery.ChangeEvent<any, any, any, HTMLInputElement>) {
    SettingsState.visDirection = event.target.value;
    display();
}

// Triggered when the max node breadth is changed.
function changeNodeBreadth(event: JQuery.ChangeEvent<any, any, any, HTMLInputElement>) {
    SettingsState.maxNodeHeight = Number(event.target.value);
    display();
}

// Triggered when the link length is changed.
function changeLinkLength(event: JQuery.ChangeEvent<any, any, any, HTMLInputElement>) {
    SettingsState.linkLength = Number(event.target.value);
    display();
}

// Triggered when the recipe sort order is changed.
function changeSortOrder(event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) {
    DisplayState.sortOrder = event.target.value;
    display();
}

// Triggered when the value format (decimal vs. rational) is changed.
function changeFormat(event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) {
    SettingsState.displayFormat = event.target.value;
    display();
}

// Triggered when fancy tooltip box is toggled.
function changeTooltip(event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) {
    SettingsState.tooltipsEnabled = event.target.checked;
    display();
}

// recipe row events

function IgnoreHandler(row: RecipeRow) {
    return () => {
        if (spec.ignore[row.name]) {
            delete spec.ignore[row.name];
            row.setIgnore(false);
        } else {
            spec.ignore[row.name] = true;
            row.setIgnore(true);
        }
        itemUpdate();
    };
}

// Triggered when a factory module is changed.
function ModuleHandler(row: FactoryRow, index: number) {
    return (module: Module) => {
        if (spec.setModule(row.recipe, index, module) || isFactoryTarget(row.recipe.name)) {
            itemUpdate();
        } else {
            display();
        }
    };
}

// Triggered when the right-arrow "copy module" button is pressed.
function ModuleCopyHandler(row: FactoryRow) {
    return () => {
        const moduleCount = spec.moduleCount(row.recipe);
        const module = spec.getModule(row.recipe, 0);
        let needRecalc = false;
        for (let i = 0; i < moduleCount; i++) {
            needRecalc = spec.setModule(row.recipe, i, module) || needRecalc;
            row.setDisplayedModule(i, module);
        }
        if (needRecalc || isFactoryTarget(row.recipe.name)) {
            itemUpdate();
        } else {
            display();
        }
    };
}

// Gets Factory object for a corresponding recipe name.
function getFactory(recipeName: string) {
    const recipe = solver.recipes[recipeName];
    return spec.getFactory(recipe);
}

// Triggered when a beacon module is changed.
function BeaconHandler(recipeName: string) {
    return (module: Module) => {
        const factory = getFactory(recipeName);
        factory.beaconModule = module;
        if (isFactoryTarget(recipeName) && !factory.beaconCount.isZero()) {
            itemUpdate();
        } else {
            display();
        }
    };
}

// Triggered when a beacon module count is changed.
function beaconCountHandler(recipeName: string) {
    return (event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) => {
        const moduleCount = RationalFromString(event.target.value);
        const factory = getFactory(recipeName);
        factory.beaconCount = moduleCount;
        if (isFactoryTarget(recipeName) && factory.beaconModule) {
            itemUpdate();
        } else {
            display();
        }
    };
}

// Triggered when the up/down arrow "copy to all recipes" button is pressed.
function copyAllHandler(name: string) {
    return () => {
        const factory = spec.spec[name];
        let needRecalc = false;
        for (const recipeName in spec.spec) {
            if (recipeName === name) {
                continue;
            }
            const f = spec.spec[recipeName];
            if (!f) {
                continue;
            }
            const recipe = solver.recipes[recipeName];
            needRecalc = factory.copyModules(f, recipe) || needRecalc || isFactoryTarget(recipeName);
        }
        recipeTable.updateDisplayedModules();
        if (needRecalc) {
            itemUpdate();
        } else {
            display();
        }
    };
}

// items tab events

function PipeCountHandler(config: PipeConfig) {
    return (event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) => {
        config.setPipes(event.target.value);
    };
}

function PipeLengthHandler(config: PipeConfig) {
    return (event: JQuery.ChangeEvent<HTMLInputElement, null, HTMLInputElement, HTMLInputElement>) => {
        config.setLength(event.target.value);
    };
}

// graph hover events

let clickedNode: GraphNode = null;

function GraphMouseOverHandler(node: GraphNode) {
    node.highlight();
}

function GraphMouseLeaveHandler(node: GraphNode) {
    if (node !== clickedNode) {
        node.unhighlight();
    }
}

function GraphClickHandler(node: GraphNode) {
    if (node === clickedNode) {
        node.unhighlight();
        clickedNode = null;
    } else if (clickedNode) {
        clickedNode.unhighlight();
        clickedNode = node;
    } else {
        clickedNode = node;
    }
}

// tab events

const DEFAULT_TAB = "totals_tab";

State.currentTab = DEFAULT_TAB;

const tabMap: IObjectMap<string> = {
    about_tab: "about_button",
    debug_tab: "debug_button",
    faq_tab: "faq_button",
    graph_tab: "graph_button",
    settings_tab: "settings_button",
    steps_tab: "steps_button",
    totals_tab: "totals_button",
};

// Triggered when a tab is clicked on.
function clickTab(tabName: string) {
    State.currentTab = tabName;
    $(".tab").css("display", "none");
    $(".tab_button").removeClass("active");
    $(`#${tabName}`).css("display", "block");
    $(`#${tabMap[tabName]}`).addClass("active");
    if (initDone) {
        window.location.hash = "#" + formatSettings();
    }
}

// Triggered when the "Visualize" tab is clicked on.
function clickVisualize(tabName: string) {
    clickTab(tabName);
    renderGraph(globalTotals, spec.ignore);
}

// debug event
function toggleDebug(event: JQuery.ChangeEvent<any, any, any, HTMLInputElement>) {
    SettingsState.showDebug = event.target.checked;
    display();
}

// utility events

function toggleVisible(targetID: string) {
    const target = $(`#${targetID}`);
    if (target.css("display") === "none") {
        target.css("display", "block");
    } else {
        target.css("display", "none");
    }
}

export {
    State,
    plusHandler,
    resetSearch,
    searchTargets,
    ItemHandler,
    RecipeSelectorHandler,
    RemoveHandler,
    FactoryHandler,
    RateHandler,
    changeMod,
    changeColor,
    displayRateHandler,
    changeRPrec,
    changeFPrec,
    changeMin,
    changeFurnace,
    changeFuel,
    changeOil,
    changeKovarex,
    changeBelt,
    changePipeLength,
    changeMprod,
    changeDefaultModule,
    changeDefaultBeacon,
    changeDefaultBeaconCount,
    toggleVisualizerSettings,
    changeVisualizerType,
    changeVisualizerDirection,
    changeNodeBreadth,
    changeLinkLength,
    changeSortOrder,
    changeFormat,
    changeTooltip,
    IgnoreHandler,
    ModuleHandler,
    ModuleCopyHandler,
    BeaconHandler,
    beaconCountHandler,
    copyAllHandler,
    PipeCountHandler,
    PipeLengthHandler,
    GraphMouseOverHandler,
    GraphMouseLeaveHandler,
    GraphClickHandler,
    DEFAULT_TAB,
    clickTab,
    clickVisualize,
    toggleDebug,
    toggleVisible,
};
