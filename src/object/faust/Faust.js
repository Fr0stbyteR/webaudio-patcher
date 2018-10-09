import Base from "../Base.js";
import Faust from "./webaudio-wasm-wrapper.js";
import CodeMirror from "codemirror";
import "./Faust.css";
import "codemirror/theme/darcula.css";
import "codemirror/lib/codemirror.css";
import "./codemirror/mode/faust/faust.js";
import "jquery-ui/ui/widgets/slider.js";
import "jquery-ui/themes/base/slider.css";
import "jquery-ui-touch-punch";
import { EventEmitter } from "events";

class FaustLoader extends EventEmitter {
    constructor() {
        super();
    }
    load() {
        if (Faust.loadStatus == -1) {
            Faust.init(() => {
                this.emit("faustLoaded", Faust);
            });
        }
    }
}
let faustLoader = new FaustLoader();

class FaustObject extends Base.BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._package = "faust";
        this._icon = "terminal";
        this._mem.faust = Faust;
        faustLoader.load();
        if (!this._patcher.hasOwnProperty("_audioCtx") || !this._patcher._audioCtx) {
            this._patcher._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this._patcher._audioCtx.onstatechange = () => {
                this._patcher.emit("audioCtxState", this._patcher._audioCtx.state);
            }
        }
    }
}

