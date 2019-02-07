import { EventEmitter } from "events";
import * as Util from "util";
import Base from "./object/Base.js";
import WA from "./object/WA.js";
import JS from "./object/JS.js";
import JSOp from "./object/JSOp.js";
import JSArray from "./object/JSArray.js";
import WebAPI from "./object/WebAPI.js";
import Max from "./object/max/Max.js";
import Faust from "./object/faust/Faust.js";
import E from "./object/Events.js";
import Xebra from "./object/Xebra.js";
import AutoImporter from "./object/AutoImporter.js";
import * as TF from "@tensorflow/tfjs";
import * as MM from "@magenta/music";
let Packages = {
    Base,
    WA,
    JS,
    JSOp,
    Max,
    Faust,
    E,
    Xebra,
    Array : JSArray,
    WebAPI : WebAPI,
    TF : AutoImporter.importer("TF", TF, 2),
    MM : AutoImporter.importer("MM", MM, 2)
};

export default class Patcher extends EventEmitter {
    constructor(patcher) {
        super();
        this.load(patcher);
        this.observeHistory();
    }

    load(patcher) {
        this.lines = {};
        this.boxes = {};
        this.data = {};
        this._log = [];
        this._history = new History(this);
        this._lib = {};
        this._packages = Packages;
        this._sharedMemory = new SharedMemory();
        this.packageRegister(Packages);
        if (this.hasOwnProperty("_audioCtx") && this._audioCtx) this._audioCtx.close();
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this._audioCtx.onstatechange = () => {
            this.emit("audioCtxState", this._audioCtx.state);
        }
        this.emit("resetPatcher", this);
        // Patcher
        this.state = {
            locked : true,
            presentation : false,
            showGrid : true,
        }
        this._prevData = (patcher && patcher.hasOwnProperty("data")) ? patcher.data : null;
        this.boxIndexCount = (patcher && patcher.hasOwnProperty("boxIndexCount")) ? patcher.boxIndexCount : 0;
        this.lineIndexCount = (patcher && patcher.hasOwnProperty("lineIndexCount")) ? patcher.lineIndexCount : 0;
        this.bgcolor = (patcher && patcher.hasOwnProperty("bgcolor")) ? patcher.bgcolor : [61, 65, 70, 1];
        this.editing_bgcolor = (patcher && patcher.hasOwnProperty("editing_bgcolor")) ? patcher.editing_bgcolor : [82, 87, 94, 1];
        this.grid = (patcher && patcher.hasOwnProperty("grid")) ? patcher.grid : [15, 15];
        // Boxes & data
        if (patcher && patcher.hasOwnProperty("boxes")) {
            for (const id in patcher.boxes) {
                this.createBox(patcher.boxes[id]);
            }
        }
        // Lines
        if (patcher && patcher.hasOwnProperty("lines")) {
            for (const id in patcher.lines) {
                this.createLine(patcher.lines[id]);
            }
        }
        this.emit("patcherLoaded", this);
        return this;
    }

    render() {
        this.emit("resetPatcher", this);
        for (const id in this.boxes) {
            this.emit("createBox", this.boxes[id]);
        }
        for (const id in this.lines) {
            this.emit("createLine", this.lines[id]);
        }
        this.emit("patcherLoaded", this);
        return this;
    }

