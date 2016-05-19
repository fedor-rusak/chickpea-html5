"use strict";

var generateModel = function(data) {
	var result = {};

	if (data.vertices) {
		result["verticesBuffer"] = new Float32Array(data.vertices);
		result["verticesItemSize"] = 3;
	}

	if (data.textureCoords) {
		result["textureCoordsBuffer"] = new Float32Array(data.textureCoords);
		result["textureCoordsItemSize"] = 2;
	}

	if (data.indices) {
		result["indicesBuffer"] = new Uint16Array(data.indices);
		result["indicesItems"] = data.indices.length;
	}

	return result;
}

var squareData = {
	"vertices": [
		-1.0, -1.0, 0.0,
		-1.0,  1.0, 0.0,
		 1.0, -1.0, 0.0,
		 1.0,  1.0, 0.0
	],
	"textureCoords": [
		0.0, 1.0,
		0.0, 0.0,
		1.0, 1.0,
		1.0, 0.0,
	],
	"indices": [
		0, 1, 2,  1, 3, 2
	]
};

var squareModel = generateModel(squareData);

var textureVertexShaderCode =
	"attribute vec3 aVertexPosition;"+
	"attribute vec2 aTextureCoord;"+

	"uniform mat4 uMVMatrix;"+
	"uniform mat4 uPMatrix;"+

	"varying vec2 vTextureCoord;"+


	"void main(void) {"+
	"	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);"+
	"	vTextureCoord = aTextureCoord;"+
	"}";

var textureFragmentShaderCode =
	"precision mediump float;"+

	"varying vec2 vTextureCoord;"+

	"uniform sampler2D uSampler;"+

	"void main(void) {"+
	"gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));"+
	// " gl_FragColor = vec4(0.1, 0.2, 0.3, 0.4);" +
	"}";

function getGLcontext(canvas) {
	var gl;

	try {
		gl = canvas.getContext("experimental-webgl");
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
	}
	catch (e) {}

	return gl;
}

function getShader(gl, type, code) {

	var shader;
	if (type === gl.FRAGMENT_SHADER) {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	}
	else if (type === gl.VERTEX_SHADER) {
		shader = gl.createShader(gl.VERTEX_SHADER);
	}
	else {
		return null;
	}

	gl.shaderSource(shader, code);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}


function getProgram(gl, vertexShaderCode, fragmentShaderCode) {
	var vertexShader = getShader(gl, gl.VERTEX_SHADER, vertexShaderCode);
	var fragmentShader = getShader(gl, gl.FRAGMENT_SHADER, fragmentShaderCode);

	var program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		alert("Could not link program!");
	}

	return program;
}


function degToRad(degrees) {
	return degrees * Math.PI / 180;
}


function makeImageRequest(label, url) {
	return new Promise(function (resolve, reject) {
		var image = document.createElement("img");

		image.onload = function () {
			if ('naturalHeight' in this && this.naturalHeight + this.naturalWidth === 0) {
				reject({"status": "noImage", "statusText": "error loading " + url});
			}
			else if (this.width + this.height == 0) {
				reject({"status": "noImage", "statusText": "error loading " + url});
			}
			else {
				resolve({"label": label, "dom": image});
			}
		};

		image.src = url;
	});
};

var makeSoundRequest = function(label, url) {
	return Promise.resolve({"label": label, "dom": label});
}

