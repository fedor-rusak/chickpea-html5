"use strict";

window.onload = function() {
	try {
		var globalData = {};

		var nativeFunctions = {
			"cacheTexture": function(label, path) {
				console.log("cacheTexture("+label+", "+path+")");
			},
			"cacheSound": function(label, path) {
				console.log("cacheSound("+label+", "+path+")");
			},
			"unproject": function(screenX, screenY) {
				console.log("unproject("+screenX+", "+screenY+")");
			},
			"playSound": function() {
				console.log("playSound()");
			},
			"getScreenDimensions": function() {
				console.log("getScreenDimensions()");
				var screenWidth = 800, screenHeight = 600;
				return [screenWidth, screenHeight];
			},
			"setCamera": function(x, y, z) {
				console.log("setCamera("+x+", "+y+", "+z+")");
			},
			"clearScreen": function(r, g, b) {
				console.log("clearScreen("+r+", "+g+", "+b+")");
			},
			"render": function(label, x, y, z) {
				console.log("render("+label+", "+x+", "+y+", "+z+")");
			}
		};

		init(globalData, nativeFunctions);

		globalData.cacheTexturesInit();

		globalData.cacheSoundsInit();

		var gameLoopCycle = function() {
			globalData.processInput();

			globalData.render();

			window.requestAnimationFrame(gameLoopCycle);
		}

		window.requestAnimationFrame(gameLoopCycle);
	}
	catch (e) {
		alert("Failure: No init function! " + e);
	}
}