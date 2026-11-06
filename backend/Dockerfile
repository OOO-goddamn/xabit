FROM golang:1.25-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/habit-api ./cmd/api \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/habit-seed ./cmd/seed

FROM alpine:3.22

RUN adduser -D -u 10001 app

COPY --from=build /out/habit-api /usr/local/bin/habit-api
COPY --from=build /out/habit-seed /usr/local/bin/habit-seed

USER app
EXPOSE 8080

ENTRYPOINT ["habit-api"]
