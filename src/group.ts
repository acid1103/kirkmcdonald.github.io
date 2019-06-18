import { Data } from "./data";
import { Item } from "./item";
import { sorted } from "./sort";
import { IObjectMap } from "./utility-types";

export function getItemGroups(items: IObjectMap<Item>, data: Data) {
    const itemGroupMap: IObjectMap<IObjectMap<Item[]>> = {};
    for (const itemName of Object.keys(items)) {
        const item = items[itemName];
        let group = itemGroupMap[item.group];
        if (!group) {
            group = {};
            itemGroupMap[item.group] = group;
        }
        let subgroup = group[item.subgroup];
        if (!subgroup) {
            subgroup = [];
            group[item.subgroup] = subgroup;
        }
        subgroup.push(item);
    }
    const itemGroups: Item[][][] = [];
    const groupNames = sorted(itemGroupMap, (k) => data.groups[k].order);
    for (const groupName of groupNames) {
        const subgroupNames = sorted(itemGroupMap[groupName], (k) => data.groups[groupName].subgroups[k]);
        const group: Item[][] = [];
        itemGroups.push(group);
        for (const subgroupName of subgroupNames) {
            const subgroupItems = itemGroupMap[groupName][subgroupName];
            const subgroupItemsStr = sorted(subgroupItems, (item) => item.order);
            group.push(subgroupItemsStr);
        }
    }
    return itemGroups;
}
