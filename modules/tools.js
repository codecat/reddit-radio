var moment = require("moment");

class ToolsModule
{
	onCmdJoinDate(msg)
	{
		var joinedAt = moment(msg.member.joinedAt);
		msg.reply("You joined this server **" + joinedAt.fromNow() + "**. (" + joinedAt.format() + ")");
	}
}

module.exports = ToolsModule;
