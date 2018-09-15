import FaustWasm from "./libfaust-wasm.js";
import SHA1 from "./SHA1.js"
//const FaustWasm = require("./libfaust-wasm.js");
//const SHA1 = require("./SHA1.js");
/*
 faust2webaudio

 Primarily written by Myles Borins
 During the Spring 2013 offering of Music 420b with Julius Smith
 A bit during the Summer of 2013 with the help of Joshua Kit Clayton
 And finally a sprint during the late fall of 2013 to get everything working
 A Special thanks to Yann Orlarey and Stéphane Letz

 faust2webaudio is distributed under the terms the MIT or GPL2 Licenses.
 Choose the license that best suits your project. The text of the MIT and GPL
 licenses are at the root directory.

 Additional code: GRAME 2014-2017

 ES6 version by Shihong REN
*/

FaustWasm.lengthBytesUTF8 = (str) => {
    let len = 0; 
    for (let i = 0; i < str.length; ++i) { 
        let u = str.charCodeAt(i); 
        if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023; 
        if (u <= 127) ++len; 
        else if (u <= 2047) len += 2;
        else if (u <= 65535) len += 3;
        else if (u <= 2097151) len += 4;
        else if (u <= 67108863) len += 5;
        else len += 6;
    } 
    return len;
}

class Faust {
    constructor() {

        this.debug = false;

        // Low-level API
        this.createWasmCDSPFactoryFromString = FaustWasm.cwrap('createWasmCDSPFactoryFromString', 'number', ['number', 'number', 'number', 'number', 'number', 'number']);
        this.expandCDSPFromString = FaustWasm.cwrap('expandCDSPFromString', 'number', ['number', 'number', 'number', 'number', 'number', 'number']);
        this.getCLibFaustVersion = FaustWasm.cwrap('getCLibFaustVersion', 'number', []);
        this.getWasmCModule = FaustWasm.cwrap('getWasmCModule', 'number', ['number']);
        this.getWasmCModuleSize = FaustWasm.cwrap('getWasmCModuleSize', 'number', ['number']);
        this.getWasmCHelpers = FaustWasm.cwrap('getWasmCHelpers', 'number', ['number']);
        this.freeWasmCModule = FaustWasm.cwrap('freeWasmCModule', null, ['number']);
        this.freeCMemory = FaustWasm.cwrap('freeCMemory', null, ['number']);
        this.cleanupAfterException = FaustWasm.cwrap('cleanupAfterException', null, []);
        this.getErrorAfterException = FaustWasm.cwrap('getErrorAfterException', 'number', []);

        this.error_msg = null;
        this.factory_number = 0;
        this.factory_table = [];

    }

    static remap(v, mn0, mx0, mn1, mx1) {
        return (1.0 * (v - mn0) / (mx0 - mn0)) * (mx1 - mn1) + mn1;
    }

    static ab2str(buf) {
        return buf ? String.fromCharCode.apply(null, new Uint8Array(buf)) : null;
    }

    static str2ab(str) {
        if (str) {
            let buf = new ArrayBuffer(str.length);
            let bufView = new Uint8Array(buf);
            for (let i = 0, strLen = str.length; i < strLen; i++) {
                bufView[i] = str.charCodeAt(i);
            }
            return buf;
        } else {
            return null;
        }
    }

    getErrorMessage() {
        return this.error_msg;
    }

    getLibFaustVersion() {
        return FaustWasm.Pointer_stringify(this.getCLibFaustVersion());
    }

