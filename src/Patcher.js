import {
    EventEmitter
} from "events";
import Base from "./object/Base.js"
import WA from "./object/WA.js"
import JS from "./object/JS.js"
import Max from "./object/Max.js"
import Faust from "./object/faust/Faust.js"
let Packages = {
    Base,
    WA,
    JS,
    Max,
    Faust
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
        this._packages = Packages;
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
        this.emit("loadPatcher", this);
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
                name: id,
                class: "",
                inlets: maxBox.numinlets,
                outlets: maxBox.numoutlets,
                patching_rect: maxBox.patching_rect,
                text: "",
                args: [],
                props: {}
            }
            if (maxBox.hasOwnProperty("text")) {
                box.text = maxBox.text;
                Object.assign(box, Box.parseObjText(maxBox.text));
            }
            // get the name out to root
            if (box.hasOwnProperty("props") && box.props.hasOwnProperty("name")) {
                box.name = box.props.name;
                delete box.props.name;
            }
            patcher.boxes[id] = box;
        }
        return patcher;
    }

    createBox(props) {
        if (!props.hasOwnProperty("id")) props.id = "box-" + ++this.boxIndexCount;
        let box = new Box(props, this);
        this.boxes[box.id] = box;
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
        this.emit("createLine", line);
        return line;
    }
    
    canCreateLine(props) {
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
            try {
                let arr = str.split(".");
                let fn = Packages;
                for (var i = 0, len = arr.length; i < len; i++) {
                    fn = fn[arr[i]];
                }
                obj = new fn(box, this);
            } catch (e) {
                this.newLog(1, "Patcher", e);
                obj = new Packages.Base.InvalidObject(box, this);
            }
            if (!(obj instanceof Packages.Base.BaseObject)) obj = new Packages.Base.InvalidObject(box, this);
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
        else srcOut = srcObj.outletLines.flat();
        if (destInlet) destIn = destObj.inletLines[destInlet];
        else destIn = destObj.inletLines.flat();
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
            if (v instanceof Array) return JSON.stringify(v);
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

    paste(clipboard) { // {boxes : [], lines : []}
        console.log(clipboard);
        let idMap = {};
		let pasted = {boxes : [], lines : []};
        for (let box of clipboard.boxes) {
            if (this.boxes.hasOwnProperty(box.id)) {
                box = new Box(box, this);
                idMap[box.id] = "box-" + ++this.boxIndexCount;
                box.id = idMap[box.id];
                box.name = idMap[box.id];
            } else {
                idMap[box.id] = box.id;
            }
            box.patching_rect[0] += 20;
            box.patching_rect[1] += 20;
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
            lineIDs = this.getLinesByIO(pair[0], pair[1]).concat(this.getLinesByIO(pair[1], pair[0]));
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
        this.name = props.name || props.id;
        this.class = props.class || "Base.EmptyObject";
        this.inlets = props.inlets;
        this.outlets = props.outlets;
        this.patching_rect = props.patching_rect;
        this.text = props.text || "";
        this.args = props.args;
        this.props = props.props;
        this.prevData = null;
        if (this._patcher._prevData && this._patcher._prevData.hasOwnProperty(this.name) && this._patcher._prevData[this.name].hasOwnProperty(this.class)) 
            this.prevData = this._patcher._prevData[this.name][this.class];
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
        
        let props = Box.parseObjText(textIn);
        // if same class and name
        if (this.name == (props.props.name || this.id) && this.class == props.class) { 
            this.props = props.props;
            this.args = props.args;
            this._patcher.data[this.name][this.class].update(this.args, this.props);
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

        this.class = props.class;
        this.args = props.args;
        this.props = props.props;
        this.name = props.props.name || this.id;

        if (!this._patcher.data.hasOwnProperty(this.name)) this._patcher.data[this.name] = {};
        if (!this._patcher.data[this.name].hasOwnProperty(this.class)) {
            this._patcher.data[this.name][this.class] = this._patcher.createObject(this);
        } else {
            this._patcher.data[this.name][this.class].addBox(this.id).update(this.args, this.props);
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
            const e = strArray.shift();
            if (typeof lastProp == "undefined" && e.charAt(0) != "@") {
                objOut.args.push(e);
                continue;
            }
            if (e.length > 1 && e.charAt(0) == "@") {
                lastProp = e.substr(1);
                objOut.props[lastProp] = [];
                continue;
            }
            objOut.props[lastProp].push(e);
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
        this.src = [props.src[0], props.src[1]];
        this.dest = [props.dest[0], props.dest[1]];
        this.id = props.id;
        this.disabled = true;
        this.enable();
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
