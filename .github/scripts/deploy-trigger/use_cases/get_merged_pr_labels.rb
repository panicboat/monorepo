# Use case for retrieving labels from merged PR
# Simplified version - PR number is provided by GitHub Actions

module UseCases
  module DeployTrigger
    class GetMergedPrLabels
      def initialize(github_client:)
        @github_client = github_client
      end

      # Execute merged PR label retrieval with known PR number
      def execute(pr_number:)
        # Get deploy labels from the specified PR
        deploy_labels_strings = @github_client.get_deploy_labels(pr_number)
        deploy_labels = deploy_labels_strings.map { |label| Entities::DeployLabel.new(label) }.select(&:valid?)

        if deploy_labels.empty?
          return Entities::Result.failure(
            error_message: "No deployment labels found on PR ##{pr_number}"
          )
        end

        Entities::Result.success(
          merged_pr_number: pr_number,
          deploy_labels: deploy_labels,
          raw_labels: deploy_labels_strings
        )
      rescue => error
        Entities::Result.failure(error_message: "Failed to retrieve PR labels: #{error.message}")
      end
    end
  end
end
