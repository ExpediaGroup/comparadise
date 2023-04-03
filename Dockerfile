FROM node:18-slim

WORKDIR /app
RUN useradd -ms /bin/sh admin
RUN chown -R admin .
COPY --chown=admin . .
USER admin

ENV PORT 8080

RUN npm ci
RUN npm run build

CMD [ "npm", "run", "start:server" ]
