FROM ruby:3.4-alpine

RUN apk add --no-cache build-base postgresql-dev

WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .
EXPOSE 50052
CMD ["ruby", "main.rb"]