class EventQuickModule
{
	constructor(config, client, bot)
	{
		this.event = config;
		this.client = client;
		this.bot = bot;

		this.current = '';
		this.ended = false;
		if (this.event.current !== undefined) {
			this.current = this.event.current;
		}

		this.channel = client.channels.resolve(this.event.channel);
		this.updateChannel();
	}

	onCmdIlink(msg, link)
	{
		if (!this.bot.isMod(msg.member)) {
			return;
		}

		this.event.link = link;

		console.log("New impromptu event link: " + this.event.link);
		msg.channel.send(":link: The livestream can be found here: <" + this.event.link + ">");

		msg.delete();
		this.updateChannel();
	}

	onCmdInow(msg)
	{
		if (!this.bot.isMod(msg.member)) {
			return;
		}

		if (arguments.length == 1) {
			return;
		}

		this.current = Array.from(arguments).slice(1).join(" ").trim();
		this.ended = false;

		console.log("Starting now: " + this.current);
		msg.channel.send(":red_circle: STARTING NOW: **" + this.current + "**");

		msg.delete();
		this.updateChannel();
	}

	onCmdIoffline(msg)
	{
		if (!this.bot.isMod(msg.member)) {
			return;
		}

		this.current = "";
		this.ended = false;

		console.log("Stream is offline!");
		msg.channel.send(":no_entry_sign: Stream is temporarily offline.");

		msg.delete();
		this.updateChannel();
	}

	onCmdIend(msg)
	{
		if (!this.bot.isMod(msg.member)) {
			return;
		}

		this.current = "";
		this.ended = true;

		console.log("End of event!");
		msg.channel.send(":tada: Thank you for tuning in.");

		msg.delete();
		this.updateChannel();
	}

	onCmdCurrent(msg) { this.onCmdNp(msg); }
	onCmdNow(msg) { this.onCmdNp(msg); }
	onCmdNp(msg)
	{
		if (this.current != "") {
			msg.channel.send(":red_circle: Now playing: **" + this.current + "**");
		} else {
			msg.channel.send(":robot: There's currently no set playing.");
		}
	}

	onCmdNext(msg)
	{
		msg.channel.send(":robot: This is an event without a timetable.");
	}

	onCmdLink(msg)
	{
		msg.channel.send(":link: The livestream can be found here: <" + this.event.link + ">");
	}

	updateChannel()
	{
		var line = "";

		if (this.ended) {
			line = ":tada: Thank you for tuning in.";
		} else {
			if (this.current == "") {
				line = ":no_entry_sign: Not currently live.";
			} else {
				line = "__" + this.current + "__";
			}

			if (this.event.link !== undefined) {
				line += " :link: " + this.event.link;
			}
		}

		if (this.event.emoji) {
			line = this.event.emoji + " " + line;
		}

		this.channel.setTopic(line);
	}
}

module.exports = EventQuickModule;
