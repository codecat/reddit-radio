var Twitter = require("twitter");

class Twit
{
	constructor(twitterConfig, twitConfig, discord)
	{
		this.discord = discord;
		this.config = twitConfig;

		this.client = new Twitter(twitterConfig);

		this.lastTime = Date.now();
		this.delay = this.config.delay;

		console.log("Twit: " + this.config.user + "/" + this.config.slug);
	}

	onTick()
	{
		this.delay--;
		if (this.delay <= 0) {
			this.delay = this.config.delay;
			this.checkNow();
		}
	}

	checkNow()
	{
		this.client.get("lists/statuses", {
			slug: this.config.slug,
			owner_screen_name: this.config.user,
			include_rts: false
		}, (error, tweets, response) => {
			var channel = this.discord.channels.get(this.config.channel);

			for (var i = 0; i < tweets.length; i++) {
				var tweet = tweets[i];
				if (this.lastTime < Date.parse(tweet.created_at)) {
					var url = "https://twitter.com/" + tweet.user.screen_name + "/status/" + tweet.id_str;
					console.log("New tweet: " + url);
					channel.send("<:twitter:373576839085686804> " + url);
				}
			}

			this.lastTime = Date.now();
		});
	}
}

module.exports = Twit;
