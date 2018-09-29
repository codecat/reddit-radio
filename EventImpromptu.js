var cmdsplit = require("./cmdsplit");

class EventImpromptu
{
	constructor(radio, event, client)
	{
		console.log("NOTE: Active impromptu event!");

		this.radio = radio;
		this.event = event;
		this.client = client;

		this.current = '';
		this.ended = false;
		if (event.current !== undefined) {
			this.current = event.current;
		}

		this.channel = client.channels.get(event.channel);
		this.updateChannel();
	}

	onTick()
	{
		//
	}

	onMessage(msg)
	{
		if (!msg.content.startsWith(".")) {
			return false;
		}

		var parse = cmdsplit(msg.content);

		if (this.radio.isDJ(msg.member)) {
			if (parse[0] == ".inow") {
				this.current = parse.slice(1).join(" ").trim();
				this.ended = false;

				console.log("Starting now: " + this.current);
				this.channel.send(":red_circle: STARTING NOW: **" + this.current + "**");

				msg.delete();
				this.updateChannel();
				return true;
			}

			if (parse[0] == ".ioffline") {
				this.current = '';
				this.ended = false;

				console.log("Stream is offline!");
				this.channel.send(":no_entry_sign: Stream is temporarily offline.");

				msg.delete();
				this.updateChannel();
				return true;
			}

			if (parse[0] == ".iend") {
				this.current = '';
				this.ended = true;

				console.log("End of event!");
				this.channel.send(":tada: Thank you for tuning in.");

				msg.delete();
				this.updateChannel();
				return true;
			}
		}

		if (parse[0] == ".np" || parse[0] == ".current" || parse[0] == ".now") {
			if (this.current != "") {
				this.channel.send(":red_circle: Now playing: **" + this.current + "**");
			} else {
				this.channel.send(":robot: There's currently no set playing.");
			}
			return true;
		}

		if (parse[0] == ".next") {
			this.channel.send(":robot: This is an event without a timetable.");
			return true;
		}

		return false;
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

		this.channel.setTopic(this.event.emoji + " " + line);
	}
}

module.exports = EventImpromptu;
