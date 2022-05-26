class RoleModule
{
	constructor(config, client, bot)
	{
		this.client = client;
		this.bot = bot;

		this.role_messages = [];
	}

	async onCmdRoleAssign(msg, id, emote, text)
	{
		if (!this.bot.isAdmin(msg.member)) {
			return;
		}

		if (id === undefined || emote === undefined || text === undefined) {
			await msg.delete();
			msg.author.send('Usage: `.roleassign <role id> <emote> "<message text>"`').catch(console.error);
			return;
		}

		await msg.delete();

		let newMessage = await msg.channel.send(text);
		await newMessage.react(emote);

		let collector = newMessage.createReactionCollector({ dispose: true });

		collector.on('collect', async (r, user) => {
			if (user == this.client.user) {
				return;
			}

			let member = await r.message.guild.members.fetch(user);
			if (!member) {
				return;
			}

			try {
				await member.roles.add(id, 'Assigned from message reaction');
			} catch (ex) { this.bot.handleError(ex); }
		});

		collector.on('remove', async (r, user) => {
			if (user == this.client.user) {
				return;
			}

			let member = await r.message.guild.members.fetch(user);
			if (!member) {
				return;
			}

			try {
				await member.roles.remove(id, 'Unassigned from message reaction');
			} catch (ex) { this.bot.handleError(ex); }
		});
	}
}

module.exports = RoleModule;
