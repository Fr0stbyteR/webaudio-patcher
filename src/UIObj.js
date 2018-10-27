
let inlet = ($, props) => {
	return $("<div />")
		.addClass(["box-port", "box-inlet", props.isHot ? "box-inlet-hot" : "box-inlet-cold"])
		.attr("data-content", props.type + ": " + props.description)
		.attr("data-variation", "mini inverted")
		.popup({
			boundary : ".boxes",
			position : "top left",
			delay: { show: 500, hide: 0 }
		});
}
let outlet = ($, props) => {
	return $("<div />").addClass(["box-port", "box-outlet"])
		.attr("data-content", props.type + ": " + props.description)
		.attr("data-variation", "mini inverted")
		.popup({
			boundary : ".boxes",
			position : "bottom left",
			delay: { show: 500, hide: 0 }
		});
}
let inlets = ($, count, props) => {
	let div = $("<div />").addClass("box-inlets");
	for (let i = 0; i < count; i++) {
		let propsI = { isHot : false, type : "anything", description : "" };
		if (props) propsI = i >= props.length ? props[props.length - 1] : props[i];
		div.append(inlet($, propsI).attr("data-index", i));
	}
	return div;
}
let outlets = ($, count, props) => {
	let div = $("<div />").addClass("box-outlets");
	for (let i = 0; i < count; i++) {
		let propsI = { type : "anything", description : "" };
		if (props) propsI = i >= props.length ? props[props.length - 1] : props[i];
		div.append(outlet($, propsI).attr("data-index", i));
	}
	return div;
}
let box = ($, box, props) => {
	let rect = box.patching_rect;
	let is = box.inlets;
	let os = box.outlets;
	let id = box.id;
	let ui = $("<div />").addClass("box-ui");
	let div = $("<div />").attr({"id": id, "tabindex": 0}).addClass(["box", "box-default"]);
	div.css({"left": rect[0], "top": rect[1], "width": rect[2], "height": rect[3]});
	div.append(inlets($, is, props.inlets)).append(outlets($, os, props.outlets)).append(ui);
	return div;
}
let line = ($, line) => {
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