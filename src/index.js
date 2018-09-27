import $ from 'jquery';
import Patcher from "./Patcher.js";
import UIObj from "./UIObj.js";
import "jquery-ui/ui/widgets/draggable.js";
import "jquery-ui/ui/widgets/resizable.js";
import "jquery-ui/themes/base/draggable.css";
import "jquery-ui/themes/base/resizable.css";
import "../semantic/dist/semantic.min.js";
window.$ = $, window.jQuery = $;


let patcher = new Patcher();
window.patcher = patcher;

$(document).ready(() => {
	patcher.on("resetPatcher", (patcher) => {
		$(".box").remove();
		$(".line").remove();
	})
	patcher.on("loadPatcher", (patcher) => {
		if (patcher.hasOwnProperty("bgcolor")) $("#patcher").css("background-color", "rgba(" + patcher.bgcolor.join(",") + ")");
		lockPatcher();
	})
	patcher.on("createBox", (box) => {
		let obj = patcher.getObjByID(box.id);
		let dom = UIObj.box($, box);
		let objUI = obj.ui($, box);
		dom.find(".box-ui").append(objUI);
		$(".boxes").append(dom);
		dom.draggable({
			start: (event, ui) => {
				ui.helper.addClass("dragged");
			},
			drag: (event, ui) => {
				if (patcher.state.showGrid) {
					ui.position.top = ui.position.top - ui.position.top % patcher.grid[0];
					ui.position.left = ui.position.left - ui.position.left % patcher.grid[1];
				}
				updateLineByBox(ui.helper.attr("id"));
			},
			stop: (event, ui) => {
				updateLineByBox(ui.helper.attr("id"));
				updateBoxRect(ui.helper.attr("id"));
			}
		}).resizable({
			disabled: true,
			handles: objUI.data("resizeHandles") ? objUI.data("resizeHandles") : "e, w",
			resize: (event, ui) => {
				updateLineByBox(ui.helper.attr("id"));
				updateBoxRect(ui.helper.attr("id"));
			}
		});
		updateBoxIO(box.id);
		updateBoxRect(box.id);
	});
	patcher.on("uiRefreshBox", (box) => {
		let obj = patcher.getObjByID(box.id);
		$("#" + box.id).find(".box-ui").empty().append(obj.ui($, box));
		$("#" + box.id).find(".box-inlets").replaceWith(UIObj.inlets($, box.inlets))
		$("#" + box.id).find(".box-outlets").replaceWith(UIObj.outlets($, box.outlets));
		updateBoxIO(box.id);
		updateBoxRect(box.id);
		updateLineByBox(box.id);
	});
	patcher.on("changeBoxText", (box) => {
		let obj = patcher.getObjByID(box.id);
		$("#" + box.id).find(".box-ui").empty().append(obj.ui($, box));
		$("#" + box.id).find(".box-inlets").replaceWith(UIObj.inlets($, box.inlets))
		$("#" + box.id).find(".box-outlets").replaceWith(UIObj.outlets($, box.outlets));
		updateBoxIO(box.id);
		updateBoxRect(box.id);
		updateLineByBox(box.id);
	})
	patcher.on("deleteBox", (box) => {
		$("#" + box.id).remove();
	})
	patcher.on("createLine", (line) => {
		let dom = UIObj.line($, line);
		$(".lines").append(dom);
		dom.find(".line-handler").draggable({
			start: (event, ui) => {
				ui.helper.parents(".line").addClass("dragging");
			},
			drag: (event, ui) => {
				let id = ui.helper.parents(".line").attr("id");
				let isSrc = ui.helper.hasClass("line-handler-src");
				dragLine(id, isSrc, [ui.offset.left, ui.offset.top]);
				let closest = findClosestPort(ui.offset, isSrc);
				$(".box-port-highlight").removeClass("box-port-highlight");
				if (closest.length) {
					$("#" + closest[0]).find(isSrc ? ".box-outlet" : ".box-inlet").eq(closest[1]).addClass("box-port-highlight");
				}
			},
			stop: (event, ui) => {
				ui.helper.parents(".line").removeClass("dragging");
				let id = ui.helper.parents(".line").attr("id");
				let isSrc = ui.helper.hasClass("line-handler-src");
				let closest = findClosestPort(ui.offset, isSrc);
				if (!closest.length) {
					patcher.deleteLine(id);
					return;
				}
				$(".box-port-highlight").removeClass("box-port-highlight");
				if (isSrc) patcher.changeLineSrc(id, closest[0], closest[1]);
				else patcher.changeLineDest(id, closest[0], closest[1]);
			}
		});
		updateLine(line.id);
		updateBoxIO(line.src[0]);
		updateBoxIO(line.dest[0]);
	});
	patcher.on("uiRefreshLine", (line) => {
		updateLine(line.id);
	})
	patcher.on("changeLine", (line, isSrc, oldCon) => {
		updateLine(line.id);
		updateBoxIO(oldCon[0]);
		updateBoxIO(line.src[0]);
		updateBoxIO(line.dest[0]);
	})
	patcher.on("resizeBox", (box) => {
		updateLineByBox(box.id);
		updateBoxRect(box.id);
	})
	patcher.on("deleteLine", (line) => {
		$("#" + line.id).remove();
		updateBoxIO(line.src[0]);
		updateBoxIO(line.dest[0]);
	})

	patcher.on("newLog", (log) => {
		$("#log tbody").append(
			$('<tr>').addClass(log[0] == 1 ? "error" : log[0] == -1 ? "warning" : log[0] == -2 ? "positive" : "")
			.append($('<td>').addClass(["two", "wide"]).text(log[1]))
			.append($('<td>').addClass(["fourteen", "wide"]).text(log[2]))
		)
		$("#log").animate({
			scrollTop: $("#log").get(0).scrollHeight
		}, 100)
	});

	fetch("patcher.json").then(response => {
		return response.json();
	}).then(content => patcher.load(content));


	$(document).on("dblclick", ".boxes", (e) => {
		if (patcher.state.locked) return;
		let box = {
			patching_rect: [e.offsetX, e.offsetY, 100, 22],
		}
		box = patcher.createBox(box);
		$("#" + box.id).mousedown().find("span").click();
	}).on("dblclick", ".boxes div", (e) => {
		e.stopPropagation();
	}).on("click", ".boxes", (e) => {
		$(".selected").removeClass("selected");
	}).on("click", ".box, .line", (e) => {
		e.stopPropagation();
	});
	$(document).on("mousedown", ".box", (e) => {
		if (patcher.state.locked) return;
		$(e.currentTarget).removeClass("dragged");
		if ($(e.currentTarget).hasClass("selected")) return;
		$(".selected").removeClass("selected");
		$(e.currentTarget).addClass("selected").resizable("enable").focus();
	}).on("blur", ".box.selected", (e) => {
		if (patcher.state.locked) return;
		if (!$.contains(document, $(e.currentTarget))) return; //if deleted
		$(e.currentTarget).removeClass("selected").resizable("disable");
	}).on("keydown", ".box.selected", (e) => {
		if (patcher.state.locked) return;
		if (e.key == "Delete" || e.key == "Backspace") patcher.deleteBox($(e.currentTarget).attr("id"));
	});
	$(document).on("focus", ".line", (e) => {
		if (patcher.state.locked) return;
		if ($(e.currentTarget).hasClass("selected")) return;
		$(".selected").removeClass("selected");
		$(e.currentTarget).addClass("selected");
		updateLine($(e.currentTarget).attr("id"));
	}).on("blur", ".line.selected", (e) => {
		if (patcher.state.locked) return;
		if (!$.contains(document, $(e.currentTarget))) return; //if deleted
		$(e.currentTarget).removeClass("selected");
	}).on("keydown", ".line.selected", (e) => {
		if (patcher.state.locked) return;
		if (e.key == "Delete" || e.key == "Backspace") patcher.deleteLine($(e.currentTarget).attr("id"));
	});
	$(document).on("click", "#save", (e) => {
		let p = patcher.toString();
		let url = "data:text/plain;charset=utf-8," + encodeURIComponent(p);
		$(e.currentTarget).attr("download", "patcher.json").attr("href", url);
	}).on("click", "#load", (e) => {
		$(e.currentTarget).siblings("input").click();
	}).on("change", "#load + input", (e) => {
		let file = $(e.currentTarget).get(0).files[0];
		if (file) loadPatcher(file);
	})
	
	$(document).on("click", "#lock", (e) => {
		if (patcher.state.locked) unlockPatcher();
		else lockPatcher();
	}).on("click", "#grid", (e) => {
		if (patcher.state.showGrid) hideGrid();
		else showGrid();
	});
});

