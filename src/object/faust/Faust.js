import Base from "../Base.js";
import Faust from "./webaudio-wasm-wrapper.js";
import CodeMirror from "codemirror";
import "./Faust.css";
import "codemirror/theme/darcula.css";
import "codemirror/lib/codemirror.css";
import "./codemirror/mode/faust/faust.js";
import "jquery-ui/ui/widgets/slider";
import "jquery-ui/themes/base/slider.css";

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
        if (!this.storage.hasOwnProperty("showEditor")) this.storage.showEditor = true;
        if (!this.storage.hasOwnProperty("code")) this.storage.code = "";
        this._mem.compileArgs = {
            isPoly : false,
            ftz : 2,
            polyVoices : 16,
            useWorklet : false,
            libraries : "https://faust.grame.fr/editor/libraries/"
        }
        this._mem.bufferSize = 256;
        this._mem.node = null;
        this._mem.params = null;
        this._mem.compiled = false;
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
            this._mem.compiled = true;
            this.uiRefresh();
        }
        let updateCode = (code) => {
            if (this._mem.compiled && (code == this.storage.code)) return;
            if (!code) {
                this.error("Faust.DSP", "Don't understand" + args[0]);
                return;
            } 
            this.storage.code = code;
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
        if (this.storage.code) updateCode(this.storage.code);
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
        let dropdownIcon = $("<i>").addClass(["dropdown", "icon", "box-ui-toggle"]).on("click", (e) => {
            editor.children('.CodeMirror').add(faustUI).slideToggle(100, () => {
                this._patcher.resizeBox(box);
                this.storage.showEditor = !this.storage.showEditor;
            });
        });
        let textarea = $("<textarea>").html(this.storage.code ? this.storage.code : box.args.length ? box.args[0] : "");
        let editor = $("<div>").addClass(["dsp-editor"]).append(textarea);
        let faustUI = $("<div>").addClass(["faust-ui"]);
        if (this._mem.params && this._mem.params.hasOwnProperty("ui") && this._mem.params.ui.length) {
            let faustUITabular = $("<div>").addClass(["ui", "bottom", "attached", "tabular", "mini", "menu"]);
            for (let i = 0; i < this._mem.params.ui.length; i++) {
                const group = this._mem.params.ui[i];
                faustUITabular.append(
                    $("<a>").addClass(["item", i == 0 ? "active" : ""])
                    .attr("data-tab", i).html(group.label)
                );
                let tab = $("<div>").addClass(["ui", "top", "attached", "tab", "segment", i == 0 ? "active" : ""]);
                for (let j = 0; j < group.items.length; j++) {
                    const item = group.items[j];
                    let faustUIItem = $("<div>").addClass("faust-ui-item");
                    switch (item.type) {
                        case "hslider":
                            faustUIItem.append($("<a>").addClass(["ui", "horizontal", "label", "faust-hslider-tag"]).html(item.label))
                            .append($("<div>").addClass("faust-hslider").attr("data-address", item.address)
                            .slider({
                                value : +item.init,
                                min : +item.min,
                                max : +item.max,
                                step : +item.step,
                                slide : (e, ui) => {
                                    this._mem.node.setParamValue(item.address, ui.value);
                                }
                            }));
                            break;
                        default:
                            break;
                    }
                    tab.append(faustUIItem);
                }
                faustUI.append(tab);
            }
            faustUI.append(faustUITabular);
        }
        let container = super.defaultUI($, box);
        container.addClass(["ui", "accordion"]).append(faustUI).append(editor)
            .find(".box-ui-text-container").append(dropdownIcon);
        //container.data("resizeHandles", "e, w, n, s");
        return container.ready(() => {
            let cm = CodeMirror.fromTextArea(textarea.get(0), {
                lineNumbers: true,
                minFoldSize: 5,
                mode: "application/faust",
                smartIndent: true,
                tabSize: 4,
                theme: "darcula",
                lineWrapping: true,
                allowDropFileTypes: ["application/octet-stream"],
                indentWithTabs: false
            })
            editor.on("click", (e) => {
                if (editor.parents(".ui-draggable").hasClass("dragged")) return;
                if (editor.hasClass("editing")) return;
                editor.addClass("editing")
                    .parents(".ui-draggable").draggable("disable");
            });
            cm.on("blur", (cm, e) => {
                editor.removeClass("editing")
                    .parents(".ui-draggable").draggable("enable");
                this.update([cm.getValue()]);
            });
            cm.on("keydown", (cm, e) => {
                if (e.key == "Delete" || e.key == "Backspace") e.stopPropagation();
            });
            if (!this.storage.showEditor) {
                faustUI.hide();
                editor.children('.CodeMirror').hide();
            }
            this._patcher.resizeBox(box);
        });
    }
}

export default {
    DSP
}