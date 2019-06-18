import { Data, IRecipes, ISimpleItem } from "./data";
import { formatName } from "./display";
import { FactorySpec } from "./factory";
import { getExtraImage, getImage, IIconned } from "./icon";
import { getItem, getItems, Item } from "./item";
import {
    one,
    Rational,
    RationalFromFloat,
    RationalFromFloats,
    zero,
} from "./rational";
import { IObjectMap } from "./utility-types";
import { SettingsState } from "./window-interface";

class Ingredient {
    public amount: Rational;
    public item: Item;
    constructor(amount: Rational, item: Item) {
        this.amount = amount;
        this.item = item;
    }
}

function makeIngredient(data: Data, i: ISimpleItem, items: IObjectMap<Item>) {
    let name;
    if ("name" in i) {
        name = i.name;
    } else {
        name = i[0];
    }
    let amount;
    if ("amount" in i) {
        amount = i.amount;
    } else if ("amount_min" in i && "amount_max" in i) {
        amount = (i.amount_min + i.amount_max) / 2;
    } else {
        amount = i[1];
    }
    amount *= i.probability || 1;
    return new Ingredient(RationalFromFloat(amount), getItem(data, items, name));
}

class Recipe implements IIconned {
    public name: string;
    public icon_col: number;
    public icon_row: number;
    public category: string;
    public time: Rational;
    public ingredients: Ingredient[];
    public products: Ingredient[];
    public displayGroup: string;
    public solveGroup: string;
    constructor(
        name: string,
        col: number,
        row: number,
        category: string,
        time: Rational,
        ingredients: Ingredient[],
        products: Ingredient[],
    ) {
        this.name = name;
        this.icon_col = col;
        this.icon_row = row;
        this.category = category;
        this.time = time;
        this.ingredients = ingredients;
        for (const ingredient of ingredients) {
            ingredient.item.addUse(this);
        }
        this.products = products;
        for (const product of products) {
            product.item.addRecipe(this);
        }
        this.displayGroup = null;
        this.solveGroup = null;
    }

    public gives(item: Item, spec: FactorySpec) {
        const factory = spec.getFactory(this);
        let prod = one;
        if (factory) {
            prod = factory.prodEffect(spec);
        }
        for (const product of this.products) {
            if (product.item.name === item.name) {
                return product.amount.mul(prod);
            }
        }
    }

    public fuelIngredient(spec: FactorySpec) {
        const factory = spec.getFactory(this);
        if (!factory || !factory.factory.fuel || factory.factory.fuel !== "chemical") {
            return [];
        }
        const basePower = factory.powerUsage(spec, one).power;
        const baseRate = factory.recipeRate(spec, this);
        const perItemEnergy = basePower.div(baseRate);
        const fuelAmount = perItemEnergy.div(SettingsState.preferredFuel.value);
        return [new Ingredient(fuelAmount, SettingsState.preferredFuel.item)];
    }

    public getIngredients(spec: FactorySpec) {
        return this.ingredients.concat(this.fuelIngredient(spec));
    }

    public makesResource() {
        return false;
    }

    public allModules() {
        return false;
    }

    public canIgnore() {
        if (this.ingredients.length === 0) {
            return false;
        }
        for (const product of this.products) {
            if (product.item.isWeird()) {
                return false;
            }
        }
        return true;
    }

    public renderTooltip(extra?: HTMLSpanElement) {
        const t = document.createElement("div");
        t.classList.add("frame");
        const title = document.createElement("h3");
        const im = getImage(this, true);
        title.appendChild(im);
        let name = formatName(this.name);
        if (this.products.length === 1 && this.products[0].item.name === this.name &&
            one.less(this.products[0].amount)) {
            name = this.products[0].amount.toDecimal() + " \u00d7 " + name;
        }
        title.appendChild(new Text("\u00A0" + name));
        t.appendChild(title);
        if (extra) {
            t.appendChild(extra);
        }
        if (this.ingredients.length === 0) {
            return t;
        }
        if (this.products.length > 1 || this.products[0].item.name !== this.name) {
            t.appendChild(new Text("Products: "));
            for (const ing of this.products) {
                const p = document.createElement("div");
                p.classList.add("product");
                p.appendChild(getImage(ing.item, true));
                const count = document.createElement("span");
                count.classList.add("count");
                count.textContent = ing.amount.toDecimal();
                p.appendChild(count);
                t.appendChild(p);
                t.appendChild(new Text("\u00A0"));
            }
            t.appendChild(document.createElement("br"));
        }
        const time = document.createElement("div");
        time.classList.add("product");
        time.appendChild(getExtraImage("clock"));
        t.appendChild(time);
        t.appendChild(new Text("\u00A0" + this.time.toDecimal()));
        for (const ing of this.ingredients) {
            t.appendChild(document.createElement("br"));
            const p = document.createElement("div");
            p.classList.add("product");
            p.appendChild(getImage(ing.item, true));
            t.appendChild(p);
            t.appendChild(new Text("\u00A0" + ing.amount.toDecimal() + " \u00d7 " + formatName(ing.item.name)));
        }
        return t;
    }
}

