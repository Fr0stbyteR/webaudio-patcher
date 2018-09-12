import Base from "./Base.js";
import "./JS.css"

class JSBaseObject extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._package = "js";
        this._inlets = 3;
        this._outlets = 2;
        this._mem.data = null;
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this._mem.data);
            return;
        }
        if (inlet <= 1) this._convert(data);
        if (inlet == 0) this.outlet(0, this._mem.data);
        if (inlet == 2) { // call function on data as first arg
            try {
                if (typeof data == "function") this.outlet(1, data(this._mem.data));
            } catch (e) {
                this.error("jsObject", e);
            }
        }
    }
    update(args, props) {
        if (args.length == 0) return this;
        this._convert(args[0]);
        return this;
    }
    _convert(data) {}
    ui($, box) {
        return super.ui($, box).addClass(["ui", "label"]);
    }
}

class JSBoolean extends JSBaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        try {
            this._mem.data = data == true;
        } catch (e) {
            this.error("boolean", e);
        }
    }
    update(args, props) {
        if (args.length == 0) return this;
        this._convert(args[0] == "true");
        return this;
    }
}

class JSNumber extends JSBaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        try {
            this._mem.data = +data;
        } catch (e) {
            try {
                this._mem.data = parseFloat(data);
            } catch (e) {
                this.error("number", e);
            }
        }
    }
}

class JSString extends JSBaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        if (typeof data == "string") this._mem.data = data;
        else {
            try {
                this._mem.data = JSON.stringify(data);
            } catch (e) {
                this.error("string", e);
            }
        }
    }
}
class JSArray extends JSBaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        if (Array.isArray(data)) this._mem.data = data;
        else {
            try {
                let parsed = JSON.parse(data);
                if (Array.isArray(parsed)) this._mem.data = parsed;
                else this._mem.data = [data];
            } catch (e) {
                this._mem.data = [data];
            }
        }
    }
}

class JSObject extends JSBaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        if (typeof data == "object") this._mem.data = data;
        else {
            try {
                this._mem.data = JSON.parse(data);
            } catch (e) {
                this.error("object", e);
            }
        }
    }
}

class JSFunction extends JSBaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this.update(box.args);
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this._mem.data);
            return;
        }
        if (inlet <= 1) this._convert(data);
        if (inlet == 0) this.outlet(0, this._mem.data);
    }
    update(args, props) {
        if (args.length == 0) return this;
        this._convert(args);
        return this;
    }
    _convert(data) {
        if (typeof data == "function") this._mem.data = data;
        else {
            try {
                this._mem.data = new Function(data[0], data[1]);
            } catch (e) {
                try {
                    this._mem.data = new Function(JSON.parse(data[0]), data[1]);
                } catch (e) {
                    this.error("function", e);
                }
            }
        }
    }
}
class JSCall extends JSBaseObject { //TODO Call with function name
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.fn = () => {};
        this._mem.args = [];
        this._mem.result;
        this.update(box.args);
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this._mem.fn(...this._mem.args));
            return;
        }
        if (inlet <= 1) {
            if (!Array.isArray(data)) data = [data];
            this._mem.args = data;
        }
        if (inlet == 2) {
            this._convertToFn(data);
        }
        if (inlet == 0) this.outlet(0, this._mem.fn(...this._mem.args));
    }
    update(args, props) {
        if (args.length == 0) return this;
        try {
            if (args.length == 1) this._convertToFn(args[0]);
            else {
                try {
                    this._mem.args = JSON.parse(args[0]);
                } catch (e) {
                    this._mem.args = [args[0]];
                }
                this._convertToFn(args[1]);
            }
            if (typeof this._mem.fn != "function") throw this._mem.fn + "not a function";
        } catch (e) {
            this.error("function", e);
        }
        return this;
    }
    _convertToFn(data) {
        if (typeof data == "function") this._mem.fn = data;
        if (typeof data == "string") {
            let ctx = window;
            let namespaces = data.split(".");
            let fn = namespaces.pop();
            for(var i = 0; i < namespaces.length; i++) {
                ctx = ctx[namespaces[i]];
            }
            this._mem.fn = ctx[fn];
        }
    }
}
//TODO expression
export default {
    JSBoolean,
    JSNumber,
    JSString,
    JSArray,
    JSObject,
    JSFunction,
    JSCall
}