import { FactorySpec } from "./factory";
import { useLegacyCalculations } from "./init";
import { Item } from "./item";
import { Matrix } from "./matrix";
import { minusOne, one, Rational, zero } from "./rational";
import { Recipe } from "./recipe";
import { simplex } from "./simplex";
import { IObjectMap } from "./utility-types";

const PRIORITY = ["uranium-ore", "steam", "coal", "crude-oil", "water"];

class MatrixSolver {
    public items: Item[];
    public outputs: IObjectMap<Item>;
    public outputItems: Item[];
    public inputRecipes: Recipe[];
    public recipeIndexes: IObjectMap<number>;
    public inputColumns: number[];
    public matrix: Matrix;
    public itemIndexes: IObjectMap<number>;
    public recipes: Recipe[];
    public lastProblem: Matrix;
    public lastSolution: Matrix;

    constructor(spec: FactorySpec, recipes: IObjectMap<Recipe>) {
        const products: IObjectMap<Item> = {};
        const ingredients: IObjectMap<Item> = {};
        const recipeArray: Recipe[] = [];
        for (const recipeName of Object.keys(recipes)) {
            const recipe = recipes[recipeName];
            recipeArray.push(recipe);
            for (const ing of recipe.products) {
                products[ing.item.name] = ing.item;
            }
            const ings = recipe.getIngredients(spec);
            for (const ing of ings) {
                ingredients[ing.item.name] = ing.item;
            }
        }
        const items: Item[] = [];
        this.items = items;
        // Map of items produced by this matrix.
        this.outputs = {};
        // Array of items produced by this matrix.
        this.outputItems = [];
        // Map from item name to waste-item column (minus offset).
        const wasteItems: IObjectMap<number> = {};
        for (const itemName of Object.keys(products)) {
            const item = products[itemName];
            this.outputs[item.name] = item;
            items.push(item);
            wasteItems[item.name] = this.outputItems.length;
            this.outputItems.push(item);
        }
        // Array of the recipes that produce the "inputs" to this matrix.
        this.inputRecipes = [];
        for (const itemName of Object.keys(ingredients)) {
            if (itemName in products) {
                continue;
            }
            const item = ingredients[itemName];
            items.push(item);
            const recipe = item.recipes[0];
            this.inputRecipes.push(recipe);
        }
        const allRecipes = recipeArray.concat(this.inputRecipes);
        const itemIndexes: IObjectMap<number> = {};
        for (let i = 0; i < items.length; i++) {
            itemIndexes[items[i].name] = i;
        }
        this.recipeIndexes = {};
        this.inputColumns = [];
        for (let i = 0; i < allRecipes.length; i++) {
            this.recipeIndexes[allRecipes[i].name] = i;
            if (i >= recipeArray.length) {
                this.inputColumns.push(i);
            }
        }
        const rows = allRecipes.length + 2;
        const cols = items.length + allRecipes.length + 3;
        const recipeMatrix = new Matrix(rows, cols);
        for (let i = 0; i < recipeArray.length; i++) {
            const recipe = recipeArray[i];
            const ings = recipe.getIngredients(spec);
            for (const ing of ings) {
                const k = itemIndexes[ing.item.name];
                recipeMatrix.addIndex(i, k, zero.sub(ing.amount));
            }
            for (const ing of recipe.products) {
                const k = itemIndexes[ing.item.name];
                recipeMatrix.addIndex(i, k, ing.amount);
            }
            // Recipe tax.
            recipeMatrix.setIndex(i, items.length, minusOne);
        }
        for (let i = 0; i < this.inputRecipes.length; i++) {
            const recipe = this.inputRecipes[i];
            for (const ing of recipe.products) {
                const k = itemIndexes[ing.item.name];
                recipeMatrix.addIndex(i + recipeArray.length, k, ing.amount);
            }
        }
        // Add "recipe tax," so that wasted items will be wasted directly.
        // There is no surplus variable for this value.
        recipeMatrix.setIndex(allRecipes.length, items.length, one);
        let col;
        // Add surplus variables.
        for (let i = 0; i < allRecipes.length; i++) {
            col = items.length + i + 1;
            recipeMatrix.setIndex(i, col, one);
        }
        recipeMatrix.setIndex(rows - 1, col + 1, one);
        // The matrix. (matrix.js)
        this.matrix = recipeMatrix;
        // Map from item name to row number.
        this.itemIndexes = itemIndexes;
        // List of all recipes in matrix, in matrix column order.
        this.recipes = allRecipes;
        this.lastProblem = null;
        this.lastSolution = null;
    }

