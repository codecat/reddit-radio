var Twitter = require("twitter");

class Twit
{
	constructor(twitterConfig, twitConfig, discord)
	{
		this.config = twitConfig;

		this.channel = discord.channels.get(this.config.channel);

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
			owner_screen_name: this.config.user
		}, (error, tweets, response) => {
			for (var i = 0; i < tweets.length; i++) {
				var tweet = tweets[i];
				if (this.lastTime < Date.parse(tweet.created_at)) {
					var url = "https://twitter.com/" + tweet.user.screen_name + "/status/" + tweet.id;
					console.log("New tweet: " + url);
					this.channel.send("<:twitter:373576839085686804> " + url);
				}
			}

			this.lastTime = Date.now();
		});
	}
}

module.exports = Twit;
