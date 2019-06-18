import { Rational, RationalFromFloat } from "./rational";
import { SettingsState } from "./window-interface";

function formatName(name: string) {
    name = name.replace(new RegExp("-", "g"), " ");
    return name[0].toUpperCase() + name.slice(1);
}

function displayCount(x: Rational) {
    if (SettingsState.displayFormat === "rational") {
        return x.toMixed();
    } else {
        return x.toUpDecimal(SettingsState.countPrecision);
    }
}

function align(s: string, prec: number) {
    if (SettingsState.displayFormat === "rational") {
        return s;
    }
    let idx = s.indexOf(".");
    if (idx === -1) {
        idx = s.length;
    }
    let toAdd = prec - s.length + idx;
    if (prec > 0) {
        toAdd += 1;
    }
    while (toAdd > 0) {
        s += "\u00A0";
        toAdd--;
    }
    return s;
}

const powerSuffixes = ["\u00A0W", "kW", "MW", "GW", "TW", "PW"];

function alignPower(x: Rational, prec?: number) {
    if (prec === undefined) {
        prec = SettingsState.countPrecision;
    }
    const thousand = RationalFromFloat(1000);
    let i = 0;
    while (thousand.less(x) && i < powerSuffixes.length - 1) {
        x = x.div(thousand);
        i++;
    }
    return align(displayCount(x), prec) + " " + powerSuffixes[i];
}

const NO_MODULE = "no module";

export {
    formatName,
    alignPower,
    NO_MODULE,
};
