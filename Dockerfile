FROM oven/bun:1.1.8
WORKDIR /app

RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

RUN bun install --production --ignore-scripts
RUN bun --filter frontend prod

ENV PORT 8080
CMD [ "bun", "--filter", "backend", "start" ]
