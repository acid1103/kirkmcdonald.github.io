import { Data } from "./data";
import { IIconned } from "./icon";
import { getItem, Item } from "./item";
import { Rational, RationalFromFloat } from "./rational";
import { IObjectMap } from "./utility-types";

const energySuffixes = ["J", "kJ", "MJ", "GJ", "TJ", "PJ"];

class Fuel implements IIconned {
    public name: string;
    public icon_col: number;
    public icon_row: number;
    public item: Item;
    public category: string;
    public value: Rational;
    public renderTooltip: (extra?: HTMLSpanElement) => HTMLDivElement;

    constructor(name: string, col: number, row: number, item: Item, category: string, value: Rational) {
        this.name = name;
        this.icon_col = col;
        this.icon_row = row;
        this.item = item;
        this.category = category;
        this.value = value;
    }
    public valueString() {
        let x = this.value;
        const thousand = RationalFromFloat(1000);
        let i = 0;
        while (thousand.less(x) && i < energySuffixes.length - 1) {
            x = x.div(thousand);
            i++;
        }
        return x.toUpDecimal(0) + " " + energySuffixes[i];
    }
}

function getFuel(data: Data, items: IObjectMap<Item>) {
    const fuelCategories: IObjectMap<Fuel[]> = {};
    for (const fuelName of data.fuel) {
        const d = data.items[fuelName];
        const fuel = new Fuel(
            fuelName,
            d.icon_col,
            d.icon_row,
            getItem(data, items, fuelName),
            d.fuel_category,
            RationalFromFloat(d.fuel_value),
        );
        let f = fuelCategories[fuel.category];
        if (!f) {
            f = [];
            fuelCategories[fuel.category] = f;
        }
        f.push(fuel);
    }
    for (const category of Object.keys(fuelCategories)) {
        fuelCategories[category].sort((a, b) => {
            if (a.value.less(b.value)) {
                return -1;
            } else if (b.value.less(a.value)) {
                return 1;
            }
            return 0;
        });
    }
    return fuelCategories;
}

export {
    Fuel,
    getFuel,
};
