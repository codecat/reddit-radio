var ytdl = require("ytdl-core");

class Song
{
	constructor(url, callback)
	{
		this.url = url;
		this.valid = false;

		this.title = "";
		this.author = "";
		this.image = "";

		if (url.match(/youtube.com\/watch\?v=/)) {
			this.stream = this.makeYoutubeStream(callback);
		}
	}

	makeYoutubeStream(callback)
	{
		var stream = ytdl(this.url, {
			filter: "audioonly"
		});

		stream.on("info", (info, format) => {
			this.title = info.title;
			this.author = info.author.name;
			this.image = info.iurlhq;

			this.valid = true;

			callback(this);
		});

		return stream;
	}
}

module.exports = Song;
