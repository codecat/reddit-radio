var qd = require("./qdnp_util");

module.exports = function(msg) {
	qd.get(-1, function(track) {
		msg.channel.send("", qd.makeEmbed(track, "Previous track on Q-Dance Radio:"));
	});
};
