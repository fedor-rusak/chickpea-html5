"use strict";

try {
	console.log;
}
catch (e) {
	var console = {"log": function(data){}};
}