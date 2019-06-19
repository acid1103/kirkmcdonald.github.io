import d3 = require("d3");
import $ = require("jquery");
import { displayCount, displayRate } from "./display";
import { addInputs, makeDropdown } from "./dropdown";
import {
    FactoryHandler,
    ItemHandler,
    RateHandler,
    RecipeSelectorHandler,
    RemoveHandler,
    resetSearch,
    searchTargets,
} from "./events";
import { getImage } from "./icon";
import { itemGroups, solver, spec } from "./init";
import { one, Rational, RationalFromString, zero } from "./rational";
import { TargetState, SettingsState } from "./window-interface";

const DEFAULT_ITEM = "advanced-circuit";

TargetState.build_targets = [];

function addTarget(itemName?: string) {
    const target = new BuildTarget(TargetState.build_targets.length, itemName);
    TargetState.build_targets.push(target);
    const targetList = document.getElementById("targets");
    const plus = targetList.replaceChild(target.element, targetList.lastChild);
    targetList.appendChild(plus);
    return target;
}

function isFactoryTarget(recipeName: string) {
    // Special case: rocket-part and rocket-launch are linked in a weird way.
    if (recipeName === "rocket-part") {
        if (isFactoryTarget("rocket-launch")) {
            return true;
        }
    }
    for (const target of TargetState.build_targets) {
        const item = solver.items[target.itemName];
        for (const recipe of item.recipes) {
            if (recipe.name === recipeName && target.changedFactory) {
                return true;
            }
        }
    }
    return false;
}

let targetCount = 0;
let recipeSelectorCount = 0;

const SELECTED_INPUT = "selected";

class BuildTarget {
    public index: number;
    public itemName: string;
    public recipeIndex: number;
    public changedFactory: boolean;
    public factoriesValue: Rational;
    public rateValue: Rational;
    public element: HTMLLIElement;
    public factoryLabel: HTMLLabelElement;
    public recipeSelector: HTMLSpanElement;
    public factories: HTMLInputElement;
    public rateLabel: HTMLLabelElement;
    public rate: HTMLInputElement;
    constructor(index: number, itemName?: string) {
        if (!itemName) {
            itemName = DEFAULT_ITEM;
        }
        this.index = index;
        this.itemName = itemName;
        this.recipeIndex = 0;
        this.changedFactory = true;
        this.factoriesValue = one;
        this.rateValue = zero;
        this.element = document.createElement("li");
        this.element.classList.add("target");

        const remover = document.createElement("button");
        remover.classList.add("targetButton");
        remover.classList.add("ui");
        $(remover).click(RemoveHandler(this));
        remover.textContent = "x";
        remover.title = "Remove this item.";
        this.element.appendChild(remover);

        const dropdown = makeDropdown(
            d3.select(this.element),
            (d) => (d.select(".search").node() as HTMLElement).focus(),
            (d) => resetSearch(d.node()),
        );
        dropdown.classed("itemDropdown", true);
        dropdown.append("input")
            .classed("search", true)
            .attr("placeholder", "Search")
            .on("keyup", searchTargets);
        const group = dropdown.selectAll("div")
            .data(itemGroups)
            .join("div");
        group.filter((d, i) => i > 0)
            .append("hr");
        const items = group.selectAll("div")
            .data((d) => d)
            .join("div")
            .selectAll("span")
            .data((d) => d)
            .join("span");
        const labels = addInputs(
            items,
            "target-" + targetCount,
            (d) => d.name === this.itemName,
            ItemHandler(this),
        );
        labels.append((d) => getImage(d, false, dropdown.node()));

        // Use a single global target count, as a given target's index can change.
        targetCount++;

        this.factoryLabel = document.createElement("label");
        this.factoryLabel.classList.add(SELECTED_INPUT);
        // TODO: htmlFor
        this.factoryLabel.textContent = " Factories: ";
        this.element.appendChild(this.factoryLabel);

        this.recipeSelector = document.createElement("span");
        this.element.appendChild(this.recipeSelector);

        this.factories = document.createElement("input");
        $(this.factories).change(FactoryHandler(this));
        this.factories.type = "text";
        this.factories.value = String(1);
        this.factories.size = 3;
        this.factories.title = "Enter a value to specify number of factories. The rate will be determined based on " +
            "the number of items a factory can make.";
        this.element.appendChild(this.factories);

        this.rateLabel = document.createElement("label");
        this.setRateLabel();
        this.element.appendChild(this.rateLabel);

        this.rate = document.createElement("input");
        $(this.rate).change(RateHandler(this));
        this.rate.type = "text";
        this.rate.value = "";
        this.rate.size = 5;
        this.rate.title = "Enter a value to specify the rate. The number of factories will be determined based on " +
            "the rate.";
        this.element.appendChild(this.rate);
        this.displayRecipes();
    }

