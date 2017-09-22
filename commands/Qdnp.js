var qd = require("./qdnp_util");

module.exports = function(msg) {
	qd.get(0, function(track) {
		msg.channel.send("", qd.makeEmbed(track, "Q-Dance Radio is now playing:"));
	});
};
