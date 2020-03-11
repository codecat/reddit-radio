var moment = require("moment");

class ToolsModule
{
	constructor(config, client, bot)
	{
		this.bot = bot;
	}

	onCmdJoinTime(msg) { this.onCmdJoinDate(msg); }
	onCmdJoinDate(msg)
	{
		msg.guild.fetchMember(msg.author).then((member) => {
			var joinedAt = moment(member.joinedAt);
			msg.reply("you joined this server **" + joinedAt.fromNow() + "**. (" + joinedAt.format() + ")");
		});
	}

	onCmdUserInfo(msg, user)
	{
		if (!this.bot.isMod(msg.member)) {
			return;
		}

		var member = msg.guild.member(user);
		if (!member) {
			msg.channel.send("Unable to find user. Please provide snowflake for best results.");
			return;
		}

		var joinedAt = moment(member.joinedAt);
		var createdAt = moment(member.user.createdAt);

		msg.channel.send(
			"**Info for " + member + "**:\n" +
			":alarm_clock: Join time: **" + joinedAt.fromNow() + "** (" + joinedAt.format() + ")\n" +
			":alarm_clock: Account age: **" + createdAt.fromNow() + "** (" + createdAt.format() + ")\n"
		);
	}
}

module.exports = ToolsModule;
