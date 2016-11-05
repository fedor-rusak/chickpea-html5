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
		{"function": "clearScreen", "r": 0.1, "g": 0.2, "b": 0.3},
		{"function": "setCamera", "x": 1, "y": 0, "z": 5},
		{"function": "enableDepthTesting"},
		{"function": "disableAlphaBlending"},
		{"function": "rotate", "angleX": 0, "angleY": 0},
		{"function": "translate", "x": 0, "y": 0},
		// [
		// 	{"function": "rotate", "angleX": 0, "angleY": 0},
		// 	{
		// 		"function": "renderOneColoredPolygons",
		// 		"vertices": [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
		// 		"indices": [0,1,2, 3,0,2],
		// 		"r": 0.1, "g": 0.7, "b": 0.2, "a": 0.5
		// 	}
		// ],
		// {
		// 	"function": "renderOneColoredLitPolygons",
		// 	"vertices": [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
		// 	"indices": [0,1,2, 3,0,2],
		// 	"normals": [-1,-1,1, 1,-1,1, 1,1,1, -1,1,1,-1,-1,1,1,1,1], //circly normals
		// 	// [0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1], //squary normals
		// 	"lightX":0, "lightY": 0, "lightZ": 5,
		// 	"r": 1, "g": 0, "b": 0, "a": 1
		// },
		{"function": "enableAlphaBlending"},
		[
			{"function": "rotate", "angleX": 0, "angleY": 90, "angleZ": 0},
			{"function": "translate", "x": -1, "z": 0},
			{"function": "renderTexturedSquare", "textureLabel": "wireframe"}
		],
		[
			{"function": "rotate", "angleX": 0, "angleY": 90, "angleZ": 0},
			{"function": "translate", "x": 1, "z": 0},
			{"function": "renderTexturedSquare", "textureLabel": "explosion"}
		],
		// [
		// 	{"function": "rotate", "angleX": 90},
		// 	{"function": "translate", "y": 1},
		// 	{"function": "renderTexturedSquare", "textureLabel": "wireframe"}
		// ],
		// [
		// 	{"function": "rotate", "angleX": 90},
		// 	{"function": "translate", "y": -1},
		// 	{"function": "renderTexturedSquare", "textureLabel": "explosion"}
		// ],
		// [
		// 	{"function": "translate", "z": -1},
		// 	{"function": "renderTexturedSquare", "textureLabel": "wireframe"}
		// ],
		// [
		// 	{"function": "translate", "z": 1},
		// 	{"function": "renderTexturedSquare", "textureLabel": "explosion"}
		// ]
	];

	var combineTransformations = function(current, propagated, destination) {
		var result = destination || {};

		var itemNameArray = ["x", "y", "z", "angleX", "angleY", "angleZ"];

		for (var i = 0; i < itemNameArray.length; i++) {
			var itemName = itemNameArray[i];

			result[itemName] = propagated[itemName] || 0;
		}


		var tempAngles = natives.rotate3dAngles(
			current.angleX, current.angleY, current.angleZ,
			propagated.angleX, propagated.angleY, propagated.angleZ);

		result.angleX = tempAngles[0];
		result.angleY = tempAngles[1];
		result.angleZ = tempAngles[2];


		var tempPoint = natives.rotate3d(
			current.x, current.y, current.z,
			propagated.angleX, propagated.angleY, propagated.angleZ);

		result.x += tempPoint[0];
		result.y += tempPoint[1]; 
		result.z += tempPoint[2];


		return result;
	}


	var combineTransformationsNew = function(current, propagated, destination) {
		var result = destination || {};

		var itemNameArray = ["x", "y", "z", "xa", "ya", "za", "a"];

		for (var i = 0; i < itemNameArray.length; i++) {
			var itemName = itemNameArray[i];

			result[itemName] = propagated[itemName] || 0;
		}


		var tempData = natives.rotateAxisAngles(
			current.xa, current.ya, current.za, current.a,
			propagated.xa, propagated.ya, propagated.za, propagated.a);

		result.xa = tempData[0];
		result.ya = tempData[1];
		result.za = tempData[2];
		result.a = tempData[3];


		var tempPoint = natives.rotate3dNew(
			current.x, current.y, current.z,
			propagated.xa, propagated.ya, propagated.za, propagated.a);

		result.x += tempPoint[0];
		result.y += tempPoint[1]; 
		result.z += tempPoint[2];


		return result;
	}


	var renderHelper = function(serializedCommands, propagatedTransformations) {
		if (propagatedTransformations === undefined) 
			propagatedTransformations = {"x": 0, "y": 0, "z": 0, "angleX": 0, "angleY": 0, "angleZ": 0};


		var currentTransformations = {"x": 0, "y": 0, "z": 0, "angleX": 0, "angleY": 0, "angleZ": 0};


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
				natives.setCamera(block.x || 0, block.y || 0, block.z || 0);
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
					block.r, block.g, block.b, block.a,
					transformations.x,
					transformations.y,
					transformations.z,
					transformations.angleX,
					transformations.angleY,
					transformations.angleZ);
			}
			else if (block.function === "renderOneColoredLitPolygons") {
				var transformations = combineTransformations(currentTransformations, propagatedTransformations);

				natives.renderOneColoredLitPolygons(
					block.vertices,
					block.indices,
					block.normals,
					block.lightX || 0, block.lightY || 0, block.lightZ || 0,
					block.r, block.g, block.b, block.a,
					transformations.x,
					transformations.y,
					transformations.z,
					transformations.angleX,
					transformations.angleY,
					transformations.angleZ);
			}
			else if (block.function === "renderTexturedSquare") {
				var transformations = combineTransformations(currentTransformations, propagatedTransformations);

				natives.renderTexturedSquare(
					block.textureLabel,
					transformations.x,
					transformations.y,
					transformations.z,
					transformations.angleX,
					transformations.angleY,
					transformations.angleZ);
			}
			else if (block.function === "translate" || block.function === "rotate") {
				combineTransformations(currentTransformations, block, currentTransformations);
			}
		};
	};

	state.delta = 270;
	state.testAngle = 270;
	state.angle = 0;//state.testAngle-1;
	state.step = 0.5;
	state.sign = +1;
	state.radius = 0;

	userScriptFunctions.render = function() {
		var radians = state.angle*Math.PI/180;

		// startData[5].x = Math.sin(radians)*state.radius;
		// startData[5].y = Math.cos(radians)*state.radius;

		state.radius += state.sign*state.step;


		state.angle += state.step * state.sign;
		if (state.angle > state.testAngle+state.delta) {
			state.sign *=-1;
		}
		else if (state.angle < state.testAngle-state.delta) {
			state.sign *=-1;
		}


		startData[4].angleX = state.angle;
		// startData[4].angleY = state.angle;
		// startData[4].angleZ = state.angle;
		// startData[6][0].angleX = state.angle;


		// renderHelper(startData);


		// var baseTransformations = {"x": 1, "y": 0, "z": 0, "angleX": 0, "angleY": 0, "angleZ": 0};

		// var transformations = {"x": 0, "y": 0, "z": 0, "angleX": 0, "angleY": 90, "angleZ": 90}

		// console.log(combineTransformations(baseTransformations, transformations));


		// var result = natives.rotate3dangles(10,0,0,0,90,0);
		// alert(result)

		// var result = natives.rotate3d(1,0,0, 90,90,0, 0,0,0);
		// alert(result)
		var baseBaseTransformations = {"x": -3, "y": 0, "z": 0, "angleX": 0, "angleY": 0, "angleZ": 0};
		var baseTransformations = {"x": 0, "y": 0, "z": 0, "angleX": 0, "angleY": state.angle, "angleZ": state.angle};
		baseTransformations = combineTransformations(baseTransformations, baseBaseTransformations)


		natives.clearScreen(0.1, 0.2, 0.3)
		natives.setCamera(0,0,7);

		var input = [
			"explosion", {"x": 1, "y": 0, "z": 0, "angleX": 0, "angleY": 90, "angleZ": 0},
			"wireframe", {"x": -1, "y": 0, "z": 0, "angleX": 0, "angleY": 90, "angleZ": 0},
			"explosion", {"x": 0, "y": 1, "z": 0, "angleX": 90, "angleY": 0, "angleZ": 0},
			"wireframe", {"x": 0, "y": -1, "z": 0, "angleX": 90, "angleY": 0, "angleZ": 0},
			"explosion", {"x": 0, "y": 0, "z": -1, "angleX": 0, "angleY": 0, "angleZ": 0},
			"wireframe", {"x": 0, "y": 0, "z": 1, "angleX": 0, "angleY": 0, "angleZ": 0}
		];

		// alert(JSON.stringify(natives.rotate3dAngles(0,55,0, 0,45,0)))
		// alert(JSON.stringify(natives.rotate3d(1,0,0, 0,90,0)))


		natives.enableAlphaBlending()

		// for (var i = 0; i < 6; i++) {
		// 	var transformations = combineTransformations(input[i*2+1], baseTransformations);
		// 	// transformations = input[i]

		// 	natives.renderTexturedSquare(
		// 		input[i*2],
		// 		transformations.x,
		// 		transformations.y,
		// 		transformations.z,
		// 		transformations.angleX,
		// 		transformations.angleY,
		// 		transformations.angleZ);
		// }

		var inputNew = [
			"explosion", {"x": 1, "y": 0, "z": 0, "xa": 0, "ya": 1, "za": 0, "a": 90},
			"wireframe", {"x": -1, "y": 0, "z": 0, "xa": 0, "ya": -0.1, "za": 0, "a": 90},
			"explosion", {"x": 0, "y": 1, "z": 0, "xa": 1, "ya": 0, "za": 0, "a": 90},
			"wireframe", {"x": 0, "y": -1, "z": 0, "xa": 1, "ya": 0, "za": 0, "a": 90},
			"explosion", {"x": 0, "y": 0, "z": -1, "xa": 0, "ya": 0, "za": 0, "a": 0},
			"wireframe", {"x": 0, "y": 0, "z": 1, "xa": 0, "ya": 0, "za": 0, "a": 0}
		];
		// console.log(inputNew)

		var baseTransformationsNew = {"x": 0, "y": 0, "z": 0, "xa": 1, "ya": 1, "za": 1, "a": state.angle};

		for (var i = 0; i < 6; i++) {
			var transformationsNew = combineTransformationsNew(inputNew[i*2+1], baseTransformationsNew);
			natives.renderTexturedSquareNew(
				inputNew[i*2],
				transformationsNew.x,
				transformationsNew.y,
				transformationsNew.z,
				transformationsNew.xa,
				transformationsNew.ya,
				transformationsNew.za,
				transformationsNew.a);
		}

		// alert(JSON.stringify(natives.rotate3dNew(1,0,0, 0,1,0,90)));
		// alert(JSON.stringify(natives.rotateAxisAngles(0,1,0,90, 0,0,0,0)));
	}
}

try {
    module.exports = init;
}
catch(e) {
    //used without module loader
}