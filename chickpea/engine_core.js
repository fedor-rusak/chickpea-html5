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

function generateSquareData() {
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

	"	gl_FragColor = vec4(lightWeighting, vColor.a);"+
	"}";


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

function translate(point, x, y, z) {
	return [point[0]+x, point[1]+y, point[2]+z];
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


function renderWireframePolygons(webgl, modelData) {
	var gl = webgl.gl;

	var program = webgl.programs.wireframe;

	var model = generateModel(modelData);

	gl.useProgram(program);

	var vertexAttribute = gl.getAttribLocation(program, "aVertexPosition");
	gl.enableVertexAttribArray(vertexAttribute);
	var glVerticesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glVerticesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, model.verticesBuffer, gl.STREAM_DRAW);
	gl.vertexAttribPointer(vertexAttribute, model.verticesItemSize, gl.FLOAT, false, 0, 0);


	var pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
	gl.uniformMatrix4fv(pMatrixUniform, false, webgl.pMatrix);

	var mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");
	gl.uniformMatrix4fv(mvMatrixUniform, false, webgl.vMatrix);


	var glIndicesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIndicesBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesBuffer, gl.STREAM_DRAW);


	gl.drawElements(gl.LINE_LOOP, model.indicesItems, gl.UNSIGNED_SHORT, 0);


	gl.deleteBuffer(glVerticesBuffer);
	gl.deleteBuffer(glIndicesBuffer);
}

function renderTexturedPolygons(webgl, textureLabel, modelData) {
	var gl = webgl.gl;

	var program = webgl.programs.texture;

	var model = generateModel(modelData);

	gl.useProgram(program);

	var vertexAttribute = gl.getAttribLocation(program, "aVertexPosition");
	gl.enableVertexAttribArray(vertexAttribute);
	var glVerticesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glVerticesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, model.verticesBuffer, gl.STREAM_DRAW);
	gl.vertexAttribPointer(vertexAttribute, model.verticesItemSize, gl.FLOAT, false, 0, 0);

	var textureCoordsAttribute = gl.getAttribLocation(program, "aTextureCoord");
	gl.enableVertexAttribArray(textureCoordsAttribute);
	var glTextureCoordsBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glTextureCoordsBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, model.textureCoordsBuffer, gl.STREAM_DRAW);
	gl.vertexAttribPointer(textureCoordsAttribute, model.textureCoordsItemSize, gl.FLOAT, false, 0, 0);

	var samplerUniform = gl.getUniformLocation(program, "uSampler");
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, webgl.textures[textureLabel]);
	gl.uniform1i(samplerUniform, 1);


	var pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
	gl.uniformMatrix4fv(pMatrixUniform, false, webgl.pMatrix);

	var mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");
	gl.uniformMatrix4fv(mvMatrixUniform, false, webgl.vMatrix);


	var glIndicesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIndicesBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesBuffer, gl.STREAM_DRAW);


	gl.drawElements(gl.TRIANGLES, model.indicesItems, gl.UNSIGNED_SHORT, 0);


	gl.deleteBuffer(glVerticesBuffer);
	gl.deleteBuffer(glTextureCoordsBuffer);
	gl.deleteBuffer(glIndicesBuffer);

	gl.disableVertexAttribArray(1);
}

function renderColoredPolygons(webgl, modelData) {
	var gl = webgl.gl;

	var program = webgl.programs.colored;


	var model = generateModel(modelData);

	gl.useProgram(program);

	var vertexAttribute = gl.getAttribLocation(program, "aVertexPosition");
	gl.enableVertexAttribArray(vertexAttribute);
	var glVerticesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glVerticesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, model.verticesBuffer, gl.STREAM_DRAW);
	gl.vertexAttribPointer(vertexAttribute, model.verticesItemSize, gl.FLOAT, false, 0, 0);

	var colorAttribute = gl.getAttribLocation(program, "aColor");
	gl.enableVertexAttribArray(colorAttribute);
	var glColorBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glColorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, model.colorBuffer, gl.STREAM_DRAW);
	gl.vertexAttribPointer(colorAttribute, model.colorItemSize, gl.FLOAT, false, 0, 0);


	var pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
	gl.uniformMatrix4fv(pMatrixUniform, false, webgl.pMatrix);

	var mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");
	gl.uniformMatrix4fv(mvMatrixUniform, false, webgl.vMatrix);


	var glIndicesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIndicesBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesBuffer, gl.STREAM_DRAW);


	var renderingType = gl.TRIANGLES;
	gl.drawElements(renderingType, model.indicesItems, gl.UNSIGNED_SHORT, 0);


	gl.deleteBuffer(glVerticesBuffer);
	gl.deleteBuffer(glColorBuffer);
	gl.deleteBuffer(glIndicesBuffer);

	gl.disableVertexAttribArray(1);
}

