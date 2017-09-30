var RedditRadio = require("./src/RedditRadio");

var bot = new RedditRadio();
bot.start();

process.on("SIGINT", function() {
	bot.stop();
});
