import Base from "./Base.js";
import "./JS.css"

class JSBaseObject extends Base.BaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            package : "JS",
            icon : "node js", 
            author : "Fr0stbyteR",
            version : "1.0.0",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "convert data, store it and output, bang to output stored data"
            }, {
                isHot : false,
                type : "anything",
                description : "convert data, store it without output"
            }, {
                isHot : true,
                type : "function",
                description : "lambda call a incoming function with data stored, output at second outlet"
            }],
            outlets : [{
                type : "anything",
                description : "Output stored data"
            }, {
                type : "anything",
                description : "output returned value of lambda function called with third inlet"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
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
                this.error(e);
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
        let container = super.defaultUI($, box);
        container.find(".box-ui-default").removeClass("box-ui-default");
        container.find(".box-ui-text-container").addClass(["ui", "label"]);
        return container;
    }
}

class JSBoolean extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Convert anything to JS boolean",
            outlets : [{
                type : "boolean",
                description : "Output stored boolean"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        try {
            this._mem.data = data ? true : false;
        } catch (e) {
            this.error(e);
        }
    }
    update(args, props) {
        if (args.length == 0) return this;
        this._convert(args[0] == "true");
        return this;
    }
}

class JSNumber extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Convert anything to JS number",
            outlets : [{
                type : "number",
                description : "Output stored number"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        if (Base.Utils.toNumber(data) !== null) this._mem.data = data;
        else this.error("Cannot convert " + data + " as a Number");
    }
}

class JSString extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Convert anything to JS string",
            outlets : [{
                type : "string",
                description : "Output stored string"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        if (Base.Utils.toString(data) !== null) this._mem.data = data;
        else this.error("Cannot convert " + data + " as a String");
    }
}
class JSArray extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Convert anything to JS array",
            outlets : [{
                type : "object",
                description : "Output stored array"
            }]
        });
    }
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
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Store anything as JS Object",
            outlets : [{
                type : "object",
                description : "Output stored object"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this.update(box.args);
    }
    _convert(data) {
        this._mem.data = data;
    }
}

class JSFunction extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "build JS Function and call it",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "function or array with [args: string[], body: string] convert data, store it and output, bang to output stored data"
            }, {
                isHot : false,
                type : "anything",
                description : "function or array with [args: string[], body: string] convert data, store it without output"
            }],
            outlets : [{
                type : "function",
                description : "Output stored function"
            }]
        });
    }
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
                    this.error(e);
                }
            }
        }
    }
}
class JSCall extends JSBaseObject { //TODO Call with function name
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Call static JS Function by name",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "Call stored function with inlet as args then output"
            }, {
                isHot : false,
                type : "anything",
                description : "Call stored function with inlet as args without output"
            }, {
                isHot : false,
                type : "anything",
                description : "Input function or parse string as name to recognize function, store it"
            }],
            outlets : [{
                type : "function",
                description : "Output returned value"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._outlets = 1;
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
            this.error(e);
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

class Get extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Get Property of Object",
            inlets : [{
                isHot : true,
                type : "object",
                description : "The object for retriving property"
            }, {
                isHot : false,
                type : "object",
                description : "Array of property name or array index"
            }],
            outlets : [{
                type : "anything",
                description : "Output data of property"
            }],
            args : [{
                type : "anything",
                optional : true,
                default : 0,
                description : "Property name or array index"
            }, {
                type : "...",
                optional : true,
                description : "Child property name or array index"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this._mem.keys = [0];
        this._mem.result;
        this.update(box.args);
    }
    update(args, props) {
        this._mem.keys = [0];
        this._mem.result = undefined;
        if (args.length == 0) return this;
        this._mem.keys = args;
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this._mem.result);
            return this;
        }
        if (inlet == 1) {
            if (Array.isArray(data)) this._mem.keys = data;
            if (typeof data !== "object") this._mem.keys = [data];
        }
        if (inlet == 0) {
            this._mem.result = data;
            try {
                for (const key of this._mem.keys) {
                    this._mem.result = this._mem.result[key];
                }
                this.outlet(0, this._mem.result);
            } catch (e) {
                this.error(e);
            }
        }
        return this;
    }
}

