const windowTempGlobals = window as unknown as TempGlobals;
const windowInitState = window as unknown as InitState;
const windowSettingsState = window as unknown as SettingsState;
const windowIconState = window as unknown as IconState;

export {
    windowTempGlobals as window,
    windowInitState as InitState,
    windowSettingsState as SettingsState,
    windowIconState as IconState,
};

import d3 = require("d3");
import { Belt } from "./belt";
import { CirclePath, makeCurve } from "./circlepath";
import { ColorScheme } from "./color";
import { addInputs, makeDropdown } from "./dropdown";
import { Factory, FactoryDef, FactorySpec } from "./factory";
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
import { sorted } from "./sort";
import { findGroups } from "./subgraph";
import { Totals } from "./totals";
import { IObjectMap } from "./utility-types";
import { MatrixSolver } from "./vectorize";

export function initWindow() {
    // d3
    (window as any).d3 = d3;

    // circlepath.ts
    (window as any).CirclePath = CirclePath;
    (window as any).makeCurve = makeCurve;

    // dropdown.ts
    (window as any).makeDropdown = makeDropdown;
    (window as any).addInputs = addInputs;

    // factory.ts
    (window as any).FactoryDef = FactoryDef;
    (window as any).Factory = Factory;
    (window as any).FactorySpec = FactorySpec;

    // fuel.ts
    (window as any).Fuel = Fuel;

    // icon.ts
    (window as any).PX_WIDTH = PX_WIDTH;
    (window as any).PX_HEIGHT = PX_HEIGHT;
    (window as any).getImage = getImage;
    (window as any).getExtraImage = getExtraImage;

    // init.ts
    (window as any).reset = reset;
    (window as any).loadData = loadData;

    // item.ts
    (window as any).Item = Item;
    (window as any).getItem = getItem;

    // matrix.ts
    (window as any).Matrix = Matrix;

    // module.ts
    (window as any).Module = Module;
    (window as any).moduleDropdown = moduleDropdown;

    // rational.ts
    (window as any).Rational = Rational;
    (window as any).RationalFromString = RationalFromString;
    (window as any).RationalFromFloat = RationalFromFloat;
    (window as any).RationalFromFloats = RationalFromFloats;
    (window as any).minusOne = minusOne;
    (window as any).zero = zero;
    (window as any).one = one;
    (window as any).half = half;

    // recipe.ts
    (window as any).Ingredient = Ingredient;
    (window as any).Recipe = Recipe;
    (window as any).MiningRecipe = MiningRecipe;

    // settings.ts
    (window as any).currentMod = currentMod;
    (window as any).setColorScheme = setColorScheme;
    (window as any).setMinimumAssembler = setMinimumAssembler;
    (window as any).setPreferredFuel = setPreferredFuel;
    (window as any).setOilRecipe = setOilRecipe;
    (window as any).setKovarex = setKovarex;
    (window as any).setPreferredBelt = setPreferredBelt;
    (window as any).setMinPipe = setMinPipe;
    (window as any).getMprod = getMprod;

    // simplex.ts
    (window as any).simplex = simplex;

    // sort.ts
    (window as any).sorted = sorted;

    // subgraph.ts
    (window as any).findGroups = findGroups;

    // totals.ts
    (window as any).Totals = Totals;

    // vectorize.ts
    (window as any).MatrixSolver = MatrixSolver;
}

// tslint:disable: interface-over-type-literal
type TempGlobals = {
    pipeThroughput: (minPipeLength: any) => any;
    changeFurnace: (d: any, i: any) => any;
    changeFuel: (d: any, i: any) => any;
    changeOil: (d: any, i: any) => any;
    changeBelt: (d: any, i: any) => any;
    changeDefaultModule: (module: Module) => void;
    changeDefaultBeacon: (module: Module) => void;
    build_targets: any[];
    RecipeTable: any;
    getItemGroups: (items: any, data: any) => any;
    Solver: any;
    addTarget: (name?: any) => any;
    itemUpdate: () => any;
    pruneSpec: (globalTotals: any) => any;
    globalTotals: (globalTotals: any) => any;
    formatSettings: () => any;
    loadSettings: (hash: any) => any;
    currentTab: string;
    clickTab: (currentTab: any) => any;
    displayRateHandler: (this: HTMLInputElement, ev: Event) => any;
    changeMin: (arg0: string) => any;
    BeltIcon: any;
};

type InitState = {
    recipeTable: any; // TODO RecipeTable type instead of any
    solver: any; // TODO Solver type instead of any
    spec: FactorySpec;
    modules: IObjectMap<Module>;
    sortedModules: string[];
    shortModules: IObjectMap<Module>;
    moduleRows: Module[][];
    belts: Belt[];
    fuel: any; // TODO Fuel[] type instead of any
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
    preferredFuel: any; // TODO Fuel type instead of any type
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
