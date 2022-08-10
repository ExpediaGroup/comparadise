FROM node:18-slim

WORKDIR /usr/share/app
COPY . .

ENV NODE_ENV "production"
ENV PORT 8080

RUN npm ci
RUN npm run build

CMD [ "npm", "run", "start:server" ]
