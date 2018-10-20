import Base from "../Base.js";

class MaxObject extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._package = "max";
        this._icon = "microchip"
    }
}

import RNG from "seedrandom";
class random extends MaxObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this._mem.seed = 0;
        this._mem.rng = Math.random;
        this._mem.maximum = 0;
        this.update(box.args, box.props);
    }

    update(args, props) {
        if (args && args[0] && Base.Utils.toNumber(args[0]) >= 0) {
            this._mem.maximum = Base.Utils.toNumber(args[0]);
        }
        if (args && args[1]) {
            if (args[1] !== 0) this._mem.rng = new RNG(args[0]);
            else this._mem.rng = Math.random;
        }
    }

    fn(data, inlet) {
        let arrayIn = Base.Utils.list2Array(data);
        if (inlet == 0) {
            if (data instanceof Base.Bang) this.outlet(0, Math.floor(this._mem.rng() * this._mem.maximum));
            if (arrayIn && arrayIn.length >= 2 && arrayIn[0] == "seed") this.update([null, arrayIn[0]]);

        }
        if (inlet == 1) {
            this.update([data]);
        }
    }
}
class metro extends MaxObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this._mem.interval = 5;
        this._mem.active = 0;
        this._mem.timeoutID = null;
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
        if ((args && args[0]) || (props && props.hasOwnProperty("interval"))) {
            let interval = Base.Utils.toNumber(args[0]);
            if (interval === null) {
                this.error("metro", "Don't understand" + args[0]);
            } else {
                this._mem.interval = interval < 1 ? 1 : interval;
            }
        }
        if (props && props.hasOwnProperty("active")) {
            let active = Base.Utils.toNumber(props.active);
            if (active === null) {
                this.error("metro", "Don't understand" + props.active);
            } else {
                this._mem.active = active !== 0;
                if (this._mem.active) {
                    window.clearTimeout(this._mem.timeoutID);
                    this.outlet(0, new Base.Bang());
                    this._mem.timeoutID = window.setTimeout(callback(), this._mem.interval);
                } else {
                    window.clearTimeout(this._mem.timeoutID);
                }
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
    metro,
    random
}