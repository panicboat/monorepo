FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o holmes .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/holmes /holmes
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/holmes"]
