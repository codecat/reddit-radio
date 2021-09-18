var discord = require("discord.js");
var http = require("https");

class QdanceModule
{
	get(dir)
	{
		return new Promise((resolve, reject) => {
			http.get("https://feed.q-dance.com/onair", function(res) {
				var data = "";
				res.setEncoding("utf8");
				res.on("data", function(chunk) { data += chunk; });
				res.on("end", function() {
					var obj = JSON.parse(data);
					if (dir == -1) {
						resolve(obj.TrackData.PreviousPlaying);
					} else if (dir == 0) {
						resolve(obj.TrackData.NowPlaying);
					} else if (dir == 1) {
						resolve(obj.TrackData.NextPlaying);
					}
					reject('Unknown track direction!');
				});
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
		embed.setAuthor("Q-dance Radio", "https://4o4.nl/20170908JHxVy.png");
		embed.setThumbnail(track.CoverImage);
		return embed;
	}

	async onCmdQdnp(msg)
	{
		var track = await this.get(0);
		msg.channel.send({
			embeds: [ this.makeEmbed(track, "Q-dance Radio is now playing:") ],
		});
	}

	async onCmdQdnext(msg)
	{
		var track = await this.get(1);
		msg.channel.send({
			embeds: [ this.makeEmbed(track, "Next track on Q-dance Radio:") ],
		});
	}

	async onCmdQdprev(msg)
	{
		var track = await this.get(-1);
		msg.channel.send({
			embeds: [ this.makeEmbed(track, "Previous track on Q-dance Radio:") ],
		});
	}
}

module.exports = QdanceModule;