let loadPatcher = (file) => {
	let reader = new FileReader();
	reader.readAsText(file, "UTF-8");
	reader.onload = (e) => {
		patcher.load(JSON.parse(e.target.result));
	}
	reader.onerror = (e) => {}
}

let dragLine = (id, isSrc, offset) => {
	let start, end;
	if (isSrc) {
		start = offset;
		end = $("#" + id).find("path").data("end");
	} else {
		end = offset;
		start = $("#" + id).find("path").data("start");
	}
	drawLine(id, start, end);

}

let updateLine = (id) => {
	let lineObj = patcher.lines[id];
	let startJQ = $("#" + lineObj.src[0]).find(".box-outlet").eq(lineObj.src[1]);
	let destJQ = $("#" + lineObj.dest[0]).find(".box-inlet").eq(lineObj.dest[1]);
	let startC = startJQ.offset();
	let destC = destJQ.offset();
	let start = [startC.left + startJQ.outerWidth() / 2, startJQ.parent(".box-outlets").offset().top];
	let dest = [destC.left + destJQ.outerWidth() / 2, destJQ.parent(".box-inlets").offset().top];
	drawLine(id, start, dest);
	let handlerPos = findHandlerPosLine(id);
	$("#" + id).find(".line-handler-dest").first().css("left", handlerPos[2]).css("top", handlerPos[3])
		.siblings(".line-handler-src").first().css("left", handlerPos[0]).css("top", handlerPos[1]);
}

