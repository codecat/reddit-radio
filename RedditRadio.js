var discord = require("discord.js");
var toml = require("toml");

var process = require("process");
var fs = require("fs");
var https = require("https");

var cmdsplit = require("./cmdsplit");
var SongQueue = require("./SongQueue");
var Radio = require("./Radio");
var Twit = require("./Twit");
var EventSchedule = require("./EventSchedule");
var EventImpromptu = require("./EventImpromptu");

class RedditRadio
{
	constructor()
	{
		let configFile = process.env.CONFIG_FILE || "config.toml";
		this.config = toml.parse(fs.readFileSync(configFile, "utf8"));
		this.loadCache();

		this.client = new discord.Client();
		this.client.on("ready", () => { this.onReady(); });
		this.client.on("message", (msg) => { this.onMessage(msg); });
		this.client.on("guildMemberAdd", (member) => { this.onMemberJoin(member); });

		this.radios = [];

		this.queue = new SongQueue(this.config);
		this.current_song = false;

		this.events = [];

		this.twits = [];
		this.loadTwitter();

		this.locked = false;

		this.voice_connection = false;
		this.voice_dispatcher = false;

		this.commands = [];
		this.loadConfigCommands();
	}

	loadCache()
	{
		this.cache = {};
		if (!fs.existsSync("cache.json")) {
			return;
		}

		this.cache = JSON.parse(fs.readFileSync("cache.json", "utf8"));
	}

	saveCache()
	{
		fs.writeFileSync("cache.json", JSON.stringify(this.cache));
	}

	loadEvents()
	{
		if (this.config.events === undefined) {
			return;
		}

		for (var i = 0; i < this.config.events.length; i++) {
			var event = this.config.events[i];
			if (event.impromptu) {
				this.events.push(new EventImpromptu(this, event, this.client));
			} else {
				this.events.push(new EventSchedule(event, this.client));
			}
		}
	}

	loadTwitter()
	{
		if (this.config.twits === undefined) {
			return;
		}

		for (var i = 0; i < this.config.twits.length; i++) {
			this.twits.push(new Twit(this.config.twitter, this.config.twits[i], this.client));
		}
	}

	loadConfigCommands()
	{
		if (this.config.commands === undefined) {
			return;
		}

		for (var i = 0; i < this.config.commands.length; i++) {
			var cmd = this.config.commands[i];
			this.commands[cmd.prefix] = require("./commands/" + cmd.prefix);

			if (cmd.aliases !== undefined) {
				for (var j = 0; j < cmd.aliases.length; j++) {
					this.commands[cmd.aliases[j]] = this.commands[cmd.prefix];
				}
			}
		}
	}

	loadConfigRadios()
	{
		if (this.config.radios === undefined) {
			return;
		}

		for (var i = 0; i < this.config.radios.length; i++) {
			this.radios.push(new Radio(this.config, this.config.radios[i]));
		}
	}

	start()
	{
		this.client.login(this.config.discord.token);
		setInterval(() => { this.onTick(); }, 1000);

		this.loadConfigRadios();
	}

	stop()
	{
		var promises = [];
		for (var i = 0; i < this.radios.length; i++) {
			promises.push(this.radios[i].stop());
		}

		console.log("Stopping client...");
		promises.push(this.client.destroy());

		Promise.all(promises).then(() => {
			console.log("Client stopped.");
			process.exit();
		});
	}

	addLogMessage(text, fromMember)
	{
		if (!this.logChannel) {
			console.log("Couldn't log because we couldn't find the log channel:", text);
			return;
		}

		if (fromMember) {
			text += " (via " + fromMember.user.username + ")";
		}

		console.log("Log: " + text);
		this.logChannel.send(":robot: " + text);
	}

	setStatusText(status)
	{
		if (typeof(status) !== "string") {
			return;
		}
		this.client.user.setActivity(status, { type: "LISTENING" });
	}

	resetStatusText()
	{
		this.client.user.setPresence({ game: null });
	}

	isAdmin(member)
	{
		for (var roleID of member.roles.keys()) {
			var role = member.roles.get(roleID);
			if (role.hasPermission("ADMINISTRATOR")) {
				return true;
			}
		}
		return false;
	}

	isMod(member)
	{
		for (var roleID of member.roles.keys()) {
			var role = member.roles.get(roleID);
			if (role.hasPermission("MANAGE_MESSAGES")) {
				return true;
			}
		}
		return false;
	}

