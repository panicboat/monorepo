FROM golang:1.24.13-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/pennyworth-slack ./cmd/slack
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/pennyworth-alertmanager ./cmd/alertmanager

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/pennyworth-slack /pennyworth-slack
COPY --from=builder /out/pennyworth-alertmanager /pennyworth-alertmanager
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/pennyworth-slack"]
