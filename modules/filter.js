const discord = require("discord.js");
const RedditRadio = require("../RedditRadio");

class FilterModule
{
	constructor(config, client, bot)
	{
		this.config = config;

		/** @type {discord.Client} */
		this.client = client;

		/** @type {RedditRadio} */
		this.bot = bot;

		if (this.config.channel) {
			if (!this.config.channels) {
				this.config.channels = [];
			}
			this.config.channels.push(this.config.channel);
		}
	}

	/**
	 * @param {discord.Message} msg
	 * @param {Boolean} edited
	 */
	onMessage(msg, edited)
	{
		if (this.bot.isMod(msg.member)) {
			return;
		}

		var shouldDelete = false;

		// Only filter if we're in the right channel
		if (this.config.channels) {
			var isInChannel = false;
			for (const channelID of this.config.channels) {
				if (msg.channel.id == channelID) {
					isInChannel = true;
					break;
				}
			}
			if (!isInChannel) {
				return;
			}
		}

		// Check for bad words (case insensitive)
		if (this.config.words && msg.content.toLowerCase().match(this.config.words)) {
			shouldDelete = true;
		}

		// Check for bad tokens (case sensitive)
		if (this.config.tokens && msg.content.match(this.config.tokens)) {
			shouldDelete = true;
		}

		if (shouldDelete) {
			var usermessage = this.config.usermessage || "Your recent message has been automatically deleted. Please take another look at the rules in #info. We automatically delete messages for things like piracy and advertising.";

			msg.delete();
			this.bot.addLogMessage("Deleted unwanted message from " + msg.author.toString() + " in " + msg.channel.toString() + ": `" + msg.content.replace('`', '\\`') + "`");
			msg.author.send(usermessage).catch(console.error);
		}
	}
}

module.exports = FilterModule;
