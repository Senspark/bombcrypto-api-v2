# syntax=docker/dockerfile:1.5

FROM node:20-alpine AS build-base
WORKDIR /app
RUN apk add --no-cache python3 make g++

FROM build-base AS deps
COPY package.json yarn.lock ./
RUN yarn install

FROM deps AS build
COPY . .
RUN yarn nest build

FROM build-base AS prod-deps
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn install --production --ignore-scripts

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/seed.js ./dist/seed.js
COPY package.json ./
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
