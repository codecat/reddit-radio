const discord = require("discord.js");

class WelcomeModule
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
	async onMemberJoin(member)
	{
		var msg = this.config.messageprefix;

		var msgIndex = Math.floor(Math.random() * this.config.messages.length);
		msg += ' ' + this.config.messages[msgIndex];
		msg = msg.replace('<name>', member.toString());

		var channel = await this.client.channels.fetch(this.config.channel);
		var message = await channel.send({
			content: msg,
			allowedMentions: {
				users: []
			}
		});
		message.react(this.config.emoji || "👋").catch(console.error);
	}
}

module.exports = WelcomeModule;
