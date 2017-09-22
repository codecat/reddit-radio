// Run this to print Q-Dance Radio schedule for "today".
// It's not really today though, see:
// https://twitter.com/codecatt/status/911341631080734720

var https = require("https");

https.get("https://www.q-dance.com/global/radio/", function(res) {
	var data = "";
	res.setEncoding("utf8");
	res.on("data", function(chunk) { data += chunk; });
	res.on("end", function() {
		var lookFor = "var radioshows = ";
		var match = data.match(/var radioshows = (.*\}\]);/);
		var obj = JSON.parse(match[1]);

		console.log(obj.length + " shows");
		console.log("First: " + obj[0].date);
		console.log("Last: " + obj[obj.length - 1].date);

		var now = new Date();
		for (var i = 0; i < obj.length; i++) {
			var show = obj[i];
			var showDate = new Date(show.date);
			if (showDate.getYear() == now.getYear() && showDate.getMonth() == now.getMonth() && showDate.getDate() == now.getDate()) {
				console.log("Today!", show);
			}
		}
	});
});