	isDJ(member)
	{
		if (this.isMod(member)) {
			return true;
		}

		for (var roleID of member.roles.keys()) {
			var role = member.roles.get(roleID);
			if (role.name == "Jukebox DJ") {
				return true;
			}
		}
		return false;
	}

	onTick()
	{
		if (this.voice_dispatcher === false) {
			while (true) {
				this.current_song = this.queue.next();
				if (this.current_song === null || this.current_song.valid) {
					break;
				}
				if (!this.current_song.valid) {
					console.log("Current song is invalid!", this.current_song);
				}
			}
			if (this.current_song !== null) {
				if (this.voice_connection === false) {
					console.log("Voice connection was false, destroying dispatcher!");
					if (this.voice_dispatcher !== false) {
						this.voice_dispatcher.destroy();
						this.voice_dispatcher = false;
					}
					return;
				}
				this.voice_dispatcher = this.voice_connection.playArbitraryInput(this.current_song.stream, this.config.voice);
				this.setStatusText(this.current_song.title);

				this.voice_connection.on("error", (error) => {
					console.log("Stream error: " + error);
					if (this.current_song) {
						if (this.current_song.live) {
							console.log("LIVESTREAM ERROR, REJUKING!!");
							this.queue.insert(this.current_song.url, (song) => {
								if (song === false) {
									console.log("Couldn't restart stream!");
									return;
								}
								console.log("Restarted stream! :D");
							});
						}
					} else {
						console.log("No current_song..");
					}
				});
				this.voice_dispatcher.on("end", (reason) => {
					console.log("Stream ended: " + reason);
					this.voice_dispatcher = false;
					if (this.current_song) {
						if (this.current_song.live) {
							console.log("LIVESTREAM END!!");
							return;
						}
					} else {
						console.log("No current_song in end..");
					}
					this.current_song = false;
					this.resetStatusText();
				});
			}
		}

		for (var i = 0; i < this.twits.length; i++) {
			this.twits[i].onTick();
		}

		for (var i = 0; i < this.events.length; i++) {
			this.events[i].onTick();
		}
	}

	onReady()
	{
		console.log("Client started.");
		this.resetStatusText();

		this.loadEvents();

		this.logChannel = this.client.channels.get(this.config.discord.logchannel);
		//this.addLogMessage("Bot started!");
	}

	onMemberJoin(member)
	{
		if (member.user.username.match(/^[A-Z][a-z]+[a-f0-9]{4}$/)) {
			console.log("!! Possible spambot joined: " + member);
			this.addLogMessage("Possible spambot joined: " + member);
		}
	}

	onMessage(msg)
	{
		/*
		if (msg.content.toLowerCase().match(/(18\+|sexy|naked photo)/)) {
			if (msg.author.username.match(/^[A-Z][a-z]+[a-f0-9]{4}$/)) {
				this.addLogMessage("Deleted **spam** from " + msg.author + " in " + msg.channel + ": `" + msg.content.replace('`', '\\`') + "`");
				msg.delete();
				return;
			}
		}
		*/

		// Ignore DM's or glitched members
		if (msg.member === null) {
			return;
		}

		// Ignore our own messages
		if (msg.member.user == this.client.user) {
			return;
		}

		if (!this.isMod(msg.member)) {
			if (msg.content.toLowerCase().match(/(kanker|1gabba|discord\.gg|discordapp\.com\/invite)/)) {
				this.addLogMessage("Deleted unwanted message from " + msg.author + " in " + msg.channel + ": `" + msg.content.replace('`', '\\`') + "`");
				msg.delete();
				return;
			}
		}

		console.log('[' + Date() + '] ' + msg.member.user.username + '#' + msg.member.user.discriminator + ' in #' + msg.channel.name + ': "' + msg.content + '"');

		var emotes = msg.content.toLowerCase().match(/<a?:[^:]+:[0-9]+>/g);
		if (emotes && emotes.length > 14) {
			this.addLogMessage("Deleted message from " + msg.member + " in " + msg.channel + " that contained " + emotes.length + " emotes");
			msg.delete();
			return;
		}

		for (var i = 0; i < this.events.length; i++) {
			if (this.events[i].onMessage(msg)) {
				console.log("Event command handled from \"" + msg.member.user.username + "\": " + msg.content);
				return;
			}
		}

		if (msg.content.toLowerCase() == "good bot") {
			msg.channel.send("Thanks");
			return;
		}

		if (msg.content.toLowerCase() == "bad bot") {
			msg.channel.send("I'm sorry :sob: If I did something wrong, you can report a bug! <https://github.com/codecat/reddit-radio/issues>");
			return;
		}

		if (msg.content.toLowerCase().indexOf("am i the only one") != -1 && msg.member !== null) {
			msg.channel.send("<@" + msg.member.id + "> Probably not.");
			return;
		}

		var parse = cmdsplit(msg.content);

		if (parse.indexOf(".shrug") != -1) {
			msg.channel.send("\xaf\\\\\\_<:headykappa:330110432209797123>\\_/\xaf");
			return;
		}

		if (!msg.content.startsWith(".")) {
			return;
		}

		var cmdID = parse[0].slice(1);
		cmdID = cmdID.charAt(0).toUpperCase() + cmdID.slice(1);
		if (!cmdID.match(/^[a-z]+$/i)) {
			return;
		}

		var cmdName = "onCmd" + cmdID;

		if (this[cmdName] !== undefined) {
			if (msg.member !== null) {
				console.log("Built-in command from \"" + msg.member.user.username + "\": " + cmdID);
			} else {
				console.log("Built-in command from offline member: " + cmdID);
			}
			this[cmdName].apply(this, [ msg ].concat(parse.slice(1)));
			return;
		}

		if (this.commands[cmdID] !== undefined) {
			if (msg.member !== null) {
				console.log("External command from \"" + msg.member.user.username + "\": " + cmdID);
			} else {
				console.log("External command from offline member: " + cmdID);
			}
			this.commands[cmdID].apply(this, [ msg ].concat(parse.slice(1)));
			return;
		}

		console.log("Unknown command: \"" + cmdName + "\"");
	}