    public setRateLabel() {
        this.rateLabel.textContent = " Items/" + SettingsState.longRateNames[SettingsState.rateName] + ": ";
    }

    public displayRecipes() {
        while (this.recipeSelector.hasChildNodes()) {
            this.recipeSelector.removeChild(this.recipeSelector.lastChild);
        }
        const item = solver.items[this.itemName];
        if (item.recipes.length <= 1) {
            return;
        }
        const self = this;
        const dropdown = makeDropdown(d3.select(this.recipeSelector));
        const inputs = dropdown.selectAll("div").data(item.recipes).join("div");
        const labels = addInputs(
            inputs,
            "target-recipe-" + recipeSelectorCount,
            (_, i) => self.recipeIndex === i,
            (_, i) => RecipeSelectorHandler(self, i),
        );
        labels.append((d) => getImage(d, false, dropdown.node()));
        recipeSelectorCount++;
        this.recipeSelector.appendChild(new Text(" \u00d7 "));
    }

    // Returns the rate at which this item is being requested. Also updates
    // the text boxes in response to changes in options.
    public getRate() {
        this.setRateLabel();
        const item = solver.items[this.itemName];
        let rate = zero;
        // XXX: Hmmm...
        const recipe = item.recipes[this.recipeIndex];
        if (!recipe.category && this.changedFactory) {
            this.rateChanged();
        }
        let baseRate = spec.recipeRate(recipe);
        if (baseRate) {
            baseRate = baseRate.mul(recipe.gives(item, spec));
        }
        if (this.changedFactory) {
            rate = baseRate.mul(this.factoriesValue);
            this.rate.value = displayRate(rate);
        } else {
            rate = this.rateValue;
            if (baseRate) {
                const factories = rate.div(baseRate);
                this.factories.value = displayCount(factories);
            } else {
                this.factories.value = "N/A";
            }
            this.rate.value = displayRate(rate);
        }
        return rate;
    }

    public factoriesChanged() {
        this.changedFactory = true;
        this.factoryLabel.classList.add(SELECTED_INPUT);
        this.rateLabel.classList.remove(SELECTED_INPUT);
        this.factoriesValue = RationalFromString(this.factories.value);
        this.rateValue = zero;
        this.rate.value = "";
    }

    public setFactories(index: number, factories: string) {
        this.recipeIndex = index;
        this.factories.value = factories;
        this.factoriesChanged();
    }

    public rateChanged() {
        this.changedFactory = false;
        this.factoryLabel.classList.remove(SELECTED_INPUT);
        this.rateLabel.classList.add(SELECTED_INPUT);
        this.factoriesValue = zero;
        this.rateValue = RationalFromString(this.rate.value).div(SettingsState.displayRateFactor);
        this.factories.value = "";
    }

    public setRate(rate: string) {
        this.rate.value = rate;
        this.rateChanged();
    }
}

export {
    addTarget,
    isFactoryTarget,
    BuildTarget,
};
