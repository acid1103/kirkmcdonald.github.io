import { Data, IAssemblingMachine, IChemicalEnergySource } from "./data";
import { alignPower, formatName } from "./display";
import { getImage, IIconned } from "./icon";
import { solver, useLegacyCalculations } from "./init";
import { Module } from "./module";
import {
    half,
    one,
    Rational,
    RationalFromFloat,
    RationalFromFloats,
    zero,
} from "./rational";
import {
    MiningRecipe,
    Recipe,
} from "./recipe";
import { State as SettingsState } from "./settings";
import { IObjectMap } from "./utility-types";

class FactoryDef implements IIconned {
    public name: string;
    public icon_col: number;
    public icon_row: number;
    public categories: string[];
    public max_ing: number;
    public speed: Rational;
    public moduleSlots: number;
    public energyUsage: Rational;
    public fuel: string;
    constructor(
        name: string,
        col: number,
        row: number,
        categories: string[],
        max_ingredients: number,
        speed: Rational,
        moduleSlots: number,
        energyUsage: Rational,
        fuel: string,
    ) {
        this.name = name;
        this.icon_col = col;
        this.icon_row = row;
        this.categories = categories;
        this.max_ing = max_ingredients;
        this.speed = speed;
        this.moduleSlots = moduleSlots;
        this.energyUsage = energyUsage;
        this.fuel = fuel;
    }

    public less(other: FactoryDef) {
        if (!this.speed.equal(other.speed)) {
            return this.speed.less(other.speed);
        }
        return this.moduleSlots < other.moduleSlots;
    }

    public makeFactory(spec: FactorySpec, recipe: Recipe) {
        return new Factory(this, spec, recipe);
    }

    public canBeacon() {
        return this.moduleSlots > 0;
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
        if (this.max_ing) {
            b = document.createElement("b");
            b.textContent = "Max ingredients: ";
            t.appendChild(b);
            t.appendChild(new Text(String(this.max_ing)));
            t.appendChild(document.createElement("br"));
        }
        b = document.createElement("b");
        b.textContent = "Energy consumption: ";
        t.appendChild(b);
        t.appendChild(new Text(alignPower(this.energyUsage, 0)));
        t.appendChild(document.createElement("br"));
        b = document.createElement("b");
        b.textContent = "Crafting speed: ";
        t.appendChild(b);
        t.appendChild(new Text(this.speed.toDecimal()));
        t.appendChild(document.createElement("br"));
        b = document.createElement("b");
        b.textContent = "Module slots: ";
        t.appendChild(b);
        t.appendChild(new Text(String(this.moduleSlots)));
        return t;
    }
}

class MinerDef extends FactoryDef {
    public mining_power: Rational;
    public mining_speed: Rational;
    constructor(
        name: string,
        col: number,
        row: number,
        categories: string[],
        power: Rational,
        speed: Rational,
        moduleSlots: number,
        energyUsage: Rational,
        fuel: string,
    ) {
        super(name, col, row, categories, 0, zero, moduleSlots, energyUsage, fuel);
        this.mining_power = power;
        this.mining_speed = speed;
    }

    public less(other: MinerDef) {
        if (useLegacyCalculations && !this.mining_power.equal(other.mining_power)) {
            return this.mining_power.less(other.mining_power);
        }
        return this.mining_speed.less(other.mining_speed);
    }

    public makeFactory(spec: FactorySpec, recipe: Recipe) {
        return new Miner(this, spec, recipe);
    }

    public renderTooltip() {
        const t = document.createElement("div");
        t.classList.add("frame");
        const title = document.createElement("h3");
        const im = getImage(this, true);
        title.appendChild(im);
        title.appendChild(new Text(formatName(this.name)));
        t.appendChild(title);
        let b = document.createElement("b");
        b.textContent = "Energy consumption: ";
        t.appendChild(b);
        t.appendChild(new Text(alignPower(this.energyUsage, 0)));
        t.appendChild(document.createElement("br"));
        if (useLegacyCalculations) {
            b = document.createElement("b");
            b.textContent = "Mining power: ";
            t.appendChild(b);
            t.appendChild(new Text(this.mining_power.toDecimal()));
            t.appendChild(document.createElement("br"));
        }
        b = document.createElement("b");
        b.textContent = "Mining speed: ";
        t.appendChild(b);
        t.appendChild(new Text(this.mining_speed.toDecimal()));
        t.appendChild(document.createElement("br"));
        b = document.createElement("b");
        b.textContent = "Module slots: ";
        t.appendChild(b);
        t.appendChild(new Text(String(this.moduleSlots)));
        return t;
    }
}

