import Base from "./Base.js";

class EventObject extends Base.BaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            package : "E",
            icon : "node js", 
            author : "Fr0stbyteR",
            version : "1.0.0",
            inlets : [],
            outlets : [{
                type : "onject",
                description : "Output event object when fired"
            }],
            args : [],
            props : []
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 0;
        this._outlets = 1;
        this._mem.callback = e => this.outlet(0, e);
        this._mem.off = () => {};
    }
    destroy() {
        this._mem.off();
        return super.destroy()
    }
}
let pkg = { document : [] };
let docEvents = [];
for (const property in document) {
    const match = property.match(/^on(.*)/)
    if (match) docEvents.push(match[1]);
}
let winEvents = [];
for (const property in window) {
    const match = property.match(/^on(.*)/)
    if (match) winEvents.push(match[1]);
}
for (const event of winEvents) {
    pkg[event] = class extends EventObject {
        static get _meta() {
            return Object.assign(super._meta, {
                name : event,
            });
        }
        ui($, box) {
            $(window).on(event, this._mem.callback);
            this._mem.off = () => $(window).off(event, this._mem.callback);
            return super.defaultUI($, box);
        }
    }
}
for (const event of docEvents) {
    pkg.document[event] = class extends EventObject {
        static get _meta() {
            return Object.assign(super._meta, {
                name : event,
            });
        }
        ui($, box) {
            $(document).on(event, this._mem.callback);
            this._mem.off = () => $(document).off(event, this._mem.callback);
            return super.defaultUI($, box);
        }
    }
}

export default pkg;