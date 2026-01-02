FROM oven/bun:1.3.5
WORKDIR /app

RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

RUN bun install --production --filter app

ENV PORT=8080
CMD [ "bun", "--filter", "app", "start" ]
