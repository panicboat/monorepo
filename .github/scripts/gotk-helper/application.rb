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
    container[:file_client] = Infrastructure::FileSystemClient.new

    # GitHub client (only in GitHub Actions or with credentials)
    if ENV['GITHUB_ACTIONS'] || (ENV['GITHUB_TOKEN'] && ENV['GITHUB_REPOSITORY'])
      container[:github_client] = Infrastructure::GitHubClient.new(
        token: ENV['GITHUB_TOKEN'] || raise('GITHUB_TOKEN is required'),
        repository: ENV['GITHUB_REPOSITORY'] || raise('GITHUB_REPOSITORY is required')
      )
    end

    # Gotk-helper specific use cases
    container[:extract_deployment_info] = UseCases::ManifestManagement::ExtractDeploymentInfo.new

    container[:update_manifest] = UseCases::ManifestManagement::UpdateManifest.new(
      file_client: container[:file_client]
    )

    if container[:github_client]
      container[:create_pull_request] = UseCases::ManifestManagement::CreatePullRequest.new(
        github_client: container[:github_client],
        file_client: container[:file_client]
      )

      container[:update_manifests_from_pr] = UseCases::ManifestManagement::UpdateManifestsFromPr.new(
        extract_deployment_info_use_case: container[:extract_deployment_info],
        update_manifest_use_case: container[:update_manifest],
        create_pull_request_use_case: container[:create_pull_request]
      )
    end

    # Presenters
    container[:console_presenter] = Interfaces::Presenters::ConsolePresenter.new
    container[:github_actions_presenter] = Interfaces::Presenters::GitHubActionsPresenter.new

    # Controller
    presenter = ENV['GITHUB_ACTIONS'] ? container[:github_actions_presenter] : container[:console_presenter]
    container[:gotk_helper_controller] = Interfaces::Controllers::GotkHelperController.new(
      update_manifests_from_pr_use_case: container[:update_manifests_from_pr],
      presenter: presenter
    )

    container
  end
end

# Loading completion log (development only)
unless ENV['GITHUB_ACTIONS']
  puts "✅ GitOps Toolkit Helper loaded".colorize(:green)
end
