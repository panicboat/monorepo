# frozen_string_literal: true

require "pathname"
SPEC_ROOT = Pathname(__dir__).realpath.freeze
$LOAD_PATH.unshift(File.expand_path('../stubs', __dir__))

ENV["HANAMI_ENV"] ||= "test"
require "hanami/prepare"

SPEC_ROOT.glob("support/**/*.rb").each { |f| require f }
