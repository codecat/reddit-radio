var fs = require("fs");

var cmdsplit = require("./cmdsplit");

class EventSchedule
{
	constructor(event, client)
	{
		this.event = event;
		this.client = client;

		console.log('NOTE: Active event: ' + this.event.file);

		this.loadSchedule(this.event.file);
	}

	loadSchedule(filename)
	{
		this.schedule = JSON.parse(fs.readFileSync(filename));

		var date = new Date();
		var dateIn5Minutes = new Date(date.getTime() + (1000 * 300));

		for (var i = 0; i < this.schedule.length; i++) {
			let stage = this.schedule[i];

			stage.channel = this.client.channels.get(stage.channel);
			stage.channelExtra = null;
			if (stage.extra_channel !== undefined) {
				stage.channelExtra = this.client.channels.get(stage.extra_channel);
			}

			for (var j = 0; j < stage.sets.length; j++) {
				var set = stage.sets[j];

				//TODO: Don't hardcode for Tomorrowland & Dominator (lol)
				var setDate = new Date(2018, 7, set[0], set[1], set[2]);
				var newSet = {
					date: setDate,
					name: set[3],
					report: date > setDate,
					report_5min: dateIn5Minutes > setDate,
					nothing: set[3] == "Nothing"
				};

				stage.sets[j] = newSet;
			}
		}

		for (var i = 0; i < this.schedule.length; i++) {
			var stage = this.schedule[i];
			this.updateChannel(stage);
		}
	}

	getStage(stage)
	{
		for (var i = 0; i < this.schedule.length; i++) {
			var s = this.schedule[i];
			if (s.stage == stage) {
				return s;
			}
		}
		return null;
	}

	findSets(query)
	{
		query = query.toLowerCase();

		var ret = [];
		for (var i = 0; i < this.schedule.length; i++) {
			var stage = this.schedule[i];
			for (var j = 0; j < stage.sets.length; j++) {
				var set = stage.sets[j];
				if (!set.nothing && set.name.toLowerCase().indexOf(query) != -1) {
					ret.push({
						set: set,
						stage: stage
					});
				}
			}
		}
		return ret;
	}

	getCurrentSet(stage)
	{
		var date = new Date();

		for (var i = 0; i < stage.sets.length; i++) {
			var set = stage.sets[i];
			if (date < set.date) {
				if (i == 0) {
					// Happens if no set has started yet on this stage
					return null;
				}
				return stage.sets[i - 1];
			}
		}

		// Happens if the last set has been played
		return stage.sets[stage.sets.length - 1];
	}

	getNextSet(stage)
	{
		var date = new Date();

		for (var i = 0; i < stage.sets.length; i++) {
			var set = stage.sets[i];
			if (date < set.date) {
				return set;
			}
		}

		// Happens if this is the final set on this stage
		return null;
	}

	getNextLiveSet(stage)
	{
		var date = new Date();

		for (var i = 0; i < stage.sets.length; i++) {
			var set = stage.sets[i];
			if (date < set.date && !set.nothing) {
				return set;
			}
		}

		// Happens if this is the final set on this stage
		return null;
	}

	onTick()
	{
		var date = new Date();
		var dateIn5Minutes = new Date(date.getTime() + (1000 * 300));

		for (var i = 0; i < this.schedule.length; i++) {
			var stage = this.schedule[i];

			var current = this.getCurrentSet(stage);
			if (current !== null) {
				if (!current.report) {
					current.report = true;
					if (!current.nothing) {
						console.log("Starting now: " + current.name);
						var msg = ":red_circle: STARTING NOW: **" + current.name + "**";
						stage.channel.send(msg);
						if (stage.channelExtra) {
							stage.channelExtra.send(msg);
						}
					} else {
						console.log("Stream is not live anymore.");
						var next = this.getNextSet(stage);
						if (next !== null && !next.nothing) {
							var msg = ":no_entry_sign: Stream is not live anymore. Next set is on " + this.getWeekDay(next.date.getDay()) + " at **" + this.getTimeString(next.date) + "** CEST!";
							stage.channel.send(msg);
							if (stage.channelExtra) {
								stage.channelExtra.send(msg);
							}
						} else {
							var msg = "<:qdance:328585093553586176> This was Defqon 1. Thank you for tuning in.";
							stage.channel.send(msg);
							if (stage.channelExtra) {
								stage.channelExtra.send(msg);
							}
						}
					}
					this.updateChannel(stage);
				}
			}

			var next = this.getNextSet(stage);
			if (next !== null && !next.nothing) {
				if (dateIn5Minutes > next.date && !next.report_5min) {
					next.report_5min = true;
					console.log("Starting in 5 minutes: " + next.name);
					var msg = ":warning: Starting in 5 minutes: **" + next.name + "**";
					stage.channel.send(msg);
					if (stage.channelExtra) {
						stage.channelExtra.send(msg);
					}
				}
			}
		}
	}

