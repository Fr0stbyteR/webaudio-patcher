import Base from "../Base.js";
import Faust from "./webaudio-wasm-wrapper.js";
import CodeMirror from "codemirror";
import "./Faust.css";
import "codemirror/theme/darcula.css";
import "codemirror/lib/codemirror.css";
import "./codemirror/mode/faust/faust.js";
import "jquery-ui/ui/widgets/slider.js";
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
    static get _meta() {
        return Object.assign(super._meta, {
            package : "Faust",
            icon : "terminal", 
            author : "Fr0stbyteR",
            version : "1.0.0"
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
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
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Edit and compile a faust dsp file using WebAudio API",
            inlets : [{
                isHot : true,
                type : "signal",
                description : "WebAudio Node input"
            }],
            outlets : [{
                type : "signal",
                description : "WebAudio Node output"
            }, {
                type : "object",
                description : "dumpout with { code: string, params: object, node: object }"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 2;
        if (!this.storage.hasOwnProperty("showEditor")) this.storage.showEditor = true;
        if (!this.storage.hasOwnProperty("code")) this.storage.code = "";
        this._mem.compileArgs = {
            poly : false,
            ftz : 2,
            voices : 16,
            useWorklet : false,
            libraries : "https://faust.grame.fr/editor/libraries/",
            bufferSize : 256
        }
        this._mem.argsChanged = true;
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
                this.error("Compilation of Node failed " + Faust.getErrorMessage());
                return;
            }
            if (this._mem.node && this._mem.node instanceof AudioNode) this.disconnectAll();
            this._mem.node = node;
            this._mem.params = JSON.parse(node.getJSON());
            this.outlet(1, {code : this.storage.code, params : this._mem.params, node : this._mem.node});
            this.connectAll();
            this._mem.compiled = true;
            this._mem.argsChanged = false;
            this.uiUpdate(this.storage);
            this.uiUpdate(this._mem);
        }
        let updateCode = (code) => {
            if (this._mem.compiled && (code == this.storage.code) && !this._mem.argsChanged) return;
            if (!code) {
                this.error("Don't understand" + args[0]);
                return;
            } 
            this.storage.code = code;
            let args = this._mem.compileArgs;
            let argv = ["-ftz", args.ftz, "-I", args.libraries];
            if (args.poly) {
                Faust.createPolyDSPFactory(code, argv, (factory) => {
                    if (!factory) {
                        this.error("Compilation of Factory failed " + Faust.getErrorMessage());
                        return;
                    }
                    if (args.useWorklet) {
                        Faust.createPolyDSPWorkletInstance(factory, this._patcher._audioCtx, args.voices, nodeReady);
                    } else {
                        Faust.createPolyDSPInstance(factory, this._patcher._audioCtx, args.bufferSize, args.voices, nodeReady);
                    }
                });
            } else {
                Faust.createDSPFactory(code, argv, (factory) => {
                    if (!factory) {
                        this.error("Compilation of Factory failed " + Faust.getErrorMessage());
                        return;
                    }
                    if (args.useWorklet) {
                        Faust.createDSPWorkletInstance(factory, this._patcher._audioCtx, nodeReady);
                    } else {
                        Faust.createDSPInstance(factory, this._patcher._audioCtx, args.bufferSize, nodeReady);
                    }
                });
            }
        }
        if (props && props.hasOwnProperty("bufferSize")) {
            let bufferSize = Base.Utils.toNumber(props.bufferSize);
            if (bufferSize === null) {
                this.error("Don't understand" + args[0]);
            } else {
                this._mem.compileArgs.bufferSize = bufferSize < 256 ? 256 : bufferSize;
                this._mem.argsChanged = true;
            }
        } else {
            this._mem.compileArgs.bufferSize = 256;
            this._mem.argsChanged = true;
        }
        if (props && props.hasOwnProperty("poly")) {
            let poly = props.poly ? true : false;
            if (poly !== this._mem.compileArgs.poly) {
                this._mem.compileArgs.poly = poly;
                this._mem.argsChanged = true;
            }
        } else {
            this._mem.compileArgs.poly = false;
            this._mem.argsChanged = true;
        }
        if (props && props.hasOwnProperty("voices")) {
            let voices = Base.Utils.toNumber(parseInt(props.voices));
            if (voices === null) {
                this.error("Don't understand" + args[0]);
            } else {
                this._mem.compileArgs.voices = voices < 1 ? 1 : voices;
                this._mem.argsChanged = true;
            }
        } else {
            this._mem.compileArgs.voices = 4;
            this._mem.argsChanged = true;
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
    fn(data, inlet) {
        if (data && typeof data === "object" && inlet == 0) {
            for (const k in data) {
                if (data.hasOwnProperty(k)) {
                    const v = data[k];
                    this._mem.node.setParamValue(k, v);
                }
            }
        }
    }
    ui($, box) {
        let _faustUIList = {};
        let _genFaustUI = ($, parent, items) => {
            _faustUIList = {};
            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                let uiItem = $("<div>").addClass("faust-ui-item");
                let $ui;
                switch (item.type) {
                    case "button":
                        uiItem.attr("data-address", item.address).data("faustUIItem", item).addClass("faust-ui-button").append(
                            $("<button>").addClass(["ui", "basic", "mini", "button", "faust-button"])
                            .html(item.label)
                            .on("mousedown", () => {
                                this._mem.node.setParamValue(item.address, 1);
                            }).on("mouseup", () => {
                                this._mem.node.setParamValue(item.address, 0);
                            })
                        )
                        break;
                    case "checkbox":
                        uiItem.attr("data-address", item.address).data("faustUIItem", item).addClass(["ui", "toggle", "checkbox", "faust-ui-checkbox"])
                        .append($("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label))
                        .append($("<input>").attr("type", "checkbox").attr("name", item.label))
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
                        $ui = $("<div>");
                        $ui.attr({
                            "data-tooltip" : +item.init,
                            "data-inverted" : "",
                            "data-position" : "left center"
                        }).slider({
                            value : +item.init,
                            min : +item.min,
                            max : +item.max,
                            step : +item.step,
                            slide : (e, ui) => {
                                this._mem.node.setParamValue(item.address, ui.value);
                                $ui.attr("data-tooltip", ui.value);
                            }
                        });
                        uiItem.attr("data-address", item.address).data("faustUIItem", item).addClass("faust-ui-hslider").append(
                            $("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label)
                        ).append($ui);
                        break;
                    case "vslider":
                        $ui = $("<div>");
                        $ui.attr({
                            "data-tooltip" : +item.init,
                            "data-inverted" : "",
                            "data-position" : "right center"
                        }).slider({
                            orientation : "vertical",
                            value : +item.init,
                            min : +item.min,
                            max : +item.max,
                            step : +item.step,
                            slide : (e, ui) => {
                                this._mem.node.setParamValue(item.address, ui.value);
                                $ui.attr("data-tooltip", ui.value);
                            }
                        });
                        uiItem.attr("data-address", item.address).data("faustUIItem", item).addClass("faust-ui-vslider").append(
                            $("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label)
                        ).append($ui);
                        break;
                    case "nentry":
                        $ui = $("<div>");
                        $ui.attr({
                            "data-tooltip" : +item.init,
                            "data-inverted" : "",
                            "data-position" : "left center"
                        }).slider({
                            value : +item.init,
                            min : +item.min,
                            max : +item.max,
                            step : +item.step,
                            slide : (e, ui) => {
                                this._mem.node.setParamValue(item.address, ui.value);
                                $ui.attr("data-tooltip", ui.value);
                            }
                        });
                        uiItem.attr("data-address", item.address).data("faustUIItem", item).addClass("faust-ui-hslider").append(
                            $("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label)
                        ).append($ui);
                        break;
                    case "hbargraph":
                        uiItem.attr("data-address", item.address).data("faustUIItem", item).addClass("faust-ui-hbargraph").append(
                            $("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label)
                        ).append(
                            $("<div>").addClass(["ui", "progress"]).append(
                                $("<div>").addClass("bar").append(
                                    $("<div>").addClass("progress").html(
                                        0
                                    )
                                )
                            )
                        );
                        break;
                    case "vbargraph":
                        uiItem.attr("data-address", item.address).data("faustUIItem", [item.min, item.max]).addClass("faust-ui-vbargraph").append(
                            $("<div>").addClass(["ui", "horizontal", "label", "faust-ui-label"]).html(item.label)
                        ).append(
                            $("<div>").addClass(["ui", "progress"]).append(
                                $("<div>").addClass("bar").append(
                                    $("<div>").addClass("progress").html(
                                        0
                                    )
                                )
                            )
                        );
                        break;
                    case "vgroup":
                        uiItem.addClass(["ui", "segment", "faust-ui-group", "faust-ui-vgroup"]).data("faustUIItem", item).append(
                            $("<div>").addClass(["ui", "left", "top", "attached", "label", "faust-ui-label"]).html(item.label)
                        );
                        _genFaustUI($, uiItem, item.items);
                        break;
                    case "hgroup":
                        uiItem.addClass(["ui", "segment", "faust-ui-group", "faust-ui-hgroup"]).data("faustUIItem", item).append(
                            $("<div>").addClass(["ui", "left", "top", "attached", "label", "faust-ui-label"]).html(item.label)
                        );
                        _genFaustUI($, uiItem, item.items);
                    break;
                    case "tgroup":
                        uiItem.addClass(["ui", "segment", "faust-ui-group", "faust-ui-tgroup"]).data("faustUIItem", item).append(
                            $("<div>").addClass(["ui", "left", "top", "attached", "label", "faust-ui-label"]).html(item.label)
                        );
                        _genFaustUI($, uiItem, item.items);
                        break;
                    default:
                        break;
                }
                parent.append(uiItem);
                _faustUIList[item.address] = uiItem;
            }
            return parent;
        }
        let textarea = $("<textarea>").html(this.storage.code ? this.storage.code : box.args.length ? box.args[0] : "");
        let editor = $("<div>").addClass(["dsp-editor"]).append(textarea);
        let faustUI = $("<div>").addClass(["faust-ui"]);
        let container = super.defaultDropdownUI($, box);
        container.find(".box-ui-dropdown-container").append(faustUI).append(editor);
        container.find(".box-ui-toggle").on("click", (e) => {
            this.storage.showEditor = !this.storage.showEditor;
        });
        let uiUpdateHandlerUI = (props, $box) => {
            if (props.params && props.params.hasOwnProperty("ui") && props.params.ui.length) {
                faustUI.empty();
                let faustUITabular = $("<div>").addClass(["ui", "bottom", "attached", "tabular", "mini", "menu"]);
                for (let i = 0; i < props.params.ui.length; i++) {
                    const group = props.params.ui[i];
                    faustUITabular.append(
                        $("<a>").addClass(["item", i == 0 ? "active" : ""])
                        .attr("data-tab", i).html(group.label)
                    );
                    let tab = $("<div>").addClass(["faust-ui-group", "ui", "top", "attached", "tab", "segment", i == 0 ? "active" : ""]);
                    
                    faustUI.append(_genFaustUI($, tab, group.items));
                }
                this._mem.node.setOutputParamHandler((address, value) => {
                    if (!_faustUIList.hasOwnProperty(address)) return;
                    if (isNaN(value)) value = 0;
                    let uiItem = _faustUIList[address];
                    if (uiItem.hasClass("faust-ui-checkbox")) {
                        if (uiItem.data("faustUIValue") == value || Math.abs(uiItem.data("faustUIValue") - value) <= 0.01) return;
                        uiItem.data("faustUIValue", value);
                        uiItem.find("input").checkbox(value ? "set checked" : "set unchecked");
                    }
                    if (uiItem.hasClass("faust-ui-hslider") || uiItem.hasClass("faust-ui-vslider") || uiItem.hasClass("faust-ui-nentry")) {
                        if (uiItem.data("faustUIValue") == value || Math.abs(uiItem.data("faustUIValue") - value) <= 0.01) return;
                        uiItem.data("faustUIValue", value);
                        uiItem.find(".ui-slider").slider("option", value);
                    }
                    if (uiItem.hasClass("faust-ui-hbargraph") || uiItem.hasClass("faust-ui-vbargraph")) {
                        if (uiItem.data("faustUIValue") == value || Math.abs(uiItem.data("faustUIValue") - value) <= 0.01) return;
                        uiItem.data("faustUIValue", value);
                        let range = [uiItem.data("faustUIItem").min, uiItem.data("faustUIItem").max];
                        let percentage = (1 - value / (range[1] - range[0])) * 100 + "%";
                        uiItem.find(".ui.progress .bar").css("padding-right", percentage).find(".progress").html(Number.parseFloat(value).toFixed(2));
                    }
                });
                faustUI.append(faustUITabular);
                let codeHeight = editor.find(".CodeMirror-sizer").height();
                container.data("resizeMinHeight", 28 + faustUI.height() + (codeHeight > 120 ? 120 : codeHeight));
                this.uiResize();
            }
        }
        container.ready(() => {
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
                this.update([cm.getValue()], this._mem.compileArgs);
                if (this._patcher.state.locked) return;
                editor.removeClass("editing")
                    .parents(".ui-draggable").draggable("enable");
            });
            cm.on("keydown", (cm, e) => {
                e.stopPropagation();
            });
            uiUpdateHandlerUI(this._mem);
            this.onUIUpdate(uiUpdateHandlerUI);
            let uiUpdateHandlerCode = (props, $box) => {
                if (props.hasOwnProperty("code") && props.code) {
                    cm.setValue(props.code);
                    let codeHeight = editor.find(".CodeMirror-sizer").height();
                    container.data("resizeMinHeight", 28 + faustUI.height() + (codeHeight > 120 ? 120 : codeHeight));
                    this.uiResize();
                }
            }
            uiUpdateHandlerCode(this.storage);
            this.onUIUpdate(uiUpdateHandlerCode);
            if (!this.storage.showEditor) {
                container.find(".box-ui-toggle").click();
            }
        });
        return container;
    }
}

class Diagram extends FaustObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Show faust diagram in iframe",
            inlets : [{
                isHot : true,
                type : "object",
                description : "Parse inlet code property { code: string }"
            }],
            outlets : []
        });
    }
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
            this.uiUpdate(this._mem);
        }
    }
    ui($, box) {
        let src = $("<iframe>").addClass("faust-diagram").css("width", "100%").css("height", "auto").css("border", "0px");
        let container = super.defaultDropdownUI($, box);
        container.find(".box-ui-dropdown-container").append(src);
        let uiUpdateHandler = (props, $box) => {
            if (props.hasOwnProperty("code") && props.code) {
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
                        container.data("resizeMinHeight", 120);
                        this.uiResize();
                    },
                    error : (jqXHR, textStatus, errorThrown) => {
                        this.error(errorThrown);
                    }
                })
            }
        }
        return container.ready(() => {
            uiUpdateHandler(this._mem);
            this.onUIUpdate(uiUpdateHandler);
        });
    }
}
export default {
    DSP,
    Diagram
}