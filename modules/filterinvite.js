const discord = require("discord.js");
const RedditRadio = require("../RedditRadio");

class FilterInviteModule
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
		if (this.bot.isMod(msg.member)) {
			return;
		}

		var inviteLinks = msg.content.matchAll(/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/([A-Za-z0-9]+)/gi);
		for (const link of inviteLinks) {
			var inviteCode = link[2];

			var isWhitelisted = false;
			if (this.config.whitelist) {
				isWhitelisted = (this.config.whitelist.indexOf(inviteCode) != -1);
			}

			if (!isWhitelisted) {
				msg.delete();
				this.bot.addLogMessage("Deleted Discord invite link from " + msg.author.toString() + " in " + msg.channel.toString() + ": `" + msg.content.replace('`', '\\`') + "`");
				msg.author.send("Your recent message has been automatically deleted. Please do not post Discord invite links without prior permission from a moderator or admin.").catch(console.error);
			}
		}
	}
}

module.exports = FilterInviteModule;
