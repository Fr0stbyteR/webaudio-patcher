import Base from "./Base.js"
export default class AutoImporter {
    static importer(pkgName, pkg, depth, out, pathIn, fromProto) {
        if (depth <= 0) return out;
        if (depth === undefined) depth = 1;
        if (!out) out = {};
        for (const key in pkg) {
            if (!pkg.hasOwnProperty(key)) continue;
            try {
                const el = pkg[key];
                const path = pathIn ? pathIn + "." + key : key;
                if (typeof el === "object" && !Array.isArray(el)) {
                    AutoImporter.importer(pkgName, el, depth - 1, out, path);
                } else {
                    out[path] = AutoImporter.generator(el, pkgName, key, fromProto);
                    if (el.hasOwnProperty("prototype")) AutoImporter.importer(pkgName, el.prototype, depth - 1, out, path, true);
                }
                continue;
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
                    this._inlets = (fromProto ? 1 : 0) + (el.length == 0 ? 1 : el.length);
                    this._outlets = (fromProto ? 1 : 0) + 2;
                    this._mem.name = name;
                    this._mem.fn = el;
                    this._mem.instance = null;
                    this._mem.inputs = box.args.slice();
                    this._mem.result = null;
                    this._mem.fromProto = fromProto ? true : false;
                    this.update(this._mem.inputs, box.props);
                }
                update(args, props) {
                    if (props && props.hasOwnProperty("inlets") && typeof props.inlets === "number") {
                        this._inlets = (this._mem.fromProto ? 1 : 0) + props.inlets;
                    }
                    if (!args) return this;
                    this._mem.inputs = args;
                    if (!this._mem.fromProto) this.execute();
                    return this;
                }
                fn(data, inlet) {
                    if (inlet == 0 && data instanceof Base.Bang) {
                        this.output();
                        return this;
                    }
                    if (this._mem.fromProto) {
                        if (inlet == 0) this._mem.instance = data;
                        else this._mem.inputs[inlet - 1] = data;
                    } else this._mem.inputs[inlet] = data;
                    if (inlet == 0) {
                        if (this.execute()) this.output();
                    }
                    return this;
                }
                output() {
                    let callback = () => {
                        if (this._mem.fromProto) this.outlet(2, this._mem.inputs.slice(1)).outlet(1, this._mem.result).outlet(0, this._mem.inputs[0]);
                        else this.outlet(1, this._mem.inputs).outlet(0, this._mem.result);
                    }
                    if (this._mem.result instanceof Promise) {
                        this._mem.result.then(r => {
                            this._mem.result = r;
                            callback();
                        });
                    } else {
                        callback();
                    }
                }
                execute() {
                    try {
                        if (this._mem.fromProto) {
                            if (this._mem.instance) this._mem.result = this._mem.instance[this._mem.name](...this._mem.inputs);
                            else return false;
                        } else try {
                            this._mem.result = new this._mem.fn(...this._mem.inputs);
                        } catch (e) {
                            this._mem.result = this._mem.fn(...this._mem.inputs);
                        }
                        if (this._mem.result instanceof Promise) {
                            this._mem.result.then(r => this._mem.result = r);
                        }
                        return true;
                    } catch (e) {
                        this.error(e);
                        return false;
                    }
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
                constructor(box, patcher) {
                    super(box, patcher);
                    this._inlets = 1;
                    this._outlets = 1;
                }
                fn(data, inlet) {
                    this.outlet(0, el);
                    return this;
                }
            }
        }
    }
}