    compileCode(factory_name, code, argv, internal_memory) {
        let code_ptr = FaustWasm._malloc(code.length + 1);
        let name = "FaustDSP";
        let name_ptr = FaustWasm._malloc(name.length + 1);
        let error_msg_ptr = FaustWasm._malloc(4096);

        FaustWasm.stringToUTF8(name, name_ptr, FaustWasm.lengthBytesUTF8(name) + 1);
        FaustWasm.stringToUTF8(code, code_ptr, FaustWasm.lengthBytesUTF8(code) + 1);

        // Add 'cn' option with the factory name
        let argv_aux = (argv === undefined) ? new Array() : argv;
        argv_aux.push("-cn", factory_name);

        // Prepare 'argv_aux' array for C side
        let ptr_size = 4;
        let argv_ptr = FaustWasm._malloc(argv_aux.length * ptr_size);  // Get buffer from emscripten.
        let argv_ptr_buffer = new Int32Array(FaustWasm.HEAP32.buffer, argv_ptr, argv_aux.length);  // Get a integer view on the newly allocated buffer.
        for (let i = 0; i < argv_aux.length; i++) {
            let arg_ptr = FaustWasm._malloc(argv_aux[i].length + 1);
            FaustWasm.stringToUTF8(argv_aux[i], arg_ptr, FaustWasm.lengthBytesUTF8(argv_aux[i]) + 1);
            argv_ptr_buffer[i] = arg_ptr;
        }
        try {
            // let time1 = performance.now();
            let module_code_ptr = this.createWasmCDSPFactoryFromString(name_ptr, code_ptr, argv_aux.length, argv_ptr, error_msg_ptr, internal_memory);
            // let time2 = performance.now();

            // console.log("Faust compilation duration : " + (time2 - time1));

            this.error_msg = FaustWasm.Pointer_stringify(error_msg_ptr);

            if (module_code_ptr === 0) return null;

            let factory_code_ptr = this.getWasmCModule(module_code_ptr);
            let factory_code_size = this.getWasmCModuleSize(module_code_ptr);

            // Copy native 'binary' string in JavaScript Uint8Array
            let factory_code = new Uint8Array(factory_code_size);
            for (let i = 0; i < factory_code_size; i++) {
                // faster than 'getValue' which gets the type of access for each read...
                factory_code[i] = FaustWasm.HEAP8[factory_code_ptr + i];
            }

            let helpers_code_ptr = this.getWasmCHelpers(module_code_ptr);
            let helpers_code = FaustWasm.Pointer_stringify(helpers_code_ptr);

            // Free strings
            FaustWasm._free(code_ptr);
            FaustWasm._free(name_ptr);
            FaustWasm._free(error_msg_ptr);

            // Free C allocated wasm module
            this.freeWasmCModule(module_code_ptr);

            // Get an updated integer view on the newly allocated buffer after possible emscripten memory grow
            argv_ptr_buffer = new Int32Array(FaustWasm.HEAP32.buffer, argv_ptr, argv_aux.length);
            // Free 'argv' C side array
            for (let i = 0; i < argv_aux.length; i++) {
                FaustWasm._free(argv_ptr_buffer[i]);
            }
            FaustWasm._free(argv_ptr);

            return {
                code: factory_code,
                code_source: code,
                helpers: helpers_code
            }


        } catch (e) {
            // libfaust is compiled without C++ exception activated, so a JS exception is throwed and catched here
            this.error_msg = FaustWasm.Pointer_stringify(this.getErrorAfterException());
            if (this.error_msg === "") {
                // Report the Emscripten error
                this.error_msg = e;
            }
            this.cleanupAfterException();
            return null;
        }
    }

    createDSPFactoryAux(code, argv, internal_memory, callback) {
        // Code memory type and argv in the SHAKey to differentiate compilation flags and Monophonic and Polyphonic factories
        let argv_str = "";
        for (let i = 0; i < argv.length; i++) {
            argv_str += argv[i];
        }
        let sha_key = SHA1.hash(code + ((internal_memory) ? "internal_memory" : "external_memory") + argv_str, true);
        let factory = this.factory_table[sha_key];
        if (factory) {
            // console.log("Existing library : " + factory.name);
            // Existing factory, do not create it...
            callback(factory);
            return;
        }

        //console.log("libfaust.js version : " + this.getLibFaustVersion());

        // Factory name for DSP and effect
        let factory_name1 = "mydsp" + this.factory_number;
        let factory_name2 = "effect" + this.factory_number++;

        // Create 'effect' expression
        let code_effect = "adapt(1,1) = _; adapt(2,2) = _,_; adapt(1,2) = _ <: _,_; adapt(2,1) = _,_ :> _; adaptor(F,G) = adapt(outputs(F),inputs(G)); dsp_code = environment{";
        code_effect = code_effect.concat(code); 
        code_effect = code_effect.concat("};");
        code_effect = code_effect.concat("process = adaptor(dsp_code.process, dsp_code.effect) : dsp_code.effect;");

        let res1 = this.compileCode(factory_name1, code, argv, internal_memory);

        if (res1) {
            let res2 = this.compileCode(factory_name2, code_effect, argv, internal_memory);
            if (res2) {
                // Effect is in the code
                this.readDSPFactoryFromMachineAux(factory_name1, res1.code, res1.code_source, res1.helpers,
                    factory_name2, res2.code, res2.code_source, res2.helpers, sha_key, callback);
            } else {
                this.readDSPFactoryFromMachineAux(factory_name1, res1.code, res1.code_source, res1.helpers,
                    null, null, null, sha_key, callback);
            }
        } else {
            callback(null);
        }
    }

