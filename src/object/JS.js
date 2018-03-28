import Base from "./Base.js";
import "./JS.css"

class JSBaseObject extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.packageClass = "package-js";
        this.inlets = 3;
        this.outlets = 2;
    }
    _fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this.data);
            return;
        }
        if (inlet <= 1) this._convert(data);
        if (inlet == 0) this.outlet(0, this.data);
        if (inlet == 2) { // call function on data as first arg
            try {
                if (typeof data == "function") this.outlet(1, data(this.data));
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
            this.data = data == true;
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
            this.data = +data;
        } catch (e) {
            try {
                this.data = parseFloat(data);
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
        if (typeof data == "string") this.data = data;
        else {
            try {
                this.data = JSON.stringify(data);
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
        if (Array.isArray(data)) this.data = data;
        else {
            try {
                let parsed = JSON.parse(data);
                if (Array.isArray(parsed)) this.data = parsed;
                else this.data = [data];
            } catch (e) {
                this.data = [data];
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
        if (typeof data == "object") this.data = data;
        else {
            try {
                this.data = JSON.parse(data);
            } catch (e) {
                this.error("object", e);
            }
        }
    }
}

class JSFunction extends JSBaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.inlets = 2;
        this.outlets = 1;
        this.update(box.args);
    }
    _fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this.data);
            return;
        }
        if (inlet <= 1) this._convert(data);
        if (inlet == 0) this.outlet(0, this.data);
    }
    update(args, props) {
        if (args.length == 0) return this;
        this._convert(args);
        return this;
    }
    _convert(data) {
        if (typeof data == "function") this.data = data;
        else {
            try {
                this.data = new Function(data[0], data[1]);
            } catch (e) {
                try {
                    this.data = new Function(JSON.parse(data[0]), data[1]);
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
        this.data.fn = () => {};
        this.data.args = [];
        this.data.result;
        this.update(box.args);
    }
    _fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this.data.fn(...this.data.args));
            return;
        }
        if (inlet <= 1) {
            if (!Array.isArray(data)) data = [data];
            this.data.args = data;
        }
        if (inlet == 2) {
            this._convertToFn(data);
        }
        if (inlet == 0) this.outlet(0, this.data.fn(...this.data.args));
    }
    update(args, props) {
        if (args.length == 0) return this;
        try {
            if (args.length == 1) this._convertToFn(args[0]);
            else {
                try {
                    this.data.args = JSON.parse(args[0]);
                } catch (e) {
                    this.data.args = [args[0]];
                }
                this._convertToFn(args[1]);
            }
            if (typeof this.data.fn != "function") throw this.data.fn + "not a function";
        } catch (e) {
            this.error("function", e);
        }
        return this;
    }
    _convertToFn(data) {
        if (typeof data == "function") this.data.fn = data;
        if (typeof data == "string") {
            let ctx = window;
            let namespaces = data.split(".");
            let fn = namespaces.pop();
            for(var i = 0; i < namespaces.length; i++) {
                ctx = ctx[namespaces[i]];
            }
            this.data.fn = ctx[fn];
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