let drawLine = (id, start, end) => {
	let divStyle = {
		"left": Math.min(start[0], end[0]) - 5,
		"top": Math.min(start[1], end[1]) - 10,
		"width": Math.abs(start[0] - end[0]) + 10,
		"height": Math.abs(start[1] - end[1]) + 20,
	};
	let dStart = [start[0] - divStyle.left, start[1] - divStyle.top];
	let dMid = [divStyle.width / 2, divStyle.height / 2];
	let dEnd = [end[0] - divStyle.left, end[1] - divStyle.top];
	let dBezier = [dStart[0] * 0.8 + dMid[0] * 0.2, start[1] - divStyle.top + divStyle.height / 5];
	if (dBezier[1] > divStyle.height) dBezier[1] = divStyle.height;
	let d = ["M", dStart[0], dStart[1], "Q", dBezier[0], dBezier[1], ",", dMid[0], dMid[1], "T", dEnd[0], dEnd[1]];
	divStyle.left -= $("#" + id).parents(".lines").offset().left;
	divStyle.top -= $("#" + id).parents(".lines").offset().top;
	$("#" + id).css(divStyle)
		.find("svg").width(divStyle.width).height(divStyle.height)
		.find("path").attr("d", d.join(" ")).data({
			"start": start,
			"end": end
		});
}
let updateLineByBox = (id) => {
	let lineIDs = patcher.getLinesByDestID(id).concat(patcher.getLinesBySrcID(id));
	for (let i = 0; i < lineIDs.length; i++) {
		updateLine(lineIDs[i]);
	}
}

let findHandlerPosLine = (id) => {
	let path = $("#" + id).find(".line-path")[0];
	let length = path.getTotalLength();
	let res = [];
	let loc = path.getPointAtLength(10);
	res.push(loc.x);
	res.push(loc.y);
	loc = path.getPointAtLength(length - 10);
	res.push(loc.x);
	res.push(loc.y);
	return res;
}

let findClosestPort = (offset, findOutlet, exclude) => {
	let closest = [];
	let distance;
	$(findOutlet ? ".box-outlet" : ".box-inlet").each((index, element) => {
		let jq = $(element);
		let o = jq.offset();
		let w = jq.outerWidth();
		let h = jq.outerHeight();
		let x = o.left - offset.left + w / 2;
		let y = o.top - offset.top + h / 2;
		let d = Math.pow(x * x + y * y, 0.5);
		if (closest.length == 0 || d < distance) {
			let e = [];
			e[0] = $(element).parents(".box").attr("id");
			e[1] = +$(element).attr("data-index");
			if (typeof exclude == "undefined" || e[0] != exclude[0] || e[1] != exclude[1]) {
				closest = e;
				distance = d;
			}
		}
	})

	return distance < 50 ? closest : [];
}

