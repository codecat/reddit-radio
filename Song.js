var ytdl = require("ytdl-core");
var https = require("follow-redirects").https;
var url = require("url");
var yt_search = require('youtube-search');

class Song
{
	constructor(config, query, callback)
	{
		var wrappedUrl = query.match(/^<(.+)>$/);
		if (wrappedUrl) {
			query = wrappedUrl[1];
		}

		this.url = query;
		this.valid = false;

		this.title = "";
		this.author = "";
		this.image = "";
		this.live = false;
		this.source = "";
		this.duration = 0; // milliseconds

		this.callback = callback;

		if (query.match(/^(https?\:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/)) {
			this.makeYoutubeStream();
		} else if (query.match(/^https:\/\/soundcloud\.com\/[^\/]+\/.+$/)) {
			this.makeSoundcloudStream(config.soundcloud);
		} else if (query.match(/^https:\/\/www\.mixcloud\.com\/[^\/]+\/.+$/)) {
			this.makeMixcloudStream(config.soundcloud);
		} else if (query.match(/^https:\/\/www\.facebook\.com\/.*\/videos\/[0-9]+/)) {
			this.makeFacebookStream();
		} else if (query.match(/^https:\/\/www\.pscp\.tv\/w\/[A-Za-z0-9]{13}/)) {
			this.makePeriscopeStream();
		} else if (query.match(/^(local\/|https?:\/\/).*\.(mp3|m4a)/)) {
			this.makeMP3Stream();
		} else {
			var matchSearch = query.match(/^([^ ]+) (.*)$/);
			if (matchSearch) {
				var service = matchSearch[1].toLowerCase();
				if (service == "youtube" || service == "yt") {
					if (this.searchYoutube(matchSearch[2], config)) {
						return;
					}
				}
			}

			if (this.searchSoundcloud(query, config)) {
				return;
			}

			console.log("Unrecognized url: " + query);
			callback(this);
		}
	}

	searchSoundcloud(query, config)
	{
		if (!config.soundcloud || !config.soundcloud.client_id) {
			return false;
		}

		var urlResolve = "https://api.soundcloud.com/tracks.json?q=" + encodeURIComponent(query) + "&client_id=" + config.soundcloud.client_id;
		https.get(urlResolve, (res) => {
			var data = "";
			res.setEncoding("utf8");
			res.on("data", function(chunk) { data += chunk; });
			res.on("end", () => {
				if (data == "") {
					console.log("Soundcloud search response was empty for some reason..");
					return;
				}

				var obj = JSON.parse(data);
				if (obj.length == 0) {
					if (!this.searchYoutube(query, config)) {
						this.callback(this);
					}
					return;
				}

				var track = obj[0];
				this.makeSoundcloudStreamFromTrack(track, config.soundcloud);
			});
		});

		return true;
	}

	searchYoutube(query, config)
	{
		if (!config.youtube || !config.youtube.token) {
			return false;
		}

		console.log("Searching YouTube: " + query);

		var options = {
			maxResults: 1,
			key: config.youtube.token
		};

		yt_search(query, options, (error, results) => {
			if (error) {
				console.log("Failed to search Youtube: \"" + error + "\"");
				return;
			}
			if (results.length <= 0) {
				console.log("No Youtube results were found for \"" + query + "\"");
				return 
			}
		 	this.url = results[0].link;
			this.makeYoutubeStream();
		});

		return true;
	}

	makeYoutubeStream()
	{
		ytdl.getInfo(this.url).then((info) => {
			if (info.live_default_broadcast || info.live_playback) {
				this.live = true;

				// Workaround for a crash in ytdl-core, I think?
				// If we're livestreaming, can use the m3u8 stream directly. This means we will also get video.
				// So we just try to get the lowest video quality with a 128kbps audio quality (or lower if nothing else).
				// WE NEED TO GET RID OF THIS IF WE CAN ACTUALLY FIX THE DAMN THING
				var audioFormats = [];
				for (var i = 0; i < info.formats.length; i++) {
					var f = info.formats[i];
					if (f.audioBitrate !== null && f.audioBitrate <= 128 && f.url.endsWith(".m3u8")) {
						console.log("-- Found format: " + f.audioBitrate + "kbps audio, " + f.resolution + " video");
						audioFormats.push(f);
					}
				}

				var sortedFormats = audioFormats.sort((a, b) => {
					if (a.audioBitrate > b.audioBitrate) {
						return -1;
					} else if (a.audioBitrate < b.audioBitrate) {
						return 1;
					}
				});

				var highestBitrate = sortedFormats[0].audioBitrate;
				console.log("Highest audio bitrate: " + highestBitrate);

				var highFormats = [];
				for (var i = 0; i < sortedFormats.length; i++) {
					if (sortedFormats[i].audioBitrate == highestBitrate) {
						highFormats.push(sortedFormats[i]);
					}
				}

				sortedFormats = highFormats.sort((a, b) => {
					var resA = parseInt(a.resolution);
					var resB = parseInt(b.resolution);

					if (resA > resB) {
						return 1;
					} else if (resA < resB) {
						return -1;
					}

					return 0;
				});

				var useFormat = sortedFormats[0];
				console.log("YouTube livestream! Using format: " + useFormat.audioBitrate + "kbps audio, " + useFormat.resolution + " video");

				this.stream = useFormat.url;

				this.title = info.title;
				this.author = info.author.name;
				this.image = info.iurlhq;
				this.source = "youtube";

				this.valid = true;

				this.callback(this);

			} else {
				this.stream = ytdl(this.url, {
					filter: "audioonly"
				});

				this.stream.on("info", (info, format) => {
					this.title = info.title;
					this.author = info.author.name;
					this.image = info.iurlhq;
					this.source = "youtube";

					this.valid = true;

					this.callback(this);
				});
			}
		});
	}

	makeSoundcloudStream(config)
	{
		var urlResolve = "https://api.soundcloud.com/resolve.json?url=" + encodeURIComponent(this.url) + "&client_id=" + config.client_id;
		https.get(urlResolve, (res) => {
			var data = "";
			res.setEncoding("utf8");
			res.on("data", function(chunk) { data += chunk; });
			res.on("end", () => {
				if (data == "") {
					console.log("There is no response for that URL. Resolve URL = " + urlResolve);
					this.callback(this);
					return;
				}

				var obj = JSON.parse(data);
				if (obj.errors !== undefined && obj.errors.length > 0) {
					console.log("Soundcloud fetch error", obj.errors);
					this.callback(this);
					return;
				}

				this.makeSoundcloudStreamFromTrack(obj, config);
			});
		});
	}

	makeSoundcloudStreamFromTrack(track, config)
	{
		this.title = track.title;
		this.author = track.user.username;
		this.image = track.artwork_url;
		this.source = "soundcloud";
		this.duration = track.duration;

		this.stream = track.stream_url + "?client_id=" + config.client_id;

		this.valid = true;
		this.callback(this);
	}

	makeMixcloudStream(config)
	{
		var resolveUrl = this.url.replace("https://www.", "https://api.");
		https.get(resolveUrl, (res) => {
			var data = "";
			res.setEncoding("utf8");
			res.on("data", function(chunk) { data += chunk; });
			res.on("end", () => {
				if (data == "") {
					console.log("There is no response for that URL. Resolve URL = " + urlResolve);
					this.callback(this);
					return;
				}

				var obj = JSON.parse(data);
				if (obj.errors !== undefined && obj.errors.length > 0) {
					console.log("Mixcloud fetch error", obj.errors);
					this.callback(this);
					return;
				}

				this.makeMixcloudStreamFromTrack(obj, config);
			});
		});
	}

	makeMixcloudStreamFromTrack(track, config) {
		this.title = track.name;
		this.author = track.user.username;
		this.image = track.pictures.large;
		this.source = "mixcloud";
		this.duration = track.audio_length * 1000; // Turn into milliseconds

		this.stream = this.url.replace("https://www.mixcloud.com", "http://download.mixcloud-downloader.com/d/mixcloud");

		this.valid = true;
		this.callback(this);
	}

	makeFacebookStream()
	{
		var parse = url.parse(this.url);
		https.get({
			host: parse.host,
			path: parse.path,
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:55.0) Gecko/20100101 Firefox/55.0",
				"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
			}
		}, (res) => {
			var data = "";
			res.setEncoding("utf8");
			res.on("data", function(chunk) { data += chunk; });
			res.on("end", () => {
				var matchLive = data.match(/isLive:(true|false)/);
				var matchOwnerName = data.match(/ownerName:"([^\"]+)"/);
				var matchUrl = data.match(/hd_src:"([^\"]+)"/);

				if (matchOwnerName) {
					this.title = matchOwnerName[1];
				} else {
					this.title = "Facebook video";
				}

				if (matchUrl) {
					this.stream = matchUrl[1];
					this.valid = true;
				}

				this.source = "facebook";

				this.live = (matchLive && matchLive[1] == "true");

				this.callback(this);
			});
		});
	}

	makePeriscopeStream()
	{
		var matchID = this.url.match(/^https:\/\/www.pscp.tv\/w\/([A-Za-z0-9]{13})/);
		if (!matchID) {
			return;
		}

		https.get("https://proxsee.pscp.tv/api/v2/accessVideoPublic?broadcast_id=" + matchID[1], (res) => {
			var data = "";
			res.setEncoding("utf8");
			res.on("data", function(chunk) { data += chunk; });
			res.on("end", () => {
				var obj = JSON.parse(data);

				var streamUrl = "";

				if (obj.type == "StreamTypeReplay") {
					console.log("This is a periscope replay, it's not live!");
					//streamUrl = obj.replay_url;
					callback(this);
					return;
				} else {
					console.log("Periscope live!");
					streamUrl = obj.hls_url;
				}

				this.title = obj.broadcast.status;
				this.author = obj.broadcast.user_display_name;
				this.image = obj.broadcast.image_url;
				this.source = "periscope";
				this.live = true;

				this.stream = streamUrl;

				this.valid = true;

				this.callback(this);
			});
		});
	}

	makeMP3Stream()
	{
		this.title = this.url;
		this.author = "The Internet";

		this.stream = this.url;

		this.valid = true;

		this.callback(this);
	}
}

module.exports = Song;
