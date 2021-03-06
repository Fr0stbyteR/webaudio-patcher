export const content = {
    "lines": {
        "line-1": {
            "src": [
                "box-6",
                0
            ],
            "dest": [
                "box-1",
                0
            ],
            "id": "line-1",
            "disabled": false
        },
        "line-2": {
            "src": [
                "box-11",
                0
            ],
            "dest": [
                "box-9",
                0
            ],
            "id": "line-2",
            "disabled": false
        },
        "line-3": {
            "src": [
                "box-12",
                0
            ],
            "dest": [
                "box-10",
                0
            ],
            "id": "line-3",
            "disabled": false
        },
        "line-8": {
            "src": [
                "box-15",
                0
            ],
            "dest": [
                "box-13",
                0
            ],
            "id": "line-8",
            "disabled": false
        },
        "line-9": {
            "src": [
                "box-13",
                0
            ],
            "dest": [
                "box-9",
                2
            ],
            "id": "line-9",
            "disabled": false
        },
        "line-11": {
            "src": [
                "box-9",
                1
            ],
            "dest": [
                "box-1",
                0
            ],
            "id": "line-11",
            "disabled": false
        },
        "line-12": {
            "src": [
                "box-9",
                0
            ],
            "dest": [
                "box-1",
                0
            ],
            "id": "line-12",
            "disabled": false
        },
        "line-13": {
            "src": [
                "box-10",
                0
            ],
            "dest": [
                "box-14",
                0
            ],
            "id": "line-13",
            "disabled": false
        },
        "line-14": {
            "src": [
                "box-14",
                0
            ],
            "dest": [
                "box-1",
                0
            ],
            "id": "line-14",
            "disabled": false
        },
        "line-15": {
            "src": [
                "box-17",
                0
            ],
            "dest": [
                "box-16",
                0
            ],
            "id": "line-15",
            "disabled": false
        },
        "line-16": {
            "src": [
                "box-18",
                1
            ],
            "dest": [
                "box-1",
                0
            ],
            "id": "line-16",
            "disabled": false
        },
        "line-17": {
            "src": [
                "box-16",
                0
            ],
            "dest": [
                "box-18",
                2
            ],
            "id": "line-17",
            "disabled": false
        },
        "line-18": {
            "src": [
                "box-18",
                1
            ],
            "dest": [
                "box-20",
                1
            ],
            "id": "line-18",
            "disabled": false
        },
        "line-19": {
            "src": [
                "box-9",
                1
            ],
            "dest": [
                "box-20",
                1
            ],
            "id": "line-19",
            "disabled": false
        },
        "line-20": {
            "src": [
                "box-21",
                0
            ],
            "dest": [
                "box-19",
                0
            ],
            "id": "line-20",
            "disabled": false
        },
        "line-21": {
            "src": [
                "box-19",
                0
            ],
            "dest": [
                "box-20",
                2
            ],
            "id": "line-21",
            "disabled": false
        },
        "line-25": {
            "src": [
                "box-20",
                1
            ],
            "dest": [
                "box-7",
                0
            ],
            "id": "line-25",
            "disabled": false
        },
        "line-26": {
            "src": [
                "box-20",
                1
            ],
            "dest": [
                "box-1",
                0
            ],
            "id": "line-26",
            "disabled": false
        },
        "line-28": {
            "src": [
                "box-10",
                0
            ],
            "dest": [
                "box-1",
                0
            ],
            "id": "line-28",
            "disabled": false
        }
    },
    "boxes": {
        "box-6": {
            "id": "box-6",
            "name": "box-6",
            "class": "Base.Button",
            "inlets": 1,
            "outlets": 1,
            "patching_rect": [
                24,
                152,
                100,
                28
            ],
            "text": "Base.Button",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-1": {
            "id": "box-1",
            "name": "box-1",
            "class": "Base.Print",
            "inlets": 1,
            "outlets": 0,
            "patching_rect": [
                25,
                401,
                196,
                28
            ],
            "text": "Base.Print",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-7": {
            "id": "box-7",
            "name": "box-7",
            "class": "WA.Oscillator",
            "inlets": 2,
            "outlets": 1,
            "patching_rect": [
                297,
                206,
                270,
                28
            ],
            "text": "WA.Oscillator @frequency 220 @type sine",
            "args": [],
            "props": {
                "frequency": 220,
                "type": "sine"
            },
            "prevData": {
                "storage": {}
            }
        },
        "box-8": {
            "id": "box-8",
            "name": "box-8",
            "class": "WA.Destination",
            "inlets": 1,
            "outlets": 0,
            "patching_rect": [
                297,
                263,
                126,
                28
            ],
            "text": "WA.Destination",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-9": {
            "id": "box-9",
            "name": "box-9",
            "class": "JS.JSNumber",
            "inlets": 3,
            "outlets": 2,
            "patching_rect": [
                684,
                160,
                150,
                28
            ],
            "text": "JS.JSNumber 440",
            "args": [
                "440"
            ],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-10": {
            "id": "box-10",
            "name": "box-10",
            "class": "JS.JSArray",
            "inlets": 3,
            "outlets": 2,
            "patching_rect": [
                669,
                301,
                146,
                28
            ],
            "text": "JS.JSArray [300,2]",
            "args": [
                "[300,2]"
            ],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-11": {
            "id": "box-11",
            "name": "box-11",
            "class": "Base.Button",
            "inlets": 1,
            "outlets": 1,
            "patching_rect": [
                681,
                31,
                60,
                28
            ],
            "text": "Base.Button",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-12": {
            "id": "box-12",
            "name": "box-12",
            "class": "Base.Button",
            "inlets": 1,
            "outlets": 1,
            "patching_rect": [
                668,
                261,
                60,
                28
            ],
            "text": "Base.Button",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-13": {
            "id": "box-13",
            "name": "box-13",
            "class": "JS.JSFunction",
            "inlets": 2,
            "outlets": 1,
            "patching_rect": [
                810,
                115,
                265,
                28
            ],
            "text": "JS.JSFunction [\"x\"] \"return x/2\" ",
            "args": [
                "[\"x\"]",
                "return x/2"
            ],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-14": {
            "id": "box-14",
            "name": "box-14",
            "class": "JS.JSCall",
            "inlets": 3,
            "outlets": 2,
            "patching_rect": [
                665,
                350,
                162,
                28
            ],
            "text": "JS.JSCall Math.pow",
            "args": [
                "Math.pow"
            ],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-15": {
            "id": "box-15",
            "name": "box-15",
            "class": "Base.Button",
            "inlets": 1,
            "outlets": 1,
            "patching_rect": [
                807,
                35,
                60,
                28
            ],
            "text": "Base.Button",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-16": {
            "id": "box-16",
            "name": "Half",
            "class": "JS.JSFunction",
            "inlets": 2,
            "outlets": 1,
            "patching_rect": [
                841,
                349,
                261,
                28
            ],
            "text": "JS.JSFunction [\"x\"] \"return x/2\" @name Half",
            "args": [
                "[\"x\"]",
                "return x/2"
            ],
            "props": {
                "name": "Half"
            },
            "prevData": {
                "storage": {}
            }
        },
        "box-17": {
            "id": "box-17",
            "name": "box-17",
            "class": "Base.Button",
            "inlets": 1,
            "outlets": 1,
            "patching_rect": [
                834,
                299,
                60,
                28
            ],
            "text": "Base.Button",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-18": {
            "id": "box-18",
            "name": "box-18",
            "class": "JS.JSNumber",
            "inlets": 3,
            "outlets": 2,
            "patching_rect": [
                707,
                392,
                161,
                28
            ],
            "text": "JS.JSNumber 880",
            "args": [
                "880"
            ],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-19": {
            "id": "box-19",
            "name": "box-19",
            "class": "JS.JSFunction",
            "inlets": 2,
            "outlets": 1,
            "patching_rect": [
                386,
                96,
                273,
                28
            ],
            "text": "JS.JSFunction [\"x\"] \"return {frequency: x}\"",
            "args": [
                "[\"x\"]",
                "return {frequency: x}"
            ],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-20": {
            "id": "box-20",
            "name": "box-20",
            "class": "JS.JSNumber",
            "inlets": 3,
            "outlets": 2,
            "patching_rect": [
                320,
                158,
                99,
                28
            ],
            "text": "JS.JSNumber",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-21": {
            "id": "box-21",
            "name": "box-21",
            "class": "Base.Button",
            "inlets": 1,
            "outlets": 1,
            "patching_rect": [
                384,
                48,
                60,
                28
            ],
            "text": "Base.Button",
            "args": [],
            "props": {},
            "prevData": {
                "storage": {}
            }
        },
        "box-22": {
            "id": "box-22",
            "name": "box-22",
            "class": "Max.metro",
            "inlets": 2,
            "outlets": 1,
            "patching_rect": [
                929,
                286,
                260,
                28
            ],
            "text": "Max.metro 1000 @active 1",
            "args": [
                "1000"
            ],
            "props": {
                "active": 1
            },
            "prevData": {
                "storage": {}
            }
        }
    },
    "data": {
        "box-6": {
            "Base.Button": {
                "storage": {}
            }
        },
        "box-1": {
            "Base.Print": {
                "storage": {}
            }
        },
        "box-7": {
            "WA.Oscillator": {
                "storage": {}
            }
        },
        "box-8": {
            "WA.Destination": {
                "storage": {}
            }
        },
        "box-9": {
            "JS.JSNumber": {
                "storage": {}
            }
        },
        "box-10": {
            "JS.JSArray": {
                "storage": {}
            }
        },
        "box-11": {
            "Base.Button": {
                "storage": {}
            }
        },
        "box-12": {
            "Base.Button": {
                "storage": {}
            }
        },
        "box-13": {
            "JS.JSFunction": {
                "storage": {}
            }
        },
        "box-14": {
            "JS.JSCall": {
                "storage": {}
            }
        },
        "box-15": {
            "Base.Button": {
                "storage": {}
            }
        },
        "Half": {
            "JS.JSFunction": {
                "storage": {}
            }
        },
        "box-17": {
            "Base.Button": {
                "storage": {}
            }
        },
        "box-18": {
            "JS.JSNumber": {
                "storage": {}
            }
        },
        "box-19": {
            "JS.JSFunction": {
                "storage": {}
            }
        },
        "box-20": {
            "JS.JSNumber": {
                "storage": {}
            }
        },
        "box-21": {
            "Base.Button": {
                "storage": {}
            }
        },
        "box-22": {
            "Max.metro": {
                "storage": {
                    "a": 1
                }
            }
        }
    },
    "boxIndexCount": 22,
    "lineIndexCount": 29,
    "bgcolor": [
        61,
        65,
        70,
        1
    ],
    "editing_bgcolor": [
        82,
        87,
        94,
        1
    ]
}