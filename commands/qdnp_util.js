var discord = require("discord.js");
var http = require("https");

module.exports = {
	get: function(dir, callback) {
		var ret = {};

		http.get("https://feed.q-dance.com/onair", function(res) {
			var data = "";
			res.setEncoding("utf8");
			res.on("data", function(chunk) { data += chunk; });
			res.on("end", function() {
				var obj = JSON.parse(data);
				if (dir == -1) {
					callback(obj.TrackData.PreviousPlaying);
				} else if (dir == 0) {
					callback(obj.TrackData.NowPlaying);
				} else if (dir == 1) {
					callback(obj.TrackData.NextPlaying);
				}
			});
		});
	},

	makeEmbed: function(track, title) {
		var embed = new discord.RichEmbed({
			title: title,
			description: track.Artist + " - " + track.Title
		});
		embed.setAuthor("Q-Dance Radio", "https://4o4.nl/20170908JHxVy.png");
		embed.setThumbnail(track.CoverImage);
		embed.setColor("#D26F1C");
		return embed;
	}
};
