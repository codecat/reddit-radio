const discord = require("discord.js");

class JoinReactModule
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
		if (msg.system && msg.type == "GUILD_MEMBER_JOIN") {
			setTimeout(() => {
				msg.react(this.config.emoji).catch(console.error);
			}, 2000);
		}
	}
}

module.exports = JoinReactModule;
