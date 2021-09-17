var discord = require("discord.js");

class Radio
{
	constructor(config, radioconfig)
	{
		this.config = config;

		this.name = radioconfig.name;
		this.url = radioconfig.url;

		this.client = new discord.Client({
			intents: [
				// List of intents: https://discord.com/developers/docs/topics/gateway#list-of-intents
				discord.Intents.FLAGS.GUILDS,
				discord.Intents.FLAGS.GUILD_VOICE_STATES,
			],
		});

		this.running = false;
		this.voice_connection = false;
		this.voice_dispatcher = false;

		this.channel = false;

		this.client.on("ready", () => {
			console.log("Radio client \"" + this.name + "\" connected!");

			this.client.channels.fetch(radioconfig.channel).then(channel => {
				this.channel = channel;
				if (channel.members.size > 0) {
					this.joinChannel();
				}
			});
		});

		this.client.on("error", (e) => {
			console.log("Radio bot error:", e);
		});

		this.client.on("voiceStateUpdate", (o, n) => {
			if (n.channel == this.channel) {
				console.log("Someone joined \"" + this.name + "\": " + this.channel.members.size);
				if (!this.running) {
					this.running = true;
					this.joinChannel();
				}
			} else if (o.channel == this.channel && n.channel != this.channel) {
				console.log("Someone left \"" + this.name + "\": " + this.channel.members.size);
				if (this.running && this.channel.members.size == 1) {
					this.running = false;
					this.leaveChannel();
				}
			}
		});

		this.client.login(radioconfig.token);
	}

	stop()
	{
		console.log("Stopping radio \"" + this.name + "\"...");
		return this.client.destroy();
	}

	joinChannel()
	{
		console.log("Joining and starting \"" + this.name + "\"!");
		this.running = true;

		this.channel.join().then((conn) => {
			this.voice_connection = conn;
			this.voice_connection.on("disconnect", () => {
				this.voice_connection = false;
			});
			this.voice_connection.on("newSession", () => {
				this.startBroadcast();
			});
			this.voice_connection.on("error", (err) => {
				console.log("Error: " + err);
			});
			this.startBroadcast();
		}).catch(console.error);
	}

	leaveChannel()
	{
		console.log("Leaving \"" + this.name + "\".");
		this.running = false;

		if (this.voice_dispatcher !== false) {
			this.voice_dispatcher.end();
		}

		if (this.voice_connection !== false) {
			this.voice_connection.disconnect();
		}
	}

	startBroadcast()
	{
		if (this.voice_connection === false) {
			return;
		}

		if (this.voice_dispatcher !== false) {
			this.voice_dispatcher.end();
		}

		this.voice_dispatcher = this.voice_connection.play(this.url, this.config.voice);
		this.voice_dispatcher.on("end", (reason) => {
			console.log("Radio voice \"" + this.name + "\" ended: \"" + reason + "\"");
			this.voice_dispatcher = false;
		});
	}
}

module.exports = Radio;
