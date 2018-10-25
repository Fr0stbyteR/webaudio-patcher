import $ from 'jquery';
import Patcher from "./Patcher.js";
import UIObj from "./UIObj.js";
import "jquery-ui/ui/widgets/draggable.js";
import "jquery-ui/ui/widgets/resizable.js";
import "jquery-ui/themes/base/draggable.css";
import "jquery-ui/themes/base/resizable.css";
import "jquery-ui-touch-punch";
import "../semantic/dist/semantic.min.js";
import Selection from "./selection-js/src/selection.js"
window.$ = $, window.jQuery = $;


let patcher = new Patcher();
window.patcher = patcher;

let keysPressed = {
	_check(key) {
		if (typeof key === "string") return this.hasOwnProperty(key) && this[key];
		if (Array.isArray(key)) {
			let res = true;
			key.forEach(k => res = res && this._check(k));
			return res;
		}
		if (typeof key === "object") {
			let res = true;
			for (const k in key) {
				if (key.hasOwnProperty(k)) res = res && (key[k] == this._check(k))
			}
			return res;
		}
		return false;
	},
	_funcKeys: ["Ctrl", "Shift", "Alt", "AltGrqph", "Meta"],
	_hasFuncKeys() {
		return this._check(this._funcKeys);
	},
	_onlyFuncKeys(keys) {
		if (typeof keys == "string") keys = [keys];
		let map = {};
		this._funcKeys.forEach(key => map[key] = false);
		keys.forEach(key => map[key] = true);
		return this._check(map);
	}
};
let mouseOffset = [0, 0];
let clipboard = {boxes : [], lines : []};

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
		let objUI = obj.requestUI($, box);
		dom.find(".box-ui").append(objUI);
		$(".boxes").append(dom);
		if (!objUI.data("resizeVertical")) dom.height("auto");
		dom.draggable({
			start: (event, ui) => {
				ui.helper.addClass("dragged");
				$('.box.selected').each((i) => {
					let box = $('.box.selected').eq(i)
					box.data("originalPosition", [box.position().top, box.position().left]);
				})
			},
			drag: (event, ui) => {
				if (patcher.state.showGrid) {
					ui.position.top -= ui.position.top % patcher.grid[0];
					ui.position.left -= ui.position.left % patcher.grid[1];
				}
				let d = [ui.position.top - ui.originalPosition.top, ui.position.left - ui.originalPosition.left];
				$('.box.selected').each((i) => {
					let box = $('.box.selected').eq(i);
					box.css("top", box.data("originalPosition")[0] + d[0])
					.css("left", box.data("originalPosition")[1] + d[1]);
					updateLineByBox(box.attr("id"));
				})
			},
			stop: (event, ui) => {
				$('.box.selected').each((i) => {
					let box = $('.box.selected').eq(i);
					patcher.newTimestamp();
					updateLineByBox(box.attr("id"));
					updateBoxRect(box.attr("id"));
				})
			}
		}).resizable({
			handles: objUI.data("resizeVertical") ? "e, w, n, s, ne, se, sw, nw" : "e, w",
			minHeight: 22,
			grid: patcher.state.showGrid ? patcher.grid : [1, 1],
			resize: (event, ui) => {
				updateLineByBox(ui.helper.attr("id"));
			},
			stop: (event, ui) => {
				patcher.newTimestamp();
				updateBoxRect(ui.helper.attr("id"));
			}
		});
		updateBoxResizable(objUI, box.id);
		updateBoxIO(box.id);
		updateBoxRect(box.id);
	});
	patcher.on("redrawBox", (box) => {
		updateBoxUI(box);
		updateBoxIO(box.id);
		updateBoxRect(box.id);
		updateLineByBox(box.id);
	});
	patcher.on("changeBoxText", (box, oldText, text) => {
		updateBoxUI(box);
		updateBoxIO(box.id);
		updateBoxRect(box.id);
		updateLineByBox(box.id);
	});
	patcher.on("deleteBox", (box) => {
		$("#" + box.id).remove();
	});
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
	patcher.on("redrawLine", (line) => {
		updateLine(line.id);
	});
	patcher.on("changeLine", (line, isSrc, oldCon, con) => {
		updateLine(line.id);
		updateBoxIO(oldCon[0]);
		updateBoxIO(line.src[0]);
		updateBoxIO(line.dest[0]);
	});
	patcher.on("resizeBox", (box) => {
		updateBoxResizable($("#" + box.id).find(".box-ui").children().eq(0), box.id);
		updateLineByBox(box.id);
		updateBoxRect(box.id);
	});
	patcher.on("forceBoxRect", (id, rect) => {
		$("#" + id).css({left : rect[0], top : rect[1], width : rect[2], height : rect[3]});
		updateBoxResizable($("#" + id).find(".box-ui").children().eq(0), id);
		updateLineByBox(id);
		updateBoxRect(id);
	})
	patcher.on("deleteLine", (line) => {
		$("#" + line.id).remove();
		updateBoxIO(line.src[0]);
		updateBoxIO(line.dest[0]);
	});

	patcher.on("newLog", (log) => {
		$("#log tbody").append(
			$('<tr>').addClass(log[0] == 1 ? "error" : log[0] == -1 ? "warning" : log[0] == -2 ? "positive" : "")
			.append($('<td>').addClass(["two", "wide"]).text(log[1]))
			.append($('<td>').addClass(["fourteen", "wide"]).text(log[2]))
		)
		$("#console").animate({
			scrollTop: $("#console").get(0).scrollHeight
		}, 100)
	});

	patcher.on("audioCtxState", (state) => {
		switch (state) {
			case "running":
				$("#audio_on").removeClass("disabled");
				$("#audio_on i").addClass("enabled");
				break;
			case "suspended":
				$("#audio_on").removeClass("disabled");
				$("#audio_on i").removeClass("enabled");
				break;
			case "closed":
				$("#audio_on").addClass("disabled");
				$("#audio_on i").removeClass("enabled");
				break;
			default:
				break;
		}
	});

	fetch("patcher.json").then(response => {
		return response.json();
	}).then(content => patcher.load(content));

	//keys
	$(document).on("keydown", (e) => {
		if ($(".editing").attr("contenteditable")) return;
		keysPressed[(e.key == "Control" || e.key == "Command") ? "Ctrl" : e.key] = true;
		if (e.key == "Delete" || e.key == "Backspace") { // delete selection
			$("#delete").click();
			return;
		}
		if (e.key == "ArrowLeft" || e.key == "ArrowRight" || e.key == "ArrowUp" || e.key == "ArrowDown"
				&& !patcher.state.locked) { // move object
			$('.box.selected').each((i) => {
				let box = $('.box.selected').eq(i);
				let animation = {};
				if (e.key == "ArrowLeft") animation = {left : "-=" + (patcher.state.showGrid ? patcher.grid[0] : 1)};
				if (e.key == "ArrowRight") animation = {left : "+=" + (patcher.state.showGrid ? patcher.grid[0] : 1)};
				if (e.key == "ArrowUp") animation = {top : "-=" + (patcher.state.showGrid ? patcher.grid[1] : 1)};
				if (e.key == "ArrowDown") animation = {top : "+=" + (patcher.state.showGrid ? patcher.grid[1] : 1)};
				box.animate(animation, 0, () => {
					patcher.newTimestamp();
					updateLineByBox(box.attr("id"));
					updateBoxRect(box.attr("id"));
				});
			})
			e.preventDefault();
			return;
		}
		if (e.key == "n") { // Ctrl + Shift + N, N : new object
			if (keysPressed._onlyFuncKeys(["Ctrl", "Shift"])) {
				$("#new_patcher").click();
				e.preventDefault();
				return;
			}
			if (!keysPressed._hasFuncKeys()) {
				let box = {
					patching_rect: [mouseOffset[0], mouseOffset[1], 100, 22]
				}
				patcher.newTimestamp();
				box = patcher.createBox(box);
				$("#" + box.id).width("auto").mousedown().find("span").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "m") { // M : new message
			if (!keysPressed._hasFuncKeys()) {
				let box = {
					patching_rect : [mouseOffset[0], mouseOffset[1], 100, 22],
					text : "Message"
				}
				patcher.newTimestamp();
				box = patcher.createBox(box);
				$("#" + box.id).width("auto").mousedown().find(".box-ui-text-container").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "o") { // Ctrl + O
			if (keysPressed._onlyFuncKeys(["Ctrl"])) {
				$("#open").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "z") { // Ctrl + Z
			if (keysPressed._onlyFuncKeys(["Ctrl"]) && !patcher.state.locked) {
				$("#undo").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "y") { // Ctrl + Y
			if (keysPressed._onlyFuncKeys(["Ctrl"]) && !patcher.state.locked) {
				$("#redo").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "c") { // Ctrl + C
			if (keysPressed._onlyFuncKeys(["Ctrl"]) && !patcher.state.locked) {
				$("#copy").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "v") { // Ctrl + V
			if (keysPressed._onlyFuncKeys(["Ctrl"]) && !patcher.state.locked) {
				$("#paste").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "x") { // Ctrl + X
			if (keysPressed._onlyFuncKeys(["Ctrl"]) && !patcher.state.locked) {
				$("#cut").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "a") { // Ctrl + A
			if (keysPressed._onlyFuncKeys(["Ctrl"]) && !patcher.state.locked) {
				$("#select_all").click();
				e.preventDefault();
			}
			return;
		}
		if (e.key == "d") { // Ctrl + D
			if (keysPressed._onlyFuncKeys(["Ctrl"]) && !patcher.state.locked) {
				$("#duplicate").click();
				e.preventDefault();
			}
			return;
		}
	}).on("keyup", (e) => {
		keysPressed[(e.key == "Control" || e.key == "Command") ? "Ctrl" : e.key] = false;
	});
	$(window).on("blur", (e) => {
		for (const key in keysPressed) {
			if (typeof keysPressed[key] == "boolean") keysPressed[key] = false;
		}
	})

	$(document).on("dblclick", ".boxes", (e) => {
		if (patcher.state.locked) return;
		if (keysPressed._hasFuncKeys()) return;
		let box = {
			patching_rect: [e.offsetX, e.offsetY, 100, 22]
		}
        patcher.newTimestamp();
		box = patcher.createBox(box);
		$("#" + box.id).width("auto").mousedown().find("span").click();
	}).on("dblclick", ".boxes div", (e) => {
		e.stopPropagation();
	}).on("mousedown touchstart", ".boxes", (e) => {
		$(".editing").blur();
		if (keysPressed._hasFuncKeys()) return;
		$(".box.selected, .line.selected").removeClass("selected");
	}).on("mousedown touchstart", ".box, .line", (e) => {
		e.stopPropagation();
	}).on("mouseup touchend", ".boxes", (e) => {
		if (keysPressed._check("Ctrl")) {
			if ($(e.target).hasClass("boxes")) {
				if (patcher.state.locked) unlockPatcher();
				else lockPatcher();
				e.stopPropagation();
			}
		}
	}).on("mousemove touchmove", ".boxes", (e) => {
		mouseOffset = [e.offsetX, e.offsetY];
	});

	//ui
	$("#patcher").on("scroll", (e) => {
		$(e.target).css("background-position", -e.target.scrollLeft + "px -" + e.target.scrollTop + "px");
		$(".boxes, .lines").css("height", e.target.scrollHeight).css("width", e.target.scrollWidth);
	});
	const selection = Selection.create({
		class: "selection",
		startThreshold: 2,
		targetDOM: "#patcher>.boxes",
		boundaries: ["#patcher.unlocked"],
		selectables: [".box"],
		validateStart(e) {
			if (patcher.state.locked) return false;
			return true;
		},
		onStart(e) {
			// Get elements which has been selected so far
			const selectedElements = e.selectedElements;
			// Remove class if the user don't pressed the control key or command key
			if (!e.originalEvent.ctrlKey && !e.originalEvent.metaKey) {
				// Unselect all elements
				selectedElements.forEach(s => s.classList.remove('selected'));
				// Clear previous selection
				this.clearSelection();
			}
		},
		onMove(e) {
			// Get the currently selected elements and those
			// which where removed since the last selection.
			const selectedElements = e.selectedElements;
			const removedElements = e.changedElements.removed;
			// Add a custom class to the elements which where selected.
			selectedElements.forEach(s => s.classList.add('selected'));
			// Remove the class from elements which where removed
			// since the last selection
			removedElements.forEach(s => s.classList.remove('selected'));
			const t = $("#patcher").get(0);
			const x = e.originalEvent.clientX - t.offsetLeft;
			const y = e.originalEvent.clientY - t.offsetTop;
			if (x < 10) t.scrollLeft += x - 10;
			if (x > t.offsetWidth - 10) t.scrollLeft += x + 10 - t.offsetWidth;
			if (y < 10) t.scrollTop += y - 10;
			if (y > t.offsetHeight - 10) t.scrollTop += y + 10 - t.offsetHeight;
		},
		onStop() {
			this.keepSelection();
		}
	})
	$("#sidebar").resizable({
		handles: "w",
		resize: (event, ui) => {
			ui.position.left = 0;
		},
		stop: (event, ui) => {
			if (ui.size.width < 100) hideSidebar();
		}
	})
	//boxes
	$(document).on("mousedown touchdown", ".box", (e) => {
		if (patcher.state.locked) return;
		$(e.currentTarget).removeClass("dragged");
		
		if (keysPressed._onlyFuncKeys(["Ctrl"])) {
			if ($(e.currentTarget).hasClass("selected")) {
				$(e.currentTarget).removeClass("selected");
			} else {
				$(e.currentTarget).addClass("selected").resizable("enable").focus();
			}
		} else {
			if ($(e.currentTarget).hasClass("selected")) return;
			$(".box.selected, .line.selected").removeClass("selected");
			$(e.currentTarget).addClass("selected").resizable("enable").focus();
		}
	}).on("blur", ".box.selected", (e) => {
		if (patcher.state.locked) return;
		if (!$.contains($(".boxes").get(0), e.currentTarget)) return; //if deleted
		//$(e.currentTarget).removeClass("selected");
	});
	//lines
	$(document).on("mousedown touchdown", ".line", (e) => {
		if (patcher.state.locked) return;
		if ($(e.currentTarget).hasClass("selected")) return;
		$(".selected").removeClass("selected");
		$(e.currentTarget).addClass("selected");
		updateLine($(e.currentTarget).attr("id"));
	}).on("blur", ".line.selected", (e) => {
		if (patcher.state.locked) return;
		if (!$.contains(document, $(e.currentTarget))) return; //if deleted
		//$(e.currentTarget).removeClass("selected");
	});

	//Menu
	$("#menu .dropdown").dropdown({
		action: "hide"
	});
	$(document).on("click", "#new_patcher", (e) => {
		patcher.load();
	}).on("click", "#save", (e) => {
		let p = patcher.toString();
		let url = "data:text/plain;charset=utf-8," + encodeURIComponent(p);
		$("#save a").attr("download", "patcher.json").attr("href", url);
	}).on("click", "#open", (e) => {
		$("#open input").click(e => e.stopPropagation()).click();
	}).on("change", "#open input", (e) => {
		let file = $("#open input").get(0).files[0];
		if (file) loadPatcher(file);
	}).on("click", "#undo", (e) => {
		patcher._history.undo();
	}).on("click", "#redo", (e) => {
		patcher._history.redo();
	}).on("click", "#copy", (e) => {
		clipboard = {boxes : [], lines : []};
		$(".box.selected").each((i) => {
			clipboard.boxes.push(patcher.boxes[$(".box.selected").eq(i).attr("id")]);
		});
		clipboard.lines = patcher.getLinesByBoxes(clipboard.boxes);
	}).on("click", "#cut", (e) => {
		clipboard = {boxes : [], lines : []};
		$(".box.selected").each((i) => {
			clipboard.boxes.push(patcher.boxes[$(".box.selected").eq(i).attr("id")]);
		});
		clipboard.lines = patcher.getLinesByBoxes(clipboard.boxes);
		$("#delete").click();
	}).on("click", "#paste", (e) => {
		patcher.newTimestamp();
		clipboard = patcher.paste(clipboard);
		$(".box.selected, .line.selected").removeClass("selected");
		for (const box of clipboard.boxes) {
			$("#" + box.id).addClass("selected");
		}
		for (const line of clipboard.lines) {
			$("#" + line.id).addClass("selected");
		}
	}).on("click", "#duplicate", (e) => {
		$("#copy").click();
		$("#paste").click();
	}).on("click", "#select_all", (e) => {
		$(".box, .line").addClass("selected");
	}).on("click", "#delete", (e) => {
		if (!patcher.state.locked) {
			let boxIDs = [];
			$(".box.selected").each((i) => {
				boxIDs.push($(".box.selected").eq(i).attr("id"));
			});
			let lineIDs = [];
			$(".line.selected").each((i) => {
				lineIDs.push($(".line.selected").eq(i).attr("id"));
			});
			if (boxIDs.length + lineIDs.length > 0) patcher.newTimestamp();
			lineIDs.forEach((id) => {
				patcher.deleteLine(id);
			});
			boxIDs.forEach((id) => {
				patcher.deleteBox(id);
			});
		}
	}).on("click", "#show_sidebar", (e) => {
		if ($("#sidebar").is(':visible')) hideSidebar();
		else showSidebar();
	});
	
	//Toolbar
	$(document).on("click", "#lock", (e) => {
		if (patcher.state.locked) unlockPatcher();
		else lockPatcher();
	}).on("click", "#grid", (e) => {
		if (patcher.state.showGrid) hideGrid();
		else showGrid();
	}).on("click", "#audio_on", (e) => {
		if (patcher._audioCtx) {
			if (patcher._audioCtx.state == "suspended") patcher._audioCtx.resume();
			if (patcher._audioCtx.state == "running") patcher._audioCtx.suspend();
		}
	});
	if (patcher._audioCtx.state == "running") $("#audio_on").addClass("enabled");

	
	let lockPatcher = () => {
		$(".selected").removeClass("selected");
		$(".box").blur();
		$(".line").blur();
		$(".box.ui-draggable").draggable("disable");
		$(".box-port.ui-draggable").draggable("disable");
		patcher.state.locked = true;
		$("#lock i").removeClass("open");
		$("#patcher").removeClass("unlocked").addClass("locked");
		hideGrid();
		$("#grid i").addClass("disabled");
		$("#undo, #redo").addClass("disabled");
	}

	let unlockPatcher = () => {
		$(".selected").removeClass("selected");
		$(".box").blur();
		$(".line").blur();
		$(".box.ui-draggable").draggable("enable");
		$(".box-port.ui-draggable").draggable("enable");
		patcher.state.locked = false;
		$("#lock i").addClass("open");
		$("#patcher").removeClass("locked").addClass("unlocked");
		if (patcher.state.showGrid) showGrid();
		$("#grid i").removeClass("disabled");
		$("#undo, #redo").removeClass("disabled");
	}

	//background-image: repeating-linear-gradient(0deg,transparent,transparent 70px,#CCC 70px,#CCC 71px)
	//	,repeating-linear-gradient(-90deg,transparent,transparent 70px,#CCC 70px,#CCC 71px);
	//background-size: 71px 71px;
	let showGrid = () => {
		let grid = patcher.grid;
		let bgcolor = patcher.bgcolor;
		let isWhite = bgcolor[0] + bgcolor[1] + bgcolor[2] < 128 * 3;
		let gridColor = isWhite ? "#FFFFFF1A" : "#0000001A";
		let pxx = grid[0] + "px";
		let pxx1 = (grid[0] - 1) + "px";
		let pxy = grid[1] + "px";
		let pxy1 = (grid[1] - 1) + "px";
		let sBGImageX = "repeating-linear-gradient(" + ["0deg, transparent, transparent " + pxx1, gridColor + " " + pxx1, gridColor + " " + pxx].join(", ") + ")";
		let sBGImageY = "repeating-linear-gradient(" + ["-90deg, transparent, transparent " + pxy1, gridColor + " " + pxy1, gridColor + " " + pxy].join(", ") + ")";
		$("#patcher").addClass("grid").css("background-image", sBGImageX + ", " + sBGImageY).css("background-size", pxx + " " + pxy);
		
		patcher.state.showGrid = true;
		$("#grid i").addClass("enabled");
		$(".box").resizable("option", "grid", grid);
	}

	let hideGrid = () => {
		$("#patcher").removeClass("grid").css("background-image", "").css("background-size", "");
		if (!patcher.state.locked) patcher.state.showGrid = false;
		$("#grid i").removeClass("enabled");
		$(".box").resizable("option", "grid", [1, 1]);
	}
	
	let hideSidebar = () => {
		$("#sidebar").hide(100);
		$("#show_sidebar i").removeClass("enabled");
	}

	let showSidebar = () => {
		if ($("#sidebar").width() < 100) $("#sidebar").width(300);
		$("#sidebar").show(100);
		$("#show_sidebar i").addClass("enabled");
	}
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
	lineObj.positionHash = dest[0] * 65536 + dest[1];
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
			let line;
			if (isSrc) line = {
				src: closest,
				dest: [ui.helper.parents(".box").attr("id"), +ui.helper.attr("data-index")]
			};
			else line = {
				src: [ui.helper.parents(".box").attr("id"), +ui.helper.attr("data-index")],
				dest: closest
			};
			if (patcher.canCreateLine(line)) {
				patcher.newTimestamp();
				patcher.createLine(line);
			}
		}
	});
}

let updateBoxRect = (id) => {
	let jq = $("#" + id);
	let l = jq.position().left;
	let t = jq.position().top;
	let w = jq.outerWidth();
	let h = jq.outerHeight();
	patcher.updateBoxRect(id, [l, t, w, h]);
}

let updateBoxUI = (box) => {
	let obj = patcher.getObjByID(box.id);
	let objUI = obj.newUI($, box);
	$("#" + box.id).find(".box-ui").empty().append(objUI);
	$("#" + box.id).find(".box-inlets").replaceWith(UIObj.inlets($, box.inlets))
	$("#" + box.id).find(".box-outlets").replaceWith(UIObj.outlets($, box.outlets));
	updateBoxResizable(objUI, box.id);
}

let updateBoxResizable = (objUI, id) => {
	let resizeVertical = objUI.data("resizeVertical");
	let resizeMinHeight = objUI.data("resizeMinHeight");
	$("#" + id).resizable("option", "handles", resizeVertical ? "e, w, n, s, ne, se, sw, nw" : "e, w")
	if (resizeVertical) {
		if (resizeMinHeight) {
			$("#" + id).resizable("option", "minHeight", resizeMinHeight);
			if ($("#" + id).height() < resizeMinHeight) $("#" + id).height(resizeMinHeight);
		}
	} else {
		$("#" + id).resizable("option", "minHeight", 22)
	}
	$("#" + id).find(".ui-resizable-handle").css("display", "");
}