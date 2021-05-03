const discord = require("discord.js");
const RedditRadio = require("../RedditRadio");

class FunModule
{
	constructor(config, client, bot)
	{
		this.config = config;

		/** @type {discord.Client} */
		this.client = client;

		/** @type {RedditRadio} */
		this.bot = bot;
	}

	/**
	 * @param {discord.Message} msg
	 * @param {Boolean} edited
	 */
	onMessage(msg, edited)
	{
		if (msg.content.toLowerCase() == "good bot") {
			msg.channel.send(msg.member.toString() + " Thanks");
			return;
		}

		if (msg.content.toLowerCase() == "bad bot") {
			msg.channel.send(msg.member.toString() + " I'm sorry :sob: If I did something wrong, you can report a bug! <https://github.com/codecat/reddit-radio/issues>");
			return;
		}

		if (msg.content.toLowerCase() == "kut bot") {
			msg.channel.send(msg.member.toString() + " nou sorry hoor");
			return;
		}

		if (msg.content.toLowerCase().indexOf("am i the only one") != -1 && msg.member !== null) {
			msg.channel.send(msg.member.toString() + " Probably not.");
			return;
		}

		if (msg.content.toLowerCase().indexOf(".shrug") != -1) {
			msg.channel.send("\xaf\\\\\\_<:headykappa:330110432209797123>\\_/\xaf");
			return;
		}

		if (msg.content.toLowerCase() == "<@!327816989114630145> <a:catjam150:760555281414881380>") {
			msg.channel.send("<a:catjam150:760555281414881380>");
			return;
		}
	}
}

module.exports = FunModule;
