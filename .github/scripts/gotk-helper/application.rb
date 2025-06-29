# Application setup for GitOps Toolkit helper
# Configures dependencies and provides access to controllers

require 'bundler/setup'

# Load shared components (adjust path for execution from shared directory)
require_relative '../shared/shared_loader'

# Load feature-specific components
[
  'entities/**/*.rb',
  'use_cases/**/*.rb',
  'controllers/**/*.rb'
].each do |pattern|
  Dir[File.expand_path("../gotk-helper/#{pattern}", __dir__)].sort.each { |file| require file }
end

# Dependency injection container for GitOps Toolkit helper
class GotkHelperContainer
  def self.configure
    @container ||= build_container
  end

  def self.resolve(name)
    configure[name]
  end

  private

  def self.build_container
    container = {}

    # Infrastructure clients
    working_directory = ENV['GITHUB_WORKSPACE'] || ENV['GOTK_WORKING_DIRECTORY']
    container[:file_client] = Infrastructure::FileSystemClient.new(working_directory: working_directory)

    # GitHub client (only in GitHub Actions or with credentials)
    if ENV['GITHUB_ACTIONS'] || (ENV['GITHUB_TOKEN'] && ENV['GITHUB_REPOSITORY'])
      container[:github_client] = Infrastructure::GitHubClient.new(
        token: ENV['GITHUB_TOKEN'] || raise('GITHUB_TOKEN is required'),
        repository: ENV['GITHUB_REPOSITORY'] || raise('GITHUB_REPOSITORY is required')
      )
    end

    # Gotk-helper specific use cases
    container[:process_gitops_request] = UseCases::GitOpsManagement::ProcessGitOpsRequest.new(
      file_client: container[:file_client]
    )

    if container[:github_client]
      container[:create_pull_request] = UseCases::ManifestManagement::CreatePullRequest.new(
        github_client: container[:github_client],
        file_client: container[:file_client]
      )

      container[:create_gitops_request] = UseCases::GitOpsManagement::CreateGitOpsRequest.new(
        process_gitops_request_use_case: container[:process_gitops_request],
        create_pull_request_use_case: container[:create_pull_request]
      )
    end

    # Presenters
    container[:console_presenter] = Interfaces::Presenters::ConsolePresenter.new
    container[:github_actions_presenter] = Interfaces::Presenters::GitHubActionsPresenter.new

    # Controller
    presenter = ENV['GITHUB_ACTIONS'] ? container[:github_actions_presenter] : container[:console_presenter]
    container[:gotk_helper_controller] = Interfaces::Controllers::GotkHelperController.new(
      create_gitops_request_use_case: container[:create_gitops_request],
      presenter: presenter
    )

    container
  end
end

# Loading completion log (development only)
unless ENV['GITHUB_ACTIONS']
  puts "✅ GitOps Toolkit Helper loaded".colorize(:green)
end
