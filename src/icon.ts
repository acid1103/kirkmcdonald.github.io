import { Data } from "./data";
import { State as SettingsState } from "./settings";
import { Tooltip } from "./tooltip";
import { IObjectMap } from "./utility-types";

interface IIconned {
    name: string;
    iconCol: number;
    iconRow: number;
    renderTooltip: (extra?: HTMLSpanElement) => HTMLDivElement;
}

const PX_WIDTH = 32;
const PX_HEIGHT = 32;

let sheetHash: string;

class Sprite implements IIconned {
    public name: string;
    public iconCol: number;
    public iconRow: number;
    public renderTooltip: (extra?: HTMLSpanElement) => HTMLDivElement;

    constructor(name: string, col: number, row: number) {
        this.name = name;
        this.iconCol = col;
        this.iconRow = row;
    }
}

function getImage(obj: IIconned, suppressTooltip?: boolean, tooltipTarget?: HTMLElement) {
    const im = blankImage();
    im.classList.add("icon");
    const x = -obj.iconCol * PX_WIDTH;
    const y = -obj.iconRow * PX_HEIGHT;
    im.style.setProperty("background", "url(images/sprite-sheet-" + sheetHash + ".png)");
    im.style.setProperty("background-position", x + "px " + y + "px");
    if (SettingsState.tooltipsEnabled && obj.renderTooltip && !suppressTooltip) {
        addTooltip(im, obj, tooltipTarget);
    } else {
        im.title = obj.name;
    }
    im.alt = obj.name;
    return im;
}

function addTooltip(im: HTMLImageElement, obj: IIconned, target: HTMLElement) {
    const node = obj.renderTooltip();
    return new Tooltip(im, node, target);
}

function blankImage() {
    const im = document.createElement("img");
    // Chrome wants the <img> element to have a src attribute, or it will
    // draw a border around it. Cram in this transparent 1x1 pixel image.
    im.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    return im;
}

let sprites: IObjectMap<Sprite>;

function getExtraImage(name: string) {
    return getImage(sprites[name]);
}

function getSprites(data: Data) {
    sheetHash = data.sprites.hash;
    sprites = {};
    for (const name of Object.keys(data.sprites.extra)) {
        const d = data.sprites.extra[name];
        sprites[name] = new Sprite(d.name, d.icon_col, d.icon_row);
    }
}

export {
    IIconned,
    PX_WIDTH,
    PX_HEIGHT,
    sheetHash as sheet_hash,
    getImage,
    getExtraImage,
    getSprites,
};
