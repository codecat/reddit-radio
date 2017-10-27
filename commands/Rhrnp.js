var discord = require("discord.js");
var http = require("http");

module.exports = function(msg) {
	http.get("http://rhr.fm/radio/history", function(res) {
		var data = "";
		res.setEncoding("utf8");
		res.on("data", function(chunk) { data += chunk; });
		res.on("end", function() {
			try {
				var match = data.match(/data-lolo-artist="([^"]+)" data-lolo-title="([^"]+)"/);

				var artist = match[1];
				var track = match[2];

				var embedDescription = track;
				if (artist != "" && artist != "p") {
					embedDescription = artist + " - " + track;
				}

				var embed = new discord.RichEmbed({
					title: "Real Hardstyle Radio is now playing:",
					description: embedDescription
				});
				embed.setColor("#215B81");
				msg.channel.send("", embed);
			} catch (err) {
				msg.channel.send("I failed to get the RHR.fm info... :sob:");
				console.log(err);
			}
		});
	});
};
