FROM node:18-slim

WORKDIR /app

RUN apt-get update && apt-get -qq -y install curl
RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

RUN pnpm i --ignore-scripts
RUN pnpm --filter frontend build

ENV PORT 8080
CMD [ "pnpm", "--filter", "app", "start" ]
