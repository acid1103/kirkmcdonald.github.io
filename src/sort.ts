import { IObjectMap } from "./utility-types";

function sorted<T>(collection: IObjectMap<T>, key?: (k: string) => string): string[];
function sorted<T>(collection: T[], key: (k: T) => string): T[];
function sorted<T extends any[] | IObjectMap<any>>(
    collection: T,
    key?: A<T>,
): B<T> {
    // if collection is an array, collectionArray will be an array of the same type.
    // otherwise, if collection is an IObjectMap, collectionArray will be a string[].
    let collectionArray: B<T>;
    if (!Array.isArray(collection)) {
        collectionArray = Object.keys(collection) as B<T>;
    } else {
        collectionArray = collection as B<T>;
    }
    const indexes: number[] = [];
    let keyvals: string[] = [];
    for (let i = 0; i < collectionArray.length; i++) {
        indexes.push(i);
        if (key) {
            keyvals.push(key(collectionArray[i]));
        }
    }
    if (!key) {
        // since key isn't optional when T = IObjectMap<any>, this check ensures collectionArray will be a string[]. For
        // that reason, we can safely assume that keyvals will be a string[].
        keyvals = collectionArray;
    }
    indexes.sort((a, b) => {
        const x = keyvals[a];
        const y = keyvals[b];
        if (x < y) {
            return -1;
        } else if (x > y) {
            return 1;
        }
        return 0;
    });
    const result: any[] = [];
    for (const index of indexes) {
        result.push(collectionArray[index]);
    }
    return result as B<T>;
}

type A<T> = T extends Array<infer Z> ? (k: Z) => string : (k: string) => string;
type B<T> = T extends any[] ? T : string[];

export { sorted };
