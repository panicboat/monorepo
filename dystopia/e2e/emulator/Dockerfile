FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal

ARG AWS_EMULATOR_VERSION
ARG TARGETARCH

# The legacy builder leaves TARGETARCH empty, and uname -m already reports the package's architecture name.
RUN case "${TARGETARCH:-$(uname -m)}" in \
      amd64 | x86_64) arch=x86_64 ;; \
      arm64 | aarch64) arch=aarch64 ;; \
      *) echo "unsupported architecture: ${TARGETARCH:-$(uname -m)}" >&2; exit 1 ;; \
    esac \
 && rpm -i "https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/aws-emulator-${AWS_EMULATOR_VERSION}-1-${arch}.rpm" \
 && mkdir -p /home/emulator \
 && chown 1000 /home/emulator

USER 1000
ENV HOME=/home/emulator
EXPOSE 9297

# Inside the container it listens on 0.0.0.0, and bin/stack limits it to 127.0.0.1 with docker run -p 127.0.0.1:9297:9297.
ENTRYPOINT ["aws-emulator", "-b", "0.0.0.0", "--telemetry", "off"]