    /**
     * Create a DSP factory from source code as a string to be used to create 'monophonic' DSP
     *
     * @param code - the source code as a string
     * @param argv - an array of parameters to be given to the Faust compiler
     * @param callback - a callback taking the created DSP factory as parameter, or null in case of error
     */
    createDSPFactory(code, argv, callback) {
        this.createDSPFactoryAux(code, argv, true, callback);
    }

    /**
     * Create a DSP factory from source code as a string to be used to create 'polyphonic' DSP
     *
     * @param code - the source code as a string
     * @param argv - an array of parameters to be given to the Faust compiler
     * @param callback - a callback taking the created DSP factory as parameter, or null in case of error
     */
    createPolyDSPFactory(code, argv, callback) {
        this.createDSPFactoryAux(code, argv, false, callback);
    }

    /**
     * From a DSP source file, creates a 'self-contained' DSP source string where all needed librairies have been included.
     * All compilations options are 'normalized' and included as a comment in the expanded string.
     *
     * @param code - the source code as a string
     * @param argv - and array of paramaters to be given to the Faust compiler
     *
     * @return the expanded DSP as a string (possibly empty).
     */
    expandDSP(code, argv) {
        //console.log("libthis.js version : " + this.getLibFaustVersion());

        // Force "wasm" compilation
        argv.push("-lang");
        argv.push("wasm");

        // Allocate strings on the HEAP
        let code_ptr = FaustWasm._malloc(code.length + 1);
        let name = "FaustDSP";
        let name_ptr = FaustWasm._malloc(name.length + 1);
        let sha_key_ptr = FaustWasm._malloc(64);
        let error_msg_ptr = FaustWasm._malloc(4096);

        FaustWasm.stringToUTF8(name, name_ptr, FaustWasm.lengthBytesUTF8(name) + 1);
        FaustWasm.stringToUTF8(code, code_ptr, FaustWasm.lengthBytesUTF8(code) + 1);

        // Add 'cn' option with the factory name
        argv = (argv === undefined) ? new Array() : argv;

        // Prepare 'argv' array for C side
        let ptr_size = 4;
        let argv_ptr = FaustWasm._malloc(argv.length * ptr_size);  // Get buffer from emscripten.
        let argv_ptr_buffer = new Int32Array(FaustWasm.HEAP32.buffer, argv_ptr, argv.length);  // Get a integer view on the newly allocated buffer.
        for (let i = 0; i < argv.length; i++) {
            let arg_ptr = FaustWasm._malloc(argv[i].length + 1);
            FaustWasm.stringToUTF8(argv[i], arg_ptr, FaustWasm.lengthBytesUTF8(argv[i]) + 1);
            argv_ptr_buffer[i] = arg_ptr;
        }
        try {
            let expand_dsp_ptr = this.expandCDSPFromString(name_ptr, code_ptr, argv.length, argv_ptr, sha_key_ptr, error_msg_ptr);
            let expand_dsp = FaustWasm.Pointer_stringify(expand_dsp_ptr);
            let sha_key = FaustWasm.Pointer_stringify(sha_key_ptr);
            this.error_msg = FaustWasm.Pointer_stringify(error_msg_ptr);

            // Free strings
            FaustWasm._free(code_ptr);
            FaustWasm._free(name_ptr);
            FaustWasm._free(sha_key_ptr);
            FaustWasm._free(error_msg_ptr);

            // Free C allocated expanded string
            this.freeCMemory(expand_dsp_ptr);

            // Get an updated integer view on the newly allocated buffer after possible emscripten memory grow
            argv_ptr_buffer = new Int32Array(FaustWasm.HEAP32.buffer, argv_ptr, argv.length);
            // Free 'argv' C side array
            for (let i = 0; i < argv.length; i++) {
                FaustWasm._free(argv_ptr_buffer[i]);
            }
            FaustWasm._free(argv_ptr);

            return expand_dsp;
        } catch (e) {
            // libfaust is compiled without C++ exception activated, so a JS exception is throwed and catched here
            this.error_msg = FaustWasm.Pointer_stringify(this.getErrorAfterException());
            if (this.error_msg === "") {
                // Report the Emscripten error
                this.error_msg = e;
            }
            this.cleanupAfterException();
            return null;
        }
    }

