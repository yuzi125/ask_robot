FROM node:18.20.4-alpine3.20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY logs/ ./logs
COPY uploads/ ./uploads
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY server.js ./server.js

EXPOSE 8090

CMD [ "npm", "start" ]
