FROM node:8-alpine

ENV CONFIG_FILE="./config/config.toml"

WORKDIR /app

COPY . /app

RUN apk add --no-cache ffmpeg \
    && apk add --no-cache --virtual .build-deps \
        g++ \
        gcc \
        libgcc \
        make \
        autoconf \
        libtool \
        automake \
        python \
    && npm install \
    && apk del .build-deps

CMD ["node", "index.js"]
