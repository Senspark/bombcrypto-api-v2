FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY native-rate.mjs crontab.template start.sh run.sh ./
RUN chmod +x /app/start.sh /app/run.sh
# crond, not a node process: the job runs once a day and must not hold a heap between runs.
CMD ["/app/start.sh"]
