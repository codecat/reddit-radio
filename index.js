(function() {
	var RedditRadio = require("./RedditRadio");
	var toml = require("toml");
	var fs = require("fs");

	let configFile = process.env.CONFIG_FILE || "config.toml";
	let config = toml.parse(fs.readFileSync(configFile, "utf8"));

	let bot = new RedditRadio(config);
	bot.start();

	let stopHandler = () => { bot.stop(); };
	process.on("SIGINT", stopHandler); // Ctrl+C
	process.on("SIGTERM", stopHandler); // Terminate
})();
