var fs = require("fs");
var moment = require("moment");

var cmdsplit = require("./../cmdsplit");

class EventSchedule
{
	constructor(config, client, bot)
	{
		this.event = config;
		this.client = client;
		this.bot = bot;

		this.lastNotFound = new Date(1970, 1, 1);
		this.lastNow = new Date(1970, 1, 1);

		this.loadSchedule(this.event.file);
	}

	loadSchedule(filename)
	{
		console.log('Loading schedule: "' + filename + '"');

		this.schedule = JSON.parse(fs.readFileSync(filename));

		for (var i = 0; i < this.schedule.length; i++) {
			let stage = this.schedule[i];

			console.log("Event channel: " + stage.channel);
			this.client.channels.fetch(stage.channel).then(channel => {
				stage.channel = channel;
				this.updateChannel(stage);
			}).catch(() => {
				console.error("Unable to find channel for stage \"" + stage.stage + "\"");
			});

			var newResponses = [];
			for (var expression in stage.responses) {
				let newResponse = {
					match: new RegExp(expression, "i"),
					msg: stage.responses[expression]
				};
				newResponses.push(newResponse);
			}
			stage.responses = newResponses;

			stage.channelExtra = null;
			if (stage.extra_channel !== undefined) {
				this.client.channels.fetch(stage.extra_channel).then(channel => {
					stage.channelExtra = channel;
				}).catch(() => {
					console.error("Unable to find channel for stage \"" + stage.stage + "\"");
				});
			}

			var streamDelay = stage.streamdelay;

			for (var j = 0; j < stage.sets.length; j++) {
				var set = stage.sets[j];
				var dateArray = set.slice(0, 5);
				dateArray[1] -= 1; // months are 0-indexed, for some reason. even in the moment library!

				var setDate = moment(dateArray).add(streamDelay, 'm');
				var newSet = {
					date: setDate,
					name: set[5],
					report: moment() > setDate,
					report_5min: moment().add(5, 'm') > setDate,
					nothing: (set[5] === undefined || set[5] == "Nothing"),
					who: set[6]
				};

				stage.sets[j] = newSet;
			}
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

	getStageByChannel(channel)
	{
		for (var i = 0; i < this.schedule.length; i++) {
			var s = this.schedule[i];
			if (s.channel == channel) {
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
				if (set.nothing) {
					continue;
				}
				if (set.name.toLowerCase().indexOf(query) != -1 || (set.who && set.who.toLowerCase().indexOf(query) != -1)) {
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
		var date = moment();

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
							var msg = ":no_entry_sign: Stream is no longer live. Next set is at **" + this.getTimeString(next.date) + "**!";
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
				if (date.clone().add(5, 'm') > next.date && !next.report_5min) {
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

	onCmdCurrent(msg) { this.onCmdNp(msg); }
	onCmdNow(msg) { this.onCmdNp(msg); }
	onCmdNp(msg)
	{
		var stage = this.getStageByChannel(msg.channel);
		if (!stage) {
			return;
		}

		var current = this.getCurrentSet(stage);
		if (current !== null && !current.nothing) {
			if (current.who) {
				msg.channel.send(":red_circle: Now playing: **" + current.name + "**, started <t:" + current.date.unix() + ":R>! (" + current.who + ")");
			} else {
				msg.channel.send(":red_circle: Now playing: **" + current.name + "**, started <t:" + current.date.unix() + ":R>!");
			}
		} else {
			msg.channel.send("Nobody's playing right now.");
		}
	}

	onCmdNext(msg)
	{
		var stage = this.getStageByChannel(msg.channel);
		if (!stage) {
			return;
		}

		var next = this.getNextSet(stage);
		if (next) {
			var localTime = "**" + this.getTimeString(next.date) + "**";
			localTime += " (<t:" + next.date.unix() + ":R>)";

			if (next.name) {
				if (next.who) {
					msg.channel.send(":arrow_forward: Next up: **" + next.name + "**, at " + localTime + " (" + next.who + ")");
				} else {
					msg.channel.send(":arrow_forward: Next up: **" + next.name + "**, at " + localTime);
				}
			} else {
				msg.channel.send(":arrow_forward: The stream ends at " + localTime);
			}
		} else {
			msg.channel.send("There's nothing playing next.");
		}
	}

	getScheduleString(stage, limit, starttime)
	{
		var ret = "";

		if (stage.unconfirmed) {
			ret = ":warning: **Note:** Set times are not confirmed!\n";
		}

		if (!starttime) {
			starttime = moment(stage.sets[0].date).clone().subtract(1, 'm');
		}

		var lines = 0;
		for (var i = 0; i < stage.sets.length; i++) {
			var set = stage.sets[i];
			if (starttime > set.date) {
				continue;
			}

			if (limit && lines == limit) {
				ret += "(limited, use `.fullschedule` for the full schedule)\n";
				break;
			}
			lines++;

			if (set.nothing) {
				ret += "- <t:" + set.date.unix() + ":t> (<t:" + set.date.unix() + ":R>), the stream will be offline :no_entry_sign:\n";
			} else {
				if (set.who) {
					ret += "- <t:" + set.date.unix() + ":t> (<t:" + set.date.unix() + ":R>): **" + set.name + "** (" + set.who + ")\n";
				} else {
					ret += "- <t:" + set.date.unix() + ":t> (<t:" + set.date.unix() + ":R>): **" + set.name + "**\n";
				}
			}
		}

		if (lines == 0) {
			ret = "We have nothing left! :frowning:";
		} else if (limit) {
			ret = ":calendar_spiral: Next " + limit + " sets are:\n" + ret.trim();
		} else {
			ret = ":calendar_spiral: The full schedule:\n" + ret.trim();
		}

		return ret;
	}

	onCmdTimetable(msg) { this.onCmdSchedule(msg); }
	onCmdSched(msg) { this.onCmdSchedule(msg); }
	onCmdSchedule(msg)
	{
		var stage = this.getStageByChannel(msg.channel);
		if (!stage) {
			return;
		}

		msg.channel.send(this.getScheduleString(stage, 5, moment()));
	}

	onCmdFullSched(msg) { this.onCmdFullSchedule(msg); }
	onCmdFullSchedule(msg)
	{
		var stage = this.getStageByChannel(msg.channel);
		if (!stage) {
			return;
		}

		var text = this.getScheduleString(stage);
		while (text.length > 0) {
			msg.author.send(text.substr(0, 2000)).catch(console.error);
			text = text.substr(2000);
		}

		msg.reply("I've DM'd you the full schedule.");
	}

	onCmdFind(msg)
	{
		var query = Array.from(arguments).slice(1).join(" ").trim();
		if (query.length < 3) {
			return;
		}

		var results = this.findSets(query);

		var ret = "";
		if (results.length == 0) {
			ret = "I found nothing :frowning:";
			// Avoid spamming "I found nothing" when jokers do .find a meaning of life
			var now = new Date();
			if ((now - this.lastNotFound) < 60 * 1000) {
				return;
			}
			this.lastNotFound = now;
		} else {
			var date = new Date();
			for (var i = 0; i < results.length; i++) {
				var res = results[i];

				var localTime = "**" + this.getTimeString(res.set.date) + "**";
				localTime += " (<t:" + res.set.date.unix() + ":R>)";

				var stageMessage = "";
				if (this.schedule.length > 1) {
					stageMessage = " on **" + res.stage.stage + "** " + res.stage.emoji + " stage!";
				}

				if (date > res.date) {
					ret += res.set.name + " already played on <t:" + res.set.date.unix() + ":F>\n";
				} else {
					ret += res.set.name + " plays on <t:" + res.set.date.unix() + ":F>\n";
				}
			}
		}

		msg.channel.send(":calendar_spiral: " + ret.trim());
	}

	onCmdReloadSchedule(msg)
	{
		if (!this.bot.isAdmin(msg.member)) {
			return;
		}

		this.loadSchedule(this.event.file);
		msg.reply("schedule reloaded!");
	}

	onMessage(msg)
	{
		var inStage = false;

		for (var i = 0; i < this.schedule.length; i++) {
			var stage = this.schedule[i];
			if (stage.channel.id != msg.channel.id) {
				continue;
			}

			inStage = true;

			for (var j = 0; j < stage.responses.length; j++) {
				var r = stage.responses[j];
				var match = msg.content.match(r.match);
				if (match) {
					var sendMessage = r.msg;
					for (var k = 0; k < match.length; k++) {
						sendMessage = sendMessage.replace("$" + k, match[k]);
					}
					msg.channel.send(sendMessage);
					return true;
				}
			}
		}

		var isCommand = msg.content.startsWith(".");

		var parse = [];
		if (isCommand) {
			parse = cmdsplit(msg.content);
		}

		// Outside-channel schedule command
		if (isCommand && this.schedule.length > 1 && !inStage && (parse[0] == ".schedule" || parse[0] == ".timetable" || parse[0] == ".sched" || parse[0] == ".current" || parse[0] == ".now")) {
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
				var next = this.getNextSet(stage);

				if (current === null && next !== null && next.date.date() != moment(now).date()) {
					continue;
				}

				if (current !== null && !current.nothing) {
					ret += stage.emoji + " " + stage.stage + ": **" + current.name + "**";
				} else {
					ret += stage.emoji + " " + stage.stage + ": Not live";
				}

				if (next !== null && !next.nothing) {
					ret += ", next: " + next.name;
				} else {
					ret += ".";
				}

				ret += " " + stage.channel.toString() + "\n";
			}
			msg.channel.send(ret.trim());
			return true;
		}

		return false;
	}

	getTimeString(date)
	{
		return "<t:" + date.unix() + ":t>";
	}

	updateChannel(stage)
	{
		if (typeof(stage.channel) == "string") {
			return;
		}

		var line = "";

		var current = this.getCurrentSet(stage);
		var next = this.getNextLiveSet(stage);

		if ((current === null || current.nothing) && next === null) {
			line += " :tada: Thanks for watching.";
		} else {
			if (current !== null && !current.nothing) {
				line += " __" + current.name + "__ <t:" + current.date.unix() + ":R>";
			} else {
				line += " :no_entry_sign: __Not currently live__.";
			}

			if (next !== null) {
				line += " :arrow_forward: Next: __" + next.name + "__ <t:" + next.date.unix() + ":R>";
			} else {
				line += " :warning: This is the last set!";
			}

			line += " :link: " + stage.url;
		}

		stage.channel.setTopic(stage.emoji + " " + line, "Automated bot action for event");
	}
}

module.exports = EventSchedule;
