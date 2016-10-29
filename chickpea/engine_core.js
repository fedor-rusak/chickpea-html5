/*
	***Project agenda***
	Make a simple yet powerful JS API for scripting game engine. To implement it for desktop
	computers and mobile devices.

	***About***
	This is an implementation of game engine. A piece of software that helps to work
	with graphics, sound and user input in order to create interactive applications.

	***Requirements***
	This implementation relies on WebGL, Web Audio API and javascript typed buffers.

	Matrix transformations for 3D graphics are implemented in third-party library.
	It must be loaded before engine is initialized.

	***Core ideas***
	Game loop as a central pattern for engine. Steps are: process input, handle rendering,
	wait for next iteration.

	Scripting for this engine is done through javascript script file whose path should be
	provided during start of engine. This file must contain declaration of init function.

	***Scripting details***
	This function will be called with userFunctions and nativeFunctions objects during
	engine start. First one for user-defined callbacks that will be called by engine.
	Second one for functions that engine provides as API to a user.

	Init function must set these callbacks at userFunctions object:
	 * cacheTexturesInit
	 * cacheSoundsInit
	 * addInput (engine will use this to add input event data to user script logic)
	 * processInput (first step of game loop)
	 * render (second step of game loop)

	NativeFunctions provides these functions:
	 * cacheTexture (currently works only on start)
	 * cacheSound (currently works only on start)
	 * unproject (translate from 2d coordinates to 3d)
	 * playSound
	 * getScreenDimensions (get size of window shown in runtime)
	 * setViewport (set dimensions for rendered image)
	 * setCamera (set position for point of view during rendering)
	 * clearScreen
	 * enableAlphaBlending (enable WebGL feature for drawing images with transparency)
	 * disableAlphaBlending (disable WebGL feature for drawing images with transparency)
	 * enableDepthTesting (enable WebGL feature that makes drawing order dependent on coordinates)
	 * disableDepthTesting (enable WebGL feature that makes drawing order dependent on draw call order)
	 * renderTexturedSquare (draw square with specified texture with specified coordinate transformation)
	 * renderOneColoredPolygons (draw polygons useing vertices, indices, rgba color, xyz coordinates and rotation angles)
	 * renderOneColoredLitPolygons (like ColoredPolygons but includes normals and light source position WORK IN PROGRESS)

	***Tough design decisions***
	Context: If every shader needs different number of uniforms/attributes.

	Question: Should I write many specified functions or make a generic mechanism?
	
	My decision: Generic function for rendering setup and call. Plus special function for data preparation.

	Pros/Cons: Less code, but it's hard to modify and read without experience.


	Context: During user defined render call huge number of draw calls may happen.

	Question: Should I just make them one by one or find some optimization?
	
	My decision: I want nice FPS like 30 or 60 and I went for optimization. Which means all the
	engine calls from render function just fill special queue object. That is later analyzed and
	multiple calls (when posible) can be compressed in one by unification of vertices, indices,
	colors and etc.

	Pros/Cons: More code, yet it was necessary to make features like alpha blending to be dynamic.
 */

"use strict";