class RocketLaunchDef extends FactoryDef {
    constructor(
        name: string,
        col: number,
        row: number,
        categories: string[],
        max_ingredients: number,
        speed: Rational,
        moduleSlots: number,
        energyUsage: Rational,
        fuel: string,
    ) {
        super(name, col, row, categories, max_ingredients, speed, moduleSlots, energyUsage, fuel);
    }

    public makeFactory(spec: FactorySpec, recipe: Recipe) {
        return new RocketLaunch(this, spec, recipe);
    }
}

class RocketSiloDef extends FactoryDef {
    constructor(
        name: string,
        col: number,
        row: number,
        categories: string[],
        max_ingredients: number,
        speed: Rational,
        moduleSlots: number,
        energyUsage: Rational,
        fuel: string,
    ) {
        super(name, col, row, categories, max_ingredients, speed, moduleSlots, energyUsage, fuel);
    }

    public makeFactory(spec: FactorySpec, recipe: Recipe) {
        return new RocketSilo(this, spec, recipe);
    }
}

class Factory {
    public recipe: Recipe;
    public modules: Module[];
    public beaconModule: Module;
    public beaconCount: Rational;
    public name: string;
    public factory: FactoryDef;

    constructor(factoryDef: FactoryDef, spec: FactorySpec, recipe: Recipe) {
        this.recipe = recipe;
        this.modules = [];
        this.setFactory(factoryDef, spec);
        this.beaconModule = spec.defaultBeacon;
        this.beaconCount = spec.defaultBeaconCount;
    }

    public setFactory(factoryDef: FactoryDef, spec: FactorySpec) {
        this.name = factoryDef.name;
        this.factory = factoryDef;
        if (this.modules.length > factoryDef.moduleSlots) {
            this.modules.length = factoryDef.moduleSlots;
        }
        let toAdd = null;
        if (spec.defaultModule && spec.defaultModule.canUse(this.recipe)) {
            toAdd = spec.defaultModule;
        }
        while (this.modules.length < factoryDef.moduleSlots) {
            this.modules.push(toAdd);
        }
    }

    public getModule(index: number) {
        return this.modules[index];
    }

    // Returns true if the module change requires a recalculation.
    public setModule(index: number, module: Module) {
        if (index >= this.modules.length) {
            return false;
        }
        const oldModule = this.modules[index];
        const needRecalc = (oldModule && oldModule.hasProdEffect()) || (module && module.hasProdEffect());
        this.modules[index] = module;
        return needRecalc;
    }

    public speedEffect(spec: FactorySpec) {
        let speed = one;
        for (const module of this.modules) {
            if (!module) {
                continue;
            }
            speed = speed.add(module.speed);
        }
        if (this.modules.length > 0) {
            const beaconModule = this.beaconModule;
            if (beaconModule) {
                speed = speed.add(beaconModule.speed.mul(this.beaconCount).mul(half));
            }
        }
        return speed;
    }

    public prodEffect(spec: FactorySpec) {
        let prod = one;
        for (const module of this.modules) {
            if (!module) {
                continue;
            }
            prod = prod.add(module.productivity);
        }
        return prod;
    }

    public powerEffect(spec: FactorySpec) {
        let power = one;
        for (const module of this.modules) {
            if (!module) {
                continue;
            }
            power = power.add(module.power);
        }
        if (this.modules.length > 0) {
            const beaconModule = this.beaconModule;
            if (beaconModule) {
                power = power.add(beaconModule.power.mul(this.beaconCount).mul(half));
            }
        }
        const minimum = RationalFromFloats(1, 5);
        if (power.less(minimum)) {
            power = minimum;
        }
        return power;
    }

