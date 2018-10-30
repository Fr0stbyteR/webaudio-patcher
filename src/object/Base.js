/* eslint no-unused-vars: 0 */

import "./Base.css";
import "./Default.css";
import { EventEmitter } from "events";
import * as Util from "util";
import "jquery-ui/ui/widgets/autocomplete.js";
class BaseObject extends EventEmitter {
    static get _meta() {
        return {
            package : "Base", // div will have class "package-name" "package-name-objectname"
            name : this.name,
            icon : "code", // semantic icon to display in UI
            author : "",
            version : "0.0.0",
            description : "",
            inlets : [],
            outlets : [],
            args : [],
            props : []
        };
    }
    constructor(box, patcher) {
        super();
        // copy meta from static
        this._meta = this.constructor._meta;
        // patcher object outside, use _ for pre`vent recursive stringify
        this._patcher = patcher;
        // the box which create this instance, use _ for prevent recursive stringify
        this._box = box;
        // one instance of object can have multiple boxes with same @name
        this._boxes = [box.id];
        // all ui jQuery object, box.id : $ui
        this._uiList = {};
        // inlets and outlets count
        this._inlets = 0;
        this._outlets = 0;
        // data for store and stringify in patch
        this.storage = box.hasOwnProperty("prevData") && box.prevData && box.prevData.hasOwnProperty("storage") ? box.prevData.storage : {};
        // should save all temporary variables here
        this._mem = {};
        // usually do this after initialization
        //this.update(box.args, box.props);
    }
    // when arguments and @properties are changed, can use this in constructor
    update(args, props) {
        return this;
    }
    // main function when receive data from a inlet (base 0)
    fn(data, inlet) {
        return this;
    }
    // called by index.js
    requestUI($, box) { //TODO not working well with some function in ui()
        if (!this._uiList.hasOwnProperty(box.id)) this._uiList[box.id] = this.ui($, box);
        return this._uiList[box.id];
    }
    newUI($, box) {
        this._uiList[box.id] = this.ui($, box);
        return this._uiList[box.id];
    }
    uiUpdate(props) {
        this.emit("uiUpdate", props);
        return this;
    }
    onUIUpdate(handler) {
        this.on("uiUpdate", props => handler(props, this._ui));
        return this;
    }
    // get all ui jquery object in one
    get _ui() {
        let obj = null;
        for (const id in this._uiList) {
            if (!obj) obj = this._uiList[id];
            else obj.add(this._uiList[id]);
        }
        return obj;
    } 
    // build new ui on page, return a div, override this
    ui($, box) {
        return this.defaultUI($, box);
    }
    //  <div class="package-base package-base-button box-ui-container">
    //      <div class="box-ui-text-container">
    //      </div>
    //  </div>
    defaultUI($, box) {
        let packageName = "package-" + this._meta.package.toLowerCase();
        let className = packageName + "-" + this._meta.name.toLowerCase();
        let container = $("<div>").addClass([packageName, className, "box-ui-container", "box-ui-default"]);
        let textContainer = $("<div>").addClass(["box-ui-text-container", "box-ui-default"]);
        let icon = $("<i>").addClass(["small", this._meta.icon, "icon"]);
        let span = $("<span>").attr({
                "contenteditable": false,
            }).html(box.text)
            .on("click", (e) => {
                if (this._patcher.state.locked) return;
                if ($(e.currentTarget).parents(".ui-draggable").hasClass("dragged")) return;
                if ($(e.currentTarget).hasClass("editing")) return;
                $(e.currentTarget).attr("contenteditable", true).addClass("editing").parents(".ui-draggable").draggable("disable");
                let range = document.createRange();
                let selection = window.getSelection();
                range.selectNodeContents($(e.currentTarget)[0]);
                selection.removeAllRanges();
                selection.addRange(range);
            }).on("blur", (e) => {
                $(e.currentTarget).attr("contenteditable", false).removeClass("editing").parents(".ui-draggable").draggable("enable");
                window.getSelection().removeAllRanges();
                if ($(e.currentTarget).text() != box.text) box._patcher.changeBoxText(box.id, $(e.currentTarget).text());
            }).on("keydown", (e) => {
                if ($(e.currentTarget).hasClass("editing")) {
                    if (e.key == "Enter") $(e.currentTarget).blur().parents(".box").focus();
                    e.stopPropagation();
                }
            }).on("paste", (e) => {
                e.preventDefault();
                document.execCommand("insertHTML", false, e.originalEvent.clipboardData.getData("text/plain"));
            })
        textContainer.append(icon).append(span);
        container.append(textContainer);
        container.data("resizeVertical", false);
        return container.ready(() => {
            container.parents(".box").on("keydown", (e) => {
                if (e.key == "Enter") {
                    span.click();
                    e.preventDefault();
                    e.stopPropagation();
                }
            })
            span.autocomplete({
                source : (request, response) => {
                    let results = $.ui.autocomplete.filter(Object.keys(this._patcher._lib), request.term);
                    response(results.slice(0, 32));
                },
                focus: (event, ui) => {
                    span.html(ui.item.label);
                    let range = document.createRange();
                    let selection = window.getSelection();
                    range.selectNodeContents(span[0]);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    return false;
                },
                select: function( event, ui ) {
                    span.html(ui.item.label);
                    let range = document.createRange();
                    let selection = window.getSelection();
                    range.selectNodeContents(span[0]);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    return false;
                  }
            });
            span.autocomplete("instance")._renderItem = (ul, item) => {
                let key = item.label;
                let meta = this._patcher._lib[key]._meta;
                let icon = meta.icon;
                let description = meta.description
                return $("<li>")
                    .append($("<i>").addClass(["small", icon, "icon"]))
                    .append($("<span>").text(key))
                    .append($("<span>").text(description))
                    .appendTo(ul);
            };
            span.autocomplete("instance")._renderMenu = (ul, items) => {
                $(ul).addClass(["ui", "inverted", "striped", "very", "compact", "small", "table"]);
                $.each(items, (index, item) => {
                    span.autocomplete("instance")._renderItemData(ul, item);
                } );
            };
        });
    }
    defaultDropdownUI($, box) {
        let container = this.defaultUI($, box);
        let dropdownContainer = $("<div>").addClass(["box-ui-dropdown-container", "box-ui-default"]);
        let dropdownIcon = $("<i>").addClass(["small", "dropdown", "icon", "box-ui-toggle"]).on("click", (e) => {
            let parent = container.parents(".box");
            if (dropdownContainer.children().is(":visible")) {
                parent.data("prevHeight", parent.height()).height("auto");
                dropdownContainer.children().slideUp(100, () => {
                    container.data("resizeVertical", false);
                    this.uiResize();
                });
            } else {
                parent.height(parent.data("prevHeight"));
                dropdownContainer.children().slideDown(100, () => {
                    container.data("resizeVertical", true);
                    this.uiResize();
                });
            }
        });
        container.append(dropdownContainer)
        .find(".box-ui-text-container").append(dropdownIcon);
        container.data("resizeVertical", true);
        container.data("resizeMinHeight", 22);
        return container;
    }
    uiRedraw() {
        this._patcher.redrawBox(this._box);
        return this;
    }
    uiResize() {
        this._patcher.resizeBox(this._box);
        return this;
    }
    // use this function to output data with ith outlet.
    outlet(i, data) {
        if (i >= this._outlets) return this;
        let outletLines = this.outletLines[i].sort((id1, id2) => {
            return this._patcher.lines[id2].positionHash - this._patcher.lines[id1].positionHash;
        });
        for (let j = 0; j < outletLines.length; j++) {
            const lineID = outletLines[j];
            this._patcher.lines[lineID].emit(data);
        }
        return this;
    }
    destroy() {
        delete this._patcher.data[this._box.name][this._box.class]; //TODO doesnt work class package
        return this;
    }
    addBox(id) {
        if (this._boxes.indexOf(id) == -1) this._boxes.push(id);
        return this;
    }
    removeBox(id) {
        // remove this box from boxes list, if is last one, destroy instance
        this._boxes.splice(this._boxes.indexOf(id), 1);
        delete this._uiList[id];
        if (this._boxes.length == 0) this.destroy();
        return this;
    }
    // called when inlet or outlet are connected or disconnected
    connectedOutlet(outlet, destObj, destInlet, lineID) {
        return this;
    }
    connectedInlet(inlet, srcObj, srcOutlet, lineID) {
        return this;
    }
    disconnectedOutlet(outlet, destObj, destInlet, lineID) {
        return this;
    }
    disconnectedInlet(inlet, srcObj, srcOutlet, lineID) {
        return this;
    }
    // output to console
    post(data) {
        this._patcher.newLog(0, this._meta.name, data);
        return this;
    }
    error(data) {
        this._patcher.newLog(1, this._meta.name, data);
        return this;
    }
    info(data) {
        this._patcher.newLog(-2, this._meta.name, data);
        return this;
    }
    warn(data) {
        this._patcher.newLog(-1, this._meta.name, data);
        return this;
    }
    get outletLines() {
        let lines = [];
        for (let i = 0; i < this._outlets; i++) {
            lines[i] = [];
            for (let j = 0; j < this._boxes.length; j++) {
                lines[i] = lines[i].concat(this._patcher.getLinesBySrcID(this._boxes[j], i));

            }
        }
        return lines;
    }
    get inletLines() {
        let lines = [];
        for (let i = 0; i < this._inlets; i++) {
            lines[i] = [];
            for (let j = 0; j < this._boxes.length; j++) {
                lines[i] = lines[i].concat(this._patcher.getLinesByDestID(this._boxes[j], i));
            }
        }
        return lines;
    }
    get class() {
        return this.constructor.name;
    }
    get importedClass() {
        return this._box.class;
    }
    isOutletTo(outlet, obj, inlet) {
        let outletLines = this.outletLines[outlet];
        for (let i = 0; i < outletLines.length; i++) {
            const line = this._patcher.lines[outletLines[i]];
            if (line.destObj == obj && line.destInlet == inlet) return true;
        }
        return false;
    }
    isInletFrom(inlet, obj, outlet) {
        let inletLines = this.inletLines[inlet];
        for (let i = 0; i < inletLines.length; i++) {
            const line = this._patcher.lines[inletLines[i]];
            if (line.srcObj == obj && line.srcOutlet == outlet) return true;
        }
        return false;
    }
}

