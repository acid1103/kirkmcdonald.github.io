import { Data } from "./data";
import { useLegacyCalculations } from "./init";
import { Rational, RationalFromFloat } from "./rational";

export class Belt {
    public name: string;
    public speed: Rational;

    constructor(name: string, speed: Rational) {
        this.name = name;
        this.speed = speed;
    }
}

export function getBelts(data: Data) {
    const beltData = data["transport-belt"];
    const beltObjs = [];
    for (const beltName of Object.keys(beltData)) {
        const beltInfo = beltData[beltName];
        // Belt speed is given in tiles/tick, which we can convert to
        // items/second as follows:
        //       tiles      ticks              32 pixels/tile
        // speed ----- * 60 ------ * 2 lanes * --------------
        //       tick       second             9 pixels/item
        // 0.17 changes this formula from 9 pixels/item to 8 pixels/item.
        const baseSpeed = RationalFromFloat(beltInfo.speed);
        const pixelsPerSecond = baseSpeed.mul(RationalFromFloat(3840));
        let speed;
        if (useLegacyCalculations) {
            speed = pixelsPerSecond.div(RationalFromFloat(9));
        } else {
            speed = pixelsPerSecond.div(RationalFromFloat(8));
        }
        beltObjs.push(new Belt(beltName, speed));
    }
    beltObjs.sort((a, b) => {
        if (a.speed.less(b.speed)) {
            return -1;
        } else if (b.speed.less(a.speed)) {
            return 1;
        }
        return 0;
    });
    return beltObjs;
}