function renderColoredLitPolygons(webgl, modelData) {
	var gl = webgl.gl;

	var program = webgl.programs.coloredLit;


	var model = generateModel(modelData);

	gl.useProgram(program);

	var vertexAttribute = gl.getAttribLocation(program, "aVertexPosition");
	gl.enableVertexAttribArray(vertexAttribute);
	var glVerticesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glVerticesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, model.verticesBuffer, gl.STREAM_DRAW);
	gl.vertexAttribPointer(vertexAttribute, model.verticesItemSize, gl.FLOAT, false, 0, 0);


	var vertexNormalAttribute = gl.getAttribLocation(program, "aVertexNormal");
	gl.enableVertexAttribArray(vertexNormalAttribute);
	var glVertexNormalsBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glVertexNormalsBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, model.vertexNormalsBuffer, gl.STREAM_DRAW);
	gl.vertexAttribPointer(vertexNormalAttribute, model.vertexNormalItemSize, gl.FLOAT, false, 0, 0);

	var colorAttribute = gl.getAttribLocation(program, "aColor");
	gl.enableVertexAttribArray(colorAttribute);
	var glColorBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glColorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, model.colorBuffer, gl.STREAM_DRAW);
	gl.vertexAttribPointer(colorAttribute, model.colorItemSize, gl.FLOAT, false, 0, 0);


	var pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
	gl.uniformMatrix4fv(pMatrixUniform, false, webgl.pMatrix);

	var mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");
	gl.uniformMatrix4fv(mvMatrixUniform, false, webgl.vMatrix);


	var normalMatrixUniform = gl.getUniformLocation(program, "uNMatrix");
	gl.uniformMatrix3fv(normalMatrixUniform, false, webgl.normalMatrix);

	var lightPositionUniform = gl.getUniformLocation(program, "uLightPosition");
	var lightPos = modelData.lightPos;
	gl.uniform3f(lightPositionUniform, lightPos.x,lightPos.y,lightPos.z);




	var glIndicesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIndicesBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesBuffer, gl.STREAM_DRAW);


	var renderingType = gl.TRIANGLES;
	gl.drawElements(renderingType, model.indicesItems, gl.UNSIGNED_SHORT, 0);


	gl.deleteBuffer(glVerticesBuffer);
	gl.deleteBuffer(glColorBuffer);
	gl.deleteBuffer(glIndicesBuffer);

	gl.disableVertexAttribArray(2);
	gl.disableVertexAttribArray(1);
}

