FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
COPY server.js ./
COPY src ./src
COPY data ./data
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]
