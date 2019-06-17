import * as Popper from "popper.js";

export class Tooltip {
    public reference: HTMLImageElement;
    public content: HTMLDivElement;
    public target: HTMLElement;
    public isOpen: boolean;
    public node: HTMLDivElement;
    public popper: Popper.default;
    constructor(reference: HTMLImageElement, content: HTMLDivElement, target: HTMLElement) {
        if (!target) {
            target = reference;
        }
        this.reference = reference;
        this.content = content;
        this.target = target;
        this.isOpen = false;
        this.node = null;
        this.popper = null;
        this.addEventListeners();
    }

    public show() {
        if (this.isOpen) {
            return;
        }
        this.isOpen = true;
        if (this.node) {
            this.node.style.display = "";
            this.popper.update();
            return;
        }
        const node = this.create();
        document.body.appendChild(node);
        // bad typing defs...
        this.popper = new (Popper as any)(
            this.target,
            node,
            {
                modifiers: {
                    offset: {
                        offset: "0, 20",
                    },
                    preventOverflow: {
                        boundariesElement: "window",
                    },
                },
                placement: "right",
            },
        );
        this.node = node;
    }

    public hide() {
        if (!this.isOpen) {
            return;
        }
        this.isOpen = false;
        this.node.style.display = "none";
    }

    public create() {
        const node = document.createElement("div");
        node.classList.add("tooltip");
        node.appendChild(this.content);
        return node;
    }

    public addEventListeners() {
        const self = this;
        this.reference.addEventListener("mouseenter", () => self.show());
        this.reference.addEventListener("mouseleave", () => self.hide());
    }
}
