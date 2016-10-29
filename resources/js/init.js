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


	var renderSide = function(textureLabel, x,y,z, xa,ya,za) {
		natives.renderTexturedSquare(textureLabel, x,y,z, xa,ya,za);
	}

	var degToRad = function(degrees) {
		return degrees * Math.PI / 180;
	}

	var sin = function(degrees) {
		return Math.sin(degToRad(degrees));
	}

	var cos = function(degrees) {
		return Math.cos(degToRad(degrees));
	}

	var renderCube = function(x,y,z, zAngles) {
		renderSide("wireframe", x-cos(zAngles), y,		z+sin(zAngles),	0,	90+zAngles);
		renderSide("explosion", x+cos(zAngles), y,		z-sin(zAngles),	0,	90+zAngles);
		renderSide("wireframe", x,				y+1, 	z,				90,	zAngles);
		renderSide("explosion", x,				y-1, 	z,				90,	zAngles);
		renderSide("wireframe", x-sin(zAngles), y,		z-cos(zAngles),	0,	zAngles);
		renderSide("explosion", x+sin(zAngles), y,		z+cos(zAngles),	0,	zAngles);
	}

	userScriptFunctions.render = function() {
		if (!state.cameraSet) {
			var data = natives.getScreenDimensions();
			console.log(JSON.stringify(data));
			natives.setCamera(0.0, 0.0, 5.0);
			state.cameraSet = true;
			state.radius = 0;
			state.angle = 0;
			state.step = 0.005;
			state.sign = +1;
		}
		var radians = state.angle*Math.PI/180;
		natives.setCamera(Math.sin(radians)*state.radius, Math.cos(radians)*state.radius, 5.0);

		state.radius += state.sign*state.step;
		state.angle += 1;
		if (state.angle == 400) {
			state.sign *=-1;
			state.angle = 40;
		}

		Math.sin(90*Math.PI/180)
		//track time with this
		// console.log(Date.now());

		natives.clearScreen(0.1, 0.2, 0.3);

		natives.enableDepthTesting();
		natives.disableAlphaBlending();

		natives.renderOneColoredPolygons(
			[-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
			[0,1,2, 3,0,2],
			0.1, 0.7, 0.2, 0.5, 0,0,0, 0, state.angle);

		natives.renderOneColoredLitPolygons(
			[-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
			[0,1,2, 3,0,2],
			// [-1,-1,1, 1,-1,1, 1,1,1, -1,1,1,-1,-1,1,1,1,1], //circly normals
			[0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1], //squary normals
			0,0,5,
			1.0, 0, 0, 1);

		natives.enableAlphaBlending();

		renderCube(0,0,0, 0);
	}
}

try {
    module.exports = init;
}
catch(e) {
    //used without module loader
}