import { FactorySpec } from "./factory";
import { Item } from "./item";
import { Recipe } from "./recipe";
import { IObjectMap } from "./utility-types";

let subgraphID = 0;

class Subgraph {
    public id: number;
    public recipes: IObjectMap<Recipe>;
    public products: IObjectMap<Item>;
    public ingredients: IObjectMap<Item>;
    constructor(recipes: IObjectMap<Recipe>) {
        this.id = subgraphID;
        subgraphID++;
        this.recipes = recipes;
        this.products = {};
        for (const recipeName in recipes) {
            const recipe = recipes[recipeName];
            for (let i = 0; i < recipe.products.length; i++) {
                const ing = recipe.products[i];
                this.products[ing.item.name] = ing.item;
            }
        }
        this.ingredients = {};
        for (const recipeName in recipes) {
            const recipe = recipes[recipeName];
            for (let i = 0; i < recipe.ingredients.length; i++) {
                const ing = recipe.ingredients[i];
                if (ing.item.name in this.products) {
                    continue;
                }
                this.ingredients[ing.item.name] = ing.item;
            }
        }
    }
    public isInteresting() {
        return Object.keys(this.recipes).length > 1 || Object.keys(this.products).length > 1;
    }
}

class SubgraphMap {
    public groups: IObjectMap<Subgraph>;
    public extraUses: IObjectMap<Recipe[]>;
    constructor(spec: FactorySpec, recipes: IObjectMap<Recipe>) {
        this.groups = {};
        this.extraUses = {};
        for (const recipeName in recipes) {
            const recipe = recipes[recipeName];
            const g: any = {}; // TODO
            g[recipeName] = recipe;
            const s = new Subgraph(g);
            this.groups[recipeName] = s;
            const fuelIngredient = recipe.fuelIngredient(spec);
            for (let i = 0; i < fuelIngredient.length; i++) {
                const ing = fuelIngredient[i];
                if (ing.item.name in this.extraUses) {
                    this.extraUses[ing.item.name].push(recipe);
                } else {
                    this.extraUses[ing.item.name] = [recipe];
                }
                if (ing.item.name in s.products) {
                    continue;
                }
                s.ingredients[ing.item.name] = ing.item;
            }
        }
    }

    public merge(recipes: Recipe[]) {
        const combinedRecipes = {};
        for (let i = 0; i < recipes.length; i++) {
            const recipe = recipes[i];
            const group = this.groups[recipe.name];
            Object.assign(combinedRecipes, group.recipes);
        }
        const newGroup = new Subgraph(combinedRecipes);
        for (const recipeName in combinedRecipes) {
            this.groups[recipeName] = newGroup;
        }
    }

    public mergeGroups(groups: Subgraph[]) {
        const allRecipes: any = {}; // TODO
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            for (const recipeName in group.recipes) {
                const recipe = group.recipes[recipeName];
                allRecipes[recipeName] = recipe;
            }
        }
        this.merge(Object.keys(allRecipes).map((k) => allRecipes[k]));
    }

    public get(recipe: Recipe) {
        return this.groups[recipe.name];
    }

    public groupObjects() {
        const groups: any = {}; // TODO
        for (const recipeName in this.groups) {
            const group = this.groups[recipeName];
            groups[group.id] = group;
        }
        return groups;
    }

    public getInterestingGroups() {
        const result = [];
        const groups = this.groupObjects();
        for (const id in groups) {
            const g = groups[id];
            if (g.isInteresting()) {
                result.push(g.recipes);
            }
        }
        return result;
    }

    public neighbors(group: Subgraph, invert: boolean) {
        let itemSet;
        if (invert) {
            itemSet = group.products;
        } else {
            itemSet = group.ingredients;
        }
        const seen: any = {}; // TODO
        const result = [];
        for (const itemName in itemSet) {
            const item = itemSet[itemName];
            let recipeSet;
            if (invert) {
                recipeSet = item.uses;
                if (itemName in this.extraUses) {
                    recipeSet = recipeSet.concat(this.extraUses[itemName]);
                }
            } else {
                recipeSet = item.recipes;
            }
            const subgroups: any = {}; // TODO
            for (let i = 0; i < recipeSet.length; i++) {
                const recipe = recipeSet[i];
                const group = this.get(recipe);
                subgroups[group.id] = group;
            }
            for (const id in subgroups) {
                const g = subgroups[id];
                if (!(id in seen)) {
                    seen[id] = g;
                    result.push(g);
                }
            }
        }
        return result;
    }
}