class EmptyObject extends BaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            author : "Fr0stbyteR",
            version : "1.0.0",
            description : "Bypass input",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "output same thing"
            }],
            outlets : [{
                type : "anything",
                description : "output same thing"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 1;
    }
    fn(data, inlet) {
        this.outlet(0, data);
        return this;
    }
}

class InvalidObject extends BaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "invalid object",
            inlets : [{
                isHot : false,
                type : "anything",
                description : "nothing"
            }],
            outlets : [{
                type : "anything",
                description : "nothing"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.class = box.class;
        this._inlets = box._inlets;
        this._outlets = box._outlets;
    }
    get class() {
        return this._mem.class;
    }
}

class Button extends EmptyObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "click to output a new Bang",
            inlets : [{
                isHot : false,
                type : "anything",
                description : "output a new Bang"
            }],
            outlets : [{
                type : "object",
                description : "new Bang"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 1;
        this._mem.text = box.props.text || "Bang";
    }
    fn(data, inlet) {
        this.outlet(0, new Bang());
    }
    ui($, box) {
        let pkgName = this._meta.package.toLowerCase();
        let clsName = this._meta.name.toLowerCase();
        return $("<div>")
            .addClass(["package-" + pkgName, "package-" + pkgName + "-" + clsName])
            .addClass(["ui", "small", "button"])
            .text(this._mem.text).on("click", (e) => {
                this.outlet(0, new Bang());
            });
    }
    update(args, props) {
        if (props.hasOwnProperty("text")) this._mem.text = props.text;
    }
}

