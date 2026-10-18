FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip gawk postgresql-client \
 && rm -rf /var/lib/apt/lists/*
COPY run.sh /usr/local/bin/etl
RUN chmod +x /usr/local/bin/etl
CMD ["etl"]