    static fromMaxPatcher(maxPatcher) {
        let rgbaMax2Css = (arr) => {
            let res = [];
            for (let i = 0; i < 3; i++) {
                res[i] = parseInt(arr[i] * 255);
            }
            if (arr.length == 4) res[3] = arr[3];
            return res;
        }
        let maxBoxes = maxPatcher.patcher.boxes;
        let maxLines = maxPatcher.patcher.lines;

        let patcher = {
            lines: {},
            boxes: {},
            data: {}
        };
        
        patcher.bgcolor = rgbaMax2Css(maxPatcher.patcher.bgcolor);
        patcher.editing_bgcolor = rgbaMax2Css(maxPatcher.patcher.editing_bgcolor);
        patcher.grid = maxPatcher.patcher.gridsize;
        patcher.boxIndexCount = 0;
        patcher.lineIndexCount = 0;
        for (let i = 0; i < maxLines.length; i++) {
            let lineArgs = maxLines[i]["patchline"];
            let line = {
                src: [lineArgs.source[0].replace(/obj/, "box"), lineArgs.source[1]],
                dest: [lineArgs.destination[0].replace(/obj/, "box"), lineArgs.destination[1]]
            };
            let id = "line-" + ++patcher.lineIndexCount;
            line.id = id;
            patcher.lines[id] = line;
        }

        for (let i = 0; i < maxBoxes.length; i++) {
            let maxBox = maxBoxes[i]["box"];
            let numID = maxBox.id.match(/\d+/)[0];
            if (numID > patcher.boxIndexCount) patcher.boxIndexCount = numID;
            let id = "box-" + numID;
            let box = {
                id: id,
                inlets: maxBox.numinlets,
                outlets: maxBox.numoutlets,
                patching_rect: maxBox.patching_rect,
                text: (maxBox.maxclass == "newobj" ? "" : maxBox.maxclass + " ") + (maxBox.text ? maxBox.text : "")
            }
            patcher.boxes[id] = box;
        }
        return patcher;
    }

    packageRegister(pkg, path, count) {
        for (const key in pkg) {
            const el = pkg[key];
            if (typeof el === "object") {
                const full = path ? path + "." + key : key;
                this.packageRegister(el, full);
            } else if (typeof el === "function" && el.prototype instanceof Packages.Base.BaseObject) {
                const full = path ? path + "." + key : key;
                if (!this._lib.hasOwnProperty(key)) this._lib[key] = el;
                if (this._lib.hasOwnProperty(full)) this.newLog(1, "Patcher", "Path duplicated, cannot register " + full);
                else this._lib[full] = el;
                count++;
            } else continue;
        }
        return count;
    }

    createBox(props) {
        if (!props.hasOwnProperty("id")) props.id = "box-" + ++this.boxIndexCount;
        let box = new Box(props, this);
        this.boxes[box.id] = box;
        box.init();
        this.emit("createBox", box);
        return box;
    }

    changeBoxText(id, text) {
        let oldText = this.boxes[id].text;
        this.boxes[id].changeText(text);
        this.newTimestamp();
        this.emit("changeBoxText", this.boxes[id], oldText, text);
        return this.boxes[id];
    }

    deleteBox(id) {
        let box = this.boxes[id];
        box.destroy();
        this.emit("deleteBox", box);
        return box;
    }

    createLine(props) { //{src[], dest[]}
        if (!this.canCreateLine(props)) return;
        if (!props.hasOwnProperty("id")) props.id = "line-" + ++this.lineIndexCount;
        let line = new Line(props, this);
        this.lines[line.id] = line;
        line.enable();
        this.emit("createLine", line);
        return line;
    }
    
    canCreateLine(props) {
        if (props.src[1] >= this.boxes[props.src[0]].outlets) return false;
        if (props.dest[1] >= this.boxes[props.dest[0]].inlets) return false;
        if (this.getLinesByIO(props.src[0], props.dest[0], props.src[1], props.dest[1]).length > 0) return false;
        return true;
    }

    changeLineSrc(id, srcID, srcOutlet) {
        let line = this.lines[id];
        if (this.getLinesByIO(srcID, line.dest[0], srcOutlet, line.dest[1]).length > 0) {
            this.emit("redrawLine", line);
            return line;
        }
        let oldSrc = line.src;
        let src = [srcID, srcOutlet]
        line.setSrc(src);
        this.newTimestamp();
        this.emit("changeLineSrc", line, oldSrc, src);
        this.emit("changeLine", line, true, oldSrc, src);
        return line;
    }

    changeLineDest(id, destID, destOutlet) {
        let line = this.lines[id];
        if (this.getLinesByIO(line.src[0], destID, line.dest[1], destOutlet).length > 0) {
            this.emit("redrawLine", line);
            return line;
        }
        let oldDest = line.dest;
        let dest = [destID, destOutlet];
        line.setDest(dest);
        this.newTimestamp();
        this.emit("changeLineDest", line, oldDest, dest);
        this.emit("changeLine", line, false, oldDest, dest);
        return line;
    }

