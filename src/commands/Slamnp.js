var discord = require("discord.js");
var https = require("https");

module.exports = function(msg) {
	https.get("https://live.slam.nl/metadata/hardstyle_livewall", function(res) {
		var data = "";
		res.setEncoding("utf8");
		res.on("data", function(chunk) { data += chunk; });
		res.on("end", function() {
			try {
				var obj = JSON.parse(data);

				var embed = new discord.RichEmbed({
					title: "SLAM Hardstyle is now playing:",
					description: obj.nowArtist + " - " + obj.nowTitle
				});
				embed.setThumbnail(obj.nowImage);
				embed.setColor("#E6006A");
				msg.channel.send("", embed);
			} catch (err) {
				msg.channel.send("I failed to get the SLAM Hardstyle info... :sob:");
				console.log(err);
			}
		});
	});
};