    /**
     * Write a Faust DSP factory into struct containing name, Faust wasm compiled code, and helpers code.
     *
     * @param factory - the DSP factory
     *
     * @return the machine code as a struct.
     */
    writeDSPFactoryToMachine(factory) {
        return {
            name: factory.name,
            code: this.ab2str(factory.code),
            code_source: factory.code_source,
            helpers: factory.helpers,
            name_effect: factory.name_effect,
            code_effect: this.ab2str(factory.code_effect),
            code_source_effect: factory.code_source_effect,
            helpers_effect: factory.helpers_effect,
        };
    }

    /**
     * Create a Faust DSP factory from a machine code struct. Note that the library keeps an internal cache of all
     * allocated factories so that the compilation of the same DSP code (that is the same machine code file) will return
     * the same factory. You will have to explicitly use deleteDSPFactory when the factory is no more needed.
     *
     * @param machine - the machine code struct
     * @param callback - a callback taking the created DSP factory as parameter, or null in case of error
     *
     * @return the DSP factory on success, otherwise a null pointer.
     */
    readDSPFactoryFromMachine(machine, callback) {
        let sha_key = SHA1.hash(machine.code_source, true);
        let factory = this.factory_table[sha_key];
        if (factory) {
            // Existing factory, do not create it...
            callback(factory);
        } else {
            this.readDSPFactoryFromMachineAux(
                machine.name, this.str2ab(machine.code), machine.code_source, machine.helpers,
                machine.name_effect, this.str2ab(machine.code_effect), machine.code_source_effect, machine.helpers_effect,
                sha_key, callback);
        }
    }

    readDSPFactoryFromMachineAux(
        factory_name1, factory_code1, factory_code_source1, helpers_code1,
        factory_name2, factory_code2, factory_code_source2, helpers_code2,
        sha_key, callback) {
        //let time1 = performance.now();
        /*
        try {
            let binaryen_module = Binaryen.readBinary(factory_code1);
            //console.log("Binaryen based optimisation");
            binaryen_module.optimize();
            //console.log(binaryen_module.emitText());
            factory_code = binaryen_module.emitBinary();
            binaryen_module.dispose();
        } catch (e) {
            console.log("Binaryen not available, no optimisation...");
        }
        */
        WebAssembly.compile(factory_code1)
            .then(module => {
                //let time2 = performance.now();
                //console.log("WASM compilation duration : " + (time2 - time1));

                let factory = {
                    polyphony: [],  // Default mode
                    code: factory_code1,
                    code_source: factory_code_source1,
                    helpers: helpers_code1,
                    module: module
                };
                // 'libfaust.js' wasm backend generates UI methods, then we compile the code
                eval(helpers_code1);
                factory.getJSON = eval("getJSON" + factory_name1);
                factory.getBase64Code = eval("getBase64Code" + factory_name1);

                try {
                    factory.json_object = JSON.parse(factory.getJSON());
                } catch (e) {
                    this.error_msg = "Error in JSON.parse: " + e;
                    callback(null);
                    throw new Error(e);
                }

                factory.name = factory_name1;
                factory.sha_key = sha_key;
                this.factory_table[sha_key] = factory;

                // Possibly compile effect
                if (factory_name2) {
                    WebAssembly.compile(factory_code2)
                        .then(module_effect => {

                            factory.code_effect = factory_code2;
                            factory.code_source_effect = factory_code_source2;
                            factory.helpers_effect = helpers_code2;
                            factory.module_effect = module_effect;

                            // 'libthis.js' wasm backend generates UI methods, then we compile the code
                            eval(helpers_code2);
                            factory.getJSONeffect = eval("getJSON" + factory_name2);
                            factory.getBase64Codeeffect = eval("getBase64Code" + factory_name2);

                            try {
                                factory.effect_json_object = JSON.parse(factory.getJSONeffect());
                            } catch (e) {
                                this.error_msg = "Error in JSON.parse: " + e;
                                callback(null);
                                throw new Error(e);
                            }

                            factory.name_effect = factory_name2;
                            callback(factory);
                        }).catch((error) => {
                            this.error_msg = "Faust DSP factory cannot be compiled";
                            callback(null);
                            throw new Error(error);
                        })
                } else {
                    callback(factory);
                }
            }).catch((e) => {
                this.error_msg = "Faust DSP factory cannot be compiled";
                callback(null);
                throw new Error(e);
            });
    }

