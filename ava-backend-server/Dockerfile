FROM node:18.16.0-alpine

LABEL maintainer="saihong@icsc.com.tw"

EXPOSE 8082

WORKDIR /app/web/backend
VOLUME /app/web/backend/uploads_backend

COPY package.json /app/web/backend/package.json
RUN npm install --only=prod

COPY config/ /app/web/backend/config
COPY controller/ /app/web/backend/controller
COPY db/ /app/web/backend/db
COPY docker/ /app/web/backend/docker
COPY global/ /app/web/backend/global
COPY middleware/ /app/web/backend/middleware
COPY model/ /app/web/backend/model
COPY orm/ /app/web/backend/orm
COPY odm/ /app/web/backend/odm
# COPY log/ /app/web/backend/log
# COPY resource/ /app/web/backend/resource
COPY router/ /app/web/backend/router
COPY temp_zip/ /app/web/backend/temp_zip
COPY tempResource/ /app/web/backend/tempResource
# COPY uploads/ /app/web/backend/uploads
# COPY uploads_backend/ /app/web/backend/uploads_backend
COPY utils/ /app/web/backend/utils
COPY server.js /app/web/backend/server.js
COPY package.json /app/web/backend/package.json
COPY package-lock.json /app/web/backend/package-lock.json
COPY site_config.json /app/web/backend/site_config.json
COPY project.json /app/web/backend/project.json
COPY schedulers/ /app/web/backend/schedulers

RUN mkdir -p /app/web/backend/log
RUN mkdir -p /app/web/backend/resource
RUN mkdir -p /app/web/backend/uploads
RUN mkdir -p /app/web/backend/uploads_backend

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ARG COMMIT_SHA
ARG BRANCH_NAME
ENV COMMIT_SHA ${COMMIT_SHA}
ENV BRANCH_NAME ${BRANCH_NAME}


ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
