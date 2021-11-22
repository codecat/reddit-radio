const discord = require("discord.js");
const RedditRadio = require("../RedditRadio");

class FilterEmotesModule
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
	 * @param {Boolean} edited
	 */
	onMessage(msg, edited)
	{
		var limit = this.config.limit || 14;

		var emotes = msg.content.toLowerCase().match(/(<a?:[^:]+:[0-9]+>|\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g);
		if (emotes && emotes.length > limit) {
			msg.delete();
			this.bot.addLogMessage("Deleted message from " + msg.member.toString() + " in " + msg.channel.toString() + " that contained " + emotes.length + " emotes");
			msg.author.send("You posted too many emojis. Calm down a little bit!").catch(console.error);
		}
	}
}

module.exports = FilterEmotesModule;
