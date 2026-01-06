FROM ruby:3.4.7-slim

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install -y build-essential libpq-dev git libyaml-dev postgresql-client-17

WORKDIR /app

# Install gems
COPY Gemfile Gemfile.lock ./
RUN bundle install

# Copy application code
COPY . .

# Expose gRPC port
EXPOSE 9001

# Start server
CMD ["./bin/grpc"]
