var discord = require("discord.js");

class Radio
{
	constructor(config, radioconfig)
	{
		this.config = config;

		this.name = radioconfig.name;
		this.channel = radioconfig.channel;
		this.url = radioconfig.url;

		this.client = new discord.Client();

		this.running = false;
		this.voice_connection = false;
		this.voice_dispatcher = false;

		this.client.on("ready", () => {
			console.log("Radio client \"" + this.name + "\" connected!");

			var channel = this.client.channels.get(this.channel);
			if (channel.members.size > 0) {
				this.joinChannel();
			}
		});

		this.client.on("voiceStateUpdate", (o, n) => {
			var channel = this.client.channels.get(this.channel);
			if (n.voiceChannelID == this.channel) {
				console.log("Someone joined \"" + this.name + "\": " + channel.members.size);
				if (!this.running) {
					this.running = true;
					this.joinChannel();
				}
			} else if (o.voiceChannelID == this.channel && n.voiceChannelID != this.channel) {
				console.log("Someone left \"" + this.name + "\": " + channel.members.size);
				if (this.running && channel.members.size == 1) {
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

		this.client.channels.get(this.channel).join().then((conn) => {
			this.voice_connection = conn;
			this.voice_connection.on("disconnect", () => {
				this.voice_connection = false;
			});
			this.voice_connection.on("newSession", () => {
				this.startBroadcast();
			});
			this.startBroadcast();
		});
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

		this.voice_dispatcher = this.voice_connection.playArbitraryInput(this.url, this.config.voice);
		this.voice_dispatcher.on("end", (reason) => {
			console.log("Radio voice \"" + this.name + "\" ended: \"" + reason + "\"");
			this.voice_dispatcher = false;
		});
	}
}

module.exports = Radio;
