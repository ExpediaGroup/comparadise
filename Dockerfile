FROM node:20.12.0-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

RUN pnpm --filter backend --filter frontend install --ignore-scripts
RUN pnpm --filter frontend prod

ENV PORT 8080
CMD [ "pnpm", "--filter", "backend", "start" ]
