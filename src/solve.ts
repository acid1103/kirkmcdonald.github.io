import { FactorySpec } from "./factory";
import { Item } from "./item";
import { Rational } from "./rational";
import { Recipe } from "./recipe";
import { findGroups } from "./subgraphs";
import { Totals } from "./totals";
import { IObjectMap } from "./utility-types";
import { MatrixSolver } from "./vectorize";

// never used
// class UnknownRecipe {
//     public name;
//     public item;
//     constructor(item) {
//         this.name = item.name;
//         this.item = item;
//     }
// }

function walk(item: Item, seen: IObjectMap<Item>, solvers: MatrixSolver[]): MatrixSolver {
    for (const m of solvers) {
        if (item.name in m.outputs) {
            return m;
        }
    }
    seen[item.name] = item;
    for (const recipe of item.recipes) {
        for (const ing of recipe.ingredients) {
            if (ing.item.name in seen) {
                continue;
            }
            const m = walk(ing.item, seen, solvers);
            if (m) {
                return m;
            }
        }
    }
    return null;
}

function insertBefore<T>(array: T[], newItem: T, existingItem: T) {
    if (!existingItem) {
        array.push(newItem);
        return;
    }
    for (let i = 0; i < array.length; i++) {
        if (array[i] === existingItem) {
            array.splice(i, 0, newItem);
            return;
        }
    }
    array.push(newItem);
}

function topologicalOrder(matrixSolvers: MatrixSolver[]) {
    const result: MatrixSolver[] = [];
    for (const m of matrixSolvers) {
        const items: IObjectMap<Item> = {};
        // Obtain set of items depended on by the group.
        for (const recipe of m.inputRecipes) {
            for (const ing of recipe.ingredients) {
                items[ing.item.name] = ing.item;
            }
        }
        let dep = null;
        for (const itemName of Object.keys(items)) {
            const item = items[itemName];
            const m2 = walk(item, {}, matrixSolvers);
            if (m2) {
                dep = m2;
                break;
            }
        }
        insertBefore(result, m, dep);
    }
    return result;
}

class Solver {
    public items: IObjectMap<Item>;
    public recipes: IObjectMap<Recipe>;
    public disabledRecipes: IObjectMap<boolean>;
    public matrixSolvers: MatrixSolver[];
    constructor(items: IObjectMap<Item>, recipes: IObjectMap<Recipe>) {
        this.items = items;
        this.recipes = recipes;
        this.disabledRecipes = {};
        this.matrixSolvers = [];
    }

    public findSubgraphs(spec: FactorySpec) {
        const r = findGroups(spec, this.items, this.recipes);
        // Clear all group tags.
        for (const recipeName of Object.keys(this.recipes)) {
            const recipe = this.recipes[recipeName];
            recipe.displayGroup = null;
            recipe.solveGroup = null;
        }
        for (let i = 0; i < r.simple.length; i++) {
            const group = r.simple[i];
            // The order in which these group IDs are assigned does not matter.
            for (const recipeName of Object.keys(group)) {
                group[recipeName].displayGroup = String(i);
            }
        }
        const groups = r.groups;
        this.matrixSolvers = [];
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            this.matrixSolvers.push(new MatrixSolver(spec, group));
            for (const recipeName of Object.keys(group)) {
                group[recipeName].solveGroup = String(i);
            }
        }
        this.matrixSolvers = topologicalOrder(this.matrixSolvers);
    }

    public addDisabledRecipes(recipes: IObjectMap<boolean>) {
        for (const recipeName of Object.keys(recipes)) {
            this.disabledRecipes[recipeName] = true;
        }
    }

    public removeDisabledRecipes(recipes: IObjectMap<boolean>) {
        for (const recipeName of Object.keys(recipes)) {
            delete this.disabledRecipes[recipeName];
        }
    }

    public solve(rates: IObjectMap<Rational>, ignore: IObjectMap<boolean>, spec: FactorySpec) {
        const totals = new Totals();
        for (const itemName of Object.keys(rates)) {
            const item = this.items[itemName];
            const rate = rates[itemName];
            const subTotals = item.produce(rate, ignore, spec);
            totals.combine(subTotals);
        }
        if (Object.keys(totals.unfinished).length === 0) {
            return totals;
        }
        for (const solver of this.matrixSolvers) {
            const match = solver.match(totals.unfinished);
            if (Object.keys(match).length === 0) {
                continue;
            }
            const solution = solver.solveFor(match, spec, this.disabledRecipes);
            for (const itemName of Object.keys(match)) {
                delete totals.unfinished[itemName];
            }
            for (const recipeName of Object.keys(solution.solution)) {
                const rate = solution.solution[recipeName];
                const recipe = this.recipes[recipeName];
                if (solver.inputRecipes.indexOf(recipe) !== -1) {
                    const ing = recipe.products[0];
                    const subRate = recipe.gives(ing.item, spec).mul(rate);
                    const subTotals = ing.item.produce(subRate, ignore, spec);
                    totals.combine(subTotals, true);
                } else {
                    totals.add(recipeName, rate);
                }
            }
            for (const itemName of Object.keys(solution.waste)) {
                totals.addWaste(itemName, solution.waste[itemName]);
            }
        }
        return totals;
    }
}

export {
    Solver,
};
