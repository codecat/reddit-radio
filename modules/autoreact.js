const discord = require("discord.js");

class AutoReactModule
{
	constructor(config, client, bot)
	{
		this.config = config;
		/** @type {discord.Client} */
		this.client = client;
		this.bot = bot;
	}

	/**
	 * @param {discord.Message} msg
	 * @param {Boolean} edited
	 */
	onMessage(msg, edited)
	{
		if (edited) {
			return;
		}

		if (msg.content.match(new RegExp(this.config.match, "i"))) {
			msg.react(this.config.emoji);
		}
	}
}

module.exports = AutoReactModule;