var render = function(tag, webgl, data) {
	if (tag === "clearScreen") {
		var gl = webgl.gl;
		var color = data[data.length-1];

		gl.clearColor(color.r || 0, color.g || 0, color.b || 0, 1.0);

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}
	if (tag === "enableAlpha") {
		var gl = webgl.gl;
		// gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		// gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.BLEND);
		// gl.disable(gl.DEPTH_TEST);
	}
	else if (tag === "disableAlpha") {
		var gl = webgl.gl;
		gl.disable(gl.BLEND);
		// gl.enable(gl.DEPTH_TEST);
	}
	else if (tag === "texturedSquare") {
		var drawCommands = data;

		var squareData = generateSquareData();

		var modelData = {"vertices":[], "textureCoords":[],"indices":[]};


		for (var i = 0; i < drawCommands.length; i++) {
			var drawCommand = drawCommands[i];

			var x = drawCommand[1],
				y = drawCommand[2],
				z = drawCommand[3],
				xa = drawCommand[4],
				ya = drawCommand[5],
				za = drawCommand[6];

			for (var j = 0; j < squareData.vertices.length/3; j++) {
				var squareVertex = [
					squareData.vertices[j*3],
					squareData.vertices[j*3+1],
					squareData.vertices[j*3+2]
				];

				var tempVertex = rotate3d(squareVertex, xa, ya, za);

				tempVertex = translate(tempVertex, x,y,z);

				modelData.vertices.push(tempVertex[0]);
				modelData.vertices.push(tempVertex[1]);
				modelData.vertices.push(tempVertex[2]);

				modelData.textureCoords.push(squareData.textureCoords[j*2]);
				modelData.textureCoords.push(squareData.textureCoords[j*2+1]);
			}

			var vertexCount = squareData.vertices.length/3;
			for (var j = 0; j < squareData.indices.length; j++) {
				modelData.indices.push(squareData.indices[j]+vertexCount*i);
			}
		}

		var textureLabel = drawCommands[0][0];
		if (textureLabel === "wireframe")
			renderWireframePolygons(webgl, modelData)
		else
			renderTexturedPolygons(webgl, textureLabel, modelData);
	}
	else if (tag === "coloredPolygons") {

		var drawCommands = data;

		var squareData = generateSquareData();

		var modelData = {"vertices":[], "colors":[],"indices":[]};


		for (var i = 0; i < drawCommands.length; i++) {
			var drawCommand = drawCommands[i];

			var vertices = drawCommand[0],
				indices = drawCommand[1],
				r = drawCommand[2],
				g = drawCommand[3],
				b = drawCommand[4],
				a = drawCommand[5],
				x = drawCommand[6] || 0,
				y = drawCommand[7] || 0,
				z = drawCommand[8] || 0,
				xa = drawCommand[9],
				ya = drawCommand[10],
				za = drawCommand[11];

			for (var j = 0; j < vertices.length/3; j++) {
				var vertex = [
					vertices[j*3],
					vertices[j*3+1],
					vertices[j*3+2]
				];

				var tempVertex = rotate3d(vertex, xa, ya, za);

				tempVertex = translate(tempVertex, x,y,z);

				modelData.vertices.push(tempVertex[0]);
				modelData.vertices.push(tempVertex[1]);
				modelData.vertices.push(tempVertex[2]);

				modelData.colors.push(r);
				modelData.colors.push(g);
				modelData.colors.push(b);
				modelData.colors.push(a);
			}

			var oldVertexCount = (modelData.vertices.length - vertices.length)/3 ;
			for (var j = 0; j < indices.length; j++) {
				modelData.indices.push(indices[j]+oldVertexCount);
			}
		}

		renderColoredPolygons(webgl,  modelData);
	}
	else if (tag === "coloredLitPolygons") {

		var drawCommands = data;

		var squareData = generateSquareData();

		var modelData = {"vertices":[], "colors":[],"indices":[], "vertexNormals": []};


		for (var i = 0; i < drawCommands.length; i++) {
			var drawCommand = drawCommands[i];

			var vertices = drawCommand[0],
				indices = drawCommand[1],
				normals = drawCommand[2],
				lightX = drawCommand[3],
				lightY = drawCommand[4],
				lightZ = drawCommand[5],
				r = drawCommand[6],
				g = drawCommand[7],
				b = drawCommand[8],
				a = drawCommand[9],
				x = drawCommand[10] || 0,
				y = drawCommand[11] || 0,
				z = drawCommand[12] || 0,
				xa = drawCommand[13],
				ya = drawCommand[14],
				za = drawCommand[15];

			for (var j = 0; j < vertices.length/3; j++) {
				var vertex = [
					vertices[j*3],
					vertices[j*3+1],
					vertices[j*3+2]
				];

				var tempVertex = rotate3d(vertex, xa, ya, za);

				tempVertex = translate(tempVertex, x,y,z);

				modelData.vertices.push(tempVertex[0]);
				modelData.vertices.push(tempVertex[1]);
				modelData.vertices.push(tempVertex[2]);

				modelData.colors.push(r);
				modelData.colors.push(g);
				modelData.colors.push(b);
				modelData.colors.push(a);
			}

			var oldVertexCount = (modelData.vertices.length - vertices.length)/3 ;
			for (var j = 0; j < indices.length; j++) {
				modelData.indices.push(indices[j]+oldVertexCount);
			}

			for (var j = 0; j < normals.length; j++) {
				modelData.vertexNormals.push(normals[j]);
			}

			modelData.lightPos = {"x": lightX, "y": lightY, "z": lightZ};
		}

		renderColoredLitPolygons(webgl,  modelData);
	}

}