    deleteDSPFactory(factory) {
        this.factory_table[factory.sha_key] = null;
    }
}

class Faust2WebAudio {
    static remap(v, mn0, mx0, mn1, mx1) {
        return (1.0 * (v - mn0) / (mx0 - mn0)) * (mx1 - mn1) + mn1;
    }
    static Heap2Str(buf) {
        let str = "";
        let i = 0;
        while (buf[i] !== 0) {
            str += String.fromCharCode(buf[i++]);
        }
        return str;
    }
    static get importObject() {
        return {
            env: {
                memoryBase: 0,
                tableBase: 0,

                // Integer version
                _abs: Math.abs,

                // Float version
                _acosf: Math.acos,
                _asinf: Math.asin,
                _atanf: Math.atan,
                _atan2f: Math.atan2,
                _ceilf: Math.ceil,
                _cosf: Math.cos,
                _expf: Math.exp,
                _floorf: Math.floor,
                _fmodf: (x, y) => { return x % y; },
                _logf: Math.log,
                _log10f: Math.log10,
                _max_f: Math.max,
                _min_f: Math.min,
                _remainderf: (x, y) => { return x - Math.round(x / y) * y; },
                _powf: Math.pow,
                _roundf: Math.fround,
                _sinf: Math.sin,
                _sqrtf: Math.sqrt,
                _tanf: Math.tan,

                // Double version
                _acos: Math.acos,
                _asin: Math.asin,
                _atan: Math.atan,
                _atan2: Math.atan2,
                _ceil: Math.ceil,
                _cos: Math.cos,
                _exp: Math.exp,
                _floor: Math.floor,
                _fmod: (x, y) => { return x % y; },
                _log: Math.log,
                _log10: Math.log10,
                _max_: Math.max,
                _min_: Math.min,
                _remainder: (x, y) => { return x - Math.round(x / y) * y; },
                _pow: Math.pow,
                _round: Math.fround,
                _sin: Math.sin,
                _sqrt: Math.sqrt,
                _tan: Math.tan,

                table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' })
            }
        };
    }

    // Monophonic Faust Node

    /**
    * Constructor
    *
    * @param dspInstance - the wasm instance
    * @param audioCtx - the Web Audio audioCtx
    * @param bufferSize - the bufferSize in frames
    *
    * @return a valid WebAudio ScriptProcessorNode object or null
    */
    static getNodeFromDSP(dspInstance, props, audioCtx, bufferSize) {
        return new FaustNode(dspInstance, props, audioCtx, bufferSize).audioNode;
    }

