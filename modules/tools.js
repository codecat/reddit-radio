var moment = require("moment");

class ToolsModule
{
	constructor(config, client, bot)
	{
		this.client = client;
		this.bot = bot;
	}

	onCmdJoinTime(msg) { this.onCmdJoinDate(msg); }
	onCmdJoinDate(msg)
	{
		msg.guild.members.fetch(msg.author).then((member) => {
			var joinedAt = moment(member.joinedAt);
			msg.reply("you joined this server **" + joinedAt.fromNow() + "**. (" + joinedAt.format() + ")");
		});
	}

	onCmdSlow(msg, seconds)
	{
		if (!this.bot.isMod(msg.member)) {
			return;
		}

		msg.channel.setRateLimitPerUser(parseInt(seconds));
		msg.delete();
	}

	onCmdUserInfo(msg, user)
	{
		if (!this.bot.isMod(msg.member)) {
			return;
		}

		var member = msg.guild.member(user);
		if (!member) {
			this.client.users.fetch(user).then((fetcheduser) => {
				var createdAt = moment(fetcheduser.createdAt);

				msg.channel.send(
					"**Info for non-member " + fetcheduser.tag + "**:\n" +
					":alarm_clock: Account age: **" + createdAt.fromNow() + "** (" + createdAt.format() + ")"
				);
			});
			return;
		}

		var joinedAt = moment(member.joinedAt);
		var createdAt = moment(member.user.createdAt);

		msg.channel.send(
			"**Info for member " + member.toString() + "**:\n" +
			":alarm_clock: Join time: **" + joinedAt.fromNow() + "** (" + joinedAt.format() + ")\n" +
			":alarm_clock: Account age: **" + createdAt.fromNow() + "** (" + createdAt.format() + ")"
		);
	}
}

module.exports = ToolsModule;
