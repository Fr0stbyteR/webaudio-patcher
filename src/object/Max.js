import Base from "./Base.js";

class MaxObject extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.packageName = "max";
        this.icon = "microchip"
    }
}

class metro extends MaxObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.inlets = 2;
        this.outlets = 1;
        this.mem = {
            interval : 5,
            active : 0,
            timeoutID : null
        };
        this.update(box.args, box.props);
    }
    update(args, props) {
        let callback = () => {
            return () => {
                if (this.mem.active) {
                    this.outlet(0, new Base.Bang());
                    this.mem.timeoutID = window.setTimeout(callback(), this.mem.interval);
                }
            }
        }
        if (args && args[0]) {
            if (!Base.Utils.isNumber(args[0])) {
                this.error("metro", "Don't understand" + args[0]);
            } else {
                let interval = Base.Utils.toNumber(args[0]);
                this.mem.interval = interval < 1 ? 1 : interval;
            }
        }
        if (props && props.hasOwnProperty("active")) {
            if (!Base.Utils.isNumber(props.active)) {
                this.error("metro", "Don't understand" + props.active);
            } else {
                this.mem.active = Base.Utils.toNumber(props.active) !== 0;
                if (this.mem.active) {
                    window.clearTimeout(this.mem.timeoutID);
                    this.outlet(0, new Base.Bang());
                    this.mem.timeoutID = window.setTimeout(callback(), this.mem.interval);
                } else window.clearTimeout(this.mem.timeoutID);
            }
        }
        if (props && props.hasOwnProperty("interval")) {
            if (!Base.Utils.isNumber(props.interval)) {
                this.error("metro", "Don't understand" + props.interval);
            } else {
                let interval = Base.Utils.toNumber(props.interval);
                this.mem.interval = interval < 1 ? 1 : interval;
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