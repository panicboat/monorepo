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
  # DatabaseCleaner truncation quotes only unqualified names, so slices need schema-qualified cleanup.
  clear_database = lambda do |db|
    tables = db.fetch("SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') AND table_name NOT IN ('schema_info', 'schema_migrations')").all
    names = tables.map { |table| db.literal(Sequel.qualify(table[:table_schema], table[:table_name])) }
    db.run("TRUNCATE TABLE #{names.join(', ')} RESTART IDENTITY CASCADE") unless names.empty?
  end

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

  config.before(:suite) do
    DatabaseCleaner[:sequel].db = Hanami.app["db.gateway"].connection
    DatabaseCleaner.strategy = :transaction
    clear_database.call(DatabaseCleaner[:sequel].db)
  end

  config.around(:each) do |example|
    if example.metadata[:committed_database]
      begin
        example.run
      ensure
        clear_database.call(DatabaseCleaner[:sequel].db)
      end
    else
      DatabaseCleaner.cleaning do
        example.run
      end
    end
  end
end

SPEC_ROOT.glob("support/**/*.rb").each { |f| require f }
