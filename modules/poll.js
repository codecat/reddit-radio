const discord = require("discord.js");
const RedditRadio = require("../RedditRadio");

class PollModule
{
	constructor(config, client, bot)
	{
		this.config = config;

		/** @type {discord.Client} */
		this.client = client;

		/** @type {RedditRadio} */
		this.bot = bot;
	}

	/**
	 * @param {discord.Message} msg
	 */
	onCmdPoll(msg)
	{
		(async () => {
			await msg.react("👍");
			await msg.react("👎");
		})();
	}
}

module.exports = PollModule;