    deleteLine(id) {
        let line = this.lines[id];
        line.destroy(id);
        this.emit("deleteLine", line);
        return line;
    }

    resizeBox(box) {
        this.emit("resizeBox", box);
        return this;
    }

    updateBoxRect(id, rect) { //[left, top, width, height]
        let oldRect = this.boxes[id].patching_rect;
        if (oldRect == rect) return this;
        this.boxes[id].patching_rect = rect;
        this.emit("updateBoxRect", this.boxes[id], oldRect, rect);
        return this;
    }

    redrawBox(box) {
        this.emit("redrawBox", box);
        return this;
    }
    
    createObject(box) {
        let obj;
        let str = box.class;
        if (typeof str != "string" || str.length == 0) obj = new Packages.Base.EmptyObject(box, this);
        else {
            if (this._lib.hasOwnProperty(str)) obj = new this._lib[str](box, this);
            else {
                this.newLog(1, "Patcher", "Object " + str + " not found.");
                obj = new Packages.Base.InvalidObject(box, this);
            }
            if (!(obj instanceof Packages.Base.BaseObject)) {
                this.newLog(1, "Patcher", "Object " + str + " is not valid.");
                obj = new Packages.Base.InvalidObject(box, this);
            }
        }
        this.emit("createObject", obj);
        return obj;
    }

    getLinesBySrcID(srcID, srcOutlet) {
        let result = [];
        for (const id in this.lines) {
            const line = this.lines[id];
            if (line.src[0] == srcID && (line.src[1] == srcOutlet || srcOutlet == undefined)) {
                result.push(id);
            }
        }
        return result;
    }

    getLinesByDestID(destID, destInlet) {
        let result = [];
        for (const id in this.lines) {
            const line = this.lines[id];
            if (line.dest[0] == destID && (line.dest[1] == destInlet || destInlet == undefined)) {
                result.push(id);
            }
        }
        return result;
    }

    getLinesByIO(srcID, destID, srcOutlet, destInlet) {
        let result = [];
        for (const id in this.lines) {
            const line = this.lines[id];
            if (line.src[0] == srcID && (line.src[1] == srcOutlet || srcOutlet == undefined)) {
                if (line.dest[0] == destID && (line.dest[1] == destInlet || destInlet == undefined)) {
                    result.push(id);
                }
            }
        }
        return result;
    }

    getLinesByObj(srcObj, destObj, srcOutlet, destInlet) {
        let result = [], srcOut = [], destIn = [];
        if (srcOutlet) srcOut = srcObj.outletLines[srcOutlet];
        else srcOut = srcObj.outletLines.reduce((acc, cur) => {
            return acc.concat(cur);
        }, []); // flat
        if (destInlet) destIn = destObj.inletLines[destInlet];
        else destIn = destObj.inletLines.reduce((acc, cur) => {
            return acc.concat(cur);
        }, []);
        if (!srcOut || !destIn) return result;
        for (const idOut of srcOut) {
            for (const idIn of destIn) {
                if (idIn == idOut) result.push(idIn);
            }
        }
        return result;
    }

    getObjByID(id) {
        return this.data[this.boxes[id].name][this.boxes[id].class];
    }
    getNameByID(id) {
        return this.boxes[id].name;
    }
    getIDsByName(name, className) {
        return this.data[name][className]._boxes;
    }
    newLog(errorLevel, title, message) {
        this._log.push([errorLevel, title, message]);
        this.emit("newLog", [errorLevel, title, message]);
    }

    // stringify to save
    toString() {
        return JSON.stringify(this, (k, v) => {
            if (k.charAt(0) !== "_") return v;
            //if (v instanceof Array) return JSON.stringify(v);
		}, 4)
    }

