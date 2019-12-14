var moment = require("moment");

class ToolsModule
{
	onCmdJoinTime(msg) { this.onCmdJoinDate(msg); }
	onCmdJoinDate(msg)
	{
		msg.guild.fetchMember(msg.author).then((member) => {
			var joinedAt = moment(member.joinedAt);
			msg.reply("you joined this server **" + joinedAt.fromNow() + "**. (" + joinedAt.format() + ")");
		});
	}
}

module.exports = ToolsModule;
