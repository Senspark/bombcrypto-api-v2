FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install --production

FROM node:24-alpine
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY *.js ./
COPY lib/ ./lib/
COPY utils/ ./utils/
COPY handlers/ ./handlers/
COPY consts/ ./consts/
COPY web/ ./web/
COPY rpc.config.json ./

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["node", "server.js"]
