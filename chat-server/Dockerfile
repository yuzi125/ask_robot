FROM node:18.16.0-alpine

LABEL maintainer="saihong@icsc.com.tw"

RUN apk add --no-cache tzdata

EXPOSE 8081

WORKDIR /app/web

COPY package.json /app/web/package.json
RUN npm install --only=prod

COPY server.js /app/web/server.js
COPY ws.js /app/web/ws.js
COPY package.json /app/web/package.json
COPY package-lock.json /app/web/package-lock.json
COPY cdn/ /app/web/cdn
COPY controller/ /app/web/controller
COPY db/ /app/web/db
COPY docker/ /app/web/docker
COPY global/ /app/web/global
COPY log/ /app/web/log
COPY middleware/ /app/web/middleware
COPY model/ /app/web/model
COPY orm/ /app/web/orm
COPY router/ /app/web/router
COPY uploads/ /app/web/uploads
COPY utils/ /app/web/utils


COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ARG COMMIT_SHA
ARG BRANCH_NAME
ENV COMMIT_SHA ${COMMIT_SHA}
ENV BRANCH_NAME ${BRANCH_NAME}

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
