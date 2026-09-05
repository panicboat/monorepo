FROM golang:1.24.13-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/holmes-slack ./cmd/slack
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/holmes-alertmanager ./cmd/alertmanager

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/holmes-slack /holmes-slack
COPY --from=builder /out/holmes-alertmanager /holmes-alertmanager
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/holmes-slack"]
