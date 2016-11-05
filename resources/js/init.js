"use strict";

function init(userScriptFunctions, natives) {

	userScriptFunctions.cacheTexturesInit = function() {
		natives.cacheTexture('explosion', 'images/with_alpha/explosion.png');
	}

	userScriptFunctions.cacheSoundsInit = function() {
		natives.cacheSound('background',	'sound/background.mp3');
		natives.cacheSound('action',		'sound/sfx.wav');
	}

	var state = {
		inputDataArray: []
	};

	userScriptFunctions.addInput = function(data) {
		state.inputDataArray.push(data);
	}

	userScriptFunctions.processInput = function() {
		var inputDataArray = state.inputDataArray;

		if (inputDataArray.length != 0) {
			console.log("inputData length = " + inputDataArray.length + ", content:");
			for (var i = 0; i < inputDataArray.length; i++) {
				console.log(JSON.stringify(inputDataArray[i]));
				if (inputDataArray[i][0] === "pressed") {
					console.log(natives.unproject(inputDataArray[i][2], inputDataArray[i][3]));
				}

				if (inputDataArray[i][0] !== "release") {
					console.log(natives.unproject(inputDataArray[i][2], inputDataArray[i][3]));
					if (inputDataArray[i][2] < 500 && !state.soundPlayed) {
						state.soundPlayed = true;
						natives.playSound();
					}
				}
			}

			//clear
			inputDataArray.splice(0, inputDataArray.length);
		}
	}



	var startData = [
		// {"function": "clearScreen", "r": 0.1, "g": 0.2, "b": 0.3},
		{"function": "setCamera", "x": 0, "y": 0, "z": 10},
		{"function": "enableDepthTesting"},
		{"function": "disableAlphaBlending"},
		{"function": "rotate", "xa": 0, "ya": 0, "za": 0, "a": 0},
		{"function": "translate", "x": 0, "y": 0, "z": 0},
		[
			{"function": "rotate", "xa": 0, "ya": 1, "za": 0, "a": 90},
			{
				"function": "renderOneColoredPolygons",
				"vertices": [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
				"indices": [0,1,2, 3,0,2],
				"r": 0.1, "g": 0.7, "b": 0.2, "alpha": 0.5
			}
		],
		{
			"function": "renderOneColoredLitPolygons",
			"vertices": [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
			"indices": [0,1,2, 3,0,2],
			"normals": [-1,-1,1, 1,-1,1, 1,1,1, -1,1,1,-1,-1,1,1,1,1], //circly normals
			// [0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1], //squary normals
			"lightX":0, "lightY": 0, "lightZ": 5,
			"r": 1, "g": 0, "b": 0, "alpha": 1
		},
		{"function": "enableAlphaBlending"},
		[
			{"function": "translate", "x": -1, "z": 0},
			{"function": "rotate", "xa": 0, "ya": -1, "za": 0, "a": 90},
			{"function": "renderTexturedSquare", "textureLabel": "wireframe"}
		],
		[
			{"function": "translate", "x": 1, "z": 0},
			{"function": "rotate", "xa": 0, "ya": 1, "za": 0, "a": 90},
			{"function": "renderTexturedSquare", "textureLabel": "explosion"}
		],
		[
			{"function": "translate", "x": 0, "y": -1, "z": 0},
			{"function": "rotate", "xa": 1, "ya": 0, "za": 0, "a": 90},
			{"function": "renderTexturedSquare", "textureLabel": "wireframe"}
		],
		[
			{"function": "translate", "x": 0, "y": 1, "z": 0},
			{"function": "rotate", "xa": 1, "ya": 0, "za": 0, "a": 90},
			{"function": "renderTexturedSquare", "textureLabel": "explosion"}
		],
		[
			{"function": "translate", "x": 0, "y": 0, "z": 1},
			{"function": "renderTexturedSquare", "textureLabel": "wireframe"}
		],
		[
			{"function": "translate", "x": 0, "y": 0, "z": -1},
			{"function": "renderTexturedSquare", "textureLabel": "explosion"}
		]
	];


	var combineTransformations = function(current, propagated, destination) {
		var result = destination || {};

		var itemNameArray = ["x", "y", "z", "xa", "ya", "za", "a"];

		for (var i = 0; i < itemNameArray.length; i++) {
			var itemName = itemNameArray[i];

			result[itemName] = propagated[itemName] || 0;
		}


		var tempData = natives.rotateAxisAngles(
			current.xa || 0, current.ya || 0, current.za || 0, current.a || 0,
			propagated.xa, propagated.ya, propagated.za, propagated.a);

		result.xa = tempData[0];
		result.ya = tempData[1];
		result.za = tempData[2];
		result.a = tempData[3];


		var tempPoint = natives.rotate3d(
			current.x || 0, current.y || 0, current.z || 0,
			propagated.xa, propagated.ya, propagated.za, propagated.a);

		result.x += tempPoint[0];
		result.y += tempPoint[1]; 
		result.z += tempPoint[2];


		return result;
	}

	function getDefaultTransformations() {
		return {"x": 0, "y": 0, "z": 0, "xa": 0, "ya": 0, "za": 0, "a": 0};
	}

	var renderHelper = function(serializedCommands, propagatedTransformations) {
		if (propagatedTransformations === undefined) 
			propagatedTransformations = getDefaultTransformations();


		var currentTransformations = getDefaultTransformations();


		for (var i = 0; i < serializedCommands.length; i++) {
			var block = serializedCommands[i];

			if (block instanceof Array) {
				var some = combineTransformations(currentTransformations, propagatedTransformations);
				renderHelper(block, some);
			}
			else if (block.function === "clearScreen") {
				natives.clearScreen(block.r, block.g, block.b);
			}
			else if (block.function === "setCamera") {
				natives.setCamera(block.x || 0, block.y || 0, block.z || 0,
				block.xa || 0, block.ya || 0, block.za || 0, block.a || 0);
			}
			else if (block.function === "enableDepthTesting") {
				natives.enableDepthTesting();
			}
			else if (block.function === "enableAlphaBlending") {
				natives.enableAlphaBlending();
			}
			else if (block.function === "disableAlphaBlending") {
				natives.disableAlphaBlending();
			}
			else if (block.function === "renderOneColoredPolygons") {
				var transformations = combineTransformations(currentTransformations, propagatedTransformations);

				natives.renderOneColoredPolygons(
					block.vertices,
					block.indices,
					block.r, block.g, block.b, block.alpha,
					transformations.x,
					transformations.y,
					transformations.z,
					transformations.xa,
					transformations.ya,
					transformations.za,
					transformations.a);
			}
			else if (block.function === "renderOneColoredLitPolygons") {
				var transformations = combineTransformations(currentTransformations, propagatedTransformations);

				natives.renderOneColoredLitPolygons(
					block.vertices,
					block.indices,
					block.normals,
					block.lightX || 0, block.lightY || 0, block.lightZ || 0,
					block.r, block.g, block.b, block.alpha,
					transformations.x,
					transformations.y,
					transformations.z,
					transformations.xa,
					transformations.ya,
					transformations.za,
					transformations.a);
			}
			else if (block.function === "renderTexturedSquare") {
				var transformations = combineTransformations(currentTransformations, propagatedTransformations);

				natives.renderTexturedSquare(
					block.textureLabel,
					transformations.x,
					transformations.y,
					transformations.z,
					transformations.xa,
					transformations.ya,
					transformations.za,
					transformations.a);
			}
			else if (block.function === "translate" || block.function === "rotate") {
				combineTransformations(block, currentTransformations, currentTransformations);
			}
		};
	};


	state.delta = 270;
	state.testAngle = 270;
	state.angle = 0;
	state.step = 0.5;
	state.sign = +1;
	state.radius = 1.5;

	userScriptFunctions.render = function() {
		var radians = state.angle*Math.PI/180;

		state.angle += state.step * state.sign;
		if (state.angle > state.testAngle+state.delta) {
			state.sign *=-1;
		}
		else if (state.angle < state.testAngle-state.delta) {
			state.sign *=-1;
		}

		var newCameraPosition = natives.rotate3d(
			Math.sin(radians)*state.radius,
			Math.cos(radians)*state.radius,
			10, 1,1,1, -state.angle);


		natives.setCamera(
			newCameraPosition[0],
			newCameraPosition[1],
			newCameraPosition[2],
			1,1,1, state.angle);

		natives.enableAlphaBlending()
		natives.clearScreen(0.1, 0.2, 0.3);


		var input = [
			"explosion", {"x": 1, "y": 0, "z": 0, "xa": 0, "ya": 1, "za": 0, "a": 90},
			"wireframe", {"x": -1, "y": 0, "z": 0, "xa": 0, "ya": -0.1, "za": 0, "a": 90},
			"explosion", {"x": 0, "y": 1, "z": 0, "xa": 1, "ya": 0, "za": 0, "a": 90},
			"wireframe", {"x": 0, "y": -1, "z": 0, "xa": 1, "ya": 0, "za": 0, "a": 90},
			"explosion", {"x": 0, "y": 0, "z": -1, "xa": 0, "ya": 0, "za": 0, "a": 0},
			"wireframe", {"x": 0, "y": 0, "z": 1, "xa": 0, "ya": 0, "za": 0, "a": 0}
		];

		var baseTransformations = {"x": 0, "y": 0, "z": 0, "xa": 1, "ya": 1, "za": 1, "a": state.angle};

		for (var i = 0; i < 6; i++) {
			var transformations = combineTransformations(input[i*2+1], baseTransformations);
			natives.renderTexturedSquare(
				input[i*2],
				transformations.x,
				transformations.y,
				transformations.z,
				transformations.xa,
				transformations.ya,
				transformations.za,
				transformations.a);
		}


		var cameraNode = startData[0];
		cameraNode.x = newCameraPosition[0];
		cameraNode.y = newCameraPosition[1];
		cameraNode.z = newCameraPosition[2];
		cameraNode.xa = 1;
		cameraNode.ya = 1;
		cameraNode.za = 1;
		cameraNode.a = state.angle;

		var worldRotateNode = startData[3];
		worldRotateNode.xa = 1;
		worldRotateNode.ya = -1;
		worldRotateNode.za = 1;
		worldRotateNode.a = -state.angle;

		renderHelper(startData);
	}
}

try {
    module.exports = init;
}
catch(e) {
    //used without module loader
}