	onSongAdded(msg, song, now)
	{
		if (song === false) {
			msg.channel.send("I can't play that URL, sorry... :sob:");
			return;
		}
		var songInfo = this.getTrackInfoText(song);
		if (now) {
			msg.channel.send("Okay, I'm gonna play it right now! " + songInfo);
			if (this.voice_dispatcher) {
				this.voice_dispatcher.end();
			}
		} else {
			msg.channel.send("Okay, I added it to the jukebox! " + songInfo);
		}
	}

	onCmdGithub(msg)
	{
		msg.channel.send("My code is on Github! :robot: https://github.com/codecat/reddit-radio");
	}

	onCmdWeather(msg)
	{
		/*
		var url = "https://api.darksky.net/forecast/" + this.config.weather.apikey + "/" + this.config.weather.coords + "?units=auto";
		https.get(url, (res) => {
			var data = "";
			res.setEncoding("utf8");
			res.on("data", function(chunk) { data += chunk; });
			res.on("end", () => {
				try {
					var obj = JSON.parse(data);
					var ret = "**The weather at Defqon.1 is currently:** (powered by darksky.net)\n";
					ret += "*" + obj.currently.summary + "* / **" + obj.currently.temperature + "\u2103 (" + Math.round((obj.currently.temperature * 9/5) + 32) + "\u2109)** / " + Math.round(obj.currently.humidity * 100) + "% humidity\n";
					ret += "UV index " + obj.currently.uvIndex + ", wind speed " + obj.currently.windSpeed + " m/s";
					msg.channel.send(ret);
				} catch (err) {
					msg.channel.send("I failed to get the weather... :sob:");
					console.log(err);
				}
			});
		});
		*/
	}

	onCmdConnect(msg)
	{
		if (this.voice_connection !== false) {
			msg.channel.send("I am already in a voice channel. :thinking:");
			return;
		}

		if (!msg.member.voiceChannel) {
			msg.channel.send("You need to be in a voice channel. :frowning2:");
			return;
		}

		msg.member.voiceChannel.join().then((conn) => {
			this.voice_connection = conn;
			this.voice_connection.on("disconnect", () => {
				this.voice_connection = false;
				console.log("Disconnected from voice chat!");
			});
			console.log("Connected to voice chat!");

			msg.channel.send("Hello! :wave:");
		});
	}

	onCmdDisconnect(msg)
	{
		if (this.voice_connection === false) {
			msg.channel.send("I'm not in a voice channel. :thinking:");
			return;
		}

		if (this.isDJ(msg.member)) {
			msg.channel.send("DJ told me to leave. :ok_hand:");
			this.voice_connection.disconnect();
			return;
		}

		if (this.locked) {
			msg.channel.send("I'm locked.. :flushed:");
			return;
		}

		if (this.voice_connection.channel.members.get(msg.member.id) === undefined) {
			msg.channel.send("You are not in my voice channel. :rolling_eyes:");
			return;
		}

		if (this.voice_dispatcher !== false && this.voice_connection.channel.members.length > 3) {
			msg.channel.send("I don't want to leave yet! :flushed:");
			return;
		}

		msg.channel.send("Bye! :wave:");
		this.voice_connection.disconnect();
	}

