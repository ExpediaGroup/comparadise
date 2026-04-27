FROM oven/bun:1.3.13
WORKDIR /workspace

RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

RUN bun install --production --filter app

WORKDIR /workspace/app
RUN bun run build

ENV PORT=8080
CMD [ "bun", "start" ]