window.onload = function() {
	try {
		var internalData = {
			"imagesDataArray": [],
			"images": {},
			"soundsDataArray": [],
			"sounds": {},
			"drawQueue": []
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
				var webgl = internalData.webgl;
				var viewport = [0,0, webgl.canvas.width, webgl.canvas.height];

				return unprojectOnZeroLevel(screenX, screenY, webgl.unprojectVMatrix, webgl.pMatrix, viewport);
			},
			"playSound": function() {
				console.log("playSound()");
			},
			"getScreenDimensions": function() {
				console.log("getScreenDimensions()");
				return [internalData.webgl.canvas.width, internalData.webgl.canvas.height];
			},
			"setViewport": function(width, height) {
				internalData.webgl.canvas.width = width;
				internalData.webgl.canvas.height = height;

				var gl = internalData.webgl.gl;
				internalData.webgl.pMatrix = mat4.create();
				mat4.perspective(45, width / height, 0.1, 100.0, internalData.webgl.pMatrix);

				gl.viewport(0, 0, width, height);				
			},
			"setCamera": function(x, y, z) {
				internalData.webgl.vMatrix = mat4.lookAt([x,y,z], [x,y,0], [0,1,0]);
				internalData.webgl.unprojectVMatrix = mat4.lookAt([x,-y,z], [x,-y,0], [0,1,0]);

				var normalMatrix = mat3.create();
				mat4.toInverseMat3(internalData.webgl.vMatrix, normalMatrix);
				mat3.transpose(normalMatrix);
				internalData.webgl.normalMatrix = normalMatrix;
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
			"renderTexturedSquare": function(label, x, y, z, xa, ya, za) {
				internalData.drawQueue.push({"tag":"texturedSquare", "data":[label, x,y,z, xa,ya,za]});
			},
			"renderColoredPolygons": function(vertices, indices, r,g,b,a, x,y,z, xa,ya,za) {
				internalData.drawQueue.push({"tag":"coloredPolygons", "data":[vertices, indices, r,g,b,a, x,y,z, xa,ya,za]});
			},
			"renderColoredLitPolygons": function(vertices, indices, normals, lX,lY,lZ, r,g,b,a, x,y,z, xa,ya,za) {
				internalData.drawQueue.push({"tag":"coloredLitPolygons", "data":[vertices, indices, normals, lX,lY,lZ, r,g,b,a, x,y,z, xa,ya,za]});
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

			var imagePromises = 
				Promise.all(requestArray)
					.then(cacheImages)
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

			var soundPromises = 
				Promise.all(requestArray)
					.then(cacheSounds)
					.catch(function(data) {alert("Something bad happened!");});

			return soundPromises;
		};

		var gameLoopCycle = function() {
			globalData.processInput();

			globalData.render();

			var oldTag = null,
				oldIdentifier = null;


			var temp = [];

			for (var i = 0; i < internalData.drawQueue.length; i++) {
				var tag = internalData.drawQueue[i].tag,
					drawCommand = internalData.drawQueue[i].data;

				var identifier = tag;
				if (tag === "texturedSquare")
					identifier += drawCommand[0]; //textureLabel

				if (oldIdentifier === null) {
					temp.push(drawCommand);
				}
				else if (identifier === oldIdentifier) {
					temp.push(drawCommand);
				}
				else if (identifier !== oldIdentifier) {
					render(oldTag, internalData.webgl, temp);
					temp = [];
					temp.push(drawCommand);
				}

				if (i === internalData.drawQueue.length - 1) {
					render(tag, internalData.webgl, temp);
				}

				oldTag = tag;
				oldIdentifier = identifier;
			}

			internalData.drawQueue = [];

			window.requestAnimationFrame(gameLoopCycle);
		}

		var jumpStart = function() {
			var canvasElement = document.querySelector("#canvas");

			var gl = getGLcontext(canvasElement);

			var textureProgram = getProgram(gl, textureVertexShaderCode, textureFragmentShaderCode);
			var wireframeProgram = getProgram(gl, wireframeVertexShaderCode, wireframeFragmentShaderCode);
			var coloredProgram = getProgram(gl, coloredVertexShaderCode, coloredFragmentShaderCode);
			var coloredLitProgram = getProgram(gl, coloredLitVertexShaderCode, coloredLitFragmentShaderCode);


			internalData.webgl = {
				"canvas": canvasElement,
				"gl": gl,
				"programs": {
					"texture": textureProgram,
					"wireframe": wireframeProgram,
					"colored": coloredProgram,
					"coloredLit": coloredLitProgram
				},
				"textures": {}
			};


			var onResize = function() {
				var width = window.innerWidth
					|| document.documentElement.clientWidth
					|| document.body.clientWidth;

				var height = window.innerHeight
					|| document.documentElement.clientHeight
					|| document.body.clientHeight;

				if (width < 120) width = 120;
				if (height < 80) height = 80;

				nativeFunctions.setViewport(width, height);
			}

			onResize();
			window.onresize = onResize;


			nativeFunctions.enableAlphaBlending();

			nativeFunctions.setCamera(0,0,0);


			gl.enable(gl.DEPTH_TEST);
			// gl.enable(gl.CULL_FACE);


			for (var i = 0; i < internalData.imagesDataArray.length; i++) {
				var imageData = internalData.imagesDataArray[i];
				var cachedTextureLabel = imageData.label;

				var withAlphaChannel = imageData.path.indexOf("with_alpha") > 0;

				var glTexture = generateGlTexture(gl, internalData.images[cachedTextureLabel], withAlphaChannel);

				internalData.webgl.textures[cachedTextureLabel] = glTexture;
			}

			canvasElement.onmousedown = function(e) {
				globalData.addInput(["pressed", 0, e.offsetX, e.offsetY]);
				internalData["mousePressed"] = true;
			};

			canvasElement.onmousemove = function(e) {
				if (internalData.mousePressed) {
					globalData.addInput(["move", 0, e.offsetX, e.offsetY]);
				}
			};

			canvasElement.onmouseup = function(e) {
				globalData.addInput(["release", 0]);
				internalData.mousePressed = undefined;
			};

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
