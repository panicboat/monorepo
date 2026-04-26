FROM ruby:4.0.2-slim

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install -y build-essential libpq-dev git libyaml-dev postgresql-client-17

WORKDIR /app

# Install gems
COPY Gemfile Gemfile.lock ./
# TODO: re-enable `bundle config set --local frozen true` once google-protobuf gemspec supports Ruby 4.0
RUN bundle install

# Copy application code
COPY . .

# Expose gRPC port
EXPOSE 9001

# Start server
CMD ["./bin/grpc"]
