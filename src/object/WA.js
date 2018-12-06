import Base from "./Base.js";

class WANode extends Base.BaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            package : "WA",
            icon : "volume up", 
            author : "Fr0stbyteR",
            version : "1.0.0"
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        if (!this._patcher.hasOwnProperty("_audioCtx") || !this._patcher._audioCtx) {
            this._patcher._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this._patcher._audioCtx.onstatechange = () => {
                this._patcher.emit("audioCtxState", this._patcher._audioCtx.state);
            }
        }
        this._mem.node = null;
    }
    connectedInlet(inlet, srcObj, srcOutlet, lineID) {
        if (this._mem.node instanceof AudioNode 
                && srcObj._mem.hasOwnProperty("node") 
                && srcObj._mem.node instanceof AudioNode) {
            if (inlet >= this._mem.node.numberOfInputs 
                    || srcOutlet >= srcObj._mem.node.numberOfOutputs) return this;
            srcObj._mem.node.connect(this._mem.node, srcOutlet, inlet);
        }
        return this;
    }
    disconnectedInlet(inlet, srcObj, srcOutlet, lineID) {
        if (this._mem.node instanceof AudioNode 
                && srcObj._mem.hasOwnProperty("node") 
                && srcObj._mem.node instanceof AudioNode) {
            if (inlet >= this._mem.node.numberOfInputs 
                    || srcOutlet >= srcObj._mem.node.numberOfOutputs) return this;
            srcObj._mem.node.disconnect(this._mem.node, srcOutlet, inlet);
        }
        return this;
    }
    connectAll() {
        let inletLines = this.inletLines;
        for (let inlet = 0; inlet < this._inlets; inlet++) {
            for (let j = 0; j < inletLines[inlet].length; j++) {
                const line = this._patcher.lines[inletLines[inlet][j]];
                let srcObj = line.srcObj;
                let srcOutlet = line.srcOutlet;
                if (srcObj._mem.hasOwnProperty("node") 
                        && srcObj._mem.node instanceof AudioNode) {
                    if (inlet >= this._mem.node.numberOfInputs 
                            || srcOutlet >= srcObj._mem.node.numberOfOutputs) continue;
                    srcObj._mem.node.connect(this._mem.node, srcOutlet, inlet);
                }
            }
        }
        let outletLines = this.outletLines;
        for (let outlet = 0; outlet < this._outlets; outlet++) {
            for (let j = 0; j < outletLines[outlet].length; j++) {
                const line = this._patcher.lines[outletLines[outlet][j]];
                let destObj = line.destObj;
                let destInlet = line.destInlet;
                if (destObj._mem.hasOwnProperty("node") 
                        && destObj._mem.node instanceof AudioNode) {
                    if (outlet >= this._mem.node.numberOfOutputs 
                            || destInlet >= destObj._mem.node.numberOfInputs) continue;
                    this._mem.node.connect(destObj._mem.node, outlet, destInlet);
                }
            }
        }
        return this;
    }
    disconnectAll() {
        let inletLines = this.inletLines;
        for (let inlet = 0; inlet < this._inlets; inlet++) {
            for (let j = 0; j < inletLines[inlet].length; j++) {
                const line = this._patcher.lines[inletLines[inlet][j]];
                let srcObj = line.srcObj;
                let srcOutlet = line.srcOutlet;
                if (srcObj._mem.hasOwnProperty("node") 
                        && srcObj._mem.node instanceof AudioNode) {
                    if (inlet >= this._mem.node.numberOfInputs 
                            || srcOutlet >= srcObj._mem.node.numberOfOutputs) continue;
                    srcObj._mem.node.disconnect(this._mem.node, srcOutlet, inlet);
                }
            }
        }
        let outletLines = this.outletLines;
        for (let outlet = 0; outlet < this._outlets; outlet++) {
            for (let j = 0; j < outletLines[outlet].length; j++) {
                const line = this._patcher.lines[outletLines[outlet][j]];
                let destObj = line.destObj;
                let destInlet = line.destInlet;
                if (destObj._mem.hasOwnProperty("node") 
                        && destObj._mem.node instanceof AudioNode) {
                    if (outlet >= this._mem.node.numberOfOutputs 
                            || destInlet >= destObj._mem.node.numberOfInputs) continue;
                    this._mem.node.disconnect(destObj._mem.node, outlet, destInlet);
                }
            }
        }
        return this;
    }
}

