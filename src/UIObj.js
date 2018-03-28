
let inlet = function($, isHot) {
	return $("<div />").addClass(["box-port", "box-inlet", isHot ? "box-inlet-hot" : "box-inlet-cold"]);
}
let outlet = function($) {
	return $("<div />").addClass(["box-port", "box-outlet"]);
}
let inlets = function($, count) {
	let div = $("<div />").addClass("box-inlets");
	for (let i = 0; i < count; i++) {
		div.append(inlet($, true).attr("data-index", i));
	}
	return div;
}
let outlets = function($, count) {
	let div = $("<div />").addClass("box-outlets");
	for (let i = 0; i < count; i++) {
		div.append(outlet($).attr("data-index", i));
	}
	return div;
}
let box = function($, box) {
	let rect = box.patching_rect;
	let is = box.inlets;
	let os = box.outlets;
	let id = box.id;
	let ui = $("<div />").addClass("box-ui");
	let div = $("<div />").attr({"id": id, "tabindex": 0}).addClass(["box", "box-default"]);
	div.css({"left": rect[0], "top": rect[1], "width": rect[2]/**, "height": rect[3]**/});
	div.append(inlets($, is)).append(outlets($, os)).append(ui);
	return div;
}
let line = function($, line) {
	let path = $("<path />").addClass("line-path");
	let svg = $("<svg />").addClass("line-svg").append(path).attr({"width": "100%", "height": "100%"});
	let handlerSrc = $("<div />").addClass(["line-handler", "line-handler-src"]);
	let handlerDest = $("<div />").addClass(["line-handler", "line-handler-dest"]);
	let div = $("<div />").attr({"id": line.id, "tabindex": 0}).addClass("line");
	div.html(svg.prop("outerHTML")).append(handlerSrc).append(handlerDest); //svg update hack
	return div;
}
export default {
	box, 
	line,
	inlets,
	outlets
}