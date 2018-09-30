/* eslint no-unused-vars: 0 */
import "./Base.css";
import "./Default.css";
import {
    EventEmitter
} from "events";
class BaseObject extends EventEmitter {
    constructor(box, patcher) {
        super();
        // define name of package of this prototype object class, usage in UI object, see below 
        // div will have class "package-name" "package-name-objectname"
        this._package = "base";
        // semantic icon to display in UI
        this._icon = "code";
        // patcher object outside, use _ for prevent recursive stringify
        this._patcher = patcher;
        // the box which create this instance, use _ for prevent recursive stringify
        this._box = box;
        // one instance of object can have multiple boxes with same @name
        this._boxes = [box.id];
        // inlets and outlets count
        this._inlets = 1;
        this._outlets = 1;
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
    // main function when receive data from a inlet (base 0);
    fn(data, inlet) {
        this.outlet(0, data);
    }
    // build ui on page, return a div
    ui($, box) {
        return this.defaultUI($, box);
    }
    //  <div class="package-base package-base-button box-ui-container">
    //      <div class="box-ui-text-container">
    //      </div>
    //  </div>
    defaultUI($, box) {
        let packageName = "package-" + this._package;
        let className = "package-" + this._package + "-" + this.constructor.name.toLowerCase();
        let textContainer = $("<div>").addClass(["box-ui-text-container", "box-ui-default"]);
        let icon = $("<i>").addClass([this._icon, "icon"]);
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
                    if (e.key == "Delete" || e.key == "Backspace") e.stopPropagation();
                }
            });
        textContainer.append(icon).append(span);
        let container = $("<div>").addClass([packageName, className, "box-ui-container", "box-ui-default"]);
        container.append(textContainer);
        container.data("resizeHandles", "e, w");
        return container;
    }
    defaultDropdownUI($, box) {
        let dropdownContainer = $("<div>").addClass(["box-ui-dropdown-container", "box-ui-default"]);
        let dropdownIcon = $("<i>").addClass(["dropdown", "icon", "box-ui-toggle"]).on("click", (e) => {
            dropdownContainer.children().slideToggle(100, () => {
                this._patcher.resizeBox(box);
            });
        });
        let container = this.defaultUI($, box);
        container.append(dropdownContainer)
        .find(".box-ui-text-container").append(dropdownIcon);
        return container;
    }
    uiRefresh() {
        this._patcher.uiRefresh(this._box);
        return this;
    }
    // use this function to output data with ith outlet.
    outlet(i, data) {
        if (i >= this._outlets) return;
        for (let j = 0; j < this.outletLines[i].length; j++) {
            const lineID = this.outletLines[i][j];
            this._patcher.lines[lineID].emit(data);
        }
    }
    destroy() {
        delete this._patcher.data[this._box.name][this._box.class]; //TODO doesnt work class package
    }
    addBox(id) {
        this._boxes.push(id);
        return this;
    }
    removeBox(id) {
        // remove this box from boxes list, if is last one, destroy instance
        this._boxes.splice(this._boxes.indexOf(id), 1);
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
    post(title, data) {
        this._patcher.newLog(0, title, data);
        return this;
    }
    error(title, data) {
        this._patcher.newLog(1, title, data);
        return this;
    }
    info(title, data) {
        this._patcher.newLog(-2, title, data);
        return this;
    }
    warn(title, data) {
        this._patcher.newLog(-1, title, data);
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
    constructor(box, patcher) {
        super(box, patcher);
    }
}

class InvalidObject extends BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.class = box.class;
        // this.ui = UIObj.InvalidBox;
        this._inlets = box._inlets;
        this._outlets = box._outlets;
    }
    fn(data, inlet) {}
    get class() {
        return this._mem.class;
    }
}


class Button extends BaseObject {
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
        return $("<button>")
        .addClass(["package-" + this._package, "package-" + this._package + "-" + this.constructor.name.toLowerCase()])
        .addClass(["ui", "mini", "icon", "button"])
        .text(this._mem.text).on("click", (e) => {
            this.outlet(0, new Bang());
        });
    }
    update(args, props) {
        if (props.hasOwnProperty("text")) this._mem.text = props.text;
    }
}

class Print extends BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 0;
    }
    fn(data, inlet) {
        if (typeof data == "object") this.post("print", data.constructor.name + JSON.stringify(data));
        else this.post("print", JSON.stringify(data));
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
    Print,
    Utils
}