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
		this.live = false;

		if (url.match(/youtube.com\/watch\?v=/)) {
			this.makeYoutubeStream(callback);
		} else if (url.match(/^https:\/\/soundcloud.com\/[^\/]+\/.+$/)) {
			this.makeSoundcloudStream(config.soundcloud, callback);
		} else if (url.endsWith(".mp3")) {
			this.makeMP3Stream(callback);
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
			if (info.live_default_broadcast == "1") {
				this.live = true;
			}

			if (this.live) {
				// Workaround for a crash in ytdl-core, I think?
				// If we're livestreaming, can use the m3u8 stream directly. This means we will also get video.
				// So we just try to get the lowest video quality with a 128kbps audio quality (or lower if nothing else).
				var audioFormats = [];
				for (var i = 0; i < info.formats.length; i++) {
					var f = info.formats[i];
					if (f.audioBitrate !== null && f.audioBitrate <= 128 && f.url.endsWith(".m3u8")) {
						audioFormats.push(f);
					}
				}

				var sortedFormats = audioFormats.sort((a, b) => {
					if (a.audioBitrate > b.audioBitrate) {
						return -1;
					} else if (a.audioBitrate < b.audioBitrate) {
						return 1;
					}
					return -a.resolution.localeCompare(b.resolution);
				});

				var useFormat = sortedFormats[0];
				console.log("YouTube livestream! Using format: " + useFormat.audioBitrate + "kbps audio, " + useFormat.resolution + " video");

				this.stream.destroy();
				this.stream = useFormat.url;
			}

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

	makeMP3Stream(callback)
	{
		this.title = this.url;
		this.author = "The Internet";

		this.stream = this.url;

		this.valid = true;

		callback(this);
	}
}

module.exports = Song;
