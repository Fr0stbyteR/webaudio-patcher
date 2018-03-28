
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
audioCtx.destination.channelInterpretation = "discrete";

var fileName = "./cycle-dac.maxpat";
//var content;
var boxes, lines, nodes = [];
const PATTERN_NODE_OSC = /^cycle~|rect~|saw~|phasor~/;
//fs.stat(fileName, function (err, stats) {});
//content = JSON.parse(fs.readFileSync(fileName, 'utf8'));
boxes = content["patcher"]["boxes"];
lines = content["patcher"]["lines"];
for (var i = 0; i < boxes.length; i++) {
    var box = boxes[i]["box"];
    var boxTxtArray = box["text"].split(" ");
    var maxObjClass = boxTxtArray.shift();
    var boxArgs = [];
    var boxAttr = {};
    var boxProperty = {};
    if (boxTxtArray.length > 0) {
        while (boxTxtArray.length) {
            if (boxTxtArray[0][0] != "@") boxArgs.push(boxTxtArray.shift());
            else break;
        }
    }
    if (maxObjClass.match(PATTERN_NODE_OSC) != null) {
        var node = nodes[box["id"]]
        node = audioCtx.createOscillator();
        switch (maxObjClass) {
            case "cycle~":
                node.type = 'sine';
                break;
        
            default:
                break;
        }
        node.connect(audioCtx.destination, 0, 0);
        node.start()
    }
}

//var jsonContent = JSON.parse(content);
//process.exit(1);