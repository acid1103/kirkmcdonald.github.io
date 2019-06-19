const windowTargetState = window as unknown as TargetState;

export {
    windowTargetState as TargetState,
};

import { BuildTarget } from "./target";

// tslint:disable: interface-over-type-literal

type TargetState = {
    build_targets: BuildTarget[];
};
