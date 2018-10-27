import Base from "./Base.js"
export default class AutoImporter {
    static importer(pkgName, pkg, depth, out, pathIn, fromProto) {
        if (depth === 0) return out;
        if (depth === undefined) depth = 1;
        if (!out) out = {};
        for (const key in pkg) {
            if (!pkg.hasOwnProperty(key)) continue;
            try {
                const el = pkg[key];
                const path = pathIn ? pathIn + "." + key : key;
                if (typeof el === "object") {
                    AutoImporter.importer(pkgName, el, depth - 1, out, path);
                } else if (typeof el === "function") {
                    out[path] = AutoImporter.generator(el, pkgName, key, fromProto);
                    if (el.hasOwnProperty("prototype")) AutoImporter.importer(pkgName, el.prototype, depth - 1, out, path, true);
                } else continue;
            } catch (e) {
                continue;
            }
        }
        return out;
    }

    static generator(el, pkgName, name, fromProto) {
        if (typeof el === "function") {
            return class extends Base.BaseObject {
                static get _meta() {
                    return Object.assign(super._meta, {
                        package : pkgName,
                        name : name,
                        description : fromProto ? "auto-imported OOP method" : "auto-imported static function",
                        inlets : fromProto ? [{
                            isHot : true,
                            type : "anything",
                            description : fromProto ? "instance of this prototype" : "function argument"
                        }, {
                            isHot : false,
                            type : "anything",
                            description : "method argument"
                        }] : [{
                            isHot : true,
                            type : "anything",
                            description : "method argument"
                        }, {
                            isHot : false,
                            type : "anything",
                            description : "method argument"
                        }],
                        outlets : fromProto ? [{
                            type : "anything",
                            description : "instance with method called"
                        }, {
                            type : "anything",
                            description : "return value of method called"
                        },{
                            type : "anything",
                            description : "arguments with method called as list"
                        }] : [{
                            type : "anything",
                            description : "return value of method called"
                        },{
                            type : "anything",
                            description : "arguments with method called as list"
                        }]
                    });
                }
                constructor(box, patcher) {
                    super(box, patcher);
                    this._inlets = (fromProto ? 1 : 0) + el.length;
                    this._outlets = (fromProto ? 1 : 0) + 2;
                    this._mem.name = name;
                    this._mem.fn = el;
                    this._mem.inputs = box.args.slice();
                    this._mem.result = null;
                    this._mem.fromProto = fromProto ? true : false;
                    if (!this._mem.fromProto) this.update(this._mem.inputs, box.props);
                }
                update(args, props) {
                    if (this._mem.fromProto && !args.length) return this;
                    if (props && props.hasOwnProperty("inlets") && typeof props.inlets === "number") {
                        this._inlets = (this._mem.fromProto ? 1 : 0) + props.inlets;
                    }
                    if (!args) return this;
                    try {
                        if (this._mem.fromProto) {
                            this._mem.result = args[0][this._mem.name](...args.slice(1));
                        } else try {
                            this._mem.result = new this._mem.fn(...args);
                        } catch (e) {
                            this._mem.result = this._mem.fn(...args);
                        }
                    } catch (e) {
                        this.error(this._mem.name, e);
                    }
                    if (this._mem.result instanceof Promise) {
                        this._mem.result.then(r => {
                            this._mem.result = r;
                            this.output();
                        });
                    } else {
                        this.output();
                    }
                    return this;
                }
                fn(data, inlet) {
                    if (inlet == 0 && data instanceof Base.Bang) {
                        this.output();
                        return this;
                    }
                    this._mem.inputs[inlet] = data;
                    if (inlet == 0) {
                        this.update(this._mem.inputs, null);
                    }
                    return this;
                }
                output() {
                    if (this._mem.fromProto) this.outlet(0, this._mem.inputs[0]).outlet(1, this._mem.result).outlet(2, this._mem.inputs.slice(1));
                    else this.outlet(0, this._mem.result).outlet(1, this._mem.inputs);
                }
            }
        } else {
            return class extends Base.BaseObject {
                static get _meta() {
                    return Object.assign(super._meta, {
                        package : pkgName,
                        name : name,
                        description : "auto-imported static value",
                        inlets : [{
                            isHot : true,
                            type : "anything",
                            description : "output value"
                        }],
                        outlets : [{
                            type : "anything",
                            description : "static value imported"
                        }]
                    });
                }
                fn(data, inlet) {
                    this.outlet(0, el);
                    return this;
                }
            }
        }
    }
}