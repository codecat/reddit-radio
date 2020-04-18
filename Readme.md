# Reddit Radio [![Discord](https://img.shields.io/discord/319525278978277407.svg)](https://discord.gg/hardstyle) [![Docker](https://img.shields.io/docker/cloud/build/codecatt/reddit-radio)](https://hub.docker.com/r/codecatt/reddit-radio)
A general purpose Discord bot made for the [/r/hardstyle](https://reddit.com/r/hardstyle) Discord.

## Features
It does:

* Event schedules.
* Lots of commands and stuff.
* Other cool things.
* Live radio re-streaming to voice channels (using multiple bot users), automatically turned on/off when someone joins/leaves the bound channel.
* Makes Headhunterz shrug. ¯\\\_(ツ)\_/¯


## Modules
A module is a class in the `modules` folder. It accepts the following methods:

* `constructor(config, client, bot)` where `config` is the object directly from the config file, `client` is the Discord client, and `bot` is the `RedditRadio` object.
* `onCmdXxxx(msg, ...)` where `Xxxx` is a command name like `.xxxx`.
* `onTick()` is called every second.
* `onMessage(msg)` is called whenever a message is sent in any channel. Return `false` if the message can pass through to other commands and handlers, or `true` to stop that from happening.


## (Optional) How to run using Docker
You can use Docker and a mounted volume to easily run Reddit Radio.

The Reddit Radio Docker image is publically available on Docker Hub and can be found [here](https://hub.docker.com/r/codecatt/reddit-radio) and are automatically built each time a change is made to the master branch.

### How to run using built image
1. Create a folder where you'd like to run the docker image
2. Create a folder called `config` or similiar to keep your configuration in
3. Make a copy of `config.example.toml` called `config.toml` and place it in your `config` folder
4. Edit the config file
5. Run the following command `docker run -d --name reddit-radio -v $(pwd)/config:/app/config codecatt/reddit-radio:latest`

### Running using Docker from the repo
1. Clone this repo
    `git clone https://github.com/codecat/reddit-radio.git`
2. Build the Docker image
    `docker build . -t reddit-radio`
3. Create a folder called `config` or similiar to keep your configuration in
4. Make a copy of `config.example.toml` called `config.toml` and place it in your `config` folder
5. Edit the config file
6. Run the following command
    `docker run -d --name reddit-radio -v $(pwd)/config:/app/config reddit-radio`

Note: For development you could map your whole code directory as follows:
`docker run -d --name reddit-radio -v $(pwd):/app reddit-radio`