class DSP extends FaustObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 2;
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
        if (Faust.loadStatus == 1) this.update(box.args, box.props);
        else {
            faustLoader.on("faustLoaded", () => {
                this.update(box.args, box.props);
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
            this.outlet(1, {code : this.storage.code, params : this._mem.params, node : this._mem.node});
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
                this.uiResize();
                this.storage.showEditor = !this.storage.showEditor;
            });
        });
        let textarea = $("<textarea>").html(this.storage.code ? this.storage.code : box.args.length ? box.args[0] : "");
        let editor = $("<div>").addClass(["dsp-editor"]).append(textarea);
        let faustUI = $("<div>").addClass(["faust-ui"]);
        
        let _genFaustUI = ($, parent, items) => {
            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                let uiItem = $("<div>").addClass("faust-ui-item");
                switch (item.type) {
                    case "button":
                        uiItem.addClass("faust-ui-button").append(
                            $("<button>").addClass(["ui", "basic", "mini", "button", "faust-button"])
                            .attr("data-address", item.address).html(item.label)
                            .on("mousedown", () => {
                                this._mem.node.setParamValue(item.address, 1);
                            }).on("mouseup", () => {
                                this._mem.node.setParamValue(item.address, 0);
                            })
                        )
                        break;
                    case "checkbox":
                        uiItem.addClass(["ui", "toggle", "checkbox", "faust-ui-checkbox"])
                        .append($("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label))
                        .append($("<input>").attr("type", "checkbox").attr("name", item.label).attr("data-address", item.address))
                        .checkbox({
                            onChecked : () => {
                                this._mem.node.setParamValue(item.address, 1);
                            },
                            onUnchecked : () => {
                                this._mem.node.setParamValue(item.address, 0);
                            }
                        });
                        break;
                    case "hslider":
                        uiItem.addClass("faust-ui-hslider").append(
                            $("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label)
                        ).append($("<div>").attr("data-address", item.address)
                            .slider({
                                value : +item.init,
                                min : +item.min,
                                max : +item.max,
                                step : +item.step,
                                slide : (e, ui) => {
                                    this._mem.node.setParamValue(item.address, ui.value);
                                    $(ui.handle).attr("data-tooltip", ui.value);
                                }
                            })
                        ).find(".ui-slider-handle").attr("data-tooltip", +item.init).attr("data-inverted", "");
                        break;
                    case "vslider":
                        uiItem.addClass("faust-ui-vslider").append(
                            $("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label)
                        ).append($("<div>").attr("data-address", item.address)
                            .slider({
                                orientation : "vertical",
                                value : +item.init,
                                min : +item.min,
                                max : +item.max,
                                step : +item.step,
                                slide : (e, ui) => {
                                    this._mem.node.setParamValue(item.address, ui.value);
                                    $(ui.handle).attr("data-tooltip", ui.value);
                                }
                            })
                        ).find(".ui-slider-handle").attr("data-tooltip", +item.init).attr("data-inverted", "").attr("data-position", "left center");
                        break;
                    case "nentry":
                        uiItem.addClass("faust-ui-nentry").append(
                            $("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label)
                        ).append($("<div>").attr("data-address", item.address)
                            .slider({
                                value : +item.init,
                                min : +item.min,
                                max : +item.max,
                                step : +item.step,
                                slide : (e, ui) => {
                                    this._mem.node.setParamValue(item.address, ui.value);
                                    $(ui.handle).attr("data-tooltip", ui.value);
                                }
                            })
                        ).find(".ui-slider-handle").attr("data-tooltip", +item.init).attr("data-inverted", "");
                        break;
                    case "vgroup":
                        uiItem.addClass(["ui", "segment", "faust-ui-group", "faust-ui-vgroup"]).append(
                            $("<div>").addClass(["ui", "left", "top", "attached", "label", "faust-ui-label"]).html(item.label)
                        );
                        _genFaustUI($, uiItem, item.items);
                        break;
                    case "hgroup":
                        uiItem.addClass(["ui", "segment", "faust-ui-group", "faust-ui-hgroup"]).append(
                            $("<div>").addClass(["ui", "left", "top", "attached", "label", "faust-ui-label"]).html(item.label)
                        );
                        _genFaustUI($, uiItem, item.items);
                    break;
                    case "tgroup":
                        uiItem.addClass(["ui", "segment", "faust-ui-group", "faust-ui-tgroup"]).append(
                            $("<div>").addClass(["ui", "left", "top", "attached", "label", "faust-ui-label"]).html(item.label)
                        );
                        _genFaustUI($, uiItem, item.items);
                        break;
                    default:
                        break;
                }
                parent.append(uiItem);
            }
            return parent;
        }
        if (this._mem.params && this._mem.params.hasOwnProperty("ui") && this._mem.params.ui.length) {
            let faustUITabular = $("<div>").addClass(["ui", "bottom", "attached", "tabular", "mini", "menu"]);
            for (let i = 0; i < this._mem.params.ui.length; i++) {
                const group = this._mem.params.ui[i];
                faustUITabular.append(
                    $("<a>").addClass(["item", i == 0 ? "active" : ""])
                    .attr("data-tab", i).html(group.label)
                );
                let tab = $("<div>").addClass(["faust-ui-group", "ui", "top", "attached", "tab", "segment", i == 0 ? "active" : ""]);
                
                faustUI.append(_genFaustUI($, tab, group.items));
            }
            faustUI.append(faustUITabular);
        }
        let container = super.defaultUI($, box);
        container.append(faustUI).append(editor)
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
                if (this._patcher.state.locked) return;
                if (editor.parents(".ui-draggable").hasClass("dragged")) return;
                if (editor.hasClass("editing")) return;
                editor.addClass("editing")
                    .parents(".ui-draggable").draggable("disable");
            });
            cm.on("blur", (cm, e) => {
                this.update([cm.getValue()]);
                if (this._patcher.state.locked) return;
                editor.removeClass("editing")
                    .parents(".ui-draggable").draggable("enable");
            });
            cm.on("keydown", (cm, e) => {
                if (e.key == "Delete" || e.key == "Backspace") e.stopPropagation();
            });
            if (!this.storage.showEditor) {
                faustUI.hide();
                editor.children('.CodeMirror').hide();
            }
            this.uiResize();
        });
    }
}

class Diagram extends FaustObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 0;
        this._mem.diagram = null;
        this._mem.code = null;
    }
    fn(data, inlet) {
        if (data && data.hasOwnProperty("code") && data.code) {
            this._mem.code = data.code;
            this.uiRefresh();
        }
    }
    ui($, box) {
        let src = $("<embed>").addClass("faust-diagram").css("width", "100%").css("height", "100%");
        let container = super.defaultDropdownUI($, box);
        container.find(".box-ui-dropdown-container").append(src);
        if (!this._mem.code) return container;
        let formData = new FormData();
        formData.append("file", new File([this._mem.code], "temp.dsp"));
        $.ajax({
            url : "https://faustservice.grame.fr/filepost",
            type : "POST",
            data : formData,
            cache : false,
            contentType : false,
            processData : false,
            success : (data, textStatus, jqXHR) => {
                src.attr("src", "https://faustservice.grame.fr/" + data + "/diagram/process.svg");
                this.uiResize();
            },
            error : (jqXHR, textStatus, errorThrown) => {
                this.error("Faust.Diagram", errorThrown);
            }
        })
        return container;
    }
}
export default {
    DSP,
    Diagram
}