    observeHistory() {
        this.on("createBox", (box) => {
            this._history.do("createBox", box);
        }).on("deleteBox", (box) => {
            this._history.do("deleteBox", box);
        }).on("createLine", (line) => {
            this._history.do("createLine", line);
        }).on("deleteLine", (line) => {
            this._history.do("deleteLine", line);
        }).on("changeBoxText", (box, oldText, text) => {
            const info = {box : box, oldText : oldText, text : text};
            this._history.do("changeBoxText", info);
        }).on("changeLineSrc", (line, oldSrc, src) => {
            const info = {line : line, oldSrc : oldSrc, src : src};
            this._history.do("changeLineSrc", info);
        }).on("changeLineDest", (line, oldDest, dest) => {
            const info = {line : line, oldDest : oldDest, dest : dest};
            this._history.do("changeLineDest", info);
        }).on("updateBoxRect", (box, oldRect, rect) => {
            const info = {box : box, oldRect : oldRect, rect : rect};
            this._history.do("updateBoxRect", info);
        });
    }

    newTimestamp() {
        this._history.newTimestamp();
        return this;
    }

    paste(clipboard) { // {boxes : [], lines : []} TODO : parse / stringify
        let idMap = {};
		let pasted = {boxes : [], lines : []};
        for (let box of clipboard.boxes) {
            if (this.boxes.hasOwnProperty(box.id)) {
                box = new Box(box, this);
                idMap[box.id] = "box-" + ++this.boxIndexCount;
                if (box.name == box.id) box.name = idMap[box.id];
                box.id = idMap[box.id];
            } else {
                idMap[box.id] = box.id;
            }
            box.patching_rect = [box.patching_rect[0] + 20, box.patching_rect[1] + 20, box.patching_rect[2], box.patching_rect[3]];
            this.createBox(box);
            pasted.boxes.push(box);
        }
        for (let line of clipboard.lines) {
            if (this.lines.hasOwnProperty(line.id)) {
                line = new Line(line, this);
                line.id = "line-" + ++this.lineIndexCount;
            }
            line.src[0] = idMap[line.src[0]];
            line.dest[0] = idMap[line.dest[0]];
            this.createLine(line);
            pasted.lines.push(line);
        }
        return pasted;
    }
    
    getLinesByBoxes(boxes) { 
        let ids = [], lineIDs = [];
        for (const box of boxes) {
            ids.push(box.id);
        }
        for (const pair of Patcher.arrangement2(ids)) {
            lineIDs = lineIDs.concat(this.getLinesByIO(pair[0], pair[1]).concat(this.getLinesByIO(pair[1], pair[0])));
        }
        return lineIDs.map(id => this.lines[id]);
    }

    static arrangement2(arr) {
        let res = [];
        for (let i = 0; i < arr.length - 1; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                res.push([arr[i], arr[j]]);
            }
        }
        return res;
    }

}