class Print extends EmptyObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "JSON.stringify anything and print it in console",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "output stored data"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 0;
    }
    fn(data, inlet) {
        if (typeof data == "object") this.post(data.constructor.name + Util.inspect(data));
        else this.post(Util.inspect(data));
    }
}

class Message extends EmptyObject {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "JSON.parse a message and store it, click to output, second input to set it",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "output stored data"
            }, {
                isHot : false,
                type : "anything",
                description : "store and display data incoming"
            }],
            outlets : [{
                type : "anything",
                description : "output stored data"
            }]
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 2;
        this._outlets = 1;
        this._mem.buffer = null;
        if (!this.storage.hasOwnProperty("text")) {
            this.storage.text = box.args && box.args[0] ? box.args[0] : "";
            if (typeof this.storage.text !== "string") this.storage.text = Util.inspect(this.storage.text);
        }
        this.update([this.storage.text]);
    }
    fn(data, inlet) {
        if (inlet == 0) {
            this.outlet(0, this._mem.buffer);
            return this;
        }
        if (inlet == 1) {
            this.update([Util.inspect(data)]);
            return this;
        }
    }
    ui($, box) {
        let packageName = "package-" + this._meta.package.toLowerCase();
        let className = packageName + "-" + this._meta.name.toLowerCase();
        let container = $("<div>").addClass([packageName, className, "box-ui-container"]);
        let textContainer = $("<div>").addClass(["box-ui-text-container", "ui", "mini", "button"]).attr({
                "contenteditable": false,
            }).html(this.storage.text)
            .on("click", (e) => {
                if (this._patcher.state.locked) {
                    this.outlet(0, this._mem.buffer);
                    return;
                }
                if ($(e.currentTarget).parents(".ui-draggable").hasClass("dragged")) return;
                if ($(e.currentTarget).hasClass("editing")) return;
                $(e.currentTarget).attr("contenteditable", true).addClass("editing").parents(".ui-draggable").draggable("disable");
                let range = document.createRange();
                let selection = window.getSelection();
                range.selectNodeContents($(e.currentTarget)[0]);
                selection.removeAllRanges();
                selection.addRange(range);
            }).on("blur", (e) => {
                $(e.currentTarget).attr("contenteditable", false).removeClass("editing").parents(".ui-draggable").draggable("enable");
                window.getSelection().removeAllRanges();
                if ($(e.currentTarget).text() != this.storage.text) this.update([$(e.currentTarget).text()]);
            }).on("keydown", (e) => {
                if ($(e.currentTarget).hasClass("editing")) {
                    if (e.key == "Enter") $(e.currentTarget).blur().parents(".box").focus();
                    e.stopPropagation();
                }
            }).on("paste", (e) => {
                e.preventDefault();
                document.execCommand("insertHTML", false, e.originalEvent.clipboardData.getData("text/plain"));
            });
        container.append(textContainer);
        container.data("resizeVertical", false);
        let uiUpdateHandler = (props, $box) => {
            if (props.hasOwnProperty("text")) {
                textContainer.html(props.text);
                this.uiResize();
            }
        }
        return container.ready(() => {
            uiUpdateHandler(this.storage);
            this.onUIUpdate(uiUpdateHandler);
            container.parents(".box").on("keydown", (e) => {
                if (e.key == "Enter") {
                    textContainer.click();
                    e.preventDefault();
                    e.stopPropagation();
                }
            })
        });
    }
    update(args, props) {
        if (args && typeof args[0] === "string") {
            this.storage.text = args[0];
            this._box.args = args;
            this.uiUpdate({text : args[0]});
            try {
                this._mem.buffer = JSON.parse(args[0]);
            } catch (e) {
                this._mem.buffer = args[0];
            }
        }
    }
}

