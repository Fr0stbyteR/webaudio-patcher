import Base from "./Base.js";
import * as Xebra from "xebra.js";
let states = {};
let count = {};
class State extends Base.BaseObject {
    static get _meta() {
        return Object.assign(super._meta, {
            package : "Xebra",
            icon : "microchip", 
            author : "Fr0stbyteR",
            version : "1.0.0",
        });
    }
    constructor(box, patcher) {
        super(box, patcher);
        this._mem.hostname = null;
        this._mem.port = null;
        this._mem.channel = null;
        this.update(box.args, box.props);
    }

    update(args, props) {
        if (!args) {
            this._mem.hostname = null;
            this._mem.port = null;
            this._mem.channel = null;
            return this.error("Address not defined");
        }
        const curAddress = this._mem.hostname + ":" + this._mem.port;
        if (args[0] && typeof args[0] === "string" && args[0] != curAddress) {
            if (count[curAddress]) count[curAddress]--
            if (count[curAddress] == 0) {
                states[curAddress].close();
                delete states[curAddress];
                delete count[curAddress];
            }
            const split = args[0].split(":");
            if (split.length == 2) {
                if (states[args[0]]) count[args[0]]++;
                else try {
                    let state = new Xebra.State({ hostname : split[0], port : split[1] });
                    state.connect();
                    states[args[0]] = state;
                    count[args[0]] = 1;
                    this._mem.hostname = split[0];
                    this._mem.port = split[1];
                } catch (e) {
                    this.error(e);
                }
            } else {
                this.error("Address parsing failed.")
            }
        }
        if (args[1] && typeof args[1] === "string") this._mem.channel = args[1];
        else this._mem.channel = null;
        return this;
    }

    destroy() {
        const curAddress = this._mem.hostname + ":" + this._mem.port;
        if (count[curAddress]) count[curAddress]--
        if (count[curAddress] == 0) {
            states[curAddress].close();
            delete states[curAddress];
            delete count[curAddress];
        }
        return super.destroy();
    }
}

class Receive extends State {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Receive messages from Xebra channel",
            outlets : [{
                isHot : true,
                type : "anything",
                description : "Received from Xebra channel"
            }],
            args : [{
                type : "string",
                optional : false,
                description : "hostname:port"
            }, {
                type : "string",
                optional : true,
                description : "channel name"
            }]
        });
    }

    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 0;
        this._outlets = 2;
    }

    update(args, props) {
        const curAddress = this._mem.hostname + ":" + this._mem.port;
        if (args && args[0] == curAddress && args[1] == this._mem.channel) return this;
        super.update(args, props);
        const newAddress = this._mem.hostname + ":" + this._mem.port;
        if (!this._mem.hostname || !this._mem.port) return this.error("Address not defined");
        if (curAddress != newAddress) {
            if (states[curAddress]) states[curAddress].removeListener("channel_message_received", this._mem.callback);
            if (states[newAddress]) states[newAddress].on("channel_message_received", this._mem.callback);
        }
        return this;
    }

    destroy() {
        const curAddress = this._mem.hostname + ":" + this._mem.port;
        if (states[curAddress]) {
            states[curAddress].removeListener("channel_message_received", this._mem.callback);
        }
        return super.destroy();
    }
}

class Send extends State {
    static get _meta() {
        return Object.assign(super._meta, {
            description : "Send messages to Xebra channel",
            inlets : [{
                isHot : true,
                type : "anything",
                description : "Send to Xebra channel"
            }],
            args : [{
                type : "string",
                optional : false,
                description : "hostname:port"
            }, {
                type : "string",
                optional : false,
                description : "channel name"
            }]
        });
    }

    constructor(box, patcher) {
        super(box, patcher);
        this._inlets = 1;
        this._outlets = 0;
        this._mem.callback = (chan, data) => {
            if (!this._mem.channel || chan == this._mem.channel) return this.outlet(0, data);
        };
    }

    update(args, props) {
        const curAddress = this._mem.hostname + ":" + this._mem.port;
        if (args && args[0] == curAddress && args[1] == this._mem.channel) return this;
        super.update(args, props);
        if (!this._mem.hostname || !this._mem.port) return this.error("Address not defined");
        if (!this._mem.channel) return this.error("Channel not defined.");
        return this;
    }

    fn(data, inlet) {
        const state = states[this._mem.hostname + ":" + this._mem.port];
        if (!state) return this.error("State not initiated")
        if (state.connectionState !== Xebra.CONNECTION_STATES.CONNECTED) return this.error("State not connected");
        if (!this._mem.channel) return this.error("Channel not specified")
        state.sendMessageToChannel(this._mem.channel, data);
    }
}
export default {
    Send,
    Receive
}