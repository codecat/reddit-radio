var colors = require("colors");
var moment = require("moment");

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

			msg.attachments.tap(async a => {
				if (!a.filename.match(/.*\.(wav|mp3|ogg|flac)/)) {
					return;
				}

				filenames += a.filename + " ";
				numFiles++;

				var logUsername = msg.author.username + '#' + msg.author.discriminator;
				console.log(logUsername + " uploaded " + a.filename.red.underline);

				this.collUsers.updateOne({ id: user.id }, {
					$inc: { files_uploaded: 1 }
				});

				for (var i = 0; i < this.config.reactions.length; i++) {
					await msg.react(this.config.reactions[i]);
				}
			});

			if (numFiles > 0) {
				var numFeedbackGiven = await this.getNumberOfFeedbackGiven(user.id);

				var quickLookText = ":question:";
				if (numFeedbackGiven < user.files_uploaded) {
					quickLookText = ":rage:";
				} else if (numFeedbackGiven > user.files_uploaded) {
					quickLookText = ":ok_hand:";
				}

				var displayName = msg.author.username;
				if (msg.member.nickname) {
					displayName = msg.member.nickname;
				}

				msg.channel.send("**Give " + msg.member + " your feedback!** :outbox_tray: " + (user.files_uploaded + 1) + " / :bulb: " + numFeedbackGiven);

				if (numFeedbackGiven < user.files_uploaded) {
					msg.channel.send(msg.member + " Remember to give others feedback, too! :ok_hand:");
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

		msg.channel.send(":bar_chart: " + msg.member + ", you have uploaded **" + (user.files_uploaded || 0) + "** files, given **" + numFeedbackGiven + "** feedback reactions, and received **" + numFeedbackReceived + "**.");
	}
}

module.exports = ProducingModule;
