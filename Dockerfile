FROM node:alpine

WORKDIR /app
COPY ./package.json /app/package.json
RUN npm install

ENV CONFIG_FILE="./config/config.toml"
WORKDIR /app
COPY . /app

CMD ["node", "index.js"]
