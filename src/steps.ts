import $ = require("jquery");
import { alignCount, alignRate, Header } from "./display";
import { PipeCountHandler, PipeLengthHandler } from "./events";
import { getImage } from "./icon";
import { solver } from "./init";
import { one, Rational, RationalFromFloat, RationalFromFloats, RationalFromString, zero } from "./rational";

// The name "steps" dates back to the earliest versions of this calculator and
// is now probably a misnomer. It originally referred to the "steps" you had
// to take to construct any given item. This purpose has been replaced with the
// visualization, leaving only the list of total item-rates, which has since
// been expanded to include the infrastructure needed to transport those
// item-rates.

// For pipe segment of the given length, returns maximum throughput as fluid/s.
function pipeThroughput(length: Rational) {
    if (length.equal(zero)) {
        // A length of zero represents a solid line of pumps.
        return RationalFromFloat(12000);
    } else if (length.less(RationalFromFloat(198))) {
        const numerator = RationalFromFloat(50).mul(length).add(RationalFromFloat(150));
        const denominator = RationalFromFloat(3).mul(length).sub(one);
        return numerator.div(denominator).mul(RationalFromFloat(60));
    } else {
        return RationalFromFloat(60 * 4000).div(RationalFromFloat(39).add(length));
    }
}

// Throughput at which pipe length equation changes.
const pipeThreshold = RationalFromFloats(4000, 236);

// For fluid throughput in fluid/s, returns maximum length of pipe that can
// support it.
function pipeLength(throughput: Rational) {
    throughput = throughput.div(RationalFromFloat(60));
    if (RationalFromFloat(200).less(throughput)) {
        return null;
    } else if (RationalFromFloat(100).less(throughput)) {
        return zero;
    } else if (pipeThreshold.less(throughput)) {
        const numerator = throughput.add(RationalFromFloat(150));
        const denominator = RationalFromFloat(3).mul(throughput).sub(RationalFromFloat(50));
        return numerator.div(denominator);
    } else {
        return RationalFromFloat(4000).div(throughput).sub(RationalFromFloat(39));
    }
}

// Arbitrarily use a default with a minimum length of 17.
function defaultPipe(rate: Rational) {
    const pipes = rate.div(RationalFromFloat(1200)).ceil();
    const perPipeRate = rate.div(pipes);
    const length = pipeLength(perPipeRate).ceil();
    return { pipes, length };
}

class PipeConfig {
    public rate: Rational;
    public minLanes: Rational;
    public element: HTMLTableDataCellElement;
    public laneInput: HTMLInputElement;
    public lengthInput: HTMLInputElement;
    constructor(rate: Rational) {
        this.rate = rate;
        const def = defaultPipe(rate);
        this.minLanes = rate.div(RationalFromFloat(12000)).ceil();
        this.element = document.createElement("td");
        const pipeItem = solver.items.pipe;
        this.element.appendChild(getImage(pipeItem));
        this.element.appendChild(new Text(" \u00d7 "));
        this.laneInput = document.createElement("input");
        $(this.laneInput).change(PipeCountHandler(this));
        this.laneInput.classList.add("pipe");
        this.laneInput.type = "number";
        this.laneInput.value = def.pipes.toDecimal(0);
        // this.laneInput.size = 4
        this.laneInput.min = this.minLanes.toDecimal(0);
        this.laneInput.title = "";
        this.element.appendChild(this.laneInput);
        this.element.appendChild(new Text(" @ "));
        this.lengthInput = document.createElement("input");
        $(this.lengthInput).change(PipeLengthHandler(this));
        this.lengthInput.classList.add("pipeLength");
        this.lengthInput.type = "number";
        this.lengthInput.value = def.length.toDecimal(0);
        // this.lengthInput.size = 5
        this.lengthInput.title = "";
        this.element.appendChild(this.lengthInput);
        this.element.appendChild(new Text(" max"));
    }

    public setPipes(pipeString: string) {
        let pipes = RationalFromString(pipeString);
        if (pipes.less(this.minLanes)) {
            pipes = this.minLanes;
            this.laneInput.value = pipes.toDecimal(0);
        }
        const perPipeRate = this.rate.div(pipes);
        const length = pipeLength(perPipeRate);
        this.lengthInput.value = length.toDecimal(0);
    }