function visit(groupmap: SubgraphMap, group: Subgraph, seen: IObjectMap<Subgraph>, invert: boolean) {
    if (group.id in seen) {
        return [];
    }
    seen[group.id] = group;
    const neighbors = groupmap.neighbors(group, invert);
    const result: Subgraph[] = [];
    for (let i = 0; i < neighbors.length; i++) {
        const neighbor = neighbors[i];
        const x = visit(groupmap, neighbor, seen, invert);
        Array.prototype.push.apply(result, x);
    }
    result.push(group);
    return result;
}

function findCycles(groupmap: SubgraphMap) {
    let seen = {};
    const L: Subgraph[] = [];
    const groups = groupmap.groupObjects();
    for (const id in groups) {
        const group = groups[id];
        const x = visit(groupmap, group, seen, false);
        Array.prototype.push.apply(L, x);
    }
    const components = [];
    seen = {};
    for (let i = L.length - 1; i >= 0; i--) {
        const root = L[i];
        if (root.id in seen) {
            continue;
        }
        const component = visit(groupmap, root, seen, true);
        components.push(component);
    }
    return components;
}

// Map an item to the items that it depends on.
function getItemDeps(item: Item, groupmap: SubgraphMap, depmap: IObjectMap<IObjectMap<Item>>) {
    if (item.name in depmap) {
        return depmap[item.name];
    }
    const groups: any = {}; // TODO
    for (let i = 0; i < item.recipes.length; i++) {
        const recipe = item.recipes[i];
        const group = groupmap.get(recipe);
        groups[group.id] = group;
    }
    const deps: any = {}; // TODO
    deps[item.name] = item;
    for (const id in groups) {
        const group = groups[id];
        for (const itemName in group.ingredients) {
            const subitem = group.ingredients[itemName];
            const subdeps = getItemDeps(subitem, groupmap, depmap);
            Object.assign(deps, subdeps);
        }
    }
    depmap[item.name] = deps;
    return deps;
}

const PENDING = {};

// Map an item to the items that depend on it.
function getItemProducts(item: Item, groupmap: SubgraphMap, prodmap: IObjectMap<IObjectMap<Item>>) {
    if (item.name in prodmap) {
        return prodmap[item.name];
    }
    const groups: any = {}; // TODO
    let uses = item.uses;
    if (item.name in groupmap.extraUses) {
        uses = uses.concat(groupmap.extraUses[item.name]);
    }
    for (let i = 0; i < uses.length; i++) {
        const recipe = uses[i];
        const group = groupmap.get(recipe);
        groups[group.id] = group;
    }
    const prods: any = {}; // TODO
    prods[item.name] = item;
    prodmap[item.name] = PENDING;
    for (const id in groups) {
        const group = groups[id];
        for (const itemName in group.products) {
            const subitem = group.products[itemName];
            const subprods = getItemProducts(subitem, groupmap, prodmap);
            if (subprods !== PENDING) {
                Object.assign(prods, subprods);
            }
        }
    }
    prodmap[item.name] = prods;
    return prods;
}