class Bang {}

class Utils {
    static toNumber(data) {
        try {
            return +data;
        } catch (e) {
            try {
                return parseFloat(data);
            } catch (e) {
                return null;
            }
        }
    }
    static toString(data) {
        if (typeof data == "string") return data;
        try {
            return JSON.stringify(data);
        } catch (e) {
            return null;
        }
    }
    static toArray(data) {  
        if (Array.isArray(data)) return data;
        else {
            try {
                let parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return parsed;
                else return [data];
            } catch (e) {
                return [data];
            }
        }
    }
    static isNumber(data) {
        return this.toNumber(data) !== null;
    }
    static isString(data) {
        return this.toString(data) !== null
    }
    static list2Array(data) {
        if (Array.isArray(data)) return data;
        try {
            let parsed = JSON.parse(data);
            if (Array.isArray(parsed)) return parsed;
            else return [data];
        } catch (e) {
            try {
                const REGEX = /"([^"]*)"|[^\s]+/gi;
                let strArray = [];
                let match = REGEX.exec(data);
                while (match != null) {
                    //Index 1 in the array is the captured group if it exists
                    //Index 0 is the matched text, which we use if no captured group exists
                    strArray.push(match[1] ? match[1] : match[0]);
                    //Each call to exec returns the next regex match as an array
                    match = REGEX.exec(data);
                }
                return strArray;
            } catch (e) {
                return null;
            }
        }
    }
}

export default {
    EmptyObject,
    InvalidObject,
    BaseObject,
    Bang,
    Button,
    Message,
    Print,
    "print" : Print,
    Utils
}