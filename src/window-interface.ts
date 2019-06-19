const windowSettingsState = window as unknown as SettingsState;
const windowIconState = window as unknown as IconState;
const windowDisplayState = window as unknown as DisplayState;
const windowEventsState = window as unknown as EventsState;
const windowTargetState = window as unknown as TargetState;

export {
    windowSettingsState as SettingsState,
    windowIconState as IconState,
    windowDisplayState as DisplayState,
    windowEventsState as EventsState,
    windowTargetState as TargetState,
};

export type GraphEdge = any;
export type GraphNode = any;

import { ColorScheme } from "./color";
import { Fuel } from "./fuel";
import { Rational } from "./rational";
import { Modification, Oil } from "./settings";
import { BuildTarget } from "./target";
import { IObjectMap } from "./utility-types";

// tslint:disable: interface-over-type-literal

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
