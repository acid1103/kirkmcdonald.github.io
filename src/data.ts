import { IObjectMap } from "./utility-types";

export class Data {
    public accumulator: IObjectMap<IAccumulator>;
    public "assembling-machine": IObjectMap<IAssemblingMachine>;
    public boiler: IObjectMap<IBoiler>;
    public fluids: string[];
    public fuel: string[];
    public furnace: IObjectMap<IFurnace>;
    public generator: IObjectMap<IGenerator>;
    public groups: IObjectMap<IGroups>;
    public items: IObjectMap<IItems>;
    public "mining-drill": IObjectMap<IMiningDrill>;
    public modules: string[];
    public "offshore-pump": IObjectMap<IOffshorePump>;
    public reactor: IObjectMap<IReactor>;
    public recipes: IObjectMap<IRecipes>;
    public resource: IObjectMap<IResource>;
    public "rocket-silo": IObjectMap<IRocketSilo>;
    public "solar-panel": IObjectMap<ISolarPanel>;
    public sprites: ISprites;
    public "transport-belt": IObjectMap<ITransportBelt>;
}

interface IAccumulator extends INamed, IIconned {
    energy_source: {
        buffer_capacity: string,
        input_flow_limit: string,
        output_flow_limit: string,
        type: string,
        usage_priority: string,
    };
}

interface IAssemblingMachine extends INamed, IIconned {
    allowed_effects?: string[];
    crafting_categories: string[];
    crafting_speed: number;
    energy_usage: number;
    ingredient_count?: number;
    module_slots: number;
}

interface IBoiler extends INamed, IIconned {
    energy_consumption: string;
    energy_source: IHeatExchangerEnergySource | IChemicalEnergySource;
}

interface IHeatExchangerEnergySource {
    connections: Array<{
        direction: number,
        position: number[],
    }>;
    max_temperature: number;
    max_transfer: string;
    min_working_temperature?: number;
    pipe_covers: {
        east: IHeatExchangerPipeCover,
        north: IHeatExchangerPipeCover,
        south: IHeatExchangerPipeCover,
        west: IHeatExchangerPipeCover,
    };
    specific_heat?: string;
    type: string;
}

interface IHeatExchangerPipeCover {
    filename: string;
    frame_count: number;
    height: number;
    hr_version: {
        filename: string,
        frame_count: number,
        height: number,
        line_length: number,
        priority: string,
        scale: number,
        width: number,
        x: number,
    };
    line_length: number;
    priority: string;
    scale: number;
    width: number;
    x: number;
}

interface IFurnace extends INamed, IIconned {
    allowed_effects?: string[];
    crafting_categories: string[];
    crafting_speed: number;
    energy_source: IElectricEnergySource | IChemicalEnergySource;
    energy_usage: number;
    module_slots: number;
}

interface IGenerator extends INamed, IIconned {
    effectivity: number;
    fluid_usage_per_tick: number;
}

interface IGroups {
    order: string;
    subgroups: IObjectMap<string>;
}

interface IItems extends INamed, IIconned {
    group: string;
    order: string;
    stack_size?: number;
    subgroup: string;
    type: string;
    fuel_category?: string;
    fuel_value?: number;
    category?: string;
    effect?: {
        consumption?: {
            bonus: number,
        },
        pollution?: {
            bonus: number,
        },
        productivity?: {
            bonus: number,
        },
        speed?: {
            bonus: number,
        },
    };
    limitation?: string[];
}

interface IMiningDrill extends INamed, IIconned {
    energy_source: IElectricEnergySource | IChemicalEnergySource;
    energy_usage: number;
    mining_power?: number;
    mining_speed: number;
    module_slots: number;
    resource_categories: string[];
}

interface IElectricEnergySource {
    emissions: number;
    type: string;
    usage_priority: string;
}

interface IChemicalEnergySource {
    effectivity: number;
    emissions: number;
    fuel_category: string;
    fuel_inventory_size: number;
    smoke: ISmoke[];
    type: string;
}

interface ISmoke {
    east_position?: number[];
    frequency: number;
    name: string;
    north_position?: number[];
    south_position?: number[];
    starting_frame_deviation?: number;
    starting_vertical_speed?: number;
    west_position?: number[];
    position?: number[];
    deviation?: number[];
}

interface IOffshorePump extends INamed, IIconned {
    fluid: string;
    pumping_speed: number;
}

interface IReactor extends INamed, IIconned {
    burner?: {
        burnt_inventory_size: number,
        effectivity: number,
        fuel_category: string,
        fuel_inventory_size: number,
    };
    consumption: string;
}

interface IRecipes extends INamed, IIconned {
    [1]?: IColorData;
    category: string;
    enabled?: boolean;
    energy_required: number;
    ingredients: ISimpleItem[];
    order: string;
    results: ISimpleItem[];
    subgroup: string;
    type: string;
    icon_size?: number;
    crafting_machine_tint?: IColorData;
    requester_paste_multiplier?: number;
    allow_decomposition?: boolean;
    main_product?: string;
    hidden?: boolean;
    display_name?: string;
    localised_name?: string[];
    emissions_multiplier?: number;
}

interface IColorData {
    primary: IRGBA;
    secondary: IRGBA;
    tertiary: IRGBA;
}

interface IRGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

interface IResource extends INamed, IIconned {
    category?: string;
    minable: {
        fluid_amount?: number;
        hardness?: number;
        mining_particle?: string;
        mining_time: number;
        required_fluid?: string;
        results: ISimpleItem[];
    };
}

interface ISimpleItem {
    amount?: number;
    amount_max?: number;
    amount_min?: number;
    name?: string;
    probability?: number;
    type?: string;
    [0]?: string;
    [1]?: number;
}

interface IRocketSilo extends INamed, IIconned {
    active_energy_usage: string;
    allowed_effects: string[];
    crafting_categories: string[];
    crafting_speed: number;
    energy_usage: number;
    idle_energy_usage: string;
    lamp_energy_usage: string;
    module_slots: number;
    rocket_parts_required: number;
}

interface ISolarPanel extends INamed, IIconned {
    production: string;
}

interface ISprites {
    extra: IObjectMap<{
        icon_col: number,
        icon_row: number,
        name: string,
    }>;
    hash: string;
}

interface ITransportBelt extends INamed, IIconned {
    speed: number;
}

interface INamed {
    localized_name: IObjectMap<string>;
    name: string;
}

interface IIconned {
    icon_col: number;
    icon_row: number;
}

export {
    INamed,
    IIconned,
    IAccumulator,
    IAssemblingMachine,
    IBoiler,
    IHeatExchangerEnergySource,
    IHeatExchangerPipeCover,
    IFurnace,
    IGenerator,
    IGroups,
    IItems,
    IMiningDrill,
    IElectricEnergySource,
    IChemicalEnergySource,
    ISmoke,
    IOffshorePump,
    IReactor,
    IRecipes,
    IResource,
    ISimpleItem,
    IRocketSilo,
    ISolarPanel,
    ISprites,
    ITransportBelt,
};
