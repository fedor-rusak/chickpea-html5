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

	state.keysPressed = {};
	state.inputs = {};

	userScriptFunctions.processInput = function() {
		var inputDataArray = state.inputDataArray;

		if (inputDataArray.length != 0) {

			for (var i = 0; i < inputDataArray.length; i++) {
				var inputEvent = inputDataArray[i];

				if (inputEvent[0] === "pressed") {
					if (state.inputs[inputEvent[1]] === undefined)
						state.inputs[inputEvent[1]] = {};

					state.inputs[inputEvent[1]].x = inputEvent[2];
					state.inputs[inputEvent[1]].y = inputEvent[3];
				}
				else if (inputEvent[0] === "release") {
					if (state.inputs[inputEvent[1]].x < 500 && !state.soundPlayed) {
						state.soundPlayed = true;
						natives.playSound();
					}

					state.inputs[inputEvent[1]] = undefined;
				}
				else if (inputEvent[0] === "keyDown") {
					state.keysPressed[inputEvent[1]] = true;
				}
				else if (inputEvent[0] === "keyUp") {
					state.keysPressed[inputEvent[1]] = false;
				}
			}

			//clear
			inputDataArray.splice(0, inputDataArray.length);
		}
	}



	var startData = [
		{"do": "clearScreen", "r": 0.1, "g": 0.2, "b": 0.3},
		{"do": "setCamera", "x": 0, "y": 0, "z": 10},
		{"do": "enableDepthTesting"},
		{"do": "disableAlphaBlending"},
		{"do": "rotate", "xa": 0, "ya": 0, "za": 0, "a": 0},
		{"do": "translate", "x": 0, "y": 0, "z": 0},
		[
			{"do": "rotate", "xa": 0, "ya": 1, "za": 0, "a": 90},
			{
				"do": "renderOneColoredPolygons",
				"vertices": [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
				"indices": [0,1,2, 3,0,2],
				"r": 0.1, "g": 0.7, "b": 0.2, "alpha": 0.5
			}
		],
		{
			"do": "renderOneColoredLitPolygons",
			"vertices": [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
			"indices": [0,1,2, 3,0,2],
			"normals": [-1,-1,1, 1,-1,1, 1,1,1, -1,1,1,-1,-1,1,1,1,1], //circly normals
			// "normals": [0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1], //squary normals
			"lightX":0, "lightY": 0, "lightZ": 5,
			"r": 1, "g": 0, "b": 0, "alpha": 1
		},
		{"do": "enableAlphaBlending"},
		[
			{"do": "scale", "yScale": 2},
			{"do": "translate", "x": -1},
			{"do": "rotate", "ya": -1, "a": 90},
			{"do": "renderScaledTexturedSquare", "textureLabel": "wireframe"}
		],
		[
			{"do": "scale", "yScale": 2},
			{"do": "translate", "x": 1},
			{"do": "rotate", "ya": 1, "a": 90},
			{"do": "renderScaledTexturedSquare", "textureLabel": "explosion"}
		],
		[
			{"do": "translate", "x": 0, "y": -2, "z": 0},
			{"do": "rotate", "xa": 1, "ya": 0, "za": 0, "a": 90},
			{"do": "renderTexturedSquare", "textureLabel": "wireframe"}
		],
		[
			{"do": "translate", "x": 0, "y": 2, "z": 0},
			{"do": "rotate", "xa": 1, "ya": 0, "za": 0, "a": 90},
			{"do": "renderTexturedSquare", "textureLabel": "explosion"}
		],
		[
			{"do": "scale", "yScale": 2},
			{"do": "translate", "z": 1},
			{"do": "renderScaledTexturedSquare", "textureLabel": "wireframe"}
		],
		[
			{"do": "scale", "yScale": 2},
			{"do": "translate", "x": 0, "y": 0, "z": -1},
			{"do": "renderScaledTexturedSquare", "textureLabel": "explosion"}
		]
	];


	var combineTransformations = function(current, propagated, destination) {
		var result = destination || {};

		var itemNameArray = ["xScale", "yScale", "zScale", "x", "y", "z", "xa", "ya", "za", "a"];

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


		result.xScale *= current.xScale || 1;
		result.yScale *= current.yScale || 1;
		result.zScale *= current.zScale || 1;


		return result;
	}

	function getDefaultTransformations() {
		return {"xScale":1, "yScale":1, "zScale": 1, "x": 0, "y": 0, "z": 0, "xa": 0, "ya": 0, "za": 0, "a": 0};
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
			else if (block.do === "clearScreen") {
				natives.clearScreen(block.r, block.g, block.b);
			}
			else if (block.do === "setCamera") {
				natives.setCamera(block.x || 0, block.y || 0, block.z || 0,
				block.xa || 0, block.ya || 0, block.za || 0, block.a || 0);
			}
			else if (block.do === "enableDepthTesting") {
				natives.enableDepthTesting();
			}
			else if (block.do === "enableAlphaBlending") {
				natives.enableAlphaBlending();
			}
			else if (block.do === "disableAlphaBlending") {
				natives.disableAlphaBlending();
			}
			else if (block.do === "renderOneColoredPolygons") {
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
			else if (block.do === "renderOneColoredLitPolygons") {
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
			else if (block.do === "renderTexturedSquare") {
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
			else if (block.do === "renderScaledTexturedSquare") {
				var transformations = combineTransformations(currentTransformations, propagatedTransformations);

				natives.renderScaledTexturedSquare(
					block.textureLabel,
					transformations.xScale,
					transformations.yScale,
					transformations.zScale,
					transformations.x,
					transformations.y,
					transformations.z,
					transformations.xa,
					transformations.ya,
					transformations.za,
					transformations.a);
			}
			else if (block.do === "translate" || block.do === "rotate" || block.do ===  "scale") {
				combineTransformations(block, currentTransformations, currentTransformations);
			}
		};
	};


	state.delta = 90;
	state.testAngle = 0;
	state.angle = state.testAngle - state.delta;
	state.step = 0.5;
	state.sign = +1;
	state.radius = 0;

	state.posX = 0;
	state.posZ = 10;
	state.speed = 0.1;

	state.sense = 0.75
	state.xAxisRotate = 0;
	state.yAxisRotate = 0;

	userScriptFunctions.render = function() {
		var radians = state.angle*Math.PI/180;

		state.angle += state.step * state.sign;
		if (state.angle > state.testAngle+state.delta) {
			state.sign *=-1;
		}
		else if (state.angle < state.testAngle-state.delta) {
			state.sign *=-1;
		}

		// var newCameraPosition = natives.rotate3d(
		// 	Math.sin(radians)*state.radius,
		// 	Math.cos(radians)*state.radius,
		// 	10, 1,1,1, -state.angle);

		var newCameraPosition = [0,0,0];

		if (state.keysPressed["a"])
			newCameraPosition[0] = -state.speed;
		if (state.keysPressed["d"])
			newCameraPosition[0] = state.speed;

		if (state.keysPressed["w"])
			newCameraPosition[2] = -state.speed;
		if (state.keysPressed["s"])
			newCameraPosition[2] = state.speed;


		if (state.keysPressed["ArrowLeft"])
			state.yAxisRotate -= state.sense;
		if (state.keysPressed["ArrowRight"])
			state.yAxisRotate += state.sense;

		if (state.keysPressed["ArrowUp"])
			state.xAxisRotate -= state.sense;
		if (state.keysPressed["ArrowDown"])
			state.xAxisRotate += state.sense;


		if (state.xAxisRotate > 90) state.xAxisRotate = 90;
		else if (state.xAxisRotate < -90) state.xAxisRotate = -90;

		var cameraAxisAngle = natives.rotateAxisAngles(1,0,0, state.xAxisRotate, 0,1,0, state.yAxisRotate);


		newCameraPosition = natives.rotate3d(
			newCameraPosition[0],
			newCameraPosition[1],
			newCameraPosition[2],
			0,1,0, -state.yAxisRotate);

		state.posX += newCameraPosition[0];
		state.posZ += newCameraPosition[2];


		newCameraPosition = [state.posX, 0, state.posZ];



		// natives.setCamera(
		// 	newCameraPosition[0],
		// 	newCameraPosition[1],
		// 	newCameraPosition[2],
		// 	1,0,0, 90);

		//for debug
		// newCameraPosition = [0,0,10];



		var cameraNode = startData[1];
		cameraNode.x = newCameraPosition[0];
		cameraNode.y = newCameraPosition[1];
		cameraNode.z = newCameraPosition[2];
		cameraNode.xa = cameraAxisAngle[0];
		cameraNode.ya = cameraAxisAngle[1];
		cameraNode.za = cameraAxisAngle[2];
		cameraNode.a = cameraAxisAngle[3];

		var worldRotateNode = startData[4];
		worldRotateNode.xa = 1;
		worldRotateNode.ya = -1;
		worldRotateNode.za = 1;
		worldRotateNode.a = state.angle;

		var coloredLitPolygonsNode = startData[7];

		coloredLitPolygonsNode.lightX = state.angle;
		coloredLitPolygonsNode.lightZ = 5;

		renderHelper(startData);
	}
}

try {
    module.exports = init;
}
catch(e) {
    //used without module loader
}