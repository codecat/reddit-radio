var RedditRadio = require("./RedditRadio");

var bot = new RedditRadio();
bot.start();

process.on("SIGINT", function() {
	bot.stop();
});
