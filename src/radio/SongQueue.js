var Song = require("./Song");

class SongQueue
{
	constructor(config)
	{
		this.config = config;

		this.list = [];
	}

	add(url, callback)
	{
		new Song(this.config, url, (song) => {
			if (!song.valid) {
				callback(false);
				return;
			}
			this.list.push(song);
			callback(song);
		});
	}

	length()
	{
		return this.list.length;
	}

	remove(index)
	{
	}

	find(name)
	{
	}

	next()
	{
		if (this.list.length == 0) {
			return null;
		}
		return this.list.splice(0, 1)[0];
	}
}

module.exports = SongQueue;