let updateBoxIO = (id) => {
	let box = patcher.boxes[id];
	for (let i = 0; i < box.inlets; i++) {
		let inlets = patcher.getLinesByDestID(id, i);
		if (inlets.length) $("#" + id).find(".box-inlet").eq(i).addClass("box-port-connected");
		else $("#" + id).find(".box-inlet").eq(i).removeClass("box-port-connected");
	}
	for (let i = 0; i < box.inlets; i++) {
		let outlets = patcher.getLinesBySrcID(id, i);
		if (outlets.length) $("#" + id).find(".box-outlet").eq(i).addClass("box-port-connected");
		else $("#" + id).find(".box-outlet").eq(i).removeClass("box-port-connected");
	}
	$("#" + id).find(".box-port").not(".ui-draggable").draggable({
		helper: "clone",
		opacity: 0.01,
		revert: true,
		revertDuration: 0,
		start: (event, ui) => {
			let id = ui.helper.parents(".box").attr("id");
			let eq = +ui.helper.attr("data-index");
			let isSrc = ui.helper.hasClass("box-inlet");
			let line = {
				id: "line-new"
			};
			if (isSrc) line.dest = [id, eq];
			else line.src = [id, eq];
			let newLine = UIObj.line($, line);
			let fixed = [ui.offset.left, ui.offset.top];
			newLine.find("path").data(isSrc ? "end" : "start", fixed);
			$(".lines").append(newLine);
		},
		drag: (event, ui) => {
			let isSrc = ui.helper.hasClass("box-inlet");
			dragLine("line-new", isSrc, [ui.offset.left, ui.offset.top]);
			let closest = findClosestPort(ui.offset, isSrc);
			$(".box-port-highlight").removeClass("box-port-highlight");
			if (closest.length) {
				$("#" + closest[0]).find(isSrc ? ".box-outlet" : ".box-inlet").eq(closest[1]).addClass("box-port-highlight");
			}
		},
		stop: (event, ui) => {
			$("#line-new").remove();
			let id = ui.helper.parent().attr("id");
			let isSrc = ui.helper.hasClass("box-inlet");
			let closest = findClosestPort(ui.offset, isSrc);
			if (!closest.length) return;
			$(".box-port-highlight").removeClass("box-port-highlight");
			if (isSrc) patcher.createLine({
				src: closest,
				dest: [ui.helper.parents(".box").attr("id"), +ui.helper.attr("data-index")]
			});
			else patcher.createLine({
				src: [ui.helper.parents(".box").attr("id"), +ui.helper.attr("data-index")],
				dest: closest
			});
		}
	});
}

let updateBoxRect = (id) => {
	let jq = $("#" + id);
	let l = jq.position().left;
	let t = jq.position().top;
	let w = jq.outerWidth();
	let h = jq.outerHeight();
	patcher.boxes[id].patching_rect = [l, t, w, h];
}

let lockPatcher = () => {
	$(".selected").removeClass("selected");
	$(".box").blur();
	$(".line").blur();
	$(".box.ui-draggable").draggable("disable");
	$(".box-port.ui-draggable").draggable("disable");
	patcher.state.locked = true;
	$("#lock").children("i.lock.open").removeClass("open");
	$("#patcher").removeClass("unlocked").addClass("locked");
	hideGrid();
}

let unlockPatcher = () => {
	$(".selected").removeClass("selected");
	$(".box").blur();
	$(".line").blur();
	$(".box.ui-draggable").draggable("enable");
	$(".box-port.ui-draggable").draggable("enable");
	patcher.state.locked = false;
	$("#lock").children("i.lock").addClass("open");
	$("#patcher").removeClass("locked").addClass("unlocked");
	if (patcher.state.showGrid) showGrid();
}

//background-image: repeating-linear-gradient(0deg,transparent,transparent 70px,#CCC 70px,#CCC 71px)
//	,repeating-linear-gradient(-90deg,transparent,transparent 70px,#CCC 70px,#CCC 71px);
//background-size: 71px 71px;
let showGrid = () => {
	let grid = patcher.grid;
	let bgcolor = patcher.bgcolor;
	let isWhite = bgcolor[0] + bgcolor[1] + bgcolor[2] < 128 * 3;
	let gridColor = isWhite ? "#FFFFFF30" : "#00000030";
	let pxx = grid[0] + "px";
	let pxx1 = (grid[0] - 1) + "px";
	let pxy = grid[1] + "px";
	let pxy1 = (grid[1] - 1) + "px";
	let sBGImageX = "repeating-linear-gradient(" + ["0deg, transparent, transparent " + pxx1, gridColor + " " + pxx1, gridColor + " " + pxx].join(", ") + ")";
	let sBGImageY = "repeating-linear-gradient(" + ["-90deg, transparent, transparent " + pxy1, gridColor + " " + pxy1, gridColor + " " + pxy].join(", ") + ")";
	$("#patcher").addClass("grid").css("background-image", sBGImageX + ", " + sBGImageY).css("background-size", pxx + " " + pxy);
	
	patcher.state.showGrid = true;
	$("#grid").children("i.th").addClass("enabled");
}

let hideGrid = () => {
	$("#patcher").removeClass("grid").css("background-image", "").css("background-size", "");
	if (!patcher.state.locked) patcher.state.showGrid = false;
	$("#grid").children("i.th").removeClass("enabled");
}