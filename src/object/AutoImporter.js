import Base from "./Base.js"
export default class AutoImporter {
    static importer(pkg, depth, out, pathIn, fromProto) {
        if (depth === 0) return out;
        if (depth === undefined) depth = 1;
        if (!out) out = {};
        for (const key in pkg) {
            if (!pkg.hasOwnProperty(key)) continue;
            try {
                const el = pkg[key];
                const path = pathIn ? pathIn + "." + key : key;
                if (typeof el === "object") {
                    AutoImporter.importer(el, depth - 1, out, path);
                } else if (typeof el === "function") {
                    out[path] = AutoImporter.generator(el, key, fromProto);
                    if (el.hasOwnProperty("prototype")) AutoImporter.importer(el.prototype, depth - 1, out, path, true);
                } else continue;
            } catch (e) {
                continue;
            }
        }
        return out;
    }

    static generator(el, name, fromProto) {
        if (typeof el === "function") {
            return class extends Base.BaseObject {
                constructor(box, patcher) {
                    super(box, patcher);
                    this._inlets = (fromProto ? 1 : 0) + (box.props.hasOwnProperty("inlets") ? box.props.inlets : el.length);
                    this._outlets = (fromProto ? 1 : 0) + 2;
                    this._mem.name = name;
                    this._mem.fn = el;
                    this._mem.inputs = box.args.slice();
                    this._mem.result = null;
                    this._mem.fromProto = fromProto ? true : false;
                    if (!this._mem.fromProto) this.update(this._mem.inputs, null);
                }
                update(args, props) {
                    if (this._mem.fromProto && !args.length) return this;
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
                fn(data, inlet) {
                    this.outlet(0, el);
                    return this;
                }
            }
        }
    }
}