class Set extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Set Property of Object",
            inlets : [{
                isHot : true,
                type : "object",
                description : "The object for retriving property"
            }, {
                isHot : false,
                type : "object",
                description : "Array of property name or array index"
            }, {
                isHot : false,
                type : "anything",
                description : "Value to set"
            }],
            outlets : [{
                type : "anything",
                description : "Output object"
            }],
            args : [{
                type : "anything",
                optional : true,
                default : 0,
                description : "Property name or array index"
            }, {
                type : "...",
                optional : true,
                description : "Child property name or array index"
            }, {
                type : "angthing",
                optional : true,
                default : undefined,
                description : "Value to set"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 3;
        this._outlets = 1;
        this._mem.keys = [0];
        this._mem.value;
        this._mem.result;
        this.update(box.args);
    }
    update(args, props) {
        this._mem.keys = [0];
        this._mem.value = undefined;
        this._mem.result = undefined;
        if (args.length == 0) return this;
        this._mem.value = args.pop();
        if (args.length == 0) return this;
        this._mem.keys = args;
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this._mem.result);
            return this;
        }
        if (inlet == 1) {
            if (Array.isArray(data)) this._mem.keys = data;
            if (typeof data !== "object") this._mem.keys = [data];
        }
        if (inlet == 2) {
            this._mem.value = data;
        }
        if (inlet == 0) {
            let curKey = data;
            try {
                for (let i = 0; i < this._mem.keys.length; i++) {
                    const key = this._mem.keys[i];
                    if (i == this._mem.keys.length - 1) {
                        curKey[key] = this._mem.value;
                        break;
                    }
                    if (!curKey.hasOwnProperty(key)) curKey[key] = {};
                    curKey = curKey[key];
                }
                this.outlet(0, data);
            } catch (e) {
                this.error(e);
            }
        }
        return this;
    }
}

class JSCallback extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Generate anonymous function, output args when called",
            inlets : [{
                isHot : true,
                type : "object",
                description : "Output anonymous function"
            }],
            outlets : [{
                type : "function",
                description : "Anonymous function"
            }, {
                type : "object",
                description : "Bang when called"
            }, {
                type : "anything",
                description : "argument when called"
            }],
            args : [{
                type : "number",
                optional : true,
                default : 0,
                description : "arguments count"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 2;
        this.update(box.args);
    }
    update(args, props) {
        if (typeof args[0] == "number") this._outlets = 2 + parseInt(args[0]);
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, (...args) => {
                for (let i = args.length - 1; i >= 0; i--) {
                    this.outlet(i + 2, args[i]);
                }
                this.outlet(1, new Base.Bang());
            });
            return this;
        }
    }
}

class For extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Output numbers for loop",
            inlets : [{
                isHot : true,
                type : "object",
                description : "Output index"
            }, {
                isHot : false,
                type : "number",
                description : "Maximum index"
            }],
            outlets : [{
                type : "object",
                description : "Bang when finished"
            }, {
                type : "number",
                description : "index"
            }],
            args : [{
                type : "number",
                optional : true,
                default : 0,
                description : "Maximum index"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 2;
        this._mem.max = 0;
        this.update(box.args);
    }
    update(args, props) {
        this._mem.max = 0;
        if (typeof args[0] == "number") this._mem.max = parseInt(args[0]);
    }
    fn(data, inlet) {
        if (inlet == 0) {
            for (let i = 0; i < this._mem.max; i++) {
                this.outlet(1, i);
            }
            this.outlet(0, new Base.Bang());
            return this;
        }
        if (inlet == 1) {
            if (typeof data == "number") this._mem.max = parseInt(data);
            return this;
        }
    }
}

class ForEach extends JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Output key and values for loop",
            inlets : [{
                isHot : true,
                type : "object",
                description : "Object to iterate"
            }],
            outlets : [{
                type : "object",
                description : "Bang when finished"
            }, {
                type : "object",
                description : "key"
            }, {
                type : "anything",
                description : "value"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 3;
        this.update(box.args);
    }
    fn(data, inlet) {
        if (inlet == 0) {
            if (typeof data !== "object") {
                this.error("Cannot iterate.")
            }
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    this.outlet(2, data[key]);
                    this.outlet(1, key);
                }
            }
            this.outlet(0, new Base.Bang());
            return this;
        }
    }
}

export default {
    JSBaseObject,
    JSBoolean,
    JSNumber,
    JSString,
    JSArray,
    JSObject,
    JSFunction,
    JSCall,
    JSCallback,
    Get,
    Set,
    For,
    ForEach
}