import { Item } from "./item";
import { Rational, zero } from "./rational";
import { IObjectMap } from "./utility-types";

class Requirements {
    public rate: Rational;
    public item: Item;
    public dependencies: Requirements[];
    constructor(rate: Rational, item: Item) {
        this.rate = rate;
        this.item = item;
        this.dependencies = [];
    }

    public add(reqs: Requirements, suppress: boolean) {
        if (reqs.item && !suppress) {
            this.dependencies.push(reqs);
        }
    }
}

class Totals {
    public reqs: Requirements;
    public totals: IObjectMap<Rational>;
    public unfinished: IObjectMap<Rational>;
    public waste: IObjectMap<Rational>;
    public topo: string[];

    constructor(rate?: Rational, item?: Item) {
        this.reqs = new Requirements(rate, item);
        // Maps recipe name to its required rate.
        this.totals = {};
        // Maps item name to its as-yet-unfulfilled rate.
        this.unfinished = {};
        // Maps item name to rate at which it will be wasted.
        this.waste = {};
        this.topo = [];
    }

    public combine(other: Totals, suppress?: boolean) {
        this.reqs.add(other.reqs, suppress);
        let newTopo = [];
        for (const recipeName of this.topo) {
            if (!(recipeName in other.totals)) {
                newTopo.push(recipeName);
            }
        }
        newTopo = newTopo.concat(other.topo);
        for (const recipeName of Object.keys(other.totals)) {
            this.add(recipeName, other.totals[recipeName]);
        }
        for (const itemName of Object.keys(other.unfinished)) {
            this.addUnfinished(itemName, other.unfinished[itemName]);
        }
        for (const itemName of Object.keys(other.waste)) {
            this.addWaste(itemName, other.waste[itemName]);
        }
        this.topo = newTopo;
    }

    public add(recipeName: string, rate: Rational) {
        this.topo.push(recipeName);
        this.totals[recipeName] = (this.totals[recipeName] || zero).add(rate);
    }

    public addUnfinished(itemName: string, rate: Rational) {
        this.unfinished[itemName] = (this.unfinished[itemName] || zero).add(rate);
    }

    public addWaste(itemName: string, rate: Rational) {
        this.waste[itemName] = (this.waste[itemName] || zero).add(rate);
    }

    public get(recipeName: string) {
        return this.totals[recipeName];
    }

    public getWaste(itemName: string) {
        const waste = this.waste[itemName];
        if (!waste) {
            return zero;
        }
        return waste;
    }
}

export {
    Totals,
};
