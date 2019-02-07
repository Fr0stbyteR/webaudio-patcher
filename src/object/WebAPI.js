import Base from "./Base.js";
import AutoImporter from "./AutoImporter.js";

class WebAPIObject extends Base.BaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            package : "WebAPI",
            icon : "globe", 
            author : "Fr0stbyteR",
            version : "1.0.0"
        });
    }
}
let Fetch = class Fetch extends WebAPIObject {
    static get _meta() {
        return Object.assign(super._meta, {
            name : "fetch",
            description : "Fetching a resource from the network",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "Input, a string or a Request object"
            }, {
                isHot : false,
                type : "object",
                description : "An options object containing any custom settings that you want to apply to the request."
            }],
            outlets : [{
                type : "object",
                description : "Response object"
            }],
            args : [{
                type : "string",
                optional : true,
                description : "Default input url"
            }],
            props : []
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this._mem.inputs = box._args.slice();
        this._mem.result = null;
        this.update(this._mem.inputs, box._props);
    }
    update(args, props) {
        if (!args) return this;
        this._mem.inputs = args;
        return this;
    }
    fn(data, inlet) {
        if (inlet == 0 && data instanceof Base.Bang) {
            if (this.execute()) this.output();
            return this;
        }
        this._mem.inputs[inlet] = data;
        if (inlet == 0) {
            if (this.execute()) this.output();
        }
        return this;
    }
    output() {
        this.loading(true);
        this._mem.result.then((r) => {
            this.loading(false);
            this._mem.result = r;
            this.outlet(0, this._mem.result);
        }, (r) => {
            this.loading(false);
            this.error(r);
        });
    }
    loading(bool) {
        if (bool) {
            for (const id in this._uiList) {
                this._uiList[id].find(".icon").removeClass(this._meta.icon).addClass(["spinner", "loading"]);
            }
        } else {
            for (const id in this._uiList) {
                this._uiList[id].find(".icon").removeClass(["spinner", "loading"]).addClass(this._meta.icon);
            }
        }
    }
    execute() {
        try {
            this._mem.result = fetch(...this._mem.inputs);
            return true;
        } catch (e) {
            this.error(e);
            return false;
        }
    }
}
let FetchAPI = {
    Request : window.Request,
    Response : window.Response,
    Headers : window.Headers
}
export default {
    FetchAPI : Object.assign(
        AutoImporter.importer("FetchAPI", FetchAPI, 2), 
        { fetch : Fetch }
    )
};