    public setLength(lengthString: string) {
        const length = RationalFromString(lengthString);
        const perPipeRate = pipeThroughput(length);
        const pipes = this.rate.div(perPipeRate).ceil();
        this.laneInput.value = pipes.toDecimal(0);
    }
}

// never used?
// function displaySteps(items, order, totals) {
//     const stepTab = document.getElementById("steps_tab");

//     const oldSteps = document.getElementById("steps");
//     const node = document.createElement("table");
//     node.id = "steps";
//     stepTab.replaceChild(node, oldSteps);

//     const headers = [
//         Header("items/" + rateName, 2),
//         Header("belts and pipes", BELTS.length * 2),
//     ];
//     let header = document.createElement("tr");
//     for (let i = 0; i < headers.length; i++) {
//         const th = document.createElement("th");
//         th.textContent = headers[i].name;
//         th.colSpan = headers[i].colSpan;
//         if (i > 0) {
//             th.classList.add("pad");
//         }
//         header.appendChild(th);
//     }
//     node.appendChild(header);
//     for (const itemName of order) {
//         const item = solver.items[itemName];
//         let rate = items[itemName];
//         if (itemName in totals.waste) {
//             rate = rate.sub(totals.waste[itemName]);
//             if (rate.equal(zero)) {
//                 continue;
//             }
//         }
//         const row = document.createElement("tr");
//         node.appendChild(row);
//         const iconCell = document.createElement("td");
//         iconCell.appendChild(getImage(item));
//         row.appendChild(iconCell);
//         const rateCell = document.createElement("td");
//         rateCell.classList.add("right-align");
//         let tt = document.createElement("tt");
//         tt.textContent = alignRate(rate);
//         rateCell.append(tt);
//         row.appendChild(rateCell);

//         if (item.phase === "solid") {
//             for (const belt of BELTS) {
//                 const beltItem = solver.items[belt.name];
//                 const belts = rate.div(belt.speed);
//                 const beltCell = document.createElement("td");
//                 beltCell.classList.add("pad");
//                 beltCell.appendChild(getImage(beltItem));
//                 beltCell.appendChild(new Text(" \u00d7"));
//                 row.appendChild(beltCell);
//                 const beltRateCell = document.createElement("td");
//                 beltRateCell.classList.add("right-align");
//                 tt = document.createElement("tt");
//                 tt.textContent = alignCount(belts);
//                 beltRateCell.append(tt);
//                 row.appendChild(beltRateCell);
//             }
//         } else if (item.phase === "fluid") {
//             const pipe = new PipeConfig(rate);
//             const pipeCell = pipe.element;
//             pipeCell.colSpan = BELTS.length * 2;
//             row.appendChild(pipeCell);
//         }
//     }

//     const oldWaste = document.getElementById("waste");
//     const waste = document.createElement("div");
//     waste.id = "waste";
//     stepTab.replaceChild(waste, oldWaste);
//     const wasteNames = Object.keys(totals.waste);
//     if (wasteNames.length === 0) {
//         return;
//     }
//     const wasteTable = document.createElement("table");
//     waste.appendChild(wasteTable);
//     header = document.createElement("tr");
//     wasteTable.appendChild(header);
//     const th = document.createElement("th");
//     th.textContent = "wasted items/" + rateName;
//     th.colSpan = 2;
//     header.appendChild(th);
//     wasteNames.sort();
//     for (const itemName of wasteNames) {
//         const item = solver.items[itemName];
//         const rate = totals.waste[itemName];
//         const row = document.createElement("tr");
//         wasteTable.appendChild(row);
//         const iconCell = document.createElement("td");
//         iconCell.appendChild(getImage(item));
//         row.appendChild(iconCell);
//         const rateCell = document.createElement("td");
//         rateCell.classList.add("right-align");
//         const tt = document.createElement("tt");
//         tt.textContent = alignRate(rate);
//         rateCell.append(tt);
//         row.appendChild(rateCell);
//     }
// }

export {
    pipeThroughput,
    pipeThreshold,
    pipeLength,
    defaultPipe,
    PipeConfig,
    // displaySteps,
};
