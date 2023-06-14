FROM node:18.16.0-slim

WORKDIR /app

RUN apt-get update && apt-get -qq -y install curl
RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

RUN pnpm install --prod --ignore-scripts
RUN pnpm --filter frontend prod

ENV PORT 8080
CMD [ "pnpm", "--filter", "backend", "start" ]
