var discord = require("discord.js");
var https = require("https");

module.exports = function(msg) {
	https.get("https://api.tb-group.fm/v1/tracklist/7", function(res) {
		var data = "";
		res.setEncoding("utf8");
		res.on("data", function(chunk) { data += chunk; });
		res.on("end", function() {
			try {
				var arr = JSON.parse(data);
				var obj = arr[1];

				var embed = new discord.RichEmbed({
					title: "HardBase.fm last played with " + obj.u + ":",
					description: obj.a + " - " + obj.t
				});
				embed.setThumbnail("https://api.tb-group.fm/images/release/" + obj.r);
				embed.setColor("#132C44");
				msg.channel.send("", embed);
			} catch (err) {
				msg.channel.send("I failed to get the HardBase.fm info... :sob:");
				console.log(err);
			}
		});
	});
};
