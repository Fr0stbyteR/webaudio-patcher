class MaxObjBase {
    constructor(strArg) {
        this.ioInit = [0, 0];
        this.ioMax = [0, 0];
        this.function;
        let argsArray = strArg.split(" ");
        this.maxObjClass = argsArray.shift();
        this.args = [];
        this.attrs = {};
        if (argsArray.length > 0) {
            let lastProperty = "";
            let lastValue = [];
            let attrsMode = 0;
            while (argsArray.length) {
                let curStr = argsArray.shift();
                attrsMode = attrsMode || curStr[0] == "@";
                if (!attrsMode) this.args.push(isNaN(curStr) ? curStr : +curStr);
                if (curStr[0] == "@") {
                    if (lastProperty.length) {
                        if (lastValue.length > 1) this.attrs[lastProperty] = lastValue;
                        else if (lastValue.length == 1) this.attrs[lastProperty] = lastValue[0];
                        else this.attrs[lastProperty] = true;
                    }
                    lastValue = [];
                }
                if (curStr[0] == "@") lastProperty = curStr.substr(1);
                else lastValue.push(isNaN(curStr) ? curStr : +curStr);
            }
            if (lastProperty.length) {
                if (lastValue.length > 1) this.attrs[lastProperty] = lastValue;
                else if (lastValue.length == 1) this.attrs[lastProperty] = lastValue[0];
                else this.attrs[lastProperty] = true;
            }
        }
    }
}
