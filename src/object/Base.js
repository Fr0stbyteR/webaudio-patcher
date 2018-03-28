import "./Base.css"
import {
    EventEmitter
} from "events";
class BaseObject extends EventEmitter {
    constructor(box, patcher) {
        super();
        this.packageClass = "package-base";
        this.icon = "code";
        this.exportedClass = box.class;
        this._patcher = patcher;
        this.name = box.name;
        this.boxes = [box.id];
        this.inlets = 1;
        this.outlets = 1;
        this.data = {};
    }
    _fn(data, inlet) {
        this.outlet(0, data);
    }
    ui($, box) {
        let content = $("<div />").addClass([this.packageClass, this.packageClass + "-" + this.constructor.name.toLowerCase()]);
        let icon = $("<i />").addClass([this.icon, "icon"]);
        let span = $("<span />").attr({
                "contenteditable": false,
            }).html(box.text)
            .on("click", (e) => {
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
            content.append(icon).append(span);
        return content;
    }
    outlet(i, data) {
        if (i >= this.outlets) return;
        for (let j = 0; j < this.outletLines[i].length; j++) {
            const lineID = this.outletLines[i][j];
            this._patcher.lines[lineID].emit(data);
        }
    }
    destroy() {
        delete this._patcher.data[this.name][this.exportedClass]; //TODO doesnt work class package
    }
    addBox(id) {
        this.boxes.push(id);
        return this;
    }
    removeBox(id) {
        this.boxes.splice(this.boxes.indexOf(id), 1);
        if (this.boxes.length == 0) this.destroy();
        return this;
    }
    update(args, props) {
        return this;
    }
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
    post(title, data) {
        this._patcher.newLog(0, title, data);
    }
    error(title, data) {
        this._patcher.newLog(1, title, data);
    }
    info(title, data) {
        this._patcher.newLog(-2, title, data);
    }
    warn(title, data) {
        this._patcher.newLog(-1, title, data);
    }
    get outletLines() {
        let lines = [];
        for (let i = 0; i < this.outlets; i++) {
            lines[i] = [];
            for (let j = 0; j < this.boxes.length; j++) {
                lines[i] = lines[i].concat(this._patcher.getLinesBySrcID(this.boxes[j], i));

            }
        }
        return lines;
    }
    get inletLines() {
        let lines = [];
        for (let i = 0; i < this.inlets; i++) {
            lines[i] = [];
            for (let j = 0; j < this.boxes.length; j++) {
                lines[i] = lines[i].concat(this._patcher.getLinesByDestID(this.boxes[j], i));
            }
        }
        return lines;
    }
    get class() {
        return this.constructor.name;
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
        this.data.class = box.class;
        // this.ui = UIObj.InvalidBox;
        this.inlets = box.inlets;
        this.outlets = box.outlets;
    }
    _fn(data, inlet) {}
    get class() {
        return this.data.class;
    }
}


class Button extends BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.inlets = 1;
        this.outlets = 1;
        this.data.text = box.props.text || "Bang";
    }
    _fn(data, inlet) {
        this.outlet(0, new Bang());
    }
    ui($, box) {
        return $("<button />")
        .addClass([this.packageClass, this.packageClass + "-" + this.constructor.name.toLowerCase()])
        .addClass(["ui", "mini", "icon", "button"])
        .text(this.data.text).on("click", (e) => {
            this.outlet(0, new Bang());
        });
    }
    update(args, props) {
        if (props.hasOwnProperty("text")) this.data.text = props.text;
    }
}

class Print extends BaseObject {
    constructor(box, patcher) {
        super(box, patcher);
        this.inlets = 1;
        this.outlets = 0;
    }
    _fn(data, inlet) {
        this.post("print", (typeof data == "object" ? data.constructor.name : "") + JSON.stringify(data));
    }
}

class Bang {
    constructor() {}
}

export default {
    EmptyObject,
    InvalidObject,
    BaseObject,
    Bang,
    Button,
    Print
}