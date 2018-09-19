import Base from "../Base.js";
import Faust from "./webaudio-wasm-wrapper.js";
import CodeMirror from "codemirror";
import "codemirror/theme/darcula.css";
import "codemirror/lib/codemirror.css";

window.CodeMirror = CodeMirror;

class FaustObject extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._package = "faust";
        this._icon = "terminal";
        this._mem.faust = Faust;
        this._mem.faustLoaded = Faust.isLoaded;
        if (!this._mem.faustLoaded) {
            Faust.init(() => {
                this._mem.faustLoaded = true;
                this.emit("faustLoaded", Faust);
            });
        }
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
            libraries : "https://faust.grame.fr/editor/libraries/"
        }
        this._mem.bufferSize = 256;
        this._mem.code = null;
        this._mem.node = null;
        this._mem.params = null;
        if (this._mem.faustLoaded) this.update(box.args, box.props);
        else {
            this.on("faustLoaded", () => {
                this.update(box.args, box.props);
                this.removeAllListeners("faustLoaded");
            });
        }
    }
    update(args, props) {
        let nodeReady = (node) => {
            if (!node) {
                this.error("Faust.DSP", "Compilation of Node failed " + Faust.getErrorMessage());
                return;
            }
            if (this._mem.node && this._mem.node instanceof AudioNode) this._disconnectAll();
            this._mem.node = node;
            this._mem.params = node.getJSON();
            this.emit("loadFaustModule", node.getJSON());
            this._connectAll();
        }
        let updateCode = (code) => {
            if (code == this._mem.code) return;
            if (!code) {
                this.error("Faust.DSP", "Don't understand" + args[0]);
                return;
            } 
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
            updateCode(code);
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
    _connectAll() {
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
        for (let outlet = 0; outlet < this._outlets; outlet++) {
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
        return this;
    }
    _disconnectAll() {
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
                            || destInlet >= destObj._mem.node.numberOfInputs) return this;
                    this._mem.node.disconnect(destObj._mem.node, outlet, destInlet);
                }
            }
        }
        return this;
    }
    ui($, box) {
        let dropdownIcon = $("<i>").addClass(["dropdown", "icon"]);
        let content = super.ui($, box).append(dropdownIcon);
        let textarea = $("<textarea>").html(box.args.length ? box.args[0] : "");
        let editor = $("<div>").addClass(["package-faust-dsp-editor"]).append(textarea);
        return content.ready(() => {
            content.after(editor);
            let cm = CodeMirror.fromTextArea(textarea.get(0), {
                mode: "faust",
                theme: "darcula",
            })
            cm.on("focus", (cm, e) => {
                if ($(e.currentTarget).parents(".ui-draggable").hasClass("dragged")) return;
                if (cm.state.focused) return;
                $(e.currentTarget).parents(".ui-draggable").draggable("disable");
            });
            cm.on("blur", (cm, e) => {
                $(e.currentTarget).parents(".ui-draggable").draggable("enable");
                this.update([cm.getValue()]);
            });
            cm.on("keydown", (cm, e) => {
                if (e.key == "Delete" || e.key == "Backspace") e.stopPropagation();
            });
        });
    }
}

export default {
    DSP
}