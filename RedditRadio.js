var discord = require("discord.js");
var colors = require("colors");
var moment = require("moment-timezone");

var process = require("process");
var fs = require("fs");
var https = require("https");

var cmdsplit = require("./cmdsplit");
var Radio = require("./Radio");
var MongoClient = require("mongodb").MongoClient;

function findCommand(obj, cmdID)
{
	var cmdName = "onCmd" + cmdID;
	var cmdRegex = new RegExp("^" + cmdName + "$", "i");

	var prototype = Object.getPrototypeOf(obj);
	var props = Object.getOwnPropertyNames(prototype);
	for (var i = 0; i < props.length; i++) {
		var key = props[i];
		if (!key.startsWith("onCmd")) {
			continue;
		}
		if (key.match(cmdRegex)) {
			return obj[key];
		}
	}
	return null;
}

class RedditRadio
{
	constructor(config)
	{
		this.config = config;
		this.readyPromises = [];

		moment.tz.setDefault(this.config.discord.timezone || "Europe/Amsterdam");

		console.log('Discord.js version', discord.version);

		this.client = new discord.Client({
			intents: [
				// List of intents: https://discord.com/developers/docs/topics/gateway#list-of-intents
				discord.Intents.FLAGS.GUILDS,
				discord.Intents.FLAGS.GUILD_MEMBERS,
				discord.Intents.FLAGS.GUILD_BANS,
				discord.Intents.FLAGS.GUILD_MESSAGES,
				discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
				discord.Intents.FLAGS.DIRECT_MESSAGES,
			],
		});
		this.client.on("messageCreate", (msg) => { this.onMessage(msg, false); });
		this.client.on("messageUpdate", (oldMsg, newMsg) => { this.onMessageUpdate(oldMsg, newMsg); });
		this.client.on("messageDelete", (msg) => { this.onMessageDelete(msg); });
		this.client.on("guildMemberAdd", (member) => { this.onMemberJoin(member); });
		this.readyPromises.push(this.client.login(this.config.discord.token));

		this.modules = [];

		if (this.config.database) {
			this.mongoclient = new MongoClient(this.config.database.url, { useUnifiedTopology: true });
			this.readyPromises.push(this.mongoclient.connect());
		}

		/** @type {discord.TextChannel} */
		this.logChannel = null;
		/** @type {discord.TextChannel} */
		this.dmChannel = null;
		/** @type {discord.TextChannel} */
		this.errorChannel = null;
	}

	loadConfigModules()
	{
		if (!this.config.modules) {
			return;
		}

		for (var name in this.config.modules) {
			var moduleClass = require('./modules/' + name);
			if (!moduleClass) {
				console.error('Unable to find module with name "' + name + '"!');
				continue;
			}

			var configs = this.config.modules[name];

			console.log('Module: "' + name + '" (' + configs.length + ' instances)');

			for (let config of configs) {
				var newModule = new moduleClass(config, this.client, this);
				this.modules.push(newModule);
			}
		}
	}

	onReady()
	{
		/*
		this.client.guilds.cache.tap(guild => {
			guild.members.fetch().then(() => {
				console.log('Cached ' + guild.members.size + ' members in ' + guild.name);
			});
		});
		*/

		this.client.user.setActivity(this.config.discord.activity);

		this.client.channels.fetch(this.config.discord.logchannel).then(logChannel => this.logChannel = logChannel);
		this.client.channels.fetch(this.config.discord.dmchannel).then(dmChannel => this.dmChannel = dmChannel);
		this.client.channels.fetch(this.config.discord.errorchannel).then(errorChannel => this.errorChannel = errorChannel);

		if (this.mongoclient) {
			this.mongodb = this.mongoclient.db(this.config.database.db);
			console.log("Database connected.");
		}

		console.log("Client ready, loading modules...");

		this.loadConfigModules();

		console.log("Modules loaded!");

		setInterval(() => { this.onTick(); }, 1000);
	}

	start()
	{
		Promise.all(this.readyPromises).then(() => {
			this.onReady();
		}).catch((err) => {
			console.error(err);
		});
	}

