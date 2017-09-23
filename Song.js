var ytdl = require("ytdl-core");
var https = require("follow-redirects").https;

class Song
{
	constructor(config, url, callback)
	{
		var wrappedUrl = url.match(/^<(.+)>$/);
		if (wrappedUrl) {
			url = wrappedUrl[1];
		}

		this.url = url;
		this.valid = false;

		this.title = "";
		this.author = "";
		this.image = "";
		this.waveform = "";

		if (url.match(/youtube.com\/watch\?v=/)) {
			this.makeYoutubeStream(callback);
		} else if (url.match(/^https:\/\/soundcloud.com\/[^\/]+\/.+$/)) {
			this.makeSoundcloudStream(config.soundcloud, callback);
		} else {
			console.log("Unrecognized url: " + url);
			callback(this);
		}
	}

	makeYoutubeStream(callback)
	{
		this.stream = ytdl(this.url, {
			filter: "audioonly"
		});

		this.stream.on("info", (info, format) => {
			this.title = info.title;
			this.author = info.author.name;
			this.image = info.iurlhq;

			this.valid = true;

			callback(this);
		});
	}

	makeSoundcloudStream(config, callback)
	{
		var urlResolve = "https://api.soundcloud.com/resolve.json?url=" + encodeURIComponent(this.url) + "&client_id=" + config.client_id;
		https.get(urlResolve, (res) => {
			var data = "";
			res.setEncoding("utf8");
			res.on("data", function(chunk) { data += chunk; });
			res.on("end", () => {
				var obj = JSON.parse(data);
				if (obj.errors !== undefined && obj.errors.length > 0) {
					console.log("Soundcloud fetch error", obj.errors);
					return;
				}

				this.title = obj.title;
				this.author = obj.user.username;
				this.image = obj.artwork_url;

				this.stream = obj.stream_url + "?client_id=" + config.client_id;

				this.valid = true;

				callback(this);
			});
		});
	}
}

module.exports = Song;