window.onload = function() {
	try {
		var internalData = {
			"imagesDataArray": [],
			"images": {},
			"soundsDataArray": [],
			"sounds": {}
		};

		var globalData = {};

		var nativeFunctions = {
			"cacheTexture": function(label, path) {
				internalData.imagesDataArray.push({"label": label, "path": path});
			},
			"cacheSound": function(label, path) {
				internalData.soundsDataArray.push({"label": label, "path": path});
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
				internalData.webgl.vMatrix = mat4.lookAt([x,y,z], [x,y,0], [0,1,0]);
			},
			"clearScreen": function(r, g, b) {
				var gl = internalData.webgl.gl;

				if (r) gl.clearColor(r || 0, g || 0, b || 0, 1.0);

				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			},
			"render": function(label, x, y, z) {
				var webgl = internalData.webgl;

				var gl = webgl.gl;
				var program = webgl.textureProgram;

				var model = squareModel;

				gl.useProgram(program);

				var vertexAttribute = gl.getAttribLocation(program, "aVertexPosition");
				gl.enableVertexAttribArray(vertexAttribute);
				var glVerticesBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, glVerticesBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, model.verticesBuffer, gl.STATIC_DRAW);
				gl.vertexAttribPointer(vertexAttribute, model.verticesItemSize, gl.FLOAT, false, 0, 0);

				var textureCoordsAttribute = gl.getAttribLocation(program, "aTextureCoord");
				gl.enableVertexAttribArray(textureCoordsAttribute);
				var glTextureCoordsBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, glTextureCoordsBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, model.textureCoordsBuffer, gl.STATIC_DRAW);
				gl.vertexAttribPointer(textureCoordsAttribute, model.textureCoordsItemSize, gl.FLOAT, false, 0, 0);


				var samplerUniform = gl.getUniformLocation(program, "uSampler");
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, webgl.textures[label]);
				gl.uniform1i(samplerUniform, 0);


				var pMatrix = mat4.create();
				mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
				var pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
				gl.uniformMatrix4fv(pMatrixUniform, false, pMatrix);

				var mMatrix = mat4.create();
				mat4.identity(mMatrix);
				mat4.translate(mMatrix, [x || 0, y || 0, z || 0]);
				// mat4.rotate(mMatrix, degToRad(45), [1, 0, 0]);
				var mvMatrix = mat4.create();
				mat4.multiply(webgl.vMatrix, mMatrix, mvMatrix);
				var mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");
				gl.uniformMatrix4fv(mvMatrixUniform, false, mvMatrix);


				var glIndicesBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIndicesBuffer);
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesBuffer, gl.STATIC_DRAW);


				gl.drawElements(gl.TRIANGLES, model.indicesItems, gl.UNSIGNED_SHORT, 0);
			}
		};

		init(globalData, nativeFunctions);


		var cacheImages = function(array) {
			for (var i = 0; i < array.length; i++) {
				var imageData = array[i];

				internalData.images[imageData.label] = imageData.dom;
			}
		}

		var promiseAllImages = function() {
			globalData.cacheTexturesInit();

			var requestArray = [];

			for (var i = 0; i < internalData.imagesDataArray.length; i++) {
				var imageData = internalData.imagesDataArray[i];
				requestArray.push(makeImageRequest(imageData.label, "resources/"+imageData.path));
			}

			var imagePromises = Promise.all(requestArray).then(cacheImages)
				   .catch(function(data) {alert("Something bad happened!");});

			return imagePromises;
		};


		var cacheSounds = function(array) {
			for (var i = 0; i < array.length; i++) {
				var soundData = array[i];

				internalData.sounds[soundData.label] = soundData.dom;
			}
		}

		var promiseAllSounds = function() {
			globalData.cacheSoundsInit();

			var requestArray = [];

			for (var i = 0; i < internalData.soundsDataArray.length; i++) {
				var soundData = internalData.soundsDataArray[i];
				requestArray.push(makeSoundRequest(soundData.label, "resources/"+soundData.path));
			}

			var soundPromises = Promise.all(requestArray).then(cacheSounds)
				   .catch(function(data) {alert("Something bad happened!");});

			return soundPromises;
		};

		var gameLoopCycle = function() {
			globalData.processInput();

			globalData.render();

			window.requestAnimationFrame(gameLoopCycle);
		}

		var jumpStart = function() {
			var gl = getGLcontext(document.querySelector("#canvas"));
			var textureProgram = getProgram(gl, textureVertexShaderCode, textureFragmentShaderCode);

			gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

			gl.enable(gl.BLEND);
			gl.blendEquation( gl.FUNC_ADD );
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

			internalData.webgl = {"gl": gl, "textureProgram": textureProgram, "textures": {}};

			nativeFunctions.setCamera(0,0,0);

			for (var i = 0; i < internalData.imagesDataArray.length; i++) {
				var imageData = internalData.imagesDataArray[i];
				var cachedTextureLabel = imageData.label;

				var imageFormat = gl.RGB;

				if (imageData.path.indexOf("with_alpha") > 0)
					imageFormat = gl.RGBA;

				var glTexture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, glTexture);
				// gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				gl.texImage2D(gl.TEXTURE_2D, 0, imageFormat, imageFormat, gl.UNSIGNED_BYTE, internalData.images[cachedTextureLabel]);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.bindTexture(gl.TEXTURE_2D, null);

				internalData.webgl.textures[cachedTextureLabel] = glTexture;
			}

			window.requestAnimationFrame(gameLoopCycle);
		}

		promiseAllImages()
			.then(promiseAllSounds())
			.then(jumpStart);
	}
	catch (e) {
		alert("Failure: No init function! " + e);
	}
}