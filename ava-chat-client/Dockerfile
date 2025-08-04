FROM node:18.17.0-alpine

LABEL maintainer="saihong@icsc.com.tw"

ENV NODE_ENV=production
ENV EDITION SELF_HOSTED
ENV DEPLOY_ENV PRODUCTION
#ENV CONSOLE_API_URL http://127.0.0.1:5001
#ENV APP_API_URL http://127.0.0.1:5001
#ENV API_HOST="http://localhost:8081"

EXPOSE 8081

WORKDIR /app/web

COPY package.json /app/web/package.json

RUN npm install --only=prod

COPY . /app/web/

RUN npm run build

COPY docker/pm2.json /app/web/pm2.json
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ARG COMMIT_SHA
ARG BRANCH_NAME
ENV COMMIT_SHA ${COMMIT_SHA}
ENV BRANCH_NAME ${BRANCH_NAME}

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
