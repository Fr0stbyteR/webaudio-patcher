import Base from "./Base.js";

class WANode extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._package = "wa";
        this._icon = "volume up"
        if (!this._patcher.hasOwnProperty("_audioCtx") || !this._patcher._audioCtx) {
            this._patcher._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this._patcher._audioCtx.destination.channelInterpretation = "discrete";
        }
        this._mem.node = null;
    }
    fn(data, inlet) {
    }
    connectedInlet(inlet, srcObj, srcOutlet, lineID) {
        if (srcObj._mem.hasOwnProperty("node") 
                && srcObj._mem.node instanceof AudioNode) {
            if (inlet >= this._mem.node.numberOfInputs 
                    || srcOutlet >= srcObj._mem.node.numberOfOutputs) return this;
            srcObj._mem.node.connect(this._mem.node, srcOutlet, inlet);
        }
        return this;
    }
    disconnectedInlet(inlet, srcObj, srcOutlet, lineID) {
        if (srcObj._mem.hasOwnProperty("node") 
                && srcObj._mem.node instanceof AudioNode) {
            if (inlet >= this._mem.node.numberOfInputs 
                    || srcOutlet >= srcObj._mem.node.numberOfOutputs) return this;
            srcObj._mem.node.disconnect(this._mem.node, srcOutlet, inlet);
        }
        return this;
    }
}

class Oscillator extends WANode {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this._mem.node = this._patcher._audioCtx.createOscillator();
        this.update(box.args, box.props);
        this._mem.node.start();
    }
    fn(data, inlet) {
        if (inlet == 0) {
            this.update([], data);
        }
    }
    update(args, props) {
        if (props.hasOwnProperty("type")) this.type = props.type;
        if (props.hasOwnProperty("frequency")) this.frequency = props.frequency;
        return this;
    }
    set frequency(freq) {
        if (typeof freq == "number") {
            this._mem.node.frequency.setValueAtTime(freq, this._patcher._audioCtx.currentTime);
        }
    }
    set type(t) {
        this._mem.node.type = t || "sine"; //TODO
    }
}

class Destination extends WANode {
    constructor(props, patcher) {
        super(props, patcher);
        this._mem.node = this._patcher._audioCtx.destination;
        this._inlets = 1;
        this._outlets = 0;
    }

}

export default {
    Oscillator,
    Destination
}