    /**
    * Create a ScriptProcessorNode Web Audio object
    * by loading and compiling the Faust wasm file
    *
    * @param file - the wasm file
    * @param audioCtx - the Web Audio context
    * @param bufferSize - the bufferSize in frames
    * @param callback - a callback taking the created ScriptProcessorNode as parameter, or null in case of error
    */
    static getNodeFromFile(fileName, props, audioCtx, bufferSize, callback) {
        fetch(fileName)
            .then(dspFile => dspFile.arrayBuffer())
            .then(dspBytes => WebAssembly.instantiate(dspBytes, Faust2WebAudio.importObject))
            .then(dsp => Faust2WebAudio.getNodeFromDSP(dsp.instance, props, audioCtx, bufferSize))
            .then(node => callback(node))
            .catch((e) => {
                throw Error("Faust DSP cannot be loaded or compiled. " + e)
            });
    }

    /**
     * Create a ScriptProcessorNode Web Audio object from a factory
     *
     * @param factory - the DSP factory
     * @param audioCtx - the Web Audio context
     * @param bufferSize - the bufferSize in frames
     * @param callback - a callback taking the created ScriptProcessorNode as parameter, or null in case of error
     */
    static getNodeFromFactory(factory, audioCtx, bufferSize, callback) {
        WebAssembly.instantiate(factory.module, this.importObject)
            .then(dspInstance => Faust2WebAudio.getNodeFromDSP(dspInstance, factory.json_object, audioCtx, bufferSize, callback))
            .then(node => callback(node))
            .catch((e) => {
                throw Error("Faust DSP cannot be loaded or compiled. " + e)
            });
    }
}


class FaustNode {
    constructor(dspInstance, props, audioCtx, bufferSize) {
        try {
            this.inputs = parseInt(props.inputs);
            this.outputs = parseInt(props.outputs);
            this.bufferSize = parseInt(bufferSize);
            this.audioNode = audioCtx.createScriptProcessor(bufferSize, this.inputs, this.outputs);
        } catch (e) {
            throw Error("Error in createScriptProcessor: " + e);
        }
        this.props = props;
        this.audioCtx = audioCtx;

        this.outputHandler, this.computeHandler;
        this.ins, this.outs;

        this.dspInChannnels = [];
        this.dspOutChannnels = [];
        this.fPitchwheelLabel = [];
        this.fCtrlLabel = new Array(128).fill([]);
        // Memory allocator
        this.ptrSize = 4;
        this.sampleSize = 4;

        this.factory = dspInstance.exports;
        this.HEAP = dspInstance.exports.memory.buffer;
        this.HEAP32 = new Int32Array(this.HEAP);
        this.HEAPF32 = new Float32Array(this.HEAP);

        // JSON is as offset 0
        /*
        let HEAPU8 = new Uint8Array(node.HEAP);
        console.log(this.Heap2Str(HEAPU8));
        */
        /* 
        console.log(node.HEAP);
        console.log(node.HEAP32);
        console.log(node.HEAPF32);
        */
        // bargraph
        this.outputsTimer = 5;
        this.outputItems = [];

        // input items
        this.inputsItems = [];

        // Start of HEAP index

        // untitled is placed first with index 0. Audio buffer start at the end of untitled.
        this.audioHeapPtr = parseInt(props.size);

        // Setup pointers offset
        this.audioHeapPtrInputs = this.audioHeapPtr;
        this.audioHeapPtrOutputs = this.audioHeapPtrInputs + (this.inputs * this.ptrSize);

        // Setup buffer offset
        this.audioHeapInputs = this.audioHeapPtrOutputs + (this.outputs * this.ptrSize);
        this.audioHeapOutputs = this.audioHeapInputs + (this.inputs * this.bufferSize * this.sampleSize);

        // Start of DSP memory : DSP is placed first with index 0
        this.dsp = 0;
        this.pathTable = [];
        // Init resulting untitled
        this.initAux();
    }

    updateOutputs() {
        if (this.outputItems.length > 0 && this.outputHandler && this.outputsTimer-- === 0) {
            this.outputsTimer = 5;
            for (let i = 0; i < this.outputItems.length; i++) {
                this.outputHandler(this.outputItems[i], this.factory.getParamValue(this.dsp, this.pathTable[this.outputItems[i]]));
            }
        }
    }

