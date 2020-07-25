const discord = require("discord.js");
const RedditRadio = require("../RedditRadio");

var moment = require("moment");

class AntiSpamModule
{
	constructor(config, client, bot)
	{
		this.config = config;

		/** @type {discord.Client} */
		this.client = client;

		/** @type {RedditRadio} */
		this.bot = bot;

		/** @type {String[]} */
		this.permitted = [];
	}

	/**
	 * @param {discord.Message} msg
	 * @param {Boolean} edited
	 */
	onMessage(msg, edited)
	{
		var delay = this.config.minutes || 60;

		if (msg.content.match(/https?:\/\//i) || msg.content.match(/\.[a-z]{2,3}\//i) || msg.content.match(/(bit.ly|shorturl.at|tiny.cc)/i)) {
			msg.guild.members.fetch(msg.author).then((member) => {
				var minutes = moment().diff(member.joinedAt, "minutes");

				// Check the list of permitted users with .permit
				var permittedIndex = this.permitted.indexOf(msg.author.id);
				if (permittedIndex != -1) {
					if (minutes >= delay) {
						this.permitted.splice(permittedIndex, 1);
					}
					return;
				}

				// Check if we joined less than X minutes ago
				if (minutes < delay) {
					this.bot.addLogMessage("Deleted link from " + member.toString() + " in " + msg.channel.toString() + " who joined " + minutes + " minutes ago. Deleted message:\n```" + msg.content + "```");
					msg.delete();
					msg.author.send("Your recent message has been automatically deleted. We do not allow new users to post links for a short while, to combat spam. Check #info for more information about the rules. If you think this message is in error, please DM one of the mods.");
					return;
				}
			});
		}
	}

	/**
	 * @param {discord.Message} msg
	 * @param {String} user
	 */
	onCmdPermit(msg, user)
	{
		if (!this.bot.isMod(msg.member)) {
			return;
		}

		var mentions = "";
		for (let member of msg.mentions.members) {
			this.permitted.push(member[0]);
			mentions += member[1].toString() + " ";
		}
		msg.channel.send(mentions + "A moderator has permitted you to post links!");

		this.bot.addLogMessage(msg.member.toString() + " has permitted " + mentions + "to post links");
	}
}

module.exports = AntiSpamModule;
