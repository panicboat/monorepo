require 'bundler/setup'

# External libraries
require 'colorize' unless ENV['GITHUB_ACTIONS']
require 'dry-container'
require 'dry-auto_inject'
require 'yaml'
require 'json'
require 'thor'
require 'octokit'

# Auto-load all core files
Dir[File.expand_path('../core/**/*.rb', __dir__)].sort.each { |file| require file }

# DI Container
require_relative 'dependency_injection'

# Loading completion log (development only)
unless ENV['GITHUB_ACTIONS']
  puts "✅ GitHub Scripts Core loaded".colorize(:green)
end
