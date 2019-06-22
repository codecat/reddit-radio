var fs = require("fs");

var cmdsplit = require("./cmdsplit");

class EventSchedule
{
	constructor(event, client)
	{
		this.event = event;
		this.client = client;

		this.lastNotFound = new Date(1970, 1, 1);
		this.lastNow = new Date(1970, 1, 1);

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

			console.log("Event channel: " + stage.channel);
			stage.channel = this.client.channels.get(stage.channel);
			if (!stage.channel) {
				console.log("WARNING: Couldn't find channel!");
			}

			stage.channelExtra = null;
			if (stage.extra_channel !== undefined) {
				stage.channelExtra = this.client.channels.get(stage.extra_channel);
			}

			for (var j = 0; j < stage.sets.length; j++) {
				var set = stage.sets[j];

				var setDate = new Date(set[0], set[1] - 1, set[2], set[3], set[4]);
				var newSet = {
					date: setDate,
					name: set[5],
					report: date > setDate,
					report_5min: dateIn5Minutes > setDate,
					nothing: set[5] == "Nothing"
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
							var msg = ":no_entry_sign: Stream is no longer live. Next set it on " + this.getWeekDay(next.date.getDay()) + " at **" + this.getTimeString(next.date) + "**!";
							stage.channel.send(msg);
							if (stage.channelExtra) {
								stage.channelExtra.send(msg);
							}
						} else {
							var msg = ":tada: This is the end of the livestream. Thanks for watching.";
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
					var msg = ":warning: **" + next.name + "** starts in 5 minutes!";
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
				if (parse[0] == ".np" || parse[0] == ".current" || parse[0] == ".now" || parse[0] == ".nu" || parse[0] == ".momenteel") {
					var current = this.getCurrentSet(stage);
					if (current !== null && !current.nothing) {
						var localTime = this.getTimeString(current.date);
						msg.channel.send(":red_circle: Now playing: **" + current.name + "**, started at **" + localTime + "**!");
					} else {
						msg.channel.send(":robot: Nobody's playing right now.");
					}
					return true;
				}

				if (parse[0] == ".next" || parse[0] == ".volgende") {
					var next = this.getNextSet(stage);
					if (next !== null) {
						var localTime = this.getTimeString(next.date);
						msg.channel.send(":soon: Next up: **" + next.name + "**, at **" + localTime + "**!");
					} else {
						msg.channel.send(":robot: There's nothing playing next.");
					}
					return true;
				}

				if (parse[0] == ".mc" || parse[0] == ".host") {
					msg.channel.send(":microphone: The MC is: **" + stage.mc + "**");
					return true;
				}

				if (parse[0] == ".schedule" || parse[0] == ".programma" || parse[0] == ".sched") {
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
							ret += "- " + this.getWeekDay(set.date.getDay()) + " **" + localTime + "**, the stream will be offline :no_entry_sign:\n";
						} else {
							ret += "- " + this.getWeekDay(set.date.getDay()) + " **" + localTime + "**: **" + set.name + "**\n";
						}

						if (lines++ == 5) {
							break;
						}
					}

					if (lines == 0) {
						msg.channel.send("We have nothing left! :frowning:");
					} else {
						msg.channel.send(":calendar_spiral: Next 5 sets are: (use `.time` for current local time)\n" + ret.trim());
					}
					return true;
				}

				if (parse[0] == ".stream" || parse[0] == ".link" || parse[0] == ".url") {
					msg.channel.send(":link: Stream link: <" + stage.url + ">");
					return true;
				}

				var matchNumber = parse[0].match(/^\.([0-9]+)$/);
				if (matchNumber) {
					var index = matchNumber[1];
					if (index > 0 && index <= stage.faq.length) {
						var faq = stage.faq[index - 1];
						msg.channel.send(":information_source: " + faq);
						return true;
					}
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
				// Avoid spamming "I found nothing" when jokers do .find a meaning of life
				var now = new Date();
				if ((now - this.lastNotFound) < 60 * 1000) {
					return true;
				}
				this.lastNotFound = now;
			} else {
				var date = new Date();
				for (var i = 0; i < results.length; i++) {
					var res = results[i];

					var weekDay = this.getWeekDay(res.set.date.getDay());
					var localTime = this.getTimeString(res.set.date);

					if (date > res.date) {
						ret += res.set.name + " already played on **" + weekDay + "**, at **" + localTime + "** on the **" + res.stage.stage + "** stage!\n";
					} else {
						ret += res.set.name + " plays on **" + weekDay + "**, at **" + localTime + "** on the **" + res.stage.stage + "** " + res.stage.emoji + " stage!\n";
					}
				}
			}

			msg.channel.send(":calendar_spiral: " + ret.trim());
			return true;
		}

		if (parse[0] == ".schedule" || parse[0] == ".programma" || parse[0] == ".sched" || parse[0] == ".current" || parse[0] == ".now") {
			// Avoid spamming long .now message when jokers spam .now
			var now = new Date();
			if ((now - this.lastNow) < 60 * 1000) {
				return true;
			}
			this.lastNow = now;

			var ret = "**LIVE**\n";
			for (var i = 0; i < this.schedule.length; i++) {
				var stage = this.schedule[i];

				var current = this.getCurrentSet(stage);
				if (current !== null && !current.nothing) {
					ret += stage.emoji + " " + stage.stage + ": **" + current.name + "**";
				} else {
					ret += stage.emoji + " " + stage.stage + ": Not live";
				}

				var next = this.getNextSet(stage);
				if (next !== null && !next.nothing) {
					ret += ", next: " + next.name;
				} else {
					ret += ".";
				}

				ret += " " + stage.channel + "\n";
			}
			msg.channel.send(ret.trim());
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
			line += " :tada: Thanks for watching.";
		} else {
			if (current !== null && !current.nothing) {
				line += " __" + current.name + "__ (" + this.getTimeString(current.date) + ")";
			} else {
				line += " :no_entry_sign: __Not currently live__.";
			}

			if (next !== null) {
				line += " :arrow_forward: Next: __" + next.name + "__ (" + this.getTimeString(next.date) + ")";
			} else {
				line += " :warning: This is the last set!";
			}

			line += " :link: " + stage.url;
		}

		stage.channel.setTopic(stage.emoji + " " + line, "Automated bot action for event");
	}
}

module.exports = EventSchedule;
