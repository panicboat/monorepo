# Pull request creation result entity containing outcome and metadata
# Represents the result of creating a pull request in the GitOps repository

module Entities
  class PullRequestResult
    attr_reader :success, :pull_request_url, :error_message, :has_changes

    def initialize(success:, pull_request_url: nil, error_message: nil, has_changes: false)
      @success = success
      @pull_request_url = pull_request_url
      @error_message = error_message
      @has_changes = has_changes
    end

    # Factory method for successful pull request creation
    def self.success(pull_request_url:, has_changes: true)
      new(
        success: true,
        pull_request_url: pull_request_url,
        has_changes: has_changes
      )
    end

    # Factory method for no changes detected
    def self.no_changes
      new(
        success: true,
        has_changes: false
      )
    end

    # Factory method for failed pull request creation
    def self.failure(error_message:)
      new(
        success: false,
        error_message: error_message
      )
    end

    # Check if the operation was successful
    def success?
      success
    end

    # Check if there were changes to commit
    def has_changes?
      has_changes
    end

    # Check if operation failed
    def failure?
      !success
    end

    # Get status message for logging
    def status_message
      return error_message if failure?
      return "No changes detected in manifests" unless has_changes?
      
      "Successfully created pull request: #{pull_request_url}"
    end

    # Convert to hash for serialization
    def to_h
      {
        success: success,
        pull_request_url: pull_request_url,
        error_message: error_message,
        has_changes: has_changes
      }
    end
  end
end