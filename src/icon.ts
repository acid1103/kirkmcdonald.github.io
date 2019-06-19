import { Data } from "./data";
import { State as SettingsState } from "./settings";
import { Tooltip } from "./tooltip";
import { IObjectMap } from "./utility-types";

interface IIconned {
    name: string;
    icon_col: number;
    icon_row: number;
    renderTooltip: (extra?: HTMLSpanElement) => HTMLDivElement;
}

const PX_WIDTH = 32;
const PX_HEIGHT = 32;

let sheet_hash: string;

class Sprite implements IIconned {
    public name: string;
    public icon_col: number;
    public icon_row: number;
    public renderTooltip: (extra?: HTMLSpanElement) => HTMLDivElement;

    constructor(name: string, col: number, row: number) {
        this.name = name;
        this.icon_col = col;
        this.icon_row = row;
    }
}

function getImage(obj: IIconned, suppressTooltip?: boolean, tooltipTarget?: HTMLElement) {
    const im = blankImage();
    im.classList.add("icon");
    const x = -obj.icon_col * PX_WIDTH;
    const y = -obj.icon_row * PX_HEIGHT;
    im.style.setProperty("background", "url(images/sprite-sheet-" + sheet_hash + ".png)");
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
    im.src = "images/pixel.gif";
    return im;
}

let sprites: IObjectMap<Sprite>;

function getExtraImage(name: string) {
    return getImage(sprites[name]);
}

function getSprites(data: Data) {
    sheet_hash = data.sprites.hash;
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
    sheet_hash,
    getImage,
    getExtraImage,
    getSprites,
};
