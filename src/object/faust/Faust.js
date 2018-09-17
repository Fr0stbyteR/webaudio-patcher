import Base from "../Base.js";
import Faust from "./webaudio-wasm-wrapper.js";

class FaustObject extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._package = "faust";
        this._icon = "microchip";
        this._mem.faust = Faust;
        if (!this._patcher.hasOwnProperty("_audioCtx")) {
            this._patcher._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this._audioCtx.destination.channelInterpretation = "discrete";
        }
    }
}

class DSP extends FaustObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 1;
        this._mem.compileArgs = {
            isPoly : false,
            ftz : 2,
            polyVoices : 16,
            useWorklet : false,
            libraries : "http://faust.grame.fr/editor/libraries/"
        }
        this._mem.bufferSize = 256;
        this._mem.code = null;
        this._mem.node = null;
        this._mem.params = null;
        this.update(box.args, box.props);
    }
    update(args, props) {
        let nodeReady = (node) => {
            if (!node) {
                this.error("Faust.DSP", "Compilation of Node failed " + Faust.getErrorMessage());
                return;
            }
            this._mem.node = node;
            this._mem.params = node.getJSON();
            let inletLines = this.inletLines;
            for (let inlet = 0; inlet < this._inlets; inlet++) {
                for (let j = 0; j < inletLines[inlet].length; j++) {
                    const line = this._patcher.lines[inletLines[inlet][j]];
                    let srcObj = line.srcObj;
                    let srcOutlet = line.srcOutlet;
                    if (srcObj._mem.hasOwnProperty("node") 
                            && srcObj._mem.node instanceof AudioNode) {
                        if (inlet >= this._mem.node.numberOfInputs 
                                || srcOutlet >= srcObj._mem.node.numberOfOutputs) return this;
                        srcObj._mem.node.connect(this._mem.node, srcOutlet, inlet);
                    }
                }
            }
            let outletLines = this.outletLines;
            for (let outlet = 0; outlet < this.outlets; outlet++) {
                for (let j = 0; j < outletLines[outlet].length; j++) {
                    const line = this._patcher.lines[outletLines[outlet][j]];
                    let destObj = line.destObj;
                    let destInlet = line.destInlet;
                    if (destObj._mem.hasOwnProperty("node") 
                            && destObj._mem.node instanceof AudioNode) {
                        if (outlet >= this._mem.node.numberOfOutputs 
                                || destInlet >= destObj._mem.node.numberOfInputs) return this;
                        this._mem.node.connect(destObj._mem.node, outlet, destInlet);
                    }
                }
            }
            this.emit("loadFaustModule", node.getJSON());
        }
        if (props && props.hasOwnProperty("bufferSize")) {
            let bufferSize = Base.Utils.toNumber(props.bufferSize);
            if (bufferSize === null) {
                this.error("Faust.DSP", "Don't understand" + args[0]);
            } else {
                this._mem.bufferSize = bufferSize < 256 ? 256 : bufferSize;
            }
        }
        if (args && args[0]) {
            let code = Base.Utils.toString(args[0]);
            if (code === null) {
                this.error("Faust.DSP", "Don't understand" + args[0]);
            } else {
                this._mem.code = code;
                let args = this._mem.compileArgs;
                let argv = ["-ftz", args.ftz, "-I", args.libraries];
                if (args.isPoly) {
                    Faust.createPolyDSPFactory(code, argv, (factory) => {
                        if (!factory) {
                            this.error("Faust.DSP", "Compilation of Factory failed " + Faust.getErrorMessage());
                            return;
                        }
                        if (args.useWorklet) {
                            Faust.createPolyDSPWorkletInstance(factory, this._patcher._audioCtx, this._mem.bufferSize, nodeReady);
                        } else {
                            Faust.createPolyDSPInstance(factory, this._patcher._audioCtx, args.polyVoices, nodeReady);
                        }
                    });
                } else {
                    Faust.createDSPFactory(code, argv, (factory) => {
                        if (!factory) {
                            this.error("Faust.DSP", "Compilation of Factory failed " + Faust.getErrorMessage());
                            return;
                        }
                        if (args.useWorklet) {
                            Faust.createDSPWorkletInstance(factory, this._patcher._audioCtx, this._mem.bufferSize, nodeReady);
                        } else {
                            Faust.createDSPInstance(factory, this._patcher._audioCtx, this._mem.bufferSize, nodeReady);
                        }
                    });
                }
            }
        }
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
}

export default {
    DSP
}