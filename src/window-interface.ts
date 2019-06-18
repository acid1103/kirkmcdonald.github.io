const windowTempGlobals = window as unknown as TempGlobals;
const windowInitState = window as unknown as InitState;
const windowSettingsState = window as unknown as SettingsState;
const windowIconState = window as unknown as IconState;
const windowDisplayState = window as unknown as DisplayState;
const windowEventsState = window as unknown as EventsState;
const windowTargetState = window as unknown as TargetState;

export {
    windowTempGlobals as window,
    windowInitState as InitState,
    windowSettingsState as SettingsState,
    windowIconState as IconState,
    windowDisplayState as DisplayState,
    windowEventsState as EventsState,
    windowTargetState as TargetState,
};

export type GraphEdge = any;
export type GraphNode = any;

import d3 = require("d3");
import dagre = require("dagre");
import pako = require("pako");
import { sprintf } from "sprintf-js";
import { Belt } from "./belt";
import { CirclePath, makeCurve } from "./circlepath";
import { ColorScheme } from "./color";
import { RecipeTable, displayCount, displayRate, formatName } from "./display";
import { addInputs, makeDropdown } from "./dropdown";
import { Factory, FactoryDef, FactorySpec } from "./factory";
import { formatSettings } from "./fragment";
import { Fuel } from "./fuel";
import { getExtraImage, getImage, PX_HEIGHT, PX_WIDTH } from "./icon";
import { loadData, reset } from "./init";
import { getItem, Item } from "./item";
import { Matrix } from "./matrix";
import { Module, moduleDropdown } from "./module";
import {
    half,
    minusOne,
    one,
    Rational,
    RationalFromFloat,
    RationalFromFloats,
    RationalFromString,
    zero,
} from "./rational";
import { Ingredient, MiningRecipe, Recipe } from "./recipe";
import {
    currentMod,
    getMprod,
    Modification,
    Oil,
    setColorScheme,
    setKovarex,
    setMinimumAssembler,
    setMinPipe,
    setOilRecipe,
    setPreferredBelt,
    setPreferredFuel,
} from "./settings";
import { simplex } from "./simplex";
import { Solver } from "./solve";
import { sorted } from "./sort";
import { findGroups } from "./subgraphs";
import { BuildTarget } from "./target";
import { Totals } from "./totals";
import { IObjectMap } from "./utility-types";
import { MatrixSolver } from "./vectorize";
import { GraphClickHandler, GraphMouseLeaveHandler, GraphMouseOverHandler } from "./events";
import { colorList, getColorMaps, iconSize, imageViewBox, renderNode } from "./visualize";

export function initWindow() {
    // // dagre
    // (window as any).dagre = dagre;
    // (window as any).displayRate = displayRate;
    // (window as any).formatName = formatName;

    // // events.ts
    // (window as any).GraphClickHandler = GraphClickHandler;
    // (window as any).GraphMouseLeaveHandler = GraphMouseLeaveHandler;
    // (window as any).GraphMouseOverHandler = GraphMouseOverHandler;

    // // visualize.ts
    // (window as any).colorList = colorList;
    // (window as any).getColorMaps = getColorMaps;
    // (window as any).iconSize = iconSize;
    // (window as any).imageViewBox = imageViewBox;
    // (window as any).renderNode = renderNode;
}

// tslint:disable: interface-over-type-literal
type TempGlobals = {
};

type InitState = {
    recipeTable: RecipeTable;
    solver: Solver;
    spec: FactorySpec;
    modules: IObjectMap<Module>;
    sortedModules: string[];
    shortModules: IObjectMap<Module>;
    moduleRows: Module[][];
    belts: Belt[];
    fuel: Fuel[];
    itemGroups: Item[][][];
    useLegacyCalculations: boolean;
    spriteSheetSize: number[];
    initDone: boolean;
    OVERRIDE: string;
};

type SettingsState = {
    MODIFICATIONS: IObjectMap<Modification>;
    DEFAULT_MODIFICATION: string;
    modUpdates: IObjectMap<string>;
    DEFAULT_COLOR_SCHEME: string;
    colorScheme: ColorScheme;
    seconds: Rational;
    minutes: Rational;
    hours: Rational;
    displayRates: IObjectMap<Rational>;
    longRateNames: IObjectMap<string>;
    DEFAULT_RATE: string;
    displayRateFactor: Rational;
    rateName: string;
    DEFAULT_RATE_PRECISION: number;
    ratePrecision: number;
    DEFAULT_COUNT_PRECISION: number;
    countPrecision: number;
    DEFAULT_MINIMUM: string;
    minimumAssembler: string;
    DEFAULT_FURNACE: string;
    DEFAULT_FUEL: string;
    preferredFuel: Fuel;
    OIL_OPTIONS: Oil[];
    DEFAULT_OIL: string;
    OIL_EXCLUSION: IObjectMap<IObjectMap<boolean>>;
    oilGroup: string;
    DEFAULT_KOVAREX: boolean;
    kovarexEnabled: boolean;
    DEFAULT_BELT: string;
    preferredBelt: string;
    preferredBeltSpeed: Rational;
    DEFAULT_PIPE: Rational;
    minPipeLength: Rational;
    maxPipeThroughput: Rational;
    DEFAULT_MINING_PROD: string;
    DEFAULT_VISUALIZER: string;
    visualizer: string;
    DEFAULT_DIRECTION: string;
    visDirection: string;
    DEFAULT_NODE_BREADTH: number;
    maxNodeHeight: number;
    DEFAULT_LINK_LENGTH: number;
    linkLength: number;
    DEFAULT_FORMAT: string;
    displayFormat: string;
    displayFormats: IObjectMap<string>;
    DEFAULT_TOOLTIP: boolean;
    tooltipsEnabled: boolean;
    DEFAULT_DEBUG: boolean;
    showDebug: boolean;
};

type IconState = {
    sheet_hash: string;
};

type DisplayState = {
    sortOrder: string;
};

type EventsState = {
    currentTab: string;
};

type TargetState = {
    build_targets: BuildTarget[];
};
