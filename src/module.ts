import d3 = require("d3");
import { Data } from "./data";
import { formatName, NO_MODULE } from "./display";
import { addInputs, makeDropdown } from "./dropdown";
import { getExtraImage, getImage, IIconned } from "./icon";
import { moduleRows } from "./init";
import {
    Rational,
    RationalFromFloat,
    zero,
} from "./rational";
import { Recipe } from "./recipe";
import { IObjectMap } from "./utility-types";

class Module implements IIconned {
    public name: string;
    public iconCol: number;
    public iconRow: number;
    public category: string;
    public order: string;
    public productivity: Rational;
    public speed: Rational;
    public power: Rational;
    public limit: IObjectMap<boolean>;
    constructor(
        name: string,
        col: number,
        row: number,
        category: string,
        order: string,
        productivity: Rational,
        speed: Rational,
        power: Rational,
        limit: string[],
    ) {
        // Other module effects not modeled by this calculator.
        this.name = name;
        this.iconCol = col;
        this.iconRow = row;
        this.category = category;
        this.order = order;
        this.productivity = productivity;
        this.speed = speed;
        this.power = power;
        this.limit = {};
        if (limit) {
            for (const limitIndex of limit) {
                this.limit[limitIndex] = true;
            }
        }
    }

    public shortName() {
        return this.name[0] + this.name[this.name.length - 1];
    }

    public canUse(recipe: Recipe) {
        if (recipe.allModules()) {
            return true;
        }
        if (Object.keys(this.limit).length > 0) {
            return recipe.name in this.limit;
        }
        return true;
    }

    public canBeacon() {
        return this.productivity.isZero();
    }

    public hasProdEffect() {
        return !this.productivity.isZero();
    }

    public renderTooltip() {
        const t = document.createElement("div");
        t.classList.add("frame");
        const title = document.createElement("h3");
        const im = getImage(this, true);
        title.appendChild(im);
        title.appendChild(new Text(formatName(this.name)));
        t.appendChild(title);
        let b;
        const hundred = RationalFromFloat(100);
        let first = false;
        if (!this.power.isZero()) {
            const power = this.power.mul(hundred);
            if (first) {
                t.appendChild(document.createElement("br"));
            } else {
                first = true;
            }
            b = document.createElement("b");
            b.textContent = "Energy consumption: ";
            t.appendChild(b);
            let sign = "";
            if (!this.power.less(zero)) {
                sign = "+";
            }
            t.appendChild(new Text(sign + power.toDecimal() + "%"));
        }
        if (!this.speed.isZero()) {
            const speed = this.speed.mul(hundred);
            if (first) {
                t.appendChild(document.createElement("br"));
            } else {
                first = true;
            }
            b = document.createElement("b");
            b.textContent = "Speed: ";
            t.appendChild(b);
            let sign = "";
            if (!this.speed.less(zero)) {
                sign = "+";
            }
            t.appendChild(new Text(sign + speed.toDecimal() + "%"));
        }
        if (!this.productivity.isZero()) {
            const productivity = this.productivity.mul(hundred);
            if (first) {
                t.appendChild(document.createElement("br"));
            } else {
                first = true;
            }
            b = document.createElement("b");
            b.textContent = "Productivity: ";
            t.appendChild(b);
            let sign = "";
            if (!this.productivity.less(zero)) {
                sign = "+";
            }
            t.appendChild(new Text(sign + productivity.toDecimal() + "%"));
        }
        return t;
    }
}

function moduleDropdown(
    selection: d3.Selection<HTMLElement, any, any, any>,
    name: string,
    selected: (d: Module) => boolean,
    callback: (module: Module) => void,
    filter?: (d: Module) => boolean,
) {
    const rows: Module[][] = [[null]].concat(moduleRows);

    const dropdown = makeDropdown(selection);
    let options = dropdown.selectAll("div")
        .data(rows)
        .join("div")
        .selectAll("span")
        .data((d) => d)
        .join("span");
    if (filter) {
        options = options.filter(filter);
    }
    const labels = addInputs(
        options,
        name,
        selected,
        callback,
    );
    labels.append((d) => {
        if (d === null) {
            const noModImage = getExtraImage("slot_icon_module");
            noModImage.title = NO_MODULE;
            return noModImage;
        } else {
            return getImage(d, false, dropdown.node());
        }
    });
    const inputs: IObjectMap<HTMLInputElement> = {};
    options.each(function(d) {
        const element = d3.select(this).select('input[type="radio"]').node() as HTMLInputElement;
        if (d === null) {
            inputs[NO_MODULE] = element;
        } else {
            inputs[d.name] = element;
        }
    });
    return { dropdown: dropdown.node(), inputs };
}

function getModules(data: Data) {
    const modules: IObjectMap<Module> = {};
    for (const name of data.modules) {
        const item = data.items[name];
        const effect = item.effect;
        const category = item.category;
        const order = item.order;
        const speed = RationalFromFloat((effect.speed || { bonus: 0 }).bonus || 0);
        const productivity = RationalFromFloat((effect.productivity || { bonus: 0 }).bonus || 0);
        const power = RationalFromFloat((effect.consumption || { bonus: 0 }).bonus || 0);
        const limit = item.limitation;
        modules[name] = new Module(
            name,
            item.icon_col,
            item.icon_row,
            category,
            order,
            productivity,
            speed,
            power,
            limit,
        );
    }
    return modules;
}

export {
    Module,
    moduleDropdown,
    getModules,
};