class History {
    constructor(patcher) {
        this._patcher = patcher;
        this.undoList = [];
        this.redoList = [];
        this.capture = true;
        this.events = {};
        this.newTimestamp();
    }
    newTimestamp() {
        if (this.capture) this.timestamp = new Date().getTime();
        return this;
    }
    do(e, data) {
        if (!this.capture) return this;
        if (!this.events.hasOwnProperty(this.timestamp)) {
            if (this.redoList.length) this.redoList = [];
            this.undoList.push(this.timestamp);
            this.events[this.timestamp] = [];
        }
        if (!this.events[this.timestamp].hasOwnProperty(e)) this.events[this.timestamp][e] = [];
        this.events[this.timestamp][e].push(data);
        return this;
    }
    undo() {
        if (this.undoList.length === 0) return this;
        this.capture = false;
        const eID = this.undoList.pop();
        if (this.events[eID].hasOwnProperty("deleteBox")) {
            for (const box of this.events[eID]["deleteBox"]) {
                this._patcher.createBox(box);
            }
        }
        if (this.events[eID].hasOwnProperty("deleteLine")) {
            for (const line of this.events[eID]["deleteLine"]) {
                this._patcher.createLine(line);
            }
        }
        if (this.events[eID].hasOwnProperty("changeBoxText")) {
            for (const info of this.events[eID]["changeBoxText"]) {
                this._patcher.changeBoxText(info.box.id, info.oldText);
            }
        }
        if (this.events[eID].hasOwnProperty("updateBoxRect")) {
            for (const info of this.events[eID]["updateBoxRect"]) {
                this._patcher.emit("forceBoxRect", info.box.id, info.oldRect);
            }
        }
        if (this.events[eID].hasOwnProperty("changeLineSrc")) {
            for (const info of this.events[eID]["changeLineSrc"]) {
                this._patcher.changeLineSrc(info.line.id, info.oldSrc[0], info.oldSrc[1]);
            }
        }
        if (this.events[eID].hasOwnProperty("changeLineDest")) {
            for (const info of this.events[eID]["changeLineDest"]) {
                this._patcher.changeLineDest(info.line.id, info.oldDest[0], info.oldDest[1]);
            }
        }
        if (this.events[eID].hasOwnProperty("createLine")) {
            for (const line of this.events[eID]["createLine"]) {
                this._patcher.deleteLine(line.id);
            }
        }
        if (this.events[eID].hasOwnProperty("createBox")) {
            for (const box of this.events[eID]["createBox"]) {
                this._patcher.deleteBox(box.id);
            }
        }
        this.redoList.push(eID);
        this.capture = true;
        return this;
    }
    redo() {
        if (this.redoList.length === 0) return this;
        this.capture = false;
        const eID = this.redoList.pop();
        if (this.events[eID].hasOwnProperty("createBox")) {
            for (const box of this.events[eID]["createBox"]) {
                this._patcher.createBox(box);
            }
        }
        if (this.events[eID].hasOwnProperty("createLine")) {
            for (const line of this.events[eID]["createLine"]) {
                this._patcher.createLine(line);
            }
        }
        if (this.events[eID].hasOwnProperty("changeBoxText")) {
            for (const info of this.events[eID]["changeBoxText"]) {
                this._patcher.changeBoxText(info.box.id, info.text);
            }
        }
        if (this.events[eID].hasOwnProperty("updateBoxRect")) {
            for (const info of this.events[eID]["updateBoxRect"]) {
                this._patcher.emit("forceBoxRect", info.box.id, info.rect);
            }
        }
        if (this.events[eID].hasOwnProperty("changeLineSrc")) {
            for (const info of this.events[eID]["changeLineSrc"]) {
                this._patcher.changeLineSrc(info.line.id, info.src[0], info.src[1]);
            }
        }
        if (this.events[eID].hasOwnProperty("changeLineDest")) {
            for (const info of this.events[eID]["changeLineDest"]) {
                this._patcher.changeLineDest(info.line.id, info.dest[0], info.dest[1]);
            }
        }
        if (this.events[eID].hasOwnProperty("deleteLine")) {
            for (const line of this.events[eID]["deleteLine"]) {
                this._patcher.deleteLine(line.id);
            }
        }
        if (this.events[eID].hasOwnProperty("deleteBox")) {
            for (const box of this.events[eID]["deleteBox"]) {
                this._patcher.deleteBox(box.id);
            }
        }
        this.undoList.push(eID);
        this.capture = true;
        return this;
    }
}

class Box {
    constructor(props, patcher) {
        this._patcher = patcher;
        this.id = props.id;
        this.text = props.text || "";
        let parsed = Box.parseObjText(this.text);
        this.name = parsed.props.name || props.id;
        this.class = parsed.class || "Base.EmptyObject";
        this.inlets = props.inlets;
        this.outlets = props.outlets;
        this.patching_rect = props.patching_rect;
        this._args = parsed.args;
        this._props = parsed.props;
        this.prevData = props.prevData; // useful when copy paste a box
        if (this._patcher._prevData && this._patcher._prevData.hasOwnProperty(this.name) && this._patcher._prevData[this.name].hasOwnProperty(this.class)) 
            this.prevData = this._patcher._prevData[this.name][this.class]; // Patcher load a patch and transfer data.storage to prevData
    }
    
