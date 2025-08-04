FROM --platform=linux/amd64 python:3.12.3-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y gcc g++ python3-dev libc-dev libffi-dev libpq-dev

COPY ./ava/requirements.txt /app/ava/requirements.txt
COPY ./ava/metadata_extractor-0.2.5-py3-none-any.whl /app/ava/metadata_extractor-0.2.5-py3-none-any.whl

WORKDIR /app/ava
RUN pip install -r requirements.txt

FROM --platform=linux/amd64 python:3.12.3-slim

LABEL maintainer="saihong@icsc.com.tw"

ENV FLASK_APP app.py
ENV EDITION SELF_HOSTED
ENV DEPLOY_ENV PRODUCTION

EXPOSE 5001 8000

WORKDIR /app

RUN apt-get update && \
    apt-get install -y bash curl wget vim libpq5 \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxrender1 libxext6 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/models && \
    wget -O /app/models/doclayout_yolo_docstructbench_imgsz1024.pt \
    https://huggingface.co/juliozhao/DocLayout-YOLO-DocStructBench/resolve/8c3299a30b8ff29a1503c4431b035b93220f7b11/doclayout_yolo_docstructbench_imgsz1024.pt


COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/gunicorn /usr/local/bin/gunicorn
COPY --from=builder /usr/local/bin/babeldoc /usr/local/bin/babeldoc


COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir /opt/tiktoken_cache
ARG TIKTOKEN_URL="https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken"
RUN wget -O /opt/tiktoken_cache/$(echo -n $TIKTOKEN_URL | sha1sum | head -c 40) $TIKTOKEN_URL

ENV TIKTOKEN_CACHE_DIR=/opt/tiktoken_cache
ENV PYTHONPATH=/app/ava-api-server

COPY ava/ /app/ava-api-server/ava
COPY config/ /app/ava-api-server/config
COPY data/ /app/ava-api-server/data
COPY docker/ /app/ava-api-server/docker
COPY skills/ /app/ava-api-server/skills


ARG COMMIT_SHA
ARG BRANCH_NAME
ENV COMMIT_SHA ${COMMIT_SHA}
ENV BRANCH_NAME ${BRANCH_NAME}

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]