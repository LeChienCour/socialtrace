FROM postgres:16-alpine

# Runs as root deliberately — see entrypoint.sh header comment / docs/adr/0006.
# Uses this image only for its pg_dump binary; no Postgres server runs here.

WORKDIR /app
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