    public powerUsage(spec: FactorySpec, count: Rational) {
        let power = this.factory.energyUsage;
        if (this.factory.fuel) {
            return { fuel: this.factory.fuel, power: power.mul(count) };
        }
        // Default drain value.
        const drain = power.div(RationalFromFloat(30));
        const divmod = count.divmod(one);
        power = power.mul(count);
        if (!divmod.remainder.isZero()) {
            const idle = one.sub(divmod.remainder);
            power = power.add(idle.mul(drain));
        }
        power = power.mul(this.powerEffect(spec));
        return { fuel: "electric", power };
    }

    public recipeRate(spec: FactorySpec, recipe: Recipe) {
        return recipe.time.reciprocate().mul(this.factory.speed).mul(this.speedEffect(spec));
    }

    public copyModules(other: Factory, recipe: Recipe) {
        const length = Math.max(this.modules.length, other.modules.length);
        let needRecalc = false;
        for (let i = 0; i < length; i++) {
            const module = this.getModule(i);
            if (!module || module.canUse(recipe)) {
                needRecalc = other.setModule(i, module) || needRecalc;
            }
        }
        if (other.factory.canBeacon()) {
            other.beaconModule = this.beaconModule;
            other.beaconCount = this.beaconCount;
        }
        return needRecalc;
    }

}

class Miner extends Factory {
    constructor(factory: MinerDef, spec: FactorySpec, recipe: Recipe) {
        super(factory, spec, recipe);
    }

    public recipeRate(spec: FactorySpec, recipe: MiningRecipe) {
        const miner = this.factory as MinerDef;
        let rate;
        if (useLegacyCalculations) {
            rate = miner.mining_power.sub(recipe.hardness);
        } else {
            rate = one;
        }
        return rate.mul(miner.mining_speed).div(recipe.mining_time).mul(this.speedEffect(spec));
    }

    public prodEffect(spec: FactorySpec) {
        const prod = super.prodEffect(spec);
        return prod.add(spec.miningProd);
    }
}

const rocketLaunchDuration = RationalFromFloats(2475, 60);

function launchRate(spec: FactorySpec) {
    const partRecipe = solver.recipes["rocket-part"];
    const partFactory = spec.getFactory(partRecipe);
    const partItem = solver.items["rocket-part"];
    const gives = partRecipe.gives(partItem, spec);
    // The base rate at which the silo can make rocket parts.
    const rate = Factory.prototype.recipeRate.call(partFactory, spec, partRecipe);
    // Number of times to complete the rocket part recipe per launch.
    const perLaunch = RationalFromFloat(100).div(gives);
    // Total length of time required to launch a rocket.
    const time = perLaunch.div(rate).add(rocketLaunchDuration);
    const launchRate = time.reciprocate();
    const partRate = perLaunch.div(time);
    return { part: partRate, launch: launchRate };
}

class RocketLaunch extends Factory {
    constructor(factory: RocketLaunchDef, spec: FactorySpec, recipe: Recipe) {
        super(factory, spec, recipe);
    }

    public recipeRate(spec: FactorySpec, recipe: Recipe) {
        return launchRate(spec).launch;
    }
}

class RocketSilo extends Factory {
    constructor(factory: RocketSiloDef, spec: FactorySpec, recipe: Recipe) {
        super(factory, spec, recipe);
    }

    public recipeRate(spec: FactorySpec, recipe: Recipe) {
        return launchRate(spec).part;
    }
}

const assembly_machine_categories = {
    "advanced-crafting": true,
    "crafting": true,
    "crafting-with-fluid": true,
};

function compareFactories(a: FactoryDef, b: FactoryDef) {
    if (a.less(b)) {
        return -1;
    }
    if (b.less(a)) {
        return 1;
    }
    return 0;
}

class FactorySpec {
    public spec: IObjectMap<Factory>;
    public factories: IObjectMap<FactoryDef[]>;
    public furnace: FactoryDef;
    public miningProd: Rational;
    public ignore: IObjectMap<boolean>;
    public defaultModule: Module;
    public defaultBeacon: Module;
    public defaultBeaconCount: Rational;
    public minimum: FactoryDef;
    constructor(factories: FactoryDef[]) {
        this.spec = {};
        this.factories = {};
        for (const factory of factories) {
            for (const category of factory.categories) {
                if (!(category in this.factories)) {
                    this.factories[category] = [];
                }
                this.factories[category].push(factory);
            }
        }
        for (const category of Object.keys(this.factories)) {
            this.factories[category].sort(compareFactories);
        }
        this.setMinimum("1");
        const smelters = this.factories.smelting;
        this.furnace = smelters[smelters.length - 1];
        SettingsState.DEFAULT_FURNACE = this.furnace.name;
        this.miningProd = zero;
        this.ignore = {};

        this.defaultModule = null;
        // XXX: Not used yet.
        this.defaultBeacon = null;
        this.defaultBeaconCount = zero;
    }