    public match(products: IObjectMap<Rational>) {
        const result: IObjectMap<Rational> = {};
        for (const itemName in products) {
            if (itemName in this.outputs) {
                result[itemName] = products[itemName];
            }
        }
        return result;
    }

    public getPriorityRatio(A: Matrix) {
        let min = null;
        let max = null;
        for (let x of A.mat) {
            x = x.abs();
            if (x.isZero()) {
                continue;
            }
            if (!min || x.less(min)) {
                min = x;
            }
            if (!max || max.less(x)) {
                max = x;
            }
        }
        return max.div(min);
    }

    public setCost(A: Matrix) {
        // Recipe tax cost.
        A.setIndex(this.recipes.length, A.cols - 1, one);
        const ratio = this.getPriorityRatio(A);
        // Cost == 1 already "spent" on recipe tax.
        let cost = ratio;
        // Maps priority number to column number.
        for (let i = PRIORITY.length - 1; i >= 0; i--) {
            const name = PRIORITY[i];
            const row = this.recipeIndexes[name];
            if (!row) {
                continue;
            }
            A.setIndex(row, A.cols - 1, cost);
            cost = cost.mul(ratio);
        }
    }

    public solveFor(products: IObjectMap<Rational>, spec: FactorySpec, disabled: IObjectMap<boolean>) {
        const A = this.matrix.copy();
        for (const itemName in products) {
            if (itemName in this.itemIndexes) {
                const col = this.itemIndexes[itemName];
                const rate = products[itemName];
                A.setIndex(A.rows - 1, col, zero.sub(rate));
            }
        }
        // Zero out disabled recipes
        for (const recipeName in disabled) {
            if (recipeName in this.recipeIndexes) {
                const i = this.recipeIndexes[recipeName];
                A.zeroRow(i);
            }
        }
        // Apply productivity effects.
        for (let i = 0; i < this.recipes.length; i++) {
            const recipe = this.recipes[i];
            if (recipe.name in disabled) {
                continue;
            }
            const factory = spec.getFactory(recipe);
            if (factory) {
                const prod = factory.prodEffect(spec);
                if (prod.equal(one)) {
                    continue;
                }
                if (useLegacyCalculations) {
                    for (const ing of recipe.products) {
                        const k = this.itemIndexes[ing.item.name];
                        A.setIndex(i, k, zero);
                    }
                    const ings = recipe.getIngredients(spec);
                    for (const ing of ings) {
                        const k = this.itemIndexes[ing.item.name];
                        if (k !== undefined) {
                            A.setIndex(i, k, zero.sub(ing.amount));
                        }
                    }
                    for (const ing of recipe.products) {
                        const k = this.itemIndexes[ing.item.name];
                        A.addIndex(i, k, ing.amount.mul(prod));
                    }
                } else {
                    for (let j = 0; j < this.items.length; j++) {
                        const n = A.index(i, j);
                        if (!zero.less(n)) {
                            continue;
                        }
                        A.setIndex(i, j, n.mul(prod));
                    }
                }
            }
        }
        this.setCost(A);
        this.lastProblem = A.copy();
        // Solve.
        simplex(A);
        // Convert array of rates into map from recipe name to rate.
        const solution: IObjectMap<Rational> = {};
        for (let i = 0; i < this.recipes.length; i++) {
            const col = this.items.length + i + 1;
            const rate = A.index(A.rows - 1, col);
            if (zero.less(rate)) {
                solution[this.recipes[i].name] = rate;
            }
        }
        const waste: IObjectMap<Rational> = {};
        for (let i = 0; i < this.outputItems.length; i++) {
            const rate = A.index(A.rows - 1, i);
            if (zero.less(rate)) {
                waste[this.outputItems[i].name] = rate;
            }
        }
        this.lastSolution = A;
        return { solution, waste };
    }
}

export {
    MatrixSolver,
};
