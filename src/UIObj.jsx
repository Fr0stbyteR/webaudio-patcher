import React from 'react';
import PropTypes from 'prop-types';
class Inlet extends React.Component {
	render() {
		return (
			<div className={this.props.isHot ? "object-inlet object-port object-inlet-hot" : "object-inlet object-port object-inlet-cold"}></div>
		)
	}
}

Inlet.propTypes = {
	isHot: PropTypes.bool.isRequired,
}

class Outlet extends React.Component {
	render() {
		return (
			<div className="object-outlet object-port"></div>
		);
	}
}

class Box extends React.Component {
	render() {
		let divStyle = {
			"left": this.props.patching_rect[0],
			"top": this.props.patching_rect[1],
			"width": this.props.patching_rect[2]//,
			//	"height": this.props.patching_rect[3]
		};
		let inlets = [];
		for (let i = 0; i < this.props.inlets; i++) {
			inlets.push(<Inlet isHot={true} key={"inlet_" + i} />)
		}
		let outlets = [];
		for (let i = 0; i < this.props.outlets; i++) {
			outlets.push(<Outlet key={"outlet_" + i} />)
		}
		return (
			<div tabIndex="0" className="object object-default" id={this.props.id} style={divStyle}>
				<div className="object-inlets">
					{inlets}
				</div>
				<div className="object-outlets">
					{outlets}
				</div>
				<p>{this.props.text}</p>
			</div>
		);
	}
}

Box.propTypes = {
	id: PropTypes.string.isRequired,
	text: PropTypes.string,
	patching_rect: PropTypes.arrayOf(PropTypes.number).isRequired,
	inlets: PropTypes.number,
	outlets: PropTypes.number,
}

class Line extends React.Component {
	render() {

		let start = this.props.start;
		let dest = this.props.dest;

		let style = {
			"left": Math.min(start[0], dest[0]) - 5,
			"top": Math.min(start[1], dest[1]) - 10,
			"width": Math.abs(start[0] - dest[0]) + 10,
			"height": Math.abs(start[1] - dest[1]) + 20,
		};
		let d = ["M", start[0] - style.left, start[1] - style.top, "L", dest[0] - style.left, dest[1] - style.top];
		return (
			<div id={this.props.id} key={this.props.id} className="line" style={style} tabIndex="0">
				<svg className="line-svg" width={style.width} height={style.height}>
					<path className="line-path" d={d.join(" ")}></path>
				</svg>
				<div className="line-handler line-handler-src hidden"></div>
				<div className="line-handler line-handler-dest hidden"></div>
			</div>
		)
	}
}
Line.propTypes = {
	id: PropTypes.string,
	start: PropTypes.arrayOf(PropTypes.number),
	dest: PropTypes.arrayOf(PropTypes.number),
}

class Boxes extends React.Component {
	render() {
		let boxes = this.props.boxes;
		let doms = [];

		for (const id in boxes) {
			const box = boxes[id];
			doms.push(<Box {...box} key={id} id={id} />);
		}
		return (
			doms
		);
	}
}
Boxes.propTypes = {
	boxes: PropTypes.object
}