    compute(e) {

        for (let i = 0; i < this.inputs; i++) {
            let input = e.inputBuffer.getChannelData(i);
            let dspInput = this.dspInChannnels[i];
            dspInput.set(input);
        }

        // Possibly call an externally given callback (for instance to synchronize playing a MIDIFile...)
        if (this.computeHandler) {
            this.computeHandler(this.bufferSize);
        }

        // Compute
        this.factory.compute(this.dsp, this.bufferSize, this.ins, this.outs);

        // Update bargraph
        this.updateOutputs();

        // Write outputs
        for (let i = 0; i < this.outputs; i++) {
            let output = e.outputBuffer.getChannelData(i);
            let dspOutput = this.dspOutChannnels[i];
            output.set(dspOutput);
        }
    }

    parseUI(ui) {
        for (let i = 0; i < ui.length; i++) {
            this.parseGroup(ui[i]);
        }
    }
    parseGroup(group) {
        if (group.items) {
            this.parseItems(group.items);
        }
    }

    parseItems(items) {
        for (let i = 0; i < items.length; i++) {
            this.parseItem(items[i]);
        }
    }

    parseItem(item) {
        if (item.type === "vgroup"
            || item.type === "hgroup"
            || item.type === "tgroup") {
            this.parseItems(item.items);
        } else if (item.type === "hbargraph"
            || item.type === "vbargraph") {
            // Keep bargraph adresses
            this.outputItems.push(item.address);
            this.pathTable[item.address] = parseInt(item.index);
        } else if (item.type === "vslider"
            || item.type === "hslider"
            || item.type === "button"
            || item.type === "checkbox"
            || item.type === "nentry") {
            // Keep inputs adresses
            this.inputsItems.push(item.address);
            this.pathTable[item.address] = parseInt(item.index);
            if (item.meta === undefined) return;
            for (let i = 0; i < item.meta.length; i++) {
                if (item.meta[i].midi === undefined) continue;
                if (item.meta[i].midi.trim() === "pitchwheel") {
                    this.fPitchwheelLabel.push(item.address);
                } else if (item.meta[i].midi.trim().split(" ")[0] === "ctrl") {
                    this.fCtrlLabel[parseInt(item.meta[i].midi.trim().split(" ")[1])]
                        .push({
                            path: item.address,
                            min: parseFloat(item.min),
                            max: parseFloat(item.max)
                        });
                }
            }
        }
    }

    initAux() {
        // Setup web audio audioCtx
        this.audioNode.onaudioprocess = (e) => {
            return this.compute(e);
        };

        if (this.inputs > 0) {
            this.ins = this.audioHeapPtrInputs;
            for (let i = 0; i < this.inputs; i++) {
                this.HEAP32[(this.ins >> 2) + i] = this.audioHeapInputs + ((this.bufferSize * this.sampleSize) * i);
            }

            // Prepare Ins buffer tables
            let dspInChans = this.HEAP32.subarray(this.ins >> 2, (this.ins + this.inputs * this.ptrSize) >> 2);
            for (let i = 0; i < this.inputs; i++) {
                this.dspInChannnels[i] = this.HEAPF32.subarray(dspInChans[i] >> 2, (dspInChans[i] + this.bufferSize * this.sampleSize) >> 2);
            }
        }

        if (this.outputs > 0) {
            this.outs = this.audioHeapPtrOutputs;
            for (let i = 0; i < this.outputs; i++) {
                this.HEAP32[(this.outs >> 2) + i] = this.audioHeapOutputs + ((this.bufferSize * this.sampleSize) * i);
            }

            // Prepare Out buffer tables
            let dspOutChans = this.HEAP32.subarray(this.outs >> 2, (this.outs + this.outputs * this.ptrSize) >> 2);
            for (let i = 0; i < this.outputs; i++) {
                this.dspOutChannnels[i] = this.HEAPF32.subarray(dspOutChans[i] >> 2, (dspOutChans[i] + this.bufferSize * this.sampleSize) >> 2);
            }
        }

        // Parse JSON UI part
        this.parseUI(this.props.ui);

        // Init DSP
        this.factory.init(this.dsp, this.audioCtx.sampleRate);
    }