var chickpea = function() {

	function generateModel(data) {
		var result = {};

		if (data.vertices) {
			result["verticesBuffer"] = new Float32Array(data.vertices);
			result["verticesItemSize"] = 3;
		}

		if (data.textureCoords) {
			result["textureCoordsBuffer"] = new Float32Array(data.textureCoords);
			result["textureCoordsItemSize"] = 2;
		}

		if (data.textureLabel)
			result["textureLabel"] = data.textureLabel;

		if (data.colors) {
			result["colorBuffer"] = new Float32Array(data.colors);
			result["colorItemSize"] = 4;
		}

		if (data.indices) {
			result["indicesBuffer"] = new Uint16Array(data.indices);
			result["indicesItems"] = data.indices.length;
		}

		if (data.vertexNormals) {
			result["vertexNormalsBuffer"] = new Float32Array(data.vertexNormals);
			result["vertexNormalItemSize"] = 3;
		}

		if (data.lightPos) {
			result["lightPos"] = data.lightPos;
		}

		return result;
	}

	function generateSquareModelData() {
		return {
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
	};


	function getGLcontext(canvas) {
		var gl;

		try {
			gl = canvas.getContext("experimental-webgl");
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

	function generatePrograms(gl) {
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
			"	gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));"+
			"}";

		var wireframeVertexShaderCode =
			"attribute vec3 aVertexPosition;"+

			"uniform mat4 uMVMatrix;"+
			"uniform mat4 uPMatrix;"+

			"void main(void) {"+
			"	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);"+
			"}";

		var wireframeFragmentShaderCode =
			"precision mediump float;"+

			"void main(void) {"+
			"	gl_FragColor = vec4(0.1, 0.2, 0.3, 0.4);" +
			"}";

		var coloredVertexShaderCode =
			"attribute vec3 aVertexPosition;"+
			"attribute vec4 aColor;"+

			"uniform mat4 uMVMatrix;"+
			"uniform mat4 uPMatrix;"+

			"varying vec4 vColor;"+


			"void main(void) {"+
			"	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);"+
			"	vColor = aColor;"+
			"}";

		var coloredFragmentShaderCode =
			"precision mediump float;"+

			"varying vec4 vColor;"+

			"void main(void) {"+
			"	gl_FragColor = vColor;"+
			"}";

		var coloredLitVertexShaderCode =
			"attribute vec3 aVertexPosition;"+
			"attribute vec3 aVertexNormal;"+
			"attribute vec4 aColor;"+

			"uniform mat4 uMVMatrix;"+
			"uniform mat4 uPMatrix;"+
			"uniform mat3 uNMatrix;"+

			"varying vec4 vPosition;"+
			"varying vec4 vColor;"+
			"varying vec3 vTransformedNormal;"+


			"void main(void) {"+
			"	vPosition = uMVMatrix * vec4(aVertexPosition, 1.0);"+
			"	gl_Position = uPMatrix * vPosition;"+
			"	vTransformedNormal = uNMatrix * aVertexNormal;"+
			"	vColor = aColor;"+
			"}";

		var coloredLitFragmentShaderCode =
			"precision mediump float;"+

			"uniform vec3 uLightPosition;"+

			"varying vec4 vPosition;"+
			"varying vec4 vColor;"+
			"varying vec3 vTransformedNormal;"+


			"void main(void) {"+
			"	vec3 lightDirection = normalize(uLightPosition - vPosition.xyz);"+

			"	float directionalLightWeighting = max(dot(normalize(vTransformedNormal), lightDirection), 0.0);"+
			"	vec3 lightWeighting = vec3(0.2,0.2,0.2)+vec3(0.8,0.8,0.8) * directionalLightWeighting;"+

			"	gl_FragColor = vec4(vColor.rgb * lightWeighting, vColor.a);"+
			"}";

		var programData = [
			["texture", textureVertexShaderCode, textureFragmentShaderCode],
			["wireframe", wireframeVertexShaderCode, wireframeFragmentShaderCode],
			["colored", coloredVertexShaderCode, coloredFragmentShaderCode],
			["coloredLit", coloredLitVertexShaderCode, coloredLitFragmentShaderCode]
		];

		var programs = {};

		for (var i = 0; i < programData.length; i++) {
			programs[programData[i][0]] = getProgram(gl, programData[i][1], programData[i][2]);
		}

		return programs;
	}

	function generateGlTexture(gl, imageData, withAlphaChannel) {
		var imageFormat = gl.RGB;

		if (withAlphaChannel)
			imageFormat = gl.RGBA;

		var glTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, glTexture);
		// gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, imageFormat, imageFormat, gl.UNSIGNED_BYTE, imageData);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.bindTexture(gl.TEXTURE_2D, null);

		return glTexture;
	}

	function generateTextures(gl, images, imagesDataArray) {
		var resultObject = {};

		for (var i = 0; i < imagesDataArray.length; i++) {
			var imageData = imagesDataArray[i];
			var cachedTextureLabel = imageData.label;

			var withAlphaChannel = imageData.path.indexOf("with_alpha") > 0;

			var glTexture = generateGlTexture(gl, images[cachedTextureLabel], withAlphaChannel);

			resultObject[cachedTextureLabel] = glTexture;
		}

		return resultObject;
	}

	function renderUsingShaderProgram(tag, webgl, modelData) {
		var gl = webgl.gl;

		var program,
			renderingType = gl.TRIANGLES;

		if (tag === "texturedPolygons") {
			program = webgl.programs.texture;

			if (modelData.textureLabel === "wireframe") {
				program = webgl.programs.wireframe;
				renderingType = gl.LINE_LOOP;
			}
		}
		else if (tag === "coloredPolygons")
			program = webgl.programs.colored;
		else if (tag === "coloredLitPolygons")
			program = webgl.programs.coloredLit;


		var model = generateModel(modelData);

		gl.useProgram(program);


		var additionalVertexAttribCount = 0;
		var bufferArray = []


		var vertexAttribute = gl.getAttribLocation(program, "aVertexPosition");
		gl.enableVertexAttribArray(vertexAttribute);
		var glVerticesBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, glVerticesBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, model.verticesBuffer, gl.STREAM_DRAW);
		gl.vertexAttribPointer(vertexAttribute, model.verticesItemSize, gl.FLOAT, false, 0, 0);
		bufferArray.push(glVerticesBuffer);


		var vertexNormalAttribute = gl.getAttribLocation(program, "aVertexNormal");
		if (vertexNormalAttribute !== -1) {
			gl.enableVertexAttribArray(vertexNormalAttribute);
			var glVertexNormalsBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, glVertexNormalsBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, model.vertexNormalsBuffer, gl.STREAM_DRAW);
			gl.vertexAttribPointer(vertexNormalAttribute, model.vertexNormalItemSize, gl.FLOAT, false, 0, 0);
			additionalVertexAttribCount++;
			bufferArray.push(glVertexNormalsBuffer);
		}

		var colorAttribute = gl.getAttribLocation(program, "aColor");
		if (colorAttribute !== -1) {
			gl.enableVertexAttribArray(colorAttribute);
			var glColorBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, glColorBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, model.colorBuffer, gl.STREAM_DRAW);
			gl.vertexAttribPointer(colorAttribute, model.colorItemSize, gl.FLOAT, false, 0, 0);
			additionalVertexAttribCount++;
			bufferArray.push(glColorBuffer);
		}

		var textureCoordsAttribute = gl.getAttribLocation(program, "aTextureCoord");
		if (textureCoordsAttribute !== -1) {
			gl.enableVertexAttribArray(textureCoordsAttribute);
			var glTextureCoordsBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, glTextureCoordsBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, model.textureCoordsBuffer, gl.STREAM_DRAW);
			gl.vertexAttribPointer(textureCoordsAttribute, model.textureCoordsItemSize, gl.FLOAT, false, 0, 0);
			additionalVertexAttribCount++;
			bufferArray.push(glTextureCoordsBuffer);
		}


		var pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
		gl.uniformMatrix4fv(pMatrixUniform, false, webgl.pMatrix);

		var mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");
		gl.uniformMatrix4fv(mvMatrixUniform, false, webgl.vMatrix);


		var samplerUniform = gl.getUniformLocation(program, "uSampler");
		if (samplerUniform !== null) {
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, webgl.textures[model.textureLabel]);
			gl.uniform1i(samplerUniform, 1);
		}


		var normalMatrixUniform = gl.getUniformLocation(program, "uNMatrix");
		if (normalMatrixUniform !== null)
			gl.uniformMatrix3fv(normalMatrixUniform, false, webgl.normalMatrix);

		var lightPositionUniform = gl.getUniformLocation(program, "uLightPosition");
		if (lightPositionUniform !== null) {
			var lightPos = modelData.lightPos;
			gl.uniform3f(lightPositionUniform, lightPos.x,lightPos.y,lightPos.z);
		}



		var glIndicesBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIndicesBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesBuffer, gl.STREAM_DRAW);
		bufferArray.push(glIndicesBuffer)


		gl.drawElements(renderingType, model.indicesItems, gl.UNSIGNED_SHORT, 0);


		//cleaning up
		for (var i = 0; i < bufferArray.length; i++) {
			gl.deleteBuffer(bufferArray[i]);
		}

		for (var i = additionalVertexAttribCount; i > 0; i--)
			gl.disableVertexAttribArray(i);
	}


	function translate(point, x, y, z) {
		return [point[0]+x, point[1]+y, point[2]+z];
	}

	function degToRad(degrees) {
		return degrees * Math.PI / 180;
	}

	function rotate2d(x, y, angle) {
		return [
			x*Math.cos(angle)-y*Math.sin(angle),
			x*Math.sin(angle)+y*Math.cos(angle)
		];
	}

	function rotate3d(point, xAngle, yAngle, zAngle) {
		var result = [point[0],point[1],point[2]];

		if (xAngle !== undefined && xAngle !== 0) {
			var xRotated = rotate2d(result[1],result[2], degToRad(xAngle));
			result[1] = xRotated[0];
			result[2] = xRotated[1];
		}

		if (yAngle !== undefined && yAngle !== 0) {
			var yRotated = rotate2d(result[0],result[2], -degToRad(yAngle));
			result[0] = yRotated[0];
			result[2] = yRotated[1];
		}

		if (zAngle !== undefined && zAngle !== 0) {
			var zRotated = rotate2d(result[0],result[1], degToRad(zAngle));
			result[0] = zRotated[0];
			result[1] = zRotated[1];
		}

		return result;
	}

	function prepareData(
		sideEffectObject, vertices, indices, textureCoords, textureLabel,
		x,y,z, xa,ya,za, r,g,b,a,
		normals, lightX, lightY, lightZ) {

		for (var j = 0; j < vertices.length/3; j++) {
			var squareVertex = [
				vertices[j*3],
				vertices[j*3+1],
				vertices[j*3+2]
			];

			var tempVertex = rotate3d(squareVertex, xa, ya, za);

			tempVertex = translate(tempVertex, x,y,z);

			sideEffectObject.vertices.push(tempVertex[0]);
			sideEffectObject.vertices.push(tempVertex[1]);
			sideEffectObject.vertices.push(tempVertex[2]);

			if (textureCoords) {
				sideEffectObject.textureCoords.push(textureCoords[j*2]);
				sideEffectObject.textureCoords.push(textureCoords[j*2+1]);
			}

			if (r || r === 0) {
				sideEffectObject.colors.push(r);
				sideEffectObject.colors.push(g);
				sideEffectObject.colors.push(b);
				sideEffectObject.colors.push(a);
			}
		}

		if (textureLabel)
			sideEffectObject.textureLabel = textureLabel;

		var vertexCount = (sideEffectObject.vertices.length - vertices.length)/3;
		for (var j = 0; j < indices.length; j++) {
			sideEffectObject.indices.push(indices[j]+vertexCount);
		}

		if (normals) {
			for (var j = 0; j < normals.length; j++) {
				sideEffectObject.vertexNormals.push(normals[j]);
			}
		}

		if (lightX || lightX === 0)
			sideEffectObject.lightPos = {"x": lightX, "y": lightY, "z": lightZ};
	}

	function prepareAllData(data) {
		var modelData = {"vertices":[], "indices":[], "colors":[], "textureCoords":[], "vertexNormals": []};

		for (var i = 0; i < data.length; i++) {
			var drawCommand = data[i];

			var vertices = drawCommand[0],
				indices = drawCommand[1],
				x = drawCommand[2] || 0,
				y = drawCommand[3] || 0,
				z = drawCommand[4] || 0,
				xa = drawCommand[5],
				ya = drawCommand[6],
				za = drawCommand[7],
				textureCoords = drawCommand[8],
				textureLabel = drawCommand[9],
				r = drawCommand[10],
				g = drawCommand[11],
				b = drawCommand[12],
				a = drawCommand[13],
				normals = drawCommand[14],
				lightX = drawCommand[15],
				lightY = drawCommand[16],
				lightZ = drawCommand[17];

			prepareData(
				modelData,
				vertices, indices, textureCoords, textureLabel,
				x,y,z, xa,ya,za,
				r,g,b,a,
				normals, lightX, lightY, lightZ);
		}

		return modelData;
	}


	function generateViewMatrix(xPos, yPos, zPos, xAngle, yAngle) {
		var xPos = xPos || 0, yPos = yPos || 0, zPos = zPos || 0,
			xAngle = xAngle || 0, yAngle = yAngle || 0;

		var resultMatrix = mat4.create();
		mat4.identity(resultMatrix);
		mat4.translate(resultMatrix, [xPos, yPos, zPos]);
		mat4.rotate(resultMatrix, xAngle * Math.PI / 180, [1, 0, 0]);
		mat4.rotate(resultMatrix, yAngle * Math.PI / 180, [0, 1, 0]);
		mat4.inverse(resultMatrix);

		return resultMatrix;
	}


	function unprojectOnZeroLevel(x, y, unprojectVMatrix, pMatrix, viewport) {
		var near = unproject(x,y,0, unprojectVMatrix, pMatrix, viewport),
			far = unproject(x,y,1, unprojectVMatrix, pMatrix, viewport);

		var t = -near[2] / (far[2] - near[2]);
	//		float tempZ = near[2] + (far[2] - near[2]) * t;
		var mapClickX = near[0] + (far[0] - near[0]) * t;
		var mapClickY = -(near[1] + (far[1] - near[1]) * t);

		return [mapClickX, mapClickY];
	}

	function unproject(winX,winY,winZ, mvMatrix, pMatrix, viewport){
		var x = 2 * (winX - viewport[0])/viewport[2] - 1,
			y = 2 * (winY - viewport[1])/viewport[3] - 1,
			z = 2 * winZ - 1;

		var vpMatrix = mat4.create();
		mat4.multiply(pMatrix, mvMatrix, vpMatrix);

		var invMatrix = mat4.create();
		mat4.inverse(vpMatrix, invMatrix);

		var n = [x,y,z,1];
		mat4.multiplyVec4(invMatrix,n,n);

		return [n[0]/n[3],n[1]/n[3],n[2]/n[3]];
	}


	function processGLCommand(tag, webgl, data) {
		if (tag === "setCamera") {
			var dataElement = data[data.length-1];

			var x = dataElement.x,
				y = dataElement.y,
				z = dataElement.z,
				xAngle = dataElement.xAngle || 0,
				yAngle = dataElement.yAngle || 0;

			webgl.vMatrix = generateViewMatrix(x, y, z, xAngle, yAngle);
			webgl.unprojectVMatrix = generateViewMatrix(x, -y, z, -xAngle, yAngle);

			var normalMatrix = mat3.create();
			mat4.toInverseMat3(webgl.vMatrix, normalMatrix);
			mat3.transpose(normalMatrix);
			webgl.normalMatrix = normalMatrix;
		}
		else if (tag === "setViewport") {
			var width = data[data.length-1].width,
				height = data[data.length-1].height;

			webgl.canvas.width = width;
			webgl.canvas.height = height;

			webgl.pMatrix = mat4.create();
			mat4.perspective(45, width / height, 0.1, 100.0, webgl.pMatrix);

			webgl.gl.viewport(0, 0, width, height);
		}
		else if (tag === "clearScreen") {
			var gl = webgl.gl;
			var color = data[data.length-1];

			gl.clearColor(color.r || 0, color.g || 0, color.b || 0, 1.0);

			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		}
		else if (tag === "enableAlpha") {
			var gl = webgl.gl;
			// gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			// gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.enable(gl.BLEND);
		}
		else if (tag === "disableAlpha") {
			webgl.gl.disable(webgl.gl.BLEND);
		}
		else if (tag === "enableDepth") {
			webgl.gl.enable(webgl.gl.DEPTH_TEST);
		}
		else if (tag === "disableDepth") {
			webgl.gl.disable(webgl.gl.DEPTH_TEST);
		}
		else if (tag === "texturedPolygons"
				|| tag === "coloredPolygons"
				|| tag === "coloredLitPolygons" ) {
			var modelData = prepareAllData(data);

			renderUsingShaderProgram(tag, webgl, modelData);
		}
	}

	function processQueuedCommands(internalData) {
		var oldTag = null,
			oldIdentifier = null;


		var temp = [];

		for (var i = 0; i < internalData.drawQueue.length; i++) {
			var tag = internalData.drawQueue[i].tag,
				drawCommand = internalData.drawQueue[i].data;

			var identifier = tag;
			if (tag === "texturedPolygons")
				identifier += drawCommand[9]; //textureLabel

			if (oldIdentifier === null) {
				temp.push(drawCommand);
			}
			else if (identifier === oldIdentifier) {
				temp.push(drawCommand);
			}
			else if (identifier !== oldIdentifier) {
				processGLCommand(oldTag, internalData.webgl, temp);
				temp = [];
				temp.push(drawCommand);
			}

			if (i === internalData.drawQueue.length - 1) {
				processGLCommand(tag, internalData.webgl, temp);
			}

			oldTag = tag;
			oldIdentifier = identifier;
		}

		internalData.drawQueue = [];
	}


	function generateNativeFunctions(internalData) {
		return {
			"cacheTexture": function(label, path) {
				internalData.imagesDataArray.push({"label": label, "path": path});
			},
			"cacheSound": function(label, path) {
				internalData.soundsDataArray.push({"label": label, "path": path});
			},
			"unproject": function(screenX, screenY) {
				var webgl = internalData.webgl;
				var viewport = [0,0, webgl.canvas.width, webgl.canvas.height];

				return unprojectOnZeroLevel(screenX, screenY, webgl.unprojectVMatrix, webgl.pMatrix, viewport);
			},
			"playSound": function() {
				console.log("playSound()");
				var audioContext = new AudioContext();
				var source = audioContext.createBufferSource();
				source.buffer = internalData.sounds["action"];
				source.connect(audioContext.destination);
				source.start(0);
				// source.onended = function() {alert(1);};
			},
			"getScreenDimensions": function() {
				console.log("getScreenDimensions()");
				return [internalData.webgl.canvas.width, internalData.webgl.canvas.height];
			},
			"setViewport": function(width, height) {
				internalData.drawQueue.push({"tag":"setViewport", data: {"width": width, "height": height}});
			},
			"setCamera": function(x, y, z, xAngle, yAngle) {
				internalData.drawQueue.push({"tag":"setCamera", data: {"x": x, "y": y, "z": z, "xAngle": xAngle, "yAngle": yAngle}});
			},
			"clearScreen": function(r, g, b) {
				internalData.drawQueue.push({"tag":"clearScreen", data: {"r": r, "g": g, "b":b}});
			},
			"enableAlphaBlending": function() {
				//http://delphic.me.uk/webglalpha.html
				internalData.drawQueue.push({"tag":"enableAlpha"});
			},
			"disableAlphaBlending": function() {
				internalData.drawQueue.push({"tag":"disableAlpha"});
			},
			"enableDepthTesting": function() {
				//http://delphic.me.uk/webglalpha.html
				internalData.drawQueue.push({"tag":"enableDepth"});
			},
			"disableDepthTesting": function() {
				internalData.drawQueue.push({"tag":"disableDepth"});
			},
			"renderTexturedSquare": function(label, x, y, z, xa, ya, za) {
				var squareData = generateSquareModelData();
				internalData.drawQueue.push({"tag":"texturedPolygons", "data":[squareData.vertices, squareData.indices, x,y,z, xa,ya,za, squareData.textureCoords, label]});
			},
			"renderOneColoredPolygons": function(vertices, indices, r,g,b,a, x,y,z, xa,ya,za) {
				internalData.drawQueue.push({"tag":"coloredPolygons", "data":[vertices, indices, x,y,z, xa,ya,za, null,null, r,g,b,a]});
			},
			"renderOneColoredLitPolygons": function(vertices, indices, normals, lX,lY,lZ, r,g,b,a, x,y,z, xa,ya,za) {
				internalData.drawQueue.push({"tag":"coloredLitPolygons", "data":[vertices, indices, x,y,z, xa,ya,za, null,null, r,g,b,a, normals, lX,lY,lZ]});
			}
		};
	}


	function makeImagePromise(label, url) {
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
					resolve({"label": label, "content": image});
				}
			};

			image.src = url;
		});
	};

	function makeSoundPromise(label, url) {
		return new Promise(function (resolve, reject) {
			var image = document.createElement("img");

			var xhr = new XMLHttpRequest();
			xhr.open('GET', url, true);
			xhr.responseType = 'arraybuffer';

			// Decode asynchronously
			xhr.onload = function() {
				var context = new AudioContext();
				context.decodeAudioData(
					xhr.response, 
					function(buffer) {
						resolve({"label": label, "content": buffer});
					},
					function(error) {
						reject({"status": "candDecodeAudio", "statusText": "failed to decode: " + url});
					}
				);
			}

			xhr.send();
		});
	}

	function cacheResults(destinationObject, dataArray) {
		for (var i = 0; i < dataArray.length; i++) {
			var data = dataArray[i];
			destinationObject[data.label] = data.content;
		}
	}

	function promiseAllFileResources(dataArray, folder, callback) {
		var requestArray = [];

		for (var i = 0; i < dataArray.length; i++) {
			var imageData = dataArray[i];
			requestArray.push(callback(imageData.label, folder+imageData.path));
		}

		return Promise.all(requestArray);
	};


	function onResizeCallback(setViewportCallback) {
		var width = window.innerWidth
			|| document.documentElement.clientWidth
			|| document.body.clientWidth;

		var height = window.innerHeight
			|| document.documentElement.clientHeight
			|| document.body.clientHeight;

		if (width < 120) width = 120;
		if (height < 80) height = 80;

		setViewportCallback(width, height);
	}


	/*
		Promise extension with methods useful for chaining.
	 */
	function activateMonkeyPatch() {
		Promise.prototype.thenCall = function(object, callbackName) {
			return this.then(function(value){return object[callbackName](value);});
		}

		Promise.prototype.thenBind = function(callback, thisObject, arg1, arg2, arg3) {
			var bindedCallback = callback;

			if (arg1 === undefined)
				bindedCallback = callback.bind(thisObject || null);
			else if (arg2 === undefined)
				bindedCallback = callback.bind(thisObject || null, arg1);
			else if (arg3 === undefined)
				bindedCallback = callback.bind(thisObject || null, arg1, arg2);
			else
				bindedCallback = callback.bind(thisObject || null, arg1, arg2, arg3);

			return this.then(bindedCallback);
		}
	}

	/*
		Remove custom Promise extension methods.
	 */
	function deactivateMonkeyPatch() {
		Promise.prototype.thenCall = undefined;
		Promise.prototype.thenBind = undefined;
	};


	/*
		This method is started when file resources were loaded.
	 */
	function jumpStartEngine(internalData, userScriptFunctions, nativeFunctions) {
		var canvasElement = document.querySelector("#canvas");

		var gl = getGLcontext(canvasElement);


		internalData.webgl = {
			"canvas": canvasElement,
			"gl": gl,
			"programs": generatePrograms(gl),
			"textures": generateTextures(gl, internalData.images, internalData.imagesDataArray)
		};


		window.onresize = onResizeCallback.bind(null, nativeFunctions.setViewport);

		window.onresize();

		//to set a correct Viewport dimensions and generate projection matrix
		processQueuedCommands(internalData);


		canvasElement.onmousedown = function(e) {
			userScriptFunctions.addInput(["pressed", 0, e.offsetX, e.offsetY]);
			internalData["mousePressed"] = true;
			return false;
		};

		canvasElement.onmousemove = function(e) {
			if (internalData.mousePressed) {
				userScriptFunctions.addInput(["move", 0, e.offsetX, e.offsetY]);
			}
			return false;
		};

		canvasElement.onmouseup = function(e) {
			userScriptFunctions.addInput(["release", 0]);
			internalData.mousePressed = undefined;
		};


		var gameLoopCycle = function() {
			userScriptFunctions.processInput();

			userScriptFunctions.render();

			processQueuedCommands(internalData);

			window.requestAnimationFrame(gameLoopCycle);
		}

		window.requestAnimationFrame(gameLoopCycle);
	}

	function startChickpea(resourceFolder) {
		try {
			if (resourceFolder === undefined) resourceFolder = "resources/";

			window.AudioContext = window.AudioContext || window.webkitAudioContext;


			var internalData = {
				"imagesDataArray": [],
				"images": {},
				"soundsDataArray": [],
				"sounds": {},
				"drawQueue": []
			};

			var userScriptFunctions = {};


			var nativeFunctions = generateNativeFunctions(internalData);


			activateMonkeyPatch();


			Promise.resolve()
				.thenBind(init, null, userScriptFunctions, nativeFunctions)

				.thenCall(userScriptFunctions, "cacheTexturesInit")
				.thenBind(promiseAllFileResources, null, internalData.imagesDataArray, resourceFolder, makeImagePromise)
				.thenBind(cacheResults, null, internalData.images)

				.thenCall(userScriptFunctions, "cacheSoundsInit")
				.thenBind(promiseAllFileResources, null, internalData.soundsDataArray, resourceFolder, makeSoundPromise)
				.thenBind(cacheResults, null, internalData.sounds)

				.thenBind(jumpStartEngine, null, internalData, userScriptFunctions, nativeFunctions)

				.then(deactivateMonkeyPatch);
		}
		catch (e) {
			alert("Failure: No init function! " + e);
		}
	}

	function start(resourceFolder, startScriptURL) {
		if (resourceFolder === undefined) resourceFolder = "resources/";
		if (startScriptURL === undefined) startScriptURL = "js/init.js";

		var scriptTag = document.createElement('script');
		scriptTag.src = resourceFolder+startScriptURL;

		scriptTag.onload = startChickpea.bind(null, resourceFolder);

		document.body.appendChild(scriptTag);
	};


	return {"start": start};
}();