module.exports = function(str, options) {
	var ret = [];

	var buffer = "";
	var inString = false;

	for (var i = 0; i < str.length; i++) {
		var c = str[i];

		// literals
		if (c == "\\" && i + 1 < str.length) {
			buffer += str[++i];
			continue;
		}

		// strings
		if (c == "\"") {
			if (inString) {
				// string ends
				inString = false;
				ret.push(buffer);
				buffer = "";
				if (i + 1 < str.length && str[i + 1] == " ") {
					i++;
				}
			} else {
				// string starts
				inString = true;
			}
			continue;
		}

		// words
		if (c == " ") {
			if (inString) {
				buffer += " ";
			} else {
				ret.push(buffer);
				buffer = "";
			}
			continue;
		}

		// characters
		buffer += c;
	}

	// last word
	if (buffer != "") {
		ret.push(buffer);
	}

	return ret;
};
