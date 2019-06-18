import { Data } from "./data";
import { formatName } from "./display";
import { FactorySpec } from "./factory";
import { getImage, IIconned } from "./icon";
import { Rational } from "./rational";
import { Recipe } from "./recipe";
import { Totals } from "./totals";
import { IObjectMap } from "./utility-types";

class Item implements IIconned {
    public name: string;
    public icon_col: number;
    public icon_row: number;
    public recipes: Recipe[];
    public uses: Recipe[];
    public phase: string;
    public group: string;
    public subgroup: string;
    public order: string;

    constructor(name: string, col: number, row: number, phase: string, group: string, subgroup: string, order: string) {
        this.name = name;
        this.icon_col = col;
        this.icon_row = row;
        this.recipes = [];
        this.uses = [];
        this.phase = phase;
        this.group = group;
        this.subgroup = subgroup;
        this.order = order;
    }

    public addRecipe(recipe: Recipe) {
        this.recipes.push(recipe);
    }

    public addUse(recipe: Recipe) {
        this.uses.push(recipe);
    }

    public isWeird() {
        return this.recipes.length > 1 || this.recipes[0].solveGroup !== null;
    }

    public produce(rate: Rational, ignore: IObjectMap<boolean>, spec: FactorySpec) {
        const totals = new Totals(rate, this);
        if (this.isWeird()) {
            totals.addUnfinished(this.name, rate);
            return totals;
        }
        const recipe = this.recipes[0];
        const gives = recipe.gives(this, spec);
        rate = rate.div(gives);
        totals.add(recipe.name, rate);
        if (ignore[recipe.name]) {
            return totals;
        }
        const ingredients = recipe.ingredients.concat(recipe.fuelIngredient(spec));
        for (const ing of ingredients) {
            const subTotals = ing.item.produce(rate.mul(ing.amount), ignore, spec);
            totals.combine(subTotals);
        }
        return totals;
    }

    public renderTooltip(extra: HTMLSpanElement) {
        if (this.recipes.length === 1 && this.recipes[0].name === this.name) {
            return this.recipes[0].renderTooltip(extra);
        }
        const t = document.createElement("div");
        t.classList.add("frame");
        const title = document.createElement("h3");
        const im = getImage(this, true);
        title.appendChild(im);
        title.appendChild(new Text(formatName(this.name)));
        t.appendChild(title);
        if (extra) {
            t.appendChild(extra);
        }
        return t;
    }
}

function getItem(data: Data, items: IObjectMap<Item>, name: string): Item {
    if (name in items) {
        return items[name];
    } else {
        const d = data.items[name];
        let phase;
        if (d.type === "fluid") {
            phase = "fluid";
        } else {
            phase = "solid";
        }
        const item = new Item(
            name,
            d.icon_col,
            d.icon_row,
            phase,
            d.group,
            d.subgroup,
            d.order,
        );
        items[name] = item;
        return item;
    }
}

function getItems(data: Data) {
    const items: IObjectMap<Item> = {};
    const cycleName = "nuclear-reactor-cycle";
    const reactor = data.items["nuclear-reactor"];
    items[cycleName] = new Item(
        cycleName,
        reactor.icon_col,
        reactor.icon_row,
        "abstract",
        "production",
        "energy",
        "f[nuclear-energy]-d[reactor-cycle]",
    );
    return items;
}

export {
    Item,
    getItem,
    getItems,
};
