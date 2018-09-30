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
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.node = this._patcher._audioCtx.destination;
        this._inlets = 1;
        this._outlets = 0;
    }

}

class Oscilloscope extends WANode {
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.node = this._patcher._audioCtx.createAnalyser();
        this._mem.node.fftSize = 512;
        this._mem.data = new Uint8Array(this._mem.node.frequencyBinCount);
        this._mem.node.getByteTimeDomainData(this._mem.data);
        this._mem.node.fftSize = 256;
        this._inlets = 1;
        this._outlets = 0;
        this.update(box.args, box.props);
    }
    update(args, props) {
        if (args && args[0]) this._mem.node.fftSize = args[0];
        return this;
    }
    ui($, box) {
        let canvas = $("<canvas>").addClass("scope").css("width", "100%").css("height", "200px");
        let container = super.defaultDropdownUI($, box);
        container.find(".box-ui-dropdown-container").append(canvas);
        return container.ready(() => {
            let canvasCtx = canvas.get(0).getContext('2d');
            canvasCtx.strokeStyle = "#FFFFFF";
            let w = canvas.get(0).width;
            let h = canvas.get(0).height;
            let l = this._mem.node.frequencyBinCount;
            let draw = () => {
                this._mem.node.getByteTimeDomainData(this._mem.data);
                canvasCtx.fillRect(0, 0, w, h);
                canvasCtx.beginPath();
                for (let i = 0; i < l; i++) {
                    let x = w * i / (l - 1);
                    let y = this._mem.data[i] / 128.0 * (h / 2);
                    if (i === 0) canvasCtx.moveTo(x, y);
                    else canvasCtx.lineTo(x, y);
                }
                canvasCtx.stroke();
                requestAnimationFrame(draw);
            };
            draw();
        });
    }
}

class Spectrogram extends WANode {
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.node = this._patcher._audioCtx.createAnalyser();
        this._mem.node.fftSize = 512;
        this._mem.data = new Uint8Array(this._mem.node.frequencyBinCount);
        this._mem.node.getByteFrequencyData(this._mem.data);
        this._mem.node.fftSize = 256;
        this._inlets = 1;
        this._outlets = 0;
        this.update(box.args, box.props);
    }
    update(args, props) {
        if (args && args[0]) this._mem.node.fftSize = args[0];
        return this;
    }
    ui($, box) {
        let canvas = $("<canvas>").addClass("spectrogram").css("width", "100%").css("height", "200px");
        let container = super.defaultDropdownUI($, box);
        container.find(".box-ui-dropdown-container").append(canvas);
        return container.ready(() => {
            let canvasCtx = canvas.get(0).getContext('2d');
            let w = canvas.get(0).width;
            let h = canvas.get(0).height;
            let l = this._mem.node.frequencyBinCount;
            let draw = () => {
                this._mem.node.getByteFrequencyData(this._mem.data);
                canvasCtx.fillStyle = "#000000";
                canvasCtx.fillRect(0, 0, w, h);
                canvasCtx.fillStyle = "#FFFFFF";
                for (let i = 0; i < l; i++) {
                    let x = w * i / l;
                    let y = this._mem.data[i] / 128.0 * h;
                    canvasCtx.fillRect(x, h - y, w / l, y);
                }
                requestAnimationFrame(draw);
            };
            draw();
        });
    }
}

export default {
    Oscillator,
    Destination,
    Oscilloscope,
    Spectrogram
}