	stop()
	{
		var promises = [];

		console.log("Stopping client...");
		promises.push(this.client.destroy());

		if (this.mongoclient) {
			console.log("Stopping MongoDB...");
			promises.push(this.mongoclient.close());
		}

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

	/**
	 * Checks if the given member is an admin.
	 * @param {discord.GuildMember} member
	 */
	isAdmin(member)
	{
		return member.permissions.has(discord.Permissions.FLAGS.ADMINISTRATOR);
	}

	/**
	 * Checks if the given member is a moderator.
	 * @param {discord.GuildMember} member
	 */
	isMod(member)
	{
		return member.permissions.has(discord.Permissions.FLAGS.MANAGE_MESSAGES);
	}

	onTick()
	{
		for (var i = 0; i < this.modules.length; i++) {
			var m = this.modules[i];
			if (m.onTick) {
				m.onTick();
			}
		}
	}

	onMemberJoin(member)
	{
		console.log("User joined: " + member + " (" + member.user.username + ")");

		for (var i = 0; i < this.modules.length; i++) {
			var m = this.modules[i];
			if (m.onMemberJoin) {
				m.onMemberJoin(member);
			}
		}
	}

	handleError(ex)
	{
		console.log(ex);
		if (this.errorChannel) {
			this.errorChannel.send(":octagonal_sign: Bot error!\n```\n" + ex.toString() + "\n```");
		}
	}

	/**
	 * @param {discord.Message} msg
	 * @param {Boolean} edited
	 */
	async onMessage(msg, edited)
	{
		// Ignore our own messages
		if (msg.author == this.client.user) {
			return;
		}

		// Ignore DM's
		if (msg.member === null && msg.guild === null) {
			// Log DM's
			var logUsername = msg.author.username + '#' + msg.author.discriminator;
			console.warn("Ignored a DM from " + logUsername.brightWhite + ": \"" + msg.content + "\"");

			// Send DM's to the DM channel
			if (this.dmChannel) {
				this.dmChannel.send(":mailbox_with_mail: " + msg.author.toString() + ": `" + msg.content + "`");
			}

			return;
		}

		// Ignore webhooks
		if (msg.webhookID) {
			console.warn("Ignored webhook: \"" + msg.content + "\"");
			return;
		}

		// Ensure we have a member (sometimes this is null if their status is offline)
		if (msg.member === null) {
			console.warn("Member is null, fetching member now");
			msg.member = await msg.guild.fetchMember(msg.author);
		}

		// Log line
		var logUsername = msg.author.username + '#' + msg.author.discriminator;
		if (this.isAdmin(msg.member)) {
			logUsername = logUsername.red;
		} else if (this.isMod(msg.member)) {
			logUsername = logUsername.yellow;
		} else {
			logUsername = logUsername.brightWhite;
		}

		console.log('[' + moment().format('MMM Do LTS') + '] '
			+ logUsername
			+ ' in ' + ('#' + msg.channel.name).green.underline + ': '
			+ (edited ? '(edited) '.gray : '')
			+ '"' + msg.content + '"');

		for (var i = 0; i < this.modules.length; i++) {
			var m = this.modules[i];
			if (m.onMessage) {
				try {
					if (m.onMessage(msg, edited)) {
						return;
					}
				} catch (ex) { this.handleError(ex); }
			}
		}

		if (!msg.content.startsWith(".")) {
			return;
		}

		var parse = cmdsplit(msg.content);
		var cmdID = parse[0].slice(1);
		cmdID = cmdID.charAt(0).toUpperCase() + cmdID.slice(1);
		if (!cmdID.match(/^[a-z]+$/i)) {
			return;
		}

		var cmdFound = false;

		var cmdFunc = findCommand(this, cmdID);
		if (cmdFunc) {
			if (msg.member !== null) {
				console.log("Built-in command from \"" + msg.member.user.username + "\": " + cmdID);
			} else {
				console.log("Module command from offline member: " + cmdID);
			}

			try {
				var r = cmdFunc.apply(this, [ msg ].concat(parse.slice(1)));
				if (r && r.catch) {
					r.catch(ex => this.handleError(ex));
				}
			} catch (ex) { this.handleError(ex); }
			cmdFound = true;
		}

		for (var i = 0; i < this.modules.length; i++) {
			var m = this.modules[i];

			var cmdFunc = findCommand(m, cmdID);
			if (!cmdFunc) {
				continue;
			}

			if (msg.member !== null) {
				console.log("Module command from \"" + msg.member.user.username + "\": " + cmdID);
			} else {
				console.log("Module command from offline member: " + cmdID);
			}

			try {
				var r = cmdFunc.apply(m, [ msg ].concat(parse.slice(1)));
				if (r && r.catch) {
					r.catch(ex => this.handleError(ex));
				}
			} catch (ex) { this.handleError(ex); }
			cmdFound = true;
		}

		if (!cmdFound) {
			console.log("Unknown command: \"" + cmdID + "\"");
		}
	}

	async onMessageUpdate(oldMsg, newMsg)
	{
		if (oldMsg.content != newMsg.content) {
			this.onMessage(newMsg, true);
		}
	}

	async onMessageDelete(msg)
	{
		console.log("Message deleted: \"" + msg.content + "\"");
	}

	onCmdGithub(msg)
	{
		msg.channel.send("My code is on Github! :robot: https://github.com/codecat/reddit-radio");
	}

	/*
	//TODO: Move this to a module
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

	//TODO: Change this to .timeout and move this to its own module
	/*
	onCmdMute(msg)
	{
		if (!this.isMod(msg.member)) {
			return;
		}

		for (var memberID of msg.mentions.members.keys()) {
			var member = msg.mentions.members.get(memberID);
			member.roles.remove(this.config.discord.mutedrole);

			this.addLogMessage("Muted " + member.user.username, msg.member);
		}

		msg.delete();
	}

	onCmdUnmute(msg)
	{
		if (!this.isMod(msg.member)) {
			return;
		}

		for (var memberID of msg.mentions.members.keys()) {
			var member = msg.mentions.members.get(memberID);
			member.roles.add(this.config.discord.mutedrole);

			this.addLogMessage("Unmuted " + member.user.username, msg.member);
		}

		msg.delete();
	}
	*/

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
		var date = moment();
		var text = "The local time is: **" + date.format("HH:mm") + "** (<https://time.is/CET>)";
		msg.channel.send(text);
	}
}

module.exports = RedditRadio;