	onMessage(msg)
	{
		if (!msg.content.startsWith(".")) {
			return false;
		}

		var parse = cmdsplit(msg.content);

		for (var i = 0; i < this.schedule.length; i++) {
			var stage = this.schedule[i];

			if (stage.channel == msg.channel) {
				if (parse[0] == ".np" || parse[0] == ".current" || parse[0] == ".now") {
					var current = this.getCurrentSet(stage);
					if (current !== null && !current.nothing) {
						var localTime = this.getTimeString(current.date);
						msg.channel.send(":red_circle: Now playing on the " + stage.stage + " stage: **" + current.name + "**, which started at **" + localTime + "** CEST!");
					} else {
						msg.channel.send(":robot: There's currently no set playing on the " + stage.stage + " stage.");
					}
					return true;
				}

				if (parse[0] == ".next") {
					var next = this.getNextSet(stage);
					if (next !== null) {
						var localTime = this.getTimeString(next.date);
						msg.channel.send(":soon: Next up on the " + stage.stage + " stage is: **" + next.name + "**, at **" + localTime + "** CEST!");
					} else {
						msg.channel.send(":robot: There's no next set on the " + stage.stage + " stage.");
					}
					return true;
				}

				if (parse[0] == ".mc" || parse[0] == ".host") {
					msg.channel.send(":microphone: The " + stage.stage + " stage MC is: **" + stage.mc + "**");
					return true;
				}

				if (parse[0] == ".schedule") {
					var ret = "";

					var date = new Date();

					var lines = 0;
					for (var i = 0; i < stage.sets.length; i++) {
						var set = stage.sets[i];
						if (date > set.date) {
							continue;
						}

						var localTime = this.getTimeString(set.date);
						if (set.nothing) {
							ret += "- " + this.getWeekDay(set.date.getDay()) + " **" + localTime + "** CEST, the stream will be offline. :no_entry_sign:\n";
						} else {
							ret += "- " + this.getWeekDay(set.date.getDay()) + " **" + localTime + "** CEST: **" + set.name + "**\n";
						}

						if (lines++ == 5) {
							break;
						}
					}

					if (lines == 0) {
						msg.channel.send("The " + stage.stage + " has nothing coming up anymore! :frowning:");
					} else {
						msg.channel.send(":calendar_spiral: Next 5 sets on the " + stage.stage + " stage:\n" + ret.trim());
					}
					return true;
				}

				if (parse[0] == ".stream" || parse[0] == ".link" || parse[0] == ".url") {
					msg.channel.send(":link: Stream link: <" + stage.url + ">");
					return true;
				}
			}
		}

		if (parse[0] == ".find" && parse.length > 1) {
			var query = parse.slice(1).join(" ").trim();
			if (query.length < 2) {
				return false;
			}

			var results = this.findSets(query);

			var ret = "";
			if (results.length == 0) {
				ret = "I found nothing :frowning:";
			} else {
				var date = new Date();
				for (var i = 0; i < results.length; i++) {
					var res = results[i];

					var weekDay = this.getWeekDay(res.set.date.getDay());
					var localTime = this.getTimeString(res.set.date);

					if (date > res.date) {
						ret += res.set.name + " has already been played on **" + weekDay + "**, at **" + localTime + "** CEST, on the " + res.stage.channel.toString() + " stage!\n";
					} else {
						ret += res.set.name + " is on **" + weekDay + "**, at **" + localTime + "** CEST, on the " + res.stage.channel.toString() + " stage!\n";
					}
				}
			}

			msg.channel.send(":calendar_spiral: " + ret.trim());
			return true;
		}

		//todo: .schedule off-channel global summary command

		if (parse[0] == ".current" || parse[0] == ".now") {
			var ret = "Now live:\n";
			for (var i = 0; i < this.schedule.length; i++) {
				var stage = this.schedule[i];
				var current = this.getCurrentSet(stage);
				if (current !== null && !current.nothing) {
					ret += stage.emoji + " The " + stage.channel.toString() + " stage is now playing: **" + current.name + "**\n";
				} else {
					ret += stage.emoji + " The " + stage.channel.toString() + " stage is currently not live.\n";
				}
			}
			msg.channel.send(ret.trim());
			return true;
		}

		if (parse[0] == ".timetable") {
			msg.channel.send(":calendar_spiral: The Defqon 2018 timetable can be found here: <https://www.q-dance.com/en/events/defqon-1/defqon-1-2018/timetable>");
			return true;
		}

		return false;
	}

	getWeekDay(index)
	{
		switch (index) {
			case 0: return "Sunday";
			case 1: return "Monday";
			case 2: return "Tuesday";
			case 3: return "Wednesday";
			case 4: return "Thursday";
			case 5: return "Friday";
			case 6: return "Saturday";
		}
		return "It's everyday bro";
	}

	getTimeString(date)
	{
		var ret = date.getHours();
		ret += ":";

		var mins = date.getMinutes();
		if (mins < 10) {
			ret += "0";
		}
		ret += mins;

		return ret;
	}

	updateChannel(stage)
	{
		var line = "";

		var current = this.getCurrentSet(stage);
		var next = this.getNextLiveSet(stage);

		if ((current === null || current.nothing) && next === null) {
			line += " :tada: Thank you for tuning in.";
		} else {
			if (current !== null && !current.nothing) {
				line += " __" + current.name + "__ (" + this.getTimeString(current.date) + ")";
			} else {
				line += " :no_entry_sign: __Not currently live__.";
			}

			if (next !== null) {
				line += " :arrow_forward: Next: __" + next.name + "__ (" + this.getTimeString(next.date) + ")";
			} else {
				line += " :warning: This is the final livestreamed set!";
			}

			line += " :link: " + stage.url;
		}

		stage.channel.setTopic(stage.emoji + " " + line, "Automated bot action for event");
	}
}

module.exports = EventSchedule;
