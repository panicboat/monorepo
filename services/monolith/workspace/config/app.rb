# frozen_string_literal: true

require "hanami"
require "sequel"

Sequel.split_symbols = true

module Monolith
  class App < Hanami::App
    config.middleware.use Rack::Static, urls: ["/uploads"], root: "public"

    if Hanami.env?(:development)
      require_relative "../lib/middleware/local_uploader"
      config.middleware.use Middleware::LocalUploader
    end
  end
end
