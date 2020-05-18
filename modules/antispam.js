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
		if (msg.content.match(/https?:\/\//i) || msg.content.match(/\.[a-z]{2,3}\//i) || msg.content.match(/(bit.ly|shorturl.at|tiny.cc)/i)) {
			msg.guild.members.fetch(msg.author).then((member) => {
				var hours = moment().diff(member.joinedAt, "hours");
				if (hours < this.config.linkhours) {
					this.bot.addLogMessage("Deleted link from " + member.toString() + " in " + msg.channel.toString() + " who joined " + hours + " hours ago. Deleted message:\n```" + msg.content + "```");
					msg.delete();
					msg.author.send("Your recent message has been automatically deleted. We do not allow new users to post links for a short while, to combat spam. Check #info for more information about the rules. If you think this message is in error, please DM one of the mods.");
					return;
				}
			});
		}
	}
}

module.exports = AntiSpamModule;
