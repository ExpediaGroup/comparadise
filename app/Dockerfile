FROM node:18-slim

WORKDIR /app
RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

ENV PORT 8080

RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm
RUN pnpm fetch
ADD . ./
RUN pnpm install -r --offline
RUN pnpm build

CMD [ "pnpm", "start:backend" ]
