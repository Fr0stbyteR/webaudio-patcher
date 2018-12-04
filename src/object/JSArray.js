import AutoImporter from "./AutoImporter.js";
let JSArrayProto = {
    concat : Array.prototype.concat,
    copyWithin : Array.prototype.copyWithin,
    entries : Array.prototype.entries,
    every : Array.prototype.every,
    fill : Array.prototype.fill,
    filter : Array.prototype.filter,
    find : Array.prototype.find,
    findIndex : Array.prototype.findIndex,
    flat : Array.prototype.flat,
    flatMap : Array.prototype.flatMap,
    forEach : Array.prototype.forEach,
    includes : Array.prototype.includes,
    indexOf : Array.prototype.indexOf,
    join : Array.prototype.join,
    keys : Array.prototype.keys,
    lastIndexOf : Array.prototype.lastIndexOf,
    length : Array.prototype.length,
    map : Array.prototype.map,
    pop : Array.prototype.pop,
    push : Array.prototype.push,
    reduce : Array.prototype.reduce,
    reduceRight : Array.prototype.reduceRight,
    reverse : Array.prototype.reverse,
    shift : Array.prototype.shift,
    slice : Array.prototype.slice,
    some : Array.prototype.some,
    sort : Array.prototype.sort,
    splice : Array.prototype.splice,
    toLocaleString : Array.prototype.toLocaleString,
    toString : Array.prototype.toString,
    unshift : Array.prototype.unshift,
    values : Array.prototype.values
}

export default Object.assign(
        AutoImporter.importer("Array", JSArrayProto, 1, undefined, undefined, true), 
        { Array : AutoImporter.generator(Array, "Array", "Array", false) }
    );