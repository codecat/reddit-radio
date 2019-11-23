var discord = require("discord.js");
var toml = require("toml");

var process = require("process");
var fs = require("fs");
var https = require("https");

var cmdsplit = require("./cmdsplit");
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
		this.events = [];

		this.twits = [];
		this.loadTwitter();

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
		return member.hasPermission("ADMINISTRATOR");
	}

	isMod(member)
	{
		return member.hasPermission("MANAGE_MESSAGES");
	}

	onTick()
	{
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
		/*
		if (member.user.username.match(/^[A-Z][a-z]+[a-f0-9]{4}$/)) {
			console.log("!! Possible spambot joined: " + member);
			this.addLogMessage("Possible spambot joined: " + member);
		}
		*/
	}

	onMessage(msg)
	{
		// Ignore DM's or glitched members
		if (msg.member === null) {
			return;
		}

		// Ignore our own messages
		if (msg.member.user == this.client.user) {
			return;
		}

		console.log('[' + Date() + '] ' + msg.member.user.username + '#' + msg.member.user.discriminator + ' in #' + msg.channel.name + ': "' + msg.content + '"');

		// Delete unwanted messages only if not a moderator
		if (!this.isMod(msg.member)) {
			// Delete unwanted messages
			if (this.config.filter && msg.content.toLowerCase().match(this.config.filter.badwords)) {
				this.addLogMessage("Deleted unwanted message from " + msg.author + " in " + msg.channel + ": `" + msg.content.replace('`', '\\`') + "`");
				msg.delete();
				msg.author.send("Your recent message has been automatically deleted. Please take another look at the rules in #info. We automatically delete messages for things like piracy and advertising.");
				return;
			}

			// Delete invite links
			var inviteLinks = msg.content.toLowerCase().match(/discord\.gg\/([A-Za-z0-9]+)/g);
			if (inviteLinks) {
				for (var i = 0; i < inviteLinks.length; i++) {
					//TODO: Put whitelist in config file
					if (inviteLinks[i].toLowerCase() != "discord.gg/hardstyle") {
						this.addLogMessage("Deleted Discord invite link from " + msg.author + " in " + msg.channel + ": `" + inviteLinks[i].replace('/', ' slash ') + "`");
						msg.delete();
						msg.author.send("Your recent message has been automatically deleted. Please do not post Discord invite links without prior permission from a moderator or admin.");
						return;
					}
				}
			}
		}

		var emotes = msg.content.toLowerCase().match(/(<a?:[^:]+:[0-9]+>|\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g);
		if (emotes && emotes.length > 14) {
			this.addLogMessage("Deleted message from " + msg.member + " in " + msg.channel + " that contained " + emotes.length + " emotes");
			msg.delete();
			msg.author.send("You posted too many emojis. Calm down a little bit!");
			return;
		}

		for (var i = 0; i < this.events.length; i++) {
			if (this.events[i].onMessage(msg)) {
				console.log("Event command handled from \"" + msg.member.user.username + "\": " + msg.content);
				return;
			}
		}

		if (msg.content.toLowerCase() == "good bot") {
			msg.channel.send(msg.member + " Thanks");
			return;
		}

		if (msg.content.toLowerCase() == "bad bot") {
			msg.channel.send(msg.member + " I'm sorry :sob: If I did something wrong, you can report a bug! <https://github.com/codecat/reddit-radio/issues>");
			return;
		}

		if (msg.content.toLowerCase().indexOf("am i the only one") != -1 && msg.member !== null) {
			msg.channel.send(msg.member + " Probably not.");
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

	/*
	onCmdWeather(msg)
	{
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
	}
	*/

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

	onCmdUnmute(msg)
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
			member.removeRole(mutedRole);

			this.addLogMessage("Unmuted " + member.user.username, msg.member);
		}

		msg.delete();
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
