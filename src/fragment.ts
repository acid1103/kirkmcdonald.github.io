import pako = require("pako");
import { sprintf } from "sprintf-js";
import { globalTotals } from "./display";
import { DEFAULT_TAB } from "./events";
import { spec } from "./init";
import { Rational, RationalFromFloat } from "./rational";
import {
    currentMod,
} from "./settings";
import { IObjectMap } from "./utility-types";
import { SettingsState, EventsState, TargetState } from "./window-interface";

function formatSettings(targets?: IObjectMap<Rational>) {
    let settings = "";
    if (EventsState.currentTab !== DEFAULT_TAB) {
        settings += "tab=" + EventsState.currentTab.slice(0, EventsState.currentTab.indexOf("_")) + "&";
    }
    if (SettingsState.showDebug !== SettingsState.DEFAULT_DEBUG) {
        settings += "debug=on&";
    }
    const mod = currentMod();
    if (mod !== SettingsState.DEFAULT_MODIFICATION) {
        settings += "data=" + mod + "&";
    }
    if (SettingsState.colorScheme.name !== SettingsState.DEFAULT_COLOR_SCHEME) {
        settings += "c=" + SettingsState.colorScheme.name + "&";
    }
    if (SettingsState.rateName !== SettingsState.DEFAULT_RATE) {
        settings += "rate=" + SettingsState.rateName + "&";
    }
    if (SettingsState.ratePrecision !== SettingsState.DEFAULT_RATE_PRECISION) {
        settings += "rp=" + SettingsState.ratePrecision + "&";
    }
    if (SettingsState.countPrecision !== SettingsState.DEFAULT_COUNT_PRECISION) {
        settings += "cp=" + SettingsState.countPrecision + "&";
    }
    if (SettingsState.minimumAssembler !== SettingsState.DEFAULT_MINIMUM) {
        settings += "min=" + SettingsState.minimumAssembler + "&";
    }
    if (spec.furnace.name !== SettingsState.DEFAULT_FURNACE) {
        settings += "furnace=" + spec.furnace.name + "&";
    }
    if (SettingsState.preferredFuel.name !== SettingsState.DEFAULT_FUEL) {
        settings += "fuel=" + SettingsState.preferredFuel.name + "&";
    }
    if (SettingsState.oilGroup !== SettingsState.DEFAULT_OIL) {
        settings += "p=" + SettingsState.oilGroup + "&";
    }
    if (SettingsState.kovarexEnabled !== SettingsState.DEFAULT_KOVAREX) {
        settings += "k=off&";
    }
    if (SettingsState.preferredBelt !== SettingsState.DEFAULT_BELT) {
        settings += "belt=" + SettingsState.preferredBelt + "&";
    }
    if (!SettingsState.minPipeLength.equal(SettingsState.DEFAULT_PIPE)) {
        settings += "pipe=" + SettingsState.minPipeLength.toDecimal(0) + "&";
    }
    if (!spec.miningProd.isZero()) {
        const hundred = RationalFromFloat(100);
        const mprod = spec.miningProd.mul(hundred).toString();
        settings += "mprod=" + mprod + "&";
    }
    if (spec.defaultModule) {
        settings += "dm=" + spec.defaultModule.shortName() + "&";
    }
    if (spec.defaultBeacon) {
        settings += "db=" + spec.defaultBeacon.shortName() + "&";
    }
    if (!spec.defaultBeaconCount.isZero()) {
        settings += "dbc=" + spec.defaultBeaconCount.toDecimal(0) + "&";
    }
    if (SettingsState.visualizer !== SettingsState.DEFAULT_VISUALIZER) {
        settings += "vis=" + SettingsState.visualizer + "&";
    }
    if (SettingsState.visDirection !== SettingsState.DEFAULT_DIRECTION) {
        settings += "vd=" + SettingsState.visDirection + "&";
    }
    if (SettingsState.maxNodeHeight !== SettingsState.DEFAULT_NODE_BREADTH) {
        settings += "nh=" + SettingsState.maxNodeHeight + "&";
    }
    if (SettingsState.linkLength !== SettingsState.DEFAULT_LINK_LENGTH) {
        settings += "ll=" + SettingsState.linkLength + "&";
    }
    if (SettingsState.displayFormat !== SettingsState.DEFAULT_FORMAT) {
        settings += "vf=" + SettingsState.displayFormat[0] + "&";
    }
    if (SettingsState.tooltipsEnabled !== SettingsState.DEFAULT_TOOLTIP) {
        settings += "t=off&";
    }

    settings += "items=";
    const targetStrings = [];
    if (!targets) {
        for (const target of TargetState.build_targets) {
            let targetString = "";
            if (target.changedFactory) {
                targetString = sprintf("%s:f:%s", target.itemName, target.factories.value);
                if (target.recipeIndex !== 0) {
                    targetString += ";" + target.recipeIndex;
                }
            } else {
                targetString =
                    sprintf("%s:r:%s", target.itemName, target.rateValue.mul(SettingsState.displayRateFactor).toString());
            }
            targetStrings.push(targetString);
        }
    } else {
        for (const itemName of Object.keys(targets)) {
            const rate = targets[itemName];
            const targetString = sprintf("%s:r:%s", itemName, rate.mul(SettingsState.displayRateFactor).toString());
            targetStrings.push(targetString);
        }
    }
    settings += targetStrings.join(",");
    const ignore = [];
    for (const recipeName in spec.ignore) {
        if (recipeName in globalTotals.totals) {
            ignore.push(recipeName);
        }
    }
    if (ignore.length > 0) {
        settings += "&ignore=" + ignore.join(",");
    }
    const specs = [];
    for (const recipeName in spec.spec) {
        if (!(recipeName in globalTotals.totals)) {
            continue;
        }
        const factory = spec.spec[recipeName];
        const modules = [];
        let beacon = "";
        let any = false;
        for (const module of factory.modules) {
            if (module !== spec.defaultModule) {
                let moduleName;
                if (module) {
                    moduleName = module.shortName();
                } else {
                    moduleName = "null";
                }
                modules.push(moduleName);
                any = true;
            }
        }
        if (factory.beaconModule !== spec.defaultBeacon || !factory.beaconCount.equal(spec.defaultBeaconCount)) {
            const beaconModule = factory.beaconModule;
            let moduleName;
            if (beaconModule) {
                moduleName = beaconModule.shortName();
            } else {
                moduleName = "null";
            }
            beacon = sprintf("%s:%d", moduleName, factory.beaconCount.toFloat());
            any = true;
        }
        if (any) {
            let recipeSpec = sprintf("%s:%s", recipeName, modules.join(":"));
            if (beacon !== "") {
                recipeSpec += ";" + beacon;
            }
            specs.push(recipeSpec);
        }
    }
    if (specs.length > 0) {
        settings += "&modules=" + specs.join(",");
    }
    const zip = "zip=" + window.btoa(pako.deflateRaw(settings, { to: "string" }));
    if (zip.length < settings.length) {
        return zip;
    }
    return settings;
}

function loadSettings(fragment: string): IObjectMap<string> {
    const settings: IObjectMap<string> = {};
    fragment = fragment.substr(1);
    const pairs = fragment.split("&");
    for (const pair of pairs) {
        const j = pair.indexOf("=");
        if (j === -1) {
            continue;
        }
        const name = pair.substr(0, j);
        const value = pair.substr(j + 1);
        settings[name] = value;
    }
    if ("zip" in settings) {
        const unzip = pako.inflateRaw(window.atob(settings.zip), { to: "string" });
        return loadSettings("#" + unzip);
    }
    return settings;
}

export {
    formatSettings,
    loadSettings,
};
