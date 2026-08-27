# frozen_string_literal: true

require "pathname"
SPEC_ROOT = Pathname(__dir__).realpath.freeze
$LOAD_PATH.unshift(File.expand_path("..", __dir__))
$LOAD_PATH.unshift(File.expand_path("../stubs", __dir__))

ENV["HANAMI_ENV"] ||= "test"
require "hanami/prepare"

require "hanami/rspec"
require "database_cleaner/sequel"


RSpec.configure do |config|
  # Use the recommended RSpec 4 defaults
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups

  config.filter_run_when_matching :focus
  config.disable_monkey_patching!
  config.warnings = true

  if config.files_to_run.one?
    config.default_formatter = "doc"
  end

  config.profile_examples = 10
  config.order = :random
  Kernel.srand config.seed

  # DatabaseCleaner
  config.before(:suite) do
    DatabaseCleaner[:sequel].db = Hanami.app["db.gateway"].connection
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.clean_with(:truncation)
  end

  config.around(:each) do |example|
    DatabaseCleaner.cleaning do
      example.run
    end
  end
end

SPEC_ROOT.glob("support/**/*.rb").each { |f| require f }