    /**
    * Global init, doing the following initialization:
    * - static tables initialization
    * - call 'instanceInit': constants and instance state initialisation
    *
    * @param sampleRate - the sampling rate in Hertz
    */
    init(sampleRate) {
        this.factory.init(this.dsp, sampleRate);
    }

    /**
    * Init instance state.
    *
    * @param sampleRate - the sampling rate in Hertz
    */
    instanceInit(sampleRate) {
        this.factory.instanceInit(this.dsp, sampleRate);
    }

    /**
     * Init instance constant state.
     *
     * @param sampleRate - the sampling rate in Hertz
     */
    instanceConstants(sampleRate) {
        this.factory.instanceConstants(this.dsp, sampleRate);
    }

    /* Init default control parameters values. */
    instanceResetUserInterface() {
        this.factory.instanceResetUserInterface(this.dsp);
    }

    /* Init instance state (delay lines...).*/
    instanceClear() {
        this.factory.instanceClear(this.dsp);
    }

    /**
    * Trigger the Meta handler with instance specific calls to 'declare' (key, value) metadata.
    *
    * @param handler - the Meta handler as a 'declare' function of type (key, value)
    */
    metadata(handler) {
        if (this.props.meta) {
            this.props.meta.forEach((meta) => {
                handler.declare(Object.keys(meta)[0], Object.values(meta)[0]);
            });
        }
    }

    /**
     * Setup a control output handler with a function of type (path, value)
     * to be used on each generated output value. This handler will be called
     * each audio cycle at the end of the 'compute' method.
     *
     * @param handler - a function of type function(path, value)
     */
    setOutputParamHandler(handler) {
        this.outputHandler = handler;
    }

    /**
     * Get the current output handler.
     */
    getOutputParamHandler() {
        return this.outputHandler;
    }
    /**
     * Control change
     *
     * @param channel - the MIDI channel (0..15, not used for now)
     * @param ctrl - the MIDI controller number (0..127)
     * @param value - the MIDI controller value (0..127)
     */
    ctrlChange(channel, ctrl, value) {
        if (this.fCtrlLabel[ctrl] !== []) {
            for (let i = 0; i < this.fCtrlLabel[ctrl].length; i++) {
                let path = this.fCtrlLabel[ctrl][i].path;
                this.setParamValue(path, Faust2WebAudio.remap(value, 0, 127, this.fCtrlLabel[ctrl][i].min, this.fCtrlLabel[ctrl][i].max));
                if (this.outputHandler) {
                    this.outputHandler(path, this.getParamValue(path));
                }
            }
        }
    }

    /**
     * PitchWeel
     *
     * @param channel - the MIDI channel (0..15, not used for now)
     * @param value - the MIDI controller value (-1..1)
     */
    pitchWheel(channel, wheel) {
        for (let i = 0; i < this.fPitchwheelLabel.length; i++) {
            let path = this.fPitchwheelLabel[i];
            this.setParamValue(path, Math.pow(2.0, wheel / 12.0));
            if (this.outputHandler) {
                this.outputHandler(path, this.getParamValue(path));
            }
        }
    }

    /**
     * Set control value.
     *
     * @param path - the path to the wanted control (retrieved using 'getParams' method)
     * @param val - the float value for the wanted parameter
     */
    setParamValue(path, val) {
        this.factory.setParamValue(this.dsp, this.pathTable[path], val);
    }

    /**
     * Get control value.
     *
     * @param path - the path to the wanted control (retrieved using 'controls' method)
     *
     * @return the float value
     */
    getParamValue(path) {
        return this.factory.getParamValue(this.dsp, this.pathTable[path]);
    }

    /**
     * Get the table of all input parameters paths.
     *
     * @return the table of all input parameter paths.
     */
    get params() {
        return this.inputsItems;
    }

    /**
     * Get DSP JSON description with its UI and metadata
     *
     * @return untitled JSON description
     */
    get JSON() {
        return this.props;
    }

    get sampleRate() {
        return this.audioCtx.sampleRate;
    }
}
export default {
    Faust2WebAudio,
    Faust
}