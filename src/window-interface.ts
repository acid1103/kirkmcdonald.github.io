const windowEventsState = window as unknown as EventsState;
const windowTargetState = window as unknown as TargetState;

export {
    windowEventsState as EventsState,
    windowTargetState as TargetState,
};

import { BuildTarget } from "./target";

// tslint:disable: interface-over-type-literal

type EventsState = {
    currentTab: string;
};

type TargetState = {
    build_targets: BuildTarget[];
};