    init() {
        if (!this._patcher.data.hasOwnProperty(this.name)) this._patcher.data[this.name] = {};
        if (!this._patcher.data[this.name].hasOwnProperty(this.class)) {
            this._patcher.data[this.name][this.class] = this._patcher.createObject(this);
        } else {
            this._patcher.data[this.name][this.class].addBox(this.id);
        }
        if (this.isValid) {
            this.inlets = this.object._inlets;
            this.outlets = this.object._outlets;
        }
    }
    changeText(textIn) {
        if (textIn == this.text) return this;
        this.text = textIn;
        
        let parsed = Box.parseObjText(textIn);
        // if same class and name
        if (this.name == (parsed.props.name || this.id) && this.class == parsed.class) { 
            this._props = parsed.props;
            this._args = parsed.args;
            this._patcher.data[this.name][this.class].update(this._args, this._props);
            if (this.isValid) {
                this.inlets = this.object._inlets;
                this.outlets = this.object._outlets;
            }
            return this;
        } 
        // else new box
        let lineAsDest = this._patcher.getLinesByDestID(this.id);
        let lineAsSrc = this._patcher.getLinesBySrcID(this.id);
        for (let i = 0; i < lineAsDest.length; i++) {
            this._patcher.lines[lineAsDest[i]].disable();
        }
        for (let i = 0; i < lineAsSrc.length; i++) {
            this._patcher.lines[lineAsSrc[i]].disable();
        }
        this._patcher.data[this.name][this.class].removeBox(this.id);

        this.class = parsed.class;
        this._args = parsed.args;
        this._props = parsed.props;
        this.name = parsed.props.name || this.id;

        if (!this._patcher.data.hasOwnProperty(this.name)) this._patcher.data[this.name] = {};
        if (!this._patcher.data[this.name].hasOwnProperty(this.class)) {
            this._patcher.data[this.name][this.class] = this._patcher.createObject(this);
        } else {
            this._patcher.data[this.name][this.class].addBox(this.id).update(this._args, this._props);
        }
        if (this.isValid) {
            this.inlets = this.object._inlets;
            this.outlets = this.object._outlets;
        }
        for (let i = 0; i < lineAsDest.length; i++) {
            this._patcher.lines[lineAsDest[i]].enable();
        }
        for (let i = 0; i < lineAsSrc.length; i++) {
            this._patcher.lines[lineAsSrc[i]].enable();
        }
        return this;
    }
    destroy() {
        let lineAsDest = this._patcher.getLinesByDestID(this.id);
        let lineAsSrc = this._patcher.getLinesBySrcID(this.id);
        for (let i = 0; i < lineAsDest.length; i++) {
            this._patcher.deleteLine(lineAsDest[i]);
        }
        for (let i = 0; i < lineAsSrc.length; i++) {
            this._patcher.deleteLine(lineAsSrc[i]);
        }
        this._patcher.data[this.name][this.class].removeBox(this.id);
        if (Object.keys(this._patcher.data[this.name]).length == 0) delete this._patcher.data[this.name];
        delete this._patcher.boxes[this.id];
    }
    
    get object() {
        return this._patcher.data[this.name][this.class];
    }
    get isValid() {
        return this.object instanceof Packages.Base.BaseObject && !(this.object instanceof Packages.Base.InvalidObject);
    }
    
    static parseObjText(strIn) {
        let parseToPrimitive = (value) => {
            try {
                return eval(value);
            } catch (e) {
                return value;
            }
        }
        const REGEX = /"([^"]*)"|[^\s]+/gi;
        let strArray = [];
        let match = REGEX.exec(strIn);
        while (match != null) {
            //Index 1 in the array is the captured group if it exists
            //Index 0 is the matched text, which we use if no captured group exists
            strArray.push(match[1] ? match[1] : match[0]);
            //Each call to exec returns the next regex match as an array
            match = REGEX.exec(strIn);
        } 
        let objOut = {
            class: "",
            args: [],
            props: {}
        }
        let lastProp;
        if (strArray.length) objOut.class = strArray.shift();
        while (strArray.length) {
            let el = strArray.shift();
            if (typeof lastProp == "undefined" && el.charAt(0) != "@") {
                try {
                    objOut.args.push(JSON.parse(el));
                } catch (e) {
                    objOut.args.push(el);
                }
                continue;
            }
            if (el.length > 1 && el.charAt(0) == "@") {
                lastProp = el.substr(1);
                objOut.props[lastProp] = [];
                continue;
            }
            try {
                objOut.props[lastProp].push(JSON.parse(el));
            } catch (e) {
                objOut.props[lastProp].push(el);
            }
        }
        for (const key in objOut.props) {
            if (objOut.props[key].length == 0) objOut.props[key] = true;
            else if (objOut.props[key].length == 1) objOut.props[key] = parseToPrimitive(objOut.props[key][0]);
        }
        return objOut;
    }
    
}