function makeRecipe(data: Data, d: IRecipes, items: IObjectMap<Item>) {
    const time = RationalFromFloat(d.energy_required);
    const products = [];
    for (const result of d.results) {
        products.push(makeIngredient(data, result, items));
    }
    const ingredients = [];
    for (const ingredient of d.ingredients) {
        ingredients.push(makeIngredient(data, ingredient, items));
    }
    return new Recipe(d.name, d.icon_col, d.icon_row, d.category, time, ingredients, products);
}

class ResourceRecipe extends Recipe {
    constructor(item: Item) {
        super(item.name, item.icon_col, item.icon_row, null, zero, [], [new Ingredient(one, item)]);
    }

    public makesResource() {
        return true;
    }
}

class MiningRecipe extends Recipe {
    public hardness: Rational;
    public mining_time: Rational;
    constructor(
        name: string,
        col: number,
        row: number,
        category: string,
        hardness: Rational,
        mining_time: Rational,
        ingredients: Ingredient[],
        products: Ingredient[],
    ) {
        super(name, col, row, category, zero, ingredients || [], products);
        this.hardness = hardness;
        this.mining_time = mining_time;
    }

    public makesResource() {
        return true;
    }

    public allModules() {
        return true;
    }
}

function ignoreRecipe(d: IRecipes) {
    return d.subgroup === "empty-barrel";
}

function getRecipeGraph(data: Data): [IObjectMap<Item>, IObjectMap<Recipe>] {
    const recipes: IObjectMap<Recipe> = {};
    const items = getItems(data);
    const water = getItem(data, items, "water");
    recipes.water = new Recipe(
        "water",
        water.icon_col,
        water.icon_row,
        "water",
        RationalFromFloats(1, 1200),
        [],
        [new Ingredient(one, water)],
    );
    const reactor = data.items["nuclear-reactor"];
    recipes["nuclear-reactor-cycle"] = new Recipe(
        "nuclear-reactor-cycle",
        reactor.icon_col,
        reactor.icon_row,
        "nuclear",
        RationalFromFloat(200),
        [new Ingredient(one, getItem(data, items, "uranium-fuel-cell"))],
        [
            new Ingredient(one, getItem(data, items, "used-up-uranium-fuel-cell")),
            new Ingredient(one, items["nuclear-reactor-cycle"]),
        ],
    );
    const rocket = data.items["rocket-silo"];
    recipes["rocket-launch"] = new Recipe(
        "rocket-launch",
        rocket.icon_col,
        rocket.icon_row,
        "rocket-launch",
        one,
        [
            new Ingredient(RationalFromFloat(100), getItem(data, items, "rocket-part")),
            new Ingredient(one, getItem(data, items, "satellite")),
        ], [new Ingredient(RationalFromFloat(1000), getItem(data, items, "space-science-pack"))],
    );
    const steam = data.items.steam;
    recipes.steam = new Recipe(
        "steam",
        steam.icon_col,
        steam.icon_row,
        "boiler",
        RationalFromFloats(1, 60),
        [new Ingredient(one, getItem(data, items, "water"))],
        [new Ingredient(one, getItem(data, items, "steam"))],
    );

    for (const name of Object.keys(data.recipes)) {
        const recipe = data.recipes[name];
        if (ignoreRecipe(recipe)) {
            continue;
        }
        const r = makeRecipe(data, recipe, items);
        recipes[recipe.name] = r;
    }
    for (const entityName of Object.keys(data.resource)) {
        const entity = data.resource[entityName];
        let category = entity.category;
        if (!category) {
            category = "basic-solid";
        }
        if (category !== "basic-solid") {
            continue;
        }
        const name = entity.name;
        const props = entity.minable;
        let ingredients = null;
        if ("required_fluid" in props) {
            ingredients = [new Ingredient(
                RationalFromFloat(props.fluid_amount / 10),
                items[props.required_fluid],
            )];
        }
        const products = [];
        for (const result of props.results) {
            products.push(makeIngredient(data, result, items));
        }
        let hardness;
        if (props.hardness) {
            hardness = RationalFromFloat(props.hardness);
        } else {
            hardness = null;
        }
        recipes[name] = new MiningRecipe(
            name,
            entity.icon_col,
            entity.icon_row,
            "mining-" + category,
            hardness,
            RationalFromFloat(props.mining_time),
            ingredients,
            products,
        );
    }
    for (const itemName of Object.keys(items)) {
        const item = items[itemName];
        if (item.recipes.length === 0) {
            const r = new ResourceRecipe(item);
            recipes[r.name] = r;
        }
    }
    return [items, recipes];
}

export {
    Ingredient,
    Recipe,
    MiningRecipe,
    getRecipeGraph,
};
