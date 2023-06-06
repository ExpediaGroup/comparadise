FROM node:18.16.0-slim

WORKDIR /app

RUN apt-get update && apt-get -qq -y install curl
RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

RUN pnpm install --ignore-scripts
RUN pnpm nx build frontend

ENV PORT 8080
CMD [ "pnpm", "nx", "start", "app" ]
