const windowDisplayState = window as unknown as DisplayState;
const windowEventsState = window as unknown as EventsState;
const windowTargetState = window as unknown as TargetState;

export {
    windowDisplayState as DisplayState,
    windowEventsState as EventsState,
    windowTargetState as TargetState,
};

import { BuildTarget } from "./target";

// tslint:disable: interface-over-type-literal

type DisplayState = {
    sortOrder: string;
};

type EventsState = {
    currentTab: string;
};

type TargetState = {
    build_targets: BuildTarget[];
};
