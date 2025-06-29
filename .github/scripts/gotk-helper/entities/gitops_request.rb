# GitOps request entity containing all information needed for GitOps repository operations
# Represents a single manifest generation and pull request creation operation

module Entities
  class GitOpsRequest
    attr_reader :service, :environment, :manifest_file_path, :target_repository,
                :target_branch, :source_sha, :source_repository, :pr_number

    def initialize(
      service:,
      environment:,
      manifest_file_path:,
      target_repository:,
      target_branch:,
      source_sha:,
      source_repository:,
      pr_number: nil
    )
      @service = service
      @environment = environment
      @manifest_file_path = manifest_file_path
      @target_repository = target_repository
      @target_branch = target_branch
      @source_sha = source_sha
      @source_repository = source_repository
      @pr_number = pr_number
    end

    # Factory method to create request from deployment target and PR information
    def self.from_deployment_target(
      deployment_target,
      manifest_file_path:,
      target_repository:,
      target_branch:,
      source_sha:,
      source_repository:,
      pr_number: nil
    )
      new(
        service: deployment_target.service,
        environment: deployment_target.environment,
        manifest_file_path: manifest_file_path,
        target_repository: target_repository,
        target_branch: target_branch,
        source_sha: source_sha,
        source_repository: source_repository,
        pr_number: pr_number
      )
    end

    # Generate feature branch name for the pull request
    def feature_branch_name
      "auto-update/#{service}-#{environment}-#{source_sha[0..6]}"[0..62]
    end

    # Generate target file path in GitOps repository
    def target_file_path
      "#{environment}/#{service}.yaml"
    end

    # Generate pull request title
    def pull_request_title
      "[Auto] Update #{service} manifests for #{environment} environment"
    end

    # Generate commit message for manifest update
    def commit_message
      <<~MSG.strip
        Update #{service} manifests for #{environment} environment

        Generated from: #{source_repository}@#{source_sha}
        Service: #{service}
        Environment: #{environment}
        Target branch: #{target_branch}
      MSG
    end

    # Check if all required fields are present and valid
    def valid?
      return false unless service && environment && manifest_file_path
      return false unless target_repository && target_branch && source_sha && source_repository
      return false unless File.exist?(manifest_file_path)
      return false unless service.match?(/\A[a-zA-Z0-9\-_]+\z/)
      return false unless environment.match?(/\A[a-zA-Z0-9\-_]+\z/)

      true
    end

    # Equality comparison
    def ==(other)
      return false unless other.is_a?(GitOpsRequest)
      
      service == other.service &&
      environment == other.environment &&
      target_repository == other.target_repository &&
      target_branch == other.target_branch &&
      source_sha == other.source_sha
    end

    # Hash for use in collections
    def hash
      [service, environment, target_repository, target_branch, source_sha].hash
    end

    # Enable use in sets and as hash keys
    alias eql? ==
  end
end