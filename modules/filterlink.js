const discord = require("discord.js");
const RedditRadio = require("../RedditRadio");

var moment = require("moment");

class FilterLinkModule
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

	isPermitted(member)
	{
		var delay = this.config.minutes || 60;
		var minutes = moment().diff(member.joinedTimestamp, "minutes");

		if (minutes >= delay) {
			return true;
		}

		// Check the list of permitted users with .permit
		var permittedIndex = this.permitted.indexOf(member.id);
		if (permittedIndex != -1) {
			if (minutes >= delay) {
				this.permitted.splice(permittedIndex, 1);
			}
			return true;
		}

		return false;
	}

	/**
	 * @param {discord.Message} msg
	 * @param {Boolean} edited
	 */
	onMessage(msg, edited)
	{
		if (msg.content.match(/https?:\/\//i) || msg.content.match(/\.[a-z]{2,3}\//i) || msg.content.match(/(bit.ly|shorturl.at|tiny.cc)/i)) {
			msg.guild.members.fetch(msg.author).then((member) => {
				if (this.isPermitted(member)) {
					return;
				}

				msg.delete();
				msg.author.send("Your recent message has been automatically deleted. Brand new members can't post links for a short while, to combat spam. Check #info for more information about the rules. If you think this message is in error, please DM one of the mods.").catch(console.error);

				var minutes = moment().diff(member.joinedTimestamp, "minutes");
				this.bot.addLogMessage("Deleted link from " + member.toString() + " in " + msg.channel.toString() + " who joined " + minutes + " minutes ago. Deleted message:\n```" + msg.content + "```");
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
		var num = 0;
		msg.mentions.members.each(member => {
			if (this.isPermitted(member)) {
				return;
			}
			this.permitted.push(member.id);
			mentions += member.toString() + " ";
			num++;
		});

		if (num > 0) {
			msg.channel.send(mentions + "A moderator has permitted you to post links!");
			this.bot.addLogMessage(msg.member.toString() + " has permitted " + mentions + "to post links");
		}
	}
}

module.exports = FilterLinkModule;
