const discord = require("discord.js");

var moment = require("moment");

class SusModule
{
	constructor(config, client, bot)
	{
		this.config = config;
		/** @type {discord.Client} */
		this.client = client;
		this.bot = bot;
	}

	/**
	 * @param {discord.GuildMember} member
	 */
	onMemberJoin(member)
	{
		if (moment().diff(member.user.createdAt, "hours") < 48) {
			this.bot.addLogMessage("<:skepticalpepe:743455915935662133> Brand new user account joined: " + member.user.toString()
				+ " (account created <t:" + moment(member.user.createdAt).unix() + ":R>)");
		}
	}
}

module.exports = SusModule;
