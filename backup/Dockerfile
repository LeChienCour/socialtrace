FROM alpine:3.20

RUN addgroup -S socialtrace && adduser -S socialtrace -G socialtrace

WORKDIR /app
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh && chown socialtrace:socialtrace entrypoint.sh

USER socialtrace

ENTRYPOINT ["./entrypoint.sh"]
