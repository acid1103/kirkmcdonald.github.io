import d3 = require("d3");
import { Belt } from "./belt";
import { CirclePath, makeCurve } from "./circlepath";
import { ColorScheme } from "./color";
import { addInputs, makeDropdown, toggleDropdown } from "./dropdown";
import { getExtraImage, getImage, getSprites, PX_HEIGHT, PX_WIDTH } from "./icon";
import { loadData, reset } from "./init";
import { Matrix } from "./matrix";
import {
    half,
    minusOne,
    one,
    oneThird,
    Rational,
    RationalFromFloat,
    RationalFromFloats,
    RationalFromString,
    twoThirds,
    zero,
} from "./rational";
import { Modification, Oil } from "./settings";
import { Tooltip } from "./tooltip";
import { IObjectMap } from "./utility-types";

(window as any).d3 = d3;

(window as any).CirclePath = CirclePath;
(window as any).makeCurve = makeCurve;

(window as any).toggleDropdown = toggleDropdown;
(window as any).makeDropdown = makeDropdown;
(window as any).addInputs = addInputs;

(window as any).PX_WIDTH = PX_WIDTH;
(window as any).PX_HEIGHT = PX_HEIGHT;
(window as any).getImage = getImage;
(window as any).getExtraImage = getExtraImage;
(window as any).getSprites = getSprites;

(window as any).reset = reset;
(window as any).reset = loadData;

(window as any).Matrix = Matrix;

(window as any).Rational = Rational;
(window as any).RationalFromString = RationalFromString;
(window as any).RationalFromFloat = RationalFromFloat;
(window as any).RationalFromFloats = RationalFromFloats;
(window as any).minusOne = minusOne;
(window as any).zero = zero;
(window as any).one = one;
(window as any).half = half;
(window as any).oneThird = oneThird;
(window as any).twotwoThirds = twoThirds;

(window as any).Tooltip = Tooltip;

// tslint:disable: interface-over-type-literal
type TempGlobals = {
    pipeThroughput: (minPipeLength: any) => any;
    changeFurnace: (d: any, i: any) => any;
    changeFuel: (d: any, i: any) => any;
    changeOil: (d: any, i: any) => any;
    changeBelt: (d: any, i: any) => any;
    changeDefaultModule: (d: any, i: any) => any;
    changeDefaultBeacon: (d: any, i: any) => any;
    build_targets: any[];
    RecipeTable: any;
    getRecipeGraph: (data: any) => any;
    getModules: (data: any) => any;
    sorted: (modules: any, arg1: (m: string) => any) => any;
    getFactories: (data: any) => any;
    FactorySpec: any;
    getFuel: (data: any, items: any) => any;
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
    moduleDropdown: (inputs: any, arg1: string, arg2: (d: any, i: any) => boolean, arg3: (d: any, i: any) => any, arg4?: (d: any) => any) => any;
    changeMin: (arg0: string) => any;
    BeltIcon: any;
};

type InitState = {
    recipeTable: any; // TODO RecipeTable type instead of any
    solver: any; // TODO Solver type instead of any
    spec: any; // TODO FactorySpec type instead of any
    modules: any; // TODO IObjectMap<Modules> type instead of any
    sortedModules: string[];
    shortModules: any; // TODO IObjectMap<Module> type instead of any
    moduleRows: any; // TODO Module[][] type instead of any
    belts: Belt[];
    fuel: any; // TODO Fuel[] type instead of any
    itemGroups: any; // TODO Item[][][] type instead of any
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