	onCmdLock(msg)
	{
		if (!this.isMod(msg.member) && !this.isDJ(msg.member)) {
			msg.channel.send("You're not a mod though.. :flushed:");
			return;
		}

		if (this.locked) {
			msg.channel.send("Jukebox is already locked! :lock:");
			return;
		}

		this.locked = true;
		msg.channel.send("Jukebox is now locked. **I will only listen to DJ's and mods!** :lock:");
	}

	onCmdUnlock(msg)
	{
		if (!this.isMod(msg.member) && !this.isDJ(msg.member)) {
			msg.channel.send("You're not a mod though.. :flushed:");
			return;
		}

		if (!this.locked) {
			msg.channel.send("Jukebox is not locked right now! :unlock:");
			return;
		}

		this.locked = false;
		msg.channel.send("Jukebox is now unlocked. :unlock:");
	}

	onCmdPlay(msg)
	{
		if (!msg.member) {
			msg.channel.send("Slipping into the DM's, are we? :smirk:");
			return;
		}

		if (this.locked && !this.isDJ(msg.member)) {
			msg.channel.send("I'm locked.. :flushed:");
			return;
		}

		var args = Array.from(arguments);
		args.shift();
		var query = args.join(" ");

		if (query == "") {
			msg.channel.send("You have to give me a URL, otherwise I don't know what to play. :sob:");
			return;
		}

		if (this.voice_connection === false) {
			if (!msg.member.voiceChannel) {
				msg.channel.send("You need to be in a voice channel. :frowning2:");
				return;
			}

			msg.member.voiceChannel.join().then((conn) => {
				this.voice_connection = conn;
				this.voice_connection.on("disconnect", () => {
					this.voice_connection = false;
					console.log("Disconnected from voice chat!");
				});
				console.log("Connected to voice chat!");

				msg.channel.send("Hello! :wave:");

				this.queue.add(query, (song) => { this.onSongAdded(msg, song, false); });
			});
			return;
		}

		this.queue.add(query, (song) => { this.onSongAdded(msg, song, false); });
	}

	onCmdPlayNow(msg, url)
	{
		if (!this.isDJ(msg.member)) {
			msg.channel.send("Only a DJ can use this command.. :flushed:");
			return;
		}

		if (url === undefined) {
			msg.channel.send("You have to give me a URL, otherwise I don't know what to play. :sob:");
			return;
		}

		var args = Array.from(arguments);
		args.shift();
		var query = args.join(' ');

		if (this.voice_connection === false) {
			if (!msg.member.voiceChannel) {
				msg.channel.send("You need to be in a voice channel. :frowning2:");
				return;
			}

			msg.member.voiceChannel.join().then((conn) => {
				this.voice_connection = conn;
				this.voice_connection.on("disconnect", () => {
					this.voice_connection = false;
					console.log("Disconnected from voice chat!");
				});
				console.log("Connected to voice chat!");

				msg.channel.send("Hello! :wave:");

				this.queue.add(query, (song) => { this.onSongAdded(msg, song, false); });
			});
			return;
		}

		this.queue.insert(query, (song) => { this.onSongAdded(msg, song, true); });
	}

	onCmdPause(msg)
	{
		if (this.locked && !this.isDJ(msg.member)) {
			msg.channel.send("I'm locked.. :flushed:");
			return;
		}

		if (this.voice_dispatcher === false) {
			msg.channel.send("I'm not playing anything right now. :thinking:");
			return;
		}

		this.voice_dispatcher.pause();
		msg.channel.send("Paused! :pause_button:");
	}

	onCmdResume(msg)
	{
		if (this.locked && !this.isDJ(msg.member)) {
			msg.channel.send("I'm locked.. :flushed:");
			return;
		}

		if (this.voice_dispatcher === false) {
			msg.channel.send("I wasn't playing anything right now. :thinking:");
			return;
		}

		this.voice_dispatcher.resume();
		msg.channel.send("Resuming! :play_pause:");
	}

