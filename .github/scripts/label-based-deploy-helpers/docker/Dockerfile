FROM ruby:3.2-alpine

# Install necessary packages
RUN apk add --no-cache \
    git \
    curl \
    wget \
    unzip \
    bash \
    ca-certificates \
    build-base \
    && update-ca-certificates

# Install Terraform
ARG TERRAFORM_VERSION=1.12.1
RUN wget -O terraform.zip https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_arm64.zip \
    && unzip terraform.zip \
    && mv terraform /usr/local/bin/ \
    && rm terraform.zip \
    && terraform --version

# Install Terragrunt
ARG TERRAGRUNT_VERSION=0.81.0
RUN wget -O terragrunt https://github.com/gruntwork-io/terragrunt/releases/download/v${TERRAGRUNT_VERSION}/terragrunt_linux_arm64 \
    && chmod +x terragrunt \
    && mv terragrunt /usr/local/bin/ \
    && terragrunt --version

# Install AWS CLI v2 (Alpine fixed version)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    && python3 -m venv /opt/aws-cli \
    && /opt/aws-cli/bin/pip install --upgrade pip \
    && /opt/aws-cli/bin/pip install awscli \
    && ln -s /opt/aws-cli/bin/aws /usr/local/bin/aws \
    && aws --version

# Install jq and yq
RUN apk add --no-cache jq \
    && wget -O /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_arm64 \
    && chmod +x /usr/local/bin/yq

# Set working directory
WORKDIR /app

# Copy Gemfile and install dependencies (correct path now)
COPY Gemfile ./
RUN bundle install --jobs=$(nproc) --retry=3

# Copy application code (everything in scripts directory)
COPY . .

# Set executable permissions for all scripts
RUN find . -name "*.sh" -exec chmod +x {} \; \
    && find bin -type f -exec chmod +x {} \; 2>/dev/null || true

# Copy and set up entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bash"]