function findGroups(spec: FactorySpec, items: IObjectMap<Item>, recipes: IObjectMap<Recipe>) {
    const groups = new SubgraphMap(spec, recipes);
    // 1) Condense all recipes that produce a given item.
    for (const itemName in items) {
        const item = items[itemName];
        if (item.recipes.length > 1) {
            groups.merge(item.recipes);
        }
    }

    // Get the "simple" groups, which are used for display purposes.
    const simpleGroups = groups.getInterestingGroups();

    // 2) Condense all recipe cycles.
    const groupCycles = findCycles(groups);
    for (let i = 0; i < groupCycles.length; i++) {
        const cycle = groupCycles[i];
        groups.mergeGroups(cycle);
    }

    // 3) Condense any groups which have a multivariate relationship, including
    //    recipes which are between the two.
    const itemDeps: any = {}; // TODO
    const itemProds: any = {}; // TODO
    for (const itemName in items) {
        const item = items[itemName];
        if (!(itemName in itemDeps)) {
            getItemDeps(item, groups, itemDeps);
        }
        if (!(itemName in itemProds)) {
            getItemProducts(item, groups, itemProds);
        }
    }

    const groupObjs = groups.groupObjects();
    const itemGroups: any = {}; // TODO
    for (const id in groupObjs) {
        const group = groupObjs[id];
        for (const prodID in group.products) {
            const item = group.products[prodID];
            itemGroups[item.name] = group;
        }
    }
    let mergings: any = []; // TODO
    for (const id in groupObjs) {
        const group = groupObjs[id];
        if (!group.isInteresting()) {
            continue;
        }
        const matches: any = {}; // TODO
        for (const itemName in group.ingredients) {
            const item = group.ingredients[itemName];
            const deps = itemDeps[item.name];
            for (const depName in deps) {
                const dep = deps[depName];
                const g = itemGroups[depName];
                if (!g.isInteresting()) {
                    continue;
                }
                const pair = { a: item, b: dep };
                if (g.id in matches) {
                    matches[g.id].push(pair);
                } else {
                    matches[g.id] = [pair];
                }
            }
        }
        const toMerge: any = {}; // TODO
        let performMerge = false;
        for (const matchID in matches) {
            const g = groupObjs[matchID];
            const links = matches[matchID];
            outer: for (let i = 0; i < links.length - 1; i++) {
                const x = links[i];
                for (let j = i + 1; j < links.length; j++) {
                    const y = links[j];
                    if (x.a !== y.a && x.b !== y.b) {
                        toMerge[g.id] = g;
                        performMerge = true;
                        break outer;
                    }
                }
            }
        }
        if (performMerge) {
            const groupsToMerge: any = {}; // TODO
            groupsToMerge[group.id] = group;
            const allDeps: any = {}; // TODO
            for (const itemName in group.ingredients) {
                for (const depName in itemDeps[itemName]) {
                    const dep = itemDeps[itemName][depName];
                    allDeps[depName] = dep;
                }
            }
            for (const id in toMerge) {
                const g = toMerge[id];
                groupsToMerge[g.id] = g;
                for (const itemName in g.products) {
                    for (const prodName in itemProds[itemName]) {
                        if (prodName in g.products) {
                            continue;
                        }
                        if (!(prodName in allDeps)) {
                            continue;
                        }
                        const prodGroup = itemGroups[prodName];
                        groupsToMerge[prodGroup.id] = prodGroup;
                    }
                }
            }
            mergings.push(groupsToMerge);
        }
    }
    let merge = true;
    while (merge) {
        merge = false;
        const result = [];
        while (mergings.length > 0) {
            const current: any = mergings.pop(); // TODO
            const newMergings = [];
            for (let i = 0; i < mergings.length; i++) {
                const x: any = mergings[i]; // TODO
                let disjoint = true;
                for (const id in current) {
                    if (id in x) {
                        disjoint = false;
                        break;
                    }
                }
                if (disjoint) {
                    newMergings.push(x);
                } else {
                    merge = true;
                    for (const id in x) {
                        const g = x[id];
                        current[id] = g;
                    }
                }
            }
            result.push(current);
            mergings = newMergings;
        }
        mergings = result;
    }
    for (let i = 0; i < mergings.length; i++) {
        const s = Object.keys(mergings[i]).map((k) => mergings[i][k]);
        groups.mergeGroups(s);
    }

    return { groups: groups.getInterestingGroups(), simple: simpleGroups };
}

export {
    findGroups,
};
