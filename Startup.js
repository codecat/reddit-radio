var RedditRadio = require("./RedditRadio");
var toml = require("toml");
var fs = require("fs");
var Radio = require("./Radio");

class Startup
{
	constructor()
	{
        this.RADIO = 'radio';
        this.NO_RADIO = 'no-radio';
        this.REGULAR_BOT = 'regular-bot';

        let configFile = process.env.CONFIG_FILE || "config.toml";
		this.config = toml.parse(fs.readFileSync(configFile, "utf8"));
    }

    run()
    {
        let args = this.parseArgs();
        switch (args.type) {
            case this.RADIO: this.setupRadio(args.name); break;
            case this.NO_RADIO: this.setupNoRadio(); break;
            default: this.startBot(this.config); break;
        }
    }

    setupNoRadio()
    {
        let config = this.config;
        delete config.radios;
        this.startBot(config);
    }

    setupRadio(name)
    {
        if (this.config.radios === undefined) {
            console.error('No radios are defined in the config file, exiting...');
            process.exit(1);
        }
        for (let i = 0; i < this.config.radios.length; i++) {
            if (this.config.radios[i].name === name) {
                this.startRadio(this.config.radios[i])
            }
        }
    }

    startRadio(radioConfig)
    {
        this.radio = new Radio(this.config, radioConfig);

        var self = this;
        process.on("SIGINT", function() {
            self.radio.stop();
        });
    }

    startBot(config)
    {
        this.bot = new RedditRadio(config);
        this.bot.start();

        var self = this;
        process.on("SIGINT", function() {
            self.bot.stop();
        });
    }

    parseArgs()
    {
        let args = process.argv.splice(2);
        switch (args[0]) {
            case '--radio': return { type: this.RADIO, name: args[1]};
            case '--no-radios': return { type: this.NO_RADIO };
            default: return { type: this.REGULAR_BOT };
        }
    }
}

module.exports = Startup;
