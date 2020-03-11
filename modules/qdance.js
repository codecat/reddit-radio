var discord = require("discord.js");
var http = require("https");

class QdanceModule
{
	get(dir, callback)
	{
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
	}

	makeEmbed(track, title)
	{
		var embed = new discord.MessageEmbed({
			title: title,
			description: track.Artist + " - " + track.Title,
			hexColor: "#D26F1C"
		});
		embed.setAuthor("Q-Dance Radio", "https://4o4.nl/20170908JHxVy.png");
		embed.setThumbnail(track.CoverImage);
		return embed;
	}

	onCmdQdnp(msg)
	{
		this.get(0, (track) => {
			msg.channel.send("", this.makeEmbed(track, "Q-Dance Radio is now playing:"));
		});
	}

	onCmdQdnext(msg)
	{
		this.get(1, (track) => {
			msg.channel.send("", this.makeEmbed(track, "Next track on Q-Dance Radio:"));
		});
	}

	onCmdQdprev(msg)
	{
		this.get(-1, (track) => {
			msg.channel.send("", this.makeEmbed(track, "Previous track on Q-Dance Radio:"));
		});
	}
}

module.exports = QdanceModule;