class Line {
    constructor(props, patcher) {
        this._patcher = patcher;
        this.src = [props.src[0], props.src[1]]; // box id, box outlet
        this.dest = [props.dest[0], props.dest[1]]; // box id. box inlet
        this.id = props.id;
        this.disabled = true;
        this.positionHash = Line.calcPositionHash(this._patcher.boxes[this.dest[0]].patching_rect, this.dest[1], this._patcher.boxes[this.dest[0]].inlets);
    }
    emit(data) {
        this.destObj.emit(this.id, data);
    }
    setSrc(src) {
        let srcID = src[0];
        let srcOutlet = src[1];
        if (srcID == this.src[0] && srcOutlet == this.src[1]) return;
        this.disable();
        this.src = [srcID, srcOutlet];
        this.enable()
        return this;
    }
    setDest(dest) {
        let destID = dest[0];
        let destInlet = dest[1];
        this.disable();
        this.dest = [destID, destInlet];
        this.enable()
        return this;
    }
    destroy() {
        delete this._patcher.lines[this.id];
        this.disable();
        return this;
    }
    disable(bool) {
        if (bool == false) return this.enable();
        if (this.disabled) return this;
        this.disabled = true;
        let srcObj = this.srcObj;
        let destObj = this.destObj;
        if (this._patcher.getLinesByObj(srcObj, destObj, this.src[1], this.dest[1]).length > 1) return this; // not last cable
        destObj.removeAllListeners(this.id);
        srcObj.disconnectedOutlet(this.src[1], destObj, this.dest[1], this.id);
        destObj.disconnectedInlet(this.dest[1], srcObj, this.src[1], this.id);
        return this;
    }
    enable(bool) {
        if (bool == false) return this.disable();
        if (!this.disabled) return this;
        this.disabled = false;
        let srcObj = this.srcObj;
        let destObj = this.destObj;
        if (this.src[1] >= srcObj._outlets || this.dest[1] >= destObj._inlets) return this._patcher.deleteLine(this.id);
        if (this._patcher.getLinesByObj(srcObj, destObj, this.src[1], this.dest[1]).length > 1) return this; // not last cable
        srcObj.connectedOutlet(this.src[1], destObj, this.dest[1], this.id);
        destObj.connectedInlet(this.dest[1], srcObj, this.src[1], this.id);
        destObj.on(this.id, (data) => {
            destObj.fn(data, this.dest[1])
        });
        return this;
    }
    static calcPositionHash(rect, port, portCount) {
        return ((rect[0] + 10) + (rect[2] - 20) * (port / portCount - 1)) * 65536 + rect[1] + rect[3];
    }
    get srcID() {
        return this.src[0];
    }
    get srcOutlet() {
        return this.src[1];
    }
    get destID() {
        return this.dest[0];
    }
    get destOutlet() {
        return this.dest[1];
    }
    get srcObj() {
        return this._patcher.getObjByID(this.src[0]);
    }
    get destObj() {
        return this._patcher.getObjByID(this.dest[0]);
    }
}

class SharedMemory {
    constructor() {
        this.dataSet = {};
    }
    
    set(key, value) {
        if (this.dataSet.hasOwnProperty(key)) this.dataSet[key].value = value;
        else this.dataSet[key] = { value : undefined, inspectors : [] };
        return this.dataSet;
    }
    get(key) {
        if (this.dataSet.hasOwnProperty(key)) return this.dataSet[key].value;
        else return undefined;
    }
    // bind a variable with object id
    on(key, id) {
        if (!this.dataSet.hasOwnProperty(key)) this.dataSet[key] = { value : undefined, inspectors : [] };
        this.dataSet[key].inspectors.push(id);
        return this;
    }
    // unbind a variable with object id
    off(key, id) {
        if (!this.dataSet.hasOwnProperty(key)) return this;
        else if (this.dataSet[key].inspectors.includes(id)) this.dataSet[key].inspectors.splice(this.dataSet[key].inspectors.indexOf(id), 1);
        if (this.dataSet[key].inspectors.length == 0) delete this.dataSet[key];
        return this;
    }
}