    // min is a string like "1", "2", or "3".
    public setMinimum(min: string) {
        const minIndex = Number(min) - 1;
        this.minimum = this.factories.crafting[minIndex];
    }

    public useMinimum(recipe: Recipe) {
        return recipe.category in assembly_machine_categories;
    }

    public setFurnace(name: string) {
        const smelters = this.factories.smelting;
        for (const smelter of smelters) {
            if (smelter.name === name) {
                this.furnace = smelter;
                return;
            }
        }
    }

    public useFurnace(recipe: Recipe) {
        return recipe.category === "smelting";
    }

    public getFactoryDef(recipe: Recipe) {
        if (this.useFurnace(recipe)) {
            return this.furnace;
        }
        const factories = this.factories[recipe.category];
        if (!this.useMinimum(recipe)) {
            return factories[factories.length - 1];
        }
        let factoryDef;
        for (factoryDef of factories) {
            if (!(factoryDef.less(this.minimum) || useLegacyCalculations &&
                factoryDef.max_ing < recipe.ingredients.length)) {
                break;
            }
        }
        return factoryDef;
    }

    // TODO: This should be very cheap. Calling getFactoryDef on each call
    // should not be necessary. Changing the minimum should proactively update
    // all of the factories to which it applies.
    public getFactory(recipe: Recipe) {
        if (!recipe.category) {
            return null;
        }
        const factoryDef = this.getFactoryDef(recipe);
        const factory = this.spec[recipe.name];
        // If the minimum changes, update the factory the next time we get it.
        if (factory) {
            factory.setFactory(factoryDef, this);
            return factory;
        }
        this.spec[recipe.name] = factoryDef.makeFactory(this, recipe);
        this.spec[recipe.name].beaconCount = this.defaultBeaconCount;
        return this.spec[recipe.name];
    }

    public moduleCount(recipe: Recipe) {
        const factory = this.getFactory(recipe);
        if (!factory) {
            return 0;
        }
        return factory.modules.length;
    }

    public getModule(recipe: Recipe, index: number) {
        const factory = this.getFactory(recipe);
        const module = factory.getModule(index);
        return module;
    }

    public setModule(recipe: Recipe, index: number, module: Module) {
        const factory = this.getFactory(recipe);
        if (!factory) {
            return false;
        }
        return factory.setModule(index, module);
    }

    public getBeaconInfo(recipe: Recipe) {
        const factory = this.getFactory(recipe);
        const module = factory.beaconModule;
        return { module, count: factory.beaconCount };
    }

    public setDefaultModule(module: Module) {
        // Set anything set to the old default to the new.
        for (const recipeName of Object.keys(this.spec)) {
            const factory = this.spec[recipeName];
            const recipe = factory.recipe;
            for (let i = 0; i < factory.modules.length; i++) {
                if (factory.modules[i] === this.defaultModule && (!module || module.canUse(recipe))) {
                    factory.modules[i] = module;
                }
            }
        }
        this.defaultModule = module;
    }

    public setDefaultBeacon(module: Module, count: Rational) {
        for (const recipeName of Object.keys(this.spec)) {
            const factory = this.spec[recipeName];
            const recipe = factory.recipe;
            // Set anything set to the old defeault beacon module to the new.
            if (factory.beaconModule === this.defaultBeacon && (!module || module.canUse(recipe))) {
                factory.beaconModule = module;
            }
            // Set any beacon counts equal to the old default to the new one.
            if (factory.beaconCount.equal(this.defaultBeaconCount)) {
                factory.beaconCount = count;
            }
        }
        this.defaultBeacon = module;
        this.defaultBeaconCount = count;
    }

    public getCount(recipe: Recipe, rate: Rational) {
        const factory = this.getFactory(recipe);
        if (!factory) {
            return zero;
        }
        return rate.div(factory.recipeRate(this, recipe));
    }

