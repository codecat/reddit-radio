var discord = require("discord.js");
var toml = require("toml");

var process = require("process");
var fs = require("fs");

var cmdsplit = require("./cmdsplit");
var SongQueue = require("./SongQueue");
var Radio = require("./Radio");

class RedditRadio
{
	constructor()
	{
		this.config = toml.parse(fs.readFileSync("config.toml", "utf8"));

		this.client = new discord.Client();
		this.client.on("ready", () => { this.onReady(); });
		this.client.on("message", (msg) => { this.onMessage(msg); });

		this.radios = [];

		this.queue = new SongQueue(this.config);
		this.current_song = false;

		this.voice_connection = false;
		this.voice_dispatcher = false;

		this.commands = [];
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

	start()
	{
		this.client.login(this.config.discord.token);
		setInterval(() => { this.onTick(); }, 1000);

		for (var i = 0; i < this.config.radios.length; i++) {
			this.radios.push(new Radio(this.config, this.config.radios[i]));
		}
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
			if (role.name == "Discord DJ") {
				return true;
			}
		}
		return false;
	}

	onTick()
	{
		if (this.voice_dispatcher === false) {
			this.current_song = this.queue.next();
			if (this.current_song !== null) {
				this.voice_dispatcher = this.voice_connection.playArbitraryInput(this.current_song.stream, this.config.voice);
				//this.voice_dispatcher = this.voice_connection.playStream(this.current_song.stream, this.config.voice);

				this.voice_dispatcher.on("end", () => {
					this.voice_dispatcher = false;
					this.current_song = false;
				});
			}
		}
	}

	onReady()
	{
		console.log("Client started.");
	}

	onMessage(msg)
	{
		if (msg.content.toLowerCase() == "good bot") {
			msg.channel.send("Thanks");
			return;
		}

		if (msg.content.toLowerCase() == "bad bot") {
			msg.channel.send("I'm sorry :sob: If I did something wrong, you can report a bug! https://github.com/codecat/reddit-radio/issues");
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

	onCmdGithub(msg)
	{
		msg.channel.send("My code is on Github! :robot: https://github.com/codecat/reddit-radio");
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

	onCmdPlay(msg, url)
	{
		if (this.voice_connection === false) {
			msg.channel.send("I'm not in a voice channel. :thinking:");
			return;
		}

		if (url === undefined) {
			msg.channel.send("You have to give me a URL, otherwise I don't know what to play. :sob:");
			return;
		}

		this.queue.add(url, (song) => {
			if (song === false) {
				msg.channel.send("I can't play that URL, sorry... :sob:");
				return;
			}
			msg.channel.send("Okay, I added it to the jukebox! :musical_note: **" + song.title + "**");
		});
	}

	onCmdPause(msg)
	{
		if (this.voice_dispatcher === false) {
			msg.channel.send("I'm not playing anything right now. :thinking:");
			return;
		}

		this.voice_dispatcher.pause();
		msg.channel.send("Paused! :pause_button:");
	}

	onCmdResume(msg)
	{
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
			msg.channel.send("There is nothing else in the queue! :sob:");
			return;
		}

		if (this.isDJ(msg.member)) {
			this.voice_dispatcher.end();
			msg.channel.send("DJ told me to skip this track! :ok_hand:");
			return;
		}

		if (this.voice_connection.channel.members.length <= 3) {
			msg.channel.send("Skipping! :track_next:");
			this.voice_dispatcher.end();
			return;
		}

		msg.channel.send("I don't want to skip yet! :flushed:");
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

		if (this.voice_connection.channel.members.length <= 3) {
			this.queue.clear();
			msg.channel.send("Cleared the queue!");
			return;
		}

		msg.channel.send("I don't want to clear the queue right now! :flushed:");
	}

	onCmdNp(msg)
	{
		if (!this.current_song) {
			msg.channel.send("I'm not playing anything right now. :thinking:");
			return;
		}

		var text = "";
		if (this.current_song.live) {
			text += "Now *livestreaming*: :red_circle:";
		} else {
			text += "Now playing:";
		}
		text += " :musical_note: **" + this.current_song.title + "**";

		msg.channel.send(text);
	}
}

module.exports = RedditRadio;
