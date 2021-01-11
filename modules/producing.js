var colors = require("colors");
var moment = require("moment");

const ffmpeg = require('fluent-ffmpeg');

class ProducingModule
{
	constructor(config, client, bot)
	{
		this.config = config;
		this.client = client;
		this.bot = bot;

		this.client.on("messageReactionAdd", (r, user) => { this.onMessageReactionAdd(r, user); });
		this.client.on("messageReactionRemove", (r, user) => { this.onMessageReactionRemove(r, user); });

		if (!this.bot.mongodb) {
			console.error("The producing module requires MongoDB to be connected to a database!");
			return;
		}

		this.collUsers = this.bot.mongodb.collection("users");
		this.collFiles = this.bot.mongodb.collection("files");
		this.collFilesFeedback = this.bot.mongodb.collection("files_feedback");
	}

	async getOrCreateUser(id)
	{
		var user = await this.collUsers.findOne({ id: id });
		if (!user) {
			user = {
				id: id,
				files_uploaded: 0,
				feedback_given: 0
			};
			await this.collUsers.insertOne(user);
		}
		return user;
	}

	async getNumberOfFeedbackGiven(userId)
	{
		var result = await this.collFilesFeedback.aggregate([
			{ $match: { user: userId } },
			{ $group: { _id: "$msg", count: { $sum: 1 } } },
			{ $count: "count" }
		]).next();

		if (!result) {
			return 0;
		}
		return result.count;
	}

	onMessageReactionAdd(r, user)
	{
		if (user == this.client.user) {
			return;
		}

		var msg = r.message;
		if (msg.channel.id != this.config.channel) {
			return;
		}

		if (user == msg.author) {
			return;
		}

		if (this.config.reactions.indexOf(r.emoji.name) == -1) {
			return;
		}

		this.collFilesFeedback.insertOne({
			time: new Date(),
			msg: msg.id,
			msg_user: msg.author.id,
			user: user.id,
			emoji: r.emoji.name
		});
	}

	onMessageReactionRemove(r, user)
	{
		if (user == this.client.user) {
			return;
		}

		var msg = r.message;
		if (msg.channel.id != this.config.channel) {
			return;
		}

		if (user == msg.author) {
			return;
		}

		if (this.config.reactions.indexOf(r.emoji.name) == -1) {
			return;
		}

		this.collFilesFeedback.deleteOne({
			msg: msg.id,
			user: user.id,
			emoji: r.emoji.name
		});
	}

	onMessage(msg, edited)
	{
		if (msg.channel.id != this.config.channel) {
			return false;
		}

		if (edited) {
			return false;
		}

		(async () => {
			var user = await this.getOrCreateUser(msg.author.id);

			var filenames = "";
			var numFiles = 0;

			msg.attachments.each(async a => {
				if (!a.name.match(/.*\.(wav|mp3|ogg|flac)/)) {
					return;
				}

				filenames += a.name + " ";
				numFiles++;

				var logUsername = msg.author.username + '#' + msg.author.discriminator;
				console.log(logUsername + " uploaded " + a.name.red.underline);

				this.collUsers.updateOne({ id: user.id }, {
					$inc: { files_uploaded: 1 }
				});

				/*
				statsmessage = false
				feedbackmessage = false
				spectrumpic = false
				*/

				if (this.config.spectrumpic) {
					new Promise((resolve, reject) => {
						let path = '/tmp/waveform-' + msg.id + '.png';
						let cmd = ffmpeg(a.url);
						cmd.complexFilter([
							'[0:a] showspectrumpic=s=400x70:color=nebulae:legend=false [tmp1]',
							//'[0:a] showwavespic=s=400x70:colors=0xFFFFFFFF:filter=peak [tmp2]',
							//'[tmp1][tmp2] overlay=y=0:format=rgb:alpha=premultiplied [tmp3]',
							'[tmp1] drawbox=0:0:400:70:black',
						]);
						cmd.frames(1);
						cmd.on('error', err => {
							reject(err);
						});
						cmd.on('end', () => {
							msg.channel.send({
								files: [{
									attachment: path,
									name: 'waveform.png',
								}],
							}).then(resolve).catch(reject);
						});
						cmd.save(path);
					}).catch(err => {
						console.error('ffmpeg waveform failed!', err);
					});
				}

				for (var i = 0; i < this.config.reactions.length; i++) {
					await msg.react(this.config.reactions[i]);
				}
			});

			if (numFiles > 0) {
				var numFeedbackGiven = await this.getNumberOfFeedbackGiven(user.id);

				if (this.config.statsmessage) {
					msg.channel.send("**Give " + msg.member.displayName + " your feedback!** :outbox_tray: " + (user.files_uploaded + 1) + " / :bulb: " + numFeedbackGiven);
				}

				if (this.config.feedbackmessage) {
					if (numFeedbackGiven < user.files_uploaded) {
						msg.channel.send(msg.member.toString() + " Remember to give others feedback, too! :ok_hand:");
					}
				}
			}
		})();

		return false;
	}

	async onCmdStats(msg)
	{
		if (msg.channel.id != this.config.channel) {
			return;
		}

		var user = await this.getOrCreateUser(msg.author.id);

		var numFeedbackReceived = await this.collFilesFeedback.countDocuments({ msg_user: user.id });
		var numFeedbackGiven = await this.getNumberOfFeedbackGiven(user.id);

		msg.channel.send(":bar_chart: " + msg.member.toString() + ", you have uploaded **" + (user.files_uploaded || 0) + "** files, given **" + numFeedbackGiven + "** feedback reactions, and received **" + numFeedbackReceived + "**.");
	}
}

module.exports = ProducingModule;
