import Base from "./Base.js";

class WANode extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.packageClass = "package-wa";
        this.icon = "volume up"
        if (!this._patcher.hasOwnProperty("audioCtx"))
            this._patcher.audioCtx = new(window.AudioContext || window.webkitAudioContext)();
        this.audioCtx.destination.channelInterpretation = "discrete";
        this.data.node;
    }
    _fn(data, inlet) {
    }
    connectedInlet(inlet, srcObj, srcOutlet, lineID) {
        if (this.isInletFrom(inlet, srcObj, srcOutlet)) return; // already connected
        if (srcObj.data.hasOwnProperty("node") && srcObj.data.node instanceof AudioNode) {
            if (inlet >= this.data.node.numberOfInputs || srcOutlet >= srcObj.data.node.numberOfOutputs) return;
            srcObj.data.node.connect(this.data.node, srcOutlet, inlet);
        }
    }
    disconnectedInlet(inlet, srcObj, srcOutlet, lineID) {
        if (this.isInletFrom(inlet, srcObj, srcOutlet)) return; // not last cable
        if (srcObj.data.hasOwnProperty("node") && srcObj.data.node instanceof AudioNode) {
            if (inlet >= this.data.node.numberOfInputs || srcOutlet >= srcObj.data.node.numberOfOutputs) return;
            srcObj.data.node.disconnect(this.data.node, srcOutlet, inlet);
        }
    }
    get audioCtx() {
        return this._patcher.audioCtx;
    }
}

class Oscillator extends WANode {
    constructor(box, patcher) {
        super(box, patcher);
        this.data.node = this.audioCtx.createOscillator();
        this.inlets = 2;
        this.outlets = 1;
        this.update(box.args, box.props);
        this.data.node.start();
    }
    _fn(data, inlet) {
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
            this.data.node.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        }
    }
    set type(t) {
        this.data.node.type = t || "sine"; //TODO
    }
}

class Destination extends WANode {
    constructor(props, patcher) {
        super(props, patcher);
        this.data.node = this.audioCtx.destination;
        this.inlets = 1;
        this.outlets = 0;
    }

}

export default {
    Oscillator,
    Destination
}