import JS from "./JS.js";
import Base from "./Base.js";

class JSUnaryOp extends JS.JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Unary Operation",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "First element"
            }],
            outlets : [{
                type : "anything",
                description : "Result"
            }],
            args : []
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 1;
        this._mem.result = 0;
        this.update(box.args);
    }
    update(args, props) {
        this._mem.result = 0;
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this._mem.result);
            return this;
        }
        if (inlet == 0) {
            try {
                this._mem.result = this.execute(data);
                this.outlet(0, this._mem.result);
            } catch (e) {
                this.error(e);
            }
        }
        return this;
    }
    execute(a) {
        return;
    }
}

class JSBinaryOp extends JS.JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Binary Operation",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "First element"
            }, {
                isHot : false,
                type : "anything",
                description : "Second element"
            }],
            outlets : [{
                type : "anything",
                description : "Result"
            }],
            args : [{
                type : "anything",
                optional : true,
                default : 0,
                description : "Initial second element"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this._mem.arg = 0;
        this._mem.result = 0;
        this.update(box.args);
    }
    update(args, props) {
        this._mem.arg = 0;
        this._mem.result = 0;
        if (args.length == 0) return this;
        this._mem.arg = args[0];
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this._mem.result);
            return this;
        }
        if (inlet == 1) {
            this._mem.arg = data;
        }
        if (inlet == 0) {
            try {
                this._mem.result = this.execute(data, this._mem.arg);
                this.outlet(0, this._mem.result);
            } catch (e) {
                this.error(e);
            }
        }
        return this;
    }
    execute(a, b) {
        return;
    }
}

class JSTernaryOp extends JS.JSBaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Ternary Operation",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "Test"
            }, {
                isHot : false,
                type : "anything",
                description : "True output"
            }, {
                isHot : false,
                type : "anything",
                description : "False output"
            }],
            outlets : [{
                type : "anything",
                description : "Result"
            }],
            args : [{
                type : "anything",
                optional : true,
                default : true,
                description : "Initial true output"
            }, {
                type : "anything",
                optional : true,
                default : false,
                description : "Initial false output"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 3;
        this._outlets = 1;
        this._mem.args = [true, false];
        this._mem.result = true;
        this.update(box.args);
    }
    update(args, props) {
        this._mem.args = [true, false];
        this._mem.result = true;
        if (args.length == 0) return this;
        this._mem.args[0] = args[0];
        this._mem.args[1] = args[1];
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            this.outlet(0, this._mem.result);
            return this;
        }
        if (inlet == 1) {
            this._mem.args[0] = data;
        }
        if (inlet == 2) {
            this._mem.args[1] = data;
        }
        if (inlet == 0) {
            try {
                this._mem.result = data ? this._mem.args[0] : this._mem.args[1];
                this.outlet(0, this._mem.result);
            } catch (e) {
                this.error(e);
            }
        }
        return this;
    }
}

class Add extends JSBinaryOp {
    execute(a, b) {
        return a + b;
    }
}

class Sub extends JSBinaryOp {
    execute(a, b) {
        return a - b;
    }
}

class Mul extends JSBinaryOp {
    execute(a, b) {
        return a * b;
    }
}

class Div extends JSBinaryOp {
    execute(a, b) {
        return a / b;
    }
}

class Exp extends JSBinaryOp {
    execute(a, b) {
        return a ** b;
    }
}

class Mod extends JSBinaryOp {
    execute(a, b) {
        return a % b;
    }
}

class Inc extends JSUnaryOp {
    execute(a) {
        return ++a;
    }
}

class Dec extends JSUnaryOp {
    execute(a) {
        return --a;
    }
}

class Eql extends JSBinaryOp {
    execute(a, b) {
        return a == b;
    }
}

class EqlS extends JSBinaryOp {
    execute(a, b) {
        return a === b;
    }
}

class NEql extends JSBinaryOp {
    execute(a, b) {
        return a != b;
    }
}

class NEqlS extends JSBinaryOp {
    execute(a, b) {
        return a !== b;
    }
}

class Gtr extends JSBinaryOp {
    execute(a, b) {
        return a > b;
    }
}

class Geq extends JSBinaryOp {
    execute(a, b) {
        return a >= b;
    }
}

class Lss extends JSBinaryOp {
    execute(a, b) {
        return a < b;
    }
}

class Leq extends JSBinaryOp {
    execute(a, b) {
        return a <= b;
    }
}

class And extends JSBinaryOp {
    execute(a, b) {
        return a && b;
    }
}

class Or extends JSBinaryOp {
    execute(a, b) {
        return a || b;
    }
}

class Not extends JSUnaryOp {
    execute(a) {
        return !a;
    }
}

class Typeof extends JSUnaryOp {
    execute(a) {
        return typeof a;
    }
}

class Instanceof extends JSBinaryOp {
    execute(a, b) {
        return a instanceof b;
    }
}

export default {
    "+" : Add,
    "-" : Sub,
    "*" : Mul,
    "/" : Div,
    "**" : Exp,
    "%" : Mod,
    "++" : Inc,
    "--" : Dec,
    "==" : Eql,
    "===" : EqlS,
    "!=" : NEql,
    "!==" : NEqlS,
    ">" : Gtr,
    ">=" : Geq,
    "<" : Lss,
    "<=" : Leq,
    "&&" : And,
    "||" : Or,
    "!" : Not,
    Typeof,
    Instanceof,
    "?" : JSTernaryOp
}