class Oscillator extends WANode {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "WebAudio Oscillator",
            inlets : [{
                isHot : true,
                type : "object",
                description : "Set oscillator props { type: string, frequency: number }"
            }],
            outlets : [{
                type : "signal",
                description : "WebAudio Node output"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 1;
        this._mem.node = this._patcher._audioCtx.createOscillator();
        this.update(box._args, box._props);
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

class StreamSource extends WANode {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "WebAudio Stream Source",
            outlets : [{
                type : "signal",
                description : "WebAudio Node output"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 0;
        this._outlets = 1;
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((stream) => {
            this._mem.node = this._patcher._audioCtx.createMediaStreamSource(stream);
            this._mem.node.channelInterpretation = "discrete";
            this.connectAll()
        }, (reason) => this.error(reason));
    }
}

class Destination extends WANode {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "WebAudio Destination",
            inlets : [{
                isHot : true,
                type : "signal",
                description : "WebAudio Node input"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.node = this._patcher._audioCtx.destination;
        this._mem.node.channelInterpretation = "discrete";
        this._inlets = 1;
        this._outlets = 0;
    }

}

class Oscilloscope extends WANode {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Draw waveform of a WebAudio Node signal in canvas",
            inlets : [{
                isHot : true,
                type : "signal",
                description : "WebAudio Node input"
            }],
            args : [{
                type : "number",
                optional : true,
                default : 512,
                description : "fftSize"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.node = this._patcher._audioCtx.createAnalyser();
        this._mem.node.fftSize = 512;
        this._mem.data = new Uint8Array(this._mem.node.frequencyBinCount);
        this._mem.node.getByteTimeDomainData(this._mem.data);
        this._inlets = 1;
        this._outlets = 0;
        this.update(box._args, box._props);
    }
    update(args, props) {
        if (args && args[0]) this._mem.node.fftSize = args[0];
        return this;
    }
    ui($, box) {
        let canvas = $("<canvas>").addClass("scope").css("width", "100%").css("height", "100%").css("min-height", "50px");
        let container = super.defaultDropdownUI($, box);
        container.find(".box-ui-dropdown-container").append(canvas);
        container.data("resizeMinHeight", 100);
        return container.ready(() => {
            let canvasCtx = canvas.get(0).getContext('2d');
            canvasCtx.strokeStyle = "#FFFFFF";
            let w = canvas.get(0).width;
            let h = canvas.get(0).height;
            let l = this._mem.node.frequencyBinCount;
            let draw = () => {
                if (this._patcher._audioCtx.state != "running") return requestAnimationFrame(draw);
                this._mem.node.getByteTimeDomainData(this._mem.data);
                canvasCtx.fillRect(0, 0, w, h);
                canvasCtx.beginPath();
                for (let i = 0; i < l; i++) {
                    let x = w * i / (l - 1);
                    let y = h - this._mem.data[i] / 128.0 * (h / 2);
                    if (i === 0) canvasCtx.moveTo(x, y);
                    else canvasCtx.lineTo(x, y);
                }
                canvasCtx.stroke();
                return requestAnimationFrame(draw);
            };
            draw();
        });
    }
}

class Spectrogram extends WANode {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Draw spectrum of a WebAudio Node signal in canvas",
            inlets : [{
                isHot : true,
                type : "signal",
                description : "WebAudio Node input"
            }],
            args : [{
                type : "number",
                optional : true,
                default : 512,
                description : "fftSize"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.node = this._patcher._audioCtx.createAnalyser();
        this._mem.node.fftSize = 512;
        this._mem.data = new Uint8Array(this._mem.node.frequencyBinCount);
        this._mem.node.getByteFrequencyData(this._mem.data);
        this._inlets = 1;
        this._outlets = 0;
        this.update(box._args, box._props);
    }
    update(args, props) {
        if (args && args[0]) this._mem.node.fftSize = args[0];
        return this;
    }
    ui($, box) {
        let canvas = $("<canvas>").addClass("spectrogram").css("width", "100%").css("height", "100%").css("min-height", "50px");
        let container = super.defaultDropdownUI($, box);
        container.find(".box-ui-dropdown-container").append(canvas);
        container.data("resizeMinHeight", 100);
        return container.ready(() => {
            let canvasCtx = canvas.get(0).getContext('2d');
            let w = canvas.get(0).width;
            let h = canvas.get(0).height;
            let l = this._mem.node.frequencyBinCount;
            let draw = () => {
                if (this._patcher._audioCtx.state != "running") return requestAnimationFrame(draw);
                this._mem.node.getByteFrequencyData(this._mem.data);
                canvasCtx.fillStyle = "#000000";
                canvasCtx.fillRect(0, 0, w, h);
                canvasCtx.fillStyle = "#FFFFFF";
                for (let i = 0; i < l; i++) {
                    let x = w * i / l;
                    let y = this._mem.data[i] / 128.0 * h;
                    canvasCtx.fillRect(x, h - y, w / l, y);
                }
                return requestAnimationFrame(draw);
            };
            draw();
        });
    }
}

export default {
    Oscillator,
    Destination,
    Oscilloscope,
    Spectrogram,
    StreamSource,
    "dac~" : Destination,
    "adc~" : StreamSource
}