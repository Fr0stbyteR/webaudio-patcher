import Base from "./Base.js";

class MaxObject extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._package = "max";
        this._icon = "microchip"
    }
}

class metro extends MaxObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this._mem = {
            interval : 5,
            active : 0,
            timeoutID : null
        };
        this.update(box.args, box.props);
    }
    update(args, props) {
        let callback = () => {
            return () => {
                if (this._mem.active) {
                    this.outlet(0, new Base.Bang());
                    this._mem.timeoutID = window.setTimeout(callback(), this._mem.interval);
                }
            }
        }
        if (args && args[0]) {
            if (!Base.Utils.isNumber(args[0])) {
                this.error("metro", "Don't understand" + args[0]);
            } else {
                let interval = Base.Utils.toNumber(args[0]);
                this._mem.interval = interval < 1 ? 1 : interval;
            }
        }
        if (props && props.hasOwnProperty("active")) {
            if (!Base.Utils.isNumber(props.active)) {
                this.error("metro", "Don't understand" + props.active);
            } else {
                this._mem.active = Base.Utils.toNumber(props.active) !== 0;
                if (this._mem.active) {
                    window.clearTimeout(this._mem.timeoutID);
                    this.outlet(0, new Base.Bang());
                    this._mem.timeoutID = window.setTimeout(callback(), this._mem.interval);
                } else window.clearTimeout(this._mem.timeoutID);
            }
        }
        if (props && props.hasOwnProperty("interval")) {
            if (!Base.Utils.isNumber(props.interval)) {
                this.error("metro", "Don't understand" + props.interval);
            } else {
                let interval = Base.Utils.toNumber(props.interval);
                this._mem.interval = interval < 1 ? 1 : interval;
            }
        }
        return this;
    }
    fn(data, inlet) {
        if (inlet == 0) {
            this.update(null, {active : data});
        }
        if (inlet == 1) {
            this.update([data]);
        }
    }
}

export default {
    metro
}