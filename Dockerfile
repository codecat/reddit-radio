FROM codecatt/reddit-radio:base

ENV CONFIG_FILE="./config/config.toml"

WORKDIR /app

COPY . /app

CMD ["node", "index.js"]