    public recipeRate(recipe: Recipe) {
        const factory = this.getFactory(recipe);
        if (!factory) {
            return null;
        }
        return factory.recipeRate(this, recipe);
    }
}

function renderTooltipBase(this: FactoryDef) {
    const t = document.createElement("div");
    t.classList.add("frame");
    const title = document.createElement("h3");
    const im = getImage(this, true);
    title.appendChild(im);
    title.appendChild(new Text(formatName(this.name)));
    t.appendChild(title);
    return t;
}

function getFactories(data: Data) {
    const factories = [];
    const pumpDef = data["offshore-pump"]["offshore-pump"];
    const pump = new FactoryDef(
        "offshore-pump",
        pumpDef.icon_col,
        pumpDef.icon_row,
        ["water"],
        1,
        one,
        0,
        zero,
        null,
    );
    pump.renderTooltip = renderTooltipBase;
    factories.push(pump);
    const reactorDef = data.reactor["nuclear-reactor"];
    const reactor = new FactoryDef(
        "nuclear-reactor",
        reactorDef.icon_col,
        reactorDef.icon_row,
        ["nuclear"],
        1,
        one,
        0,
        zero,
        null,
    );
    reactor.renderTooltip = renderTooltipBase;
    factories.push(reactor);
    const boilerDef = data.boiler.boiler;
    // XXX: Should derive this from game data.
    let boiler_energy: Rational;
    if (useLegacyCalculations) {
        boiler_energy = RationalFromFloat(3600000);
    } else {
        boiler_energy = RationalFromFloat(1800000);
    }
    const boiler = new FactoryDef(
        "boiler",
        boilerDef.icon_col,
        boilerDef.icon_row,
        ["boiler"],
        1,
        one,
        0,
        boiler_energy,
        "chemical",
    );
    boiler.renderTooltip = renderTooltipBase;
    factories.push(boiler);
    const siloDef = data["rocket-silo"]["rocket-silo"];
    const launch = new RocketLaunchDef(
        "rocket-silo",
        siloDef.icon_col,
        siloDef.icon_row,
        ["rocket-launch"],
        2,
        one,
        0,
        zero,
        null,
    );
    launch.renderTooltip = renderTooltipBase;
    factories.push(launch);
    for (const type of [data["assembling-machine"], data.furnace]) {
        for (const name of Object.keys(type)) {
            const d = type[name];
            let fuel = null;
            if ("energy_source" in d && d.energy_source.type === "burner") {
                fuel = (d.energy_source as IChemicalEnergySource).fuel_category;
            }
            factories.push(new FactoryDef(
                d.name,
                d.icon_col,
                d.icon_row,
                d.crafting_categories,
                (d as IAssemblingMachine).ingredient_count,
                RationalFromFloat(d.crafting_speed),
                d.module_slots,
                RationalFromFloat(d.energy_usage),
                fuel,
            ));
        }
    }
    for (const name of Object.keys(data["rocket-silo"])) {
        const d = data["rocket-silo"][name];
        factories.push(new RocketSiloDef(
            d.name,
            d.icon_col,
            d.icon_row,
            d.crafting_categories,
            undefined,
            RationalFromFloat(d.crafting_speed),
            d.module_slots,
            RationalFromFloat(d.energy_usage),
            null,
        ));
    }
    for (const name of Object.keys(data["mining-drill"])) {
        const d = data["mining-drill"][name];
        if (d.name === "pumpjack") {
            continue;
        }
        let fuel = null;
        if (d.energy_source && d.energy_source.type === "burner") {
            fuel = (d.energy_source as IChemicalEnergySource).fuel_category;
        }
        let power;
        if ("mining_power" in d) {
            power = RationalFromFloat(d.mining_power);
        } else {
            power = null;
        }
        factories.push(new MinerDef(
            d.name,
            d.icon_col,
            d.icon_row,
            ["mining-basic-solid"],
            power,
            RationalFromFloat(d.mining_speed),
            d.module_slots,
            RationalFromFloat(d.energy_usage),
            fuel,
        ));
    }
    return factories;
}

export {
    FactoryDef,
    Factory,
    FactorySpec,
    getFactories,
};
