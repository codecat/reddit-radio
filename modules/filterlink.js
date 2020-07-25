var moment = require("moment");

class AntiSpamModule
{
	constructor(config, client, bot)
	{
		this.config = config;
		this.client = client;
		this.bot = bot;
	}

	onMessage(msg, edited)
	{
		//TODO: Add a command .permit to allow a user to post links even inside of their 60 minute countdown

		if (msg.content.match(/https?:\/\//i) || msg.content.match(/\.[a-z]{2,3}\//i) || msg.content.match(/(bit.ly|shorturl.at|tiny.cc)/i)) {
			msg.guild.members.fetch(msg.author).then((member) => {
				var minutes = moment().diff(member.joinedAt, "minutes");

				if (minutes < (this.config.minutes || 60)) {
					this.bot.addLogMessage("Deleted link from " + member.toString() + " in " + msg.channel.toString() + " who joined " + minutes + " minutes ago. Deleted message:\n```" + msg.content + "```");
					msg.delete();
					msg.author.send("Your recent message has been automatically deleted. We do not allow new users to post links for a short while, to combat spam. Check #info for more information about the rules. If you think this message is in error, please DM one of the mods.");
					return;
				}
			});
		}
	}
}

module.exports = AntiSpamModule;
