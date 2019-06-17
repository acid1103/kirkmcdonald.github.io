import { IObjectMap } from "./utility-types";

class ColorScheme {
    public displayName: string;
    public name: string;
    public scheme: IObjectMap<string>;

    constructor(displayName: string, name: string, scheme: IObjectMap<string>) {
        this.displayName = displayName;
        this.name = name;
        this.scheme = scheme;
    }

    public apply() {
        const html = document.documentElement;
        for (const name of Object.keys(this.scheme)) {
            const value = this.scheme[name];
            html.style.setProperty(name, value);
        }
    }
}

const colorSchemes = [
    new ColorScheme(
        "Default",
        "default",
        {
            "--accent": "#ff7200",
            "--bright": "#f1fff2",
            "--dark": "#171717",
            "--dark-overlay": "rgba(23, 23, 23, 0.8)",
            "--foreground": "#c8c8c8",
            "--light": "#3a3f44",
            "--main": "#272b30",
            "--medium": "#212427",
        },
    ),
    new ColorScheme(
        "Printer-friendly",
        "printer",
        {
            "--accent": "#222222",
            "--bright": "#111111",
            "--dark": "#f0f0f0",
            "--dark-overlay": "#ffffff",
            "--foreground": "#000000",
            "--light": "#dddddd",
            "--main": "#ffffff",
            "--medium": "#ffffff",
        },
    ),
];

export {
    ColorScheme,
    colorSchemes,
};