	onCmdSkip(msg)
	{
		if (this.voice_dispatcher === false) {
			msg.channel.send("I'm not playing anything right now. :thinking:");
			return;
		}

		if (this.queue.length() == 0) {
			this.voice_dispatcher.end();
			msg.channel.send("That's all, folks! <:headygasm:330120648309342210>");
			return;
		}

		if (this.isDJ(msg.member)) {
			msg.channel.send("DJ told me to skip this track! :ok_hand:\nNow: " + this.getTrackInfoText(this.queue.list[0]));
			this.voice_dispatcher.end();
			return;
		}

		if (this.locked) {
			msg.channel.send("I'm locked.. :flushed:");
			return;
		}

		if (this.voice_connection.channel.members.length <= 3) {
			msg.channel.send("Skipping! :track_next:");
			this.voice_dispatcher.end();
			return;
		}

		msg.channel.send("I don't want to skip yet! :flushed:");
	}

	onCmdQueue(msg)
	{
		if (this.queue.length() == 0) {
			msg.channel.send("The jukebox queue is empty. :sob:");
			return;
		}

		var ret = "Next up:\n";
		for (var i = 0; i < this.queue.list.length; i++) {
			var song = this.queue.list[i];
			var add = (i + 1) + ". ";
			add += this.getTrackInfoText(song);
			add += "\n";
			if (ret.length + add.length > 1800) {
				ret += (this.queue.list.length - i) + " more...";
				break;
			}
			ret += add;
		}

		msg.channel.send(ret);
	}

	onCmdClearQueue(msg)
	{
		if (this.queue.length() == 0) {
			msg.channel.send("Queue is already empty. :shrug:");
			return;
		}

		if (this.isDJ(msg.member)) {
			this.queue.clear();
			msg.channel.send("DL told me to clear the queue! :ok_hand:");
			return;
		}

		if (this.locked) {
			msg.channel.send("I'm locked.. :flushed:");
			return;
		}

		if (this.voice_connection.channel.members.length <= 3) {
			this.queue.clear();
			msg.channel.send("Cleared the queue!");
			return;
		}

		msg.channel.send("I don't want to clear the queue right now! :flushed:");
	}

	onCmdMute(msg)
	{
		if (!this.isMod(msg.member)) {
			return;
		}

		var mutedRole = msg.guild.roles.find(val => val.name == "Chat mute");
		if (!mutedRole) {
			console.error("Couldn't find \"Chat mute\" role!");
			return;
		}

		for (var memberID of msg.mentions.members.keys()) {
			var member = msg.mentions.members.get(memberID);
			member.addRole(mutedRole);

			this.addLogMessage("Muted " + member.user.username, msg.member);
		}

		msg.delete();
	}

	getEmoji(source)
	{
		switch (source) {
			case "youtube": return this.config.emoji.youtube;
			case "soundcloud": return this.config.emoji.soundcloud;
			case "facebook": return this.config.emoji.facebook;
			case "periscope": return this.config.emoji.periscope;
			case "mixcloud": return this.config.emoji.mixcloud;
		}
		return ":musical_note:";
	}

	formatMilliseconds(ms)
	{
		var sec = Math.floor(ms / 1000);

		var secs = sec % 60;
		var mins = Math.floor(sec / 60) % 60;
		var hours = Math.floor(sec / 60 / 60) % 60;

		var ret = "";
		if (hours > 0) {
			ret += hours + "h";
		}
		if (mins > 0) {
			ret += mins + "m";
		}
		ret += secs + "s";
		return ret;
	}

	getTrackInfoText(song)
	{
		var emoji = this.getEmoji(song.source);
		if (song.live) {
			emoji += ":red_circle:";
		}

		var text = emoji + " **" + song.title + "**";

		if (song.duration > 0) {
			text += " (" + this.formatMilliseconds(song.duration) + ")";
		}

		return text;
	}

	onCmdNp(msg)
	{
		if (!this.current_song) {
			msg.channel.send("I'm not playing anything right now. :thinking:");
			return;
		}

		var prefix = "";
		if (this.current_song.live) {
			prefix = "Now **livestreaming**:";
		} else {
			prefix = "Now playing:";
		}

		var text = prefix + " " + this.getTrackInfoText(this.current_song);

		msg.channel.send(text);
	}

	onCmdTime(msg)
	{
		var date = new Date();
		var hours = date.getHours();
		var minutes = date.getMinutes();

		var text = "The local time is: **" + hours + ":" + (minutes >= 10 ? minutes : "0" + minutes) + "**";

		msg.channel.send(text);
	}
}

module.exports = RedditRadio;
