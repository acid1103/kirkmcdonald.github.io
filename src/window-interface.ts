const windowIconState = window as unknown as IconState;
const windowDisplayState = window as unknown as DisplayState;
const windowEventsState = window as unknown as EventsState;
const windowTargetState = window as unknown as TargetState;

export {
    windowIconState as IconState,
    windowDisplayState as DisplayState,
    windowEventsState as EventsState,
    windowTargetState as TargetState,
};

import { BuildTarget } from "./target";

// tslint:disable: interface-over-type-literal

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
