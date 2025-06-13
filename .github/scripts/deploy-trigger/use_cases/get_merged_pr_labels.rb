# Use case for retrieving labels from merged PR
# Simplified version - PR number is provided by GitHub Actions

module UseCases
  module DeployTrigger
    class GetMergedPrLabels
      def initialize(github_client:)
        @github_client = github_client
      end

      # Execute merged PR label retrieval with known PR number or branch search
      def execute(pr_number: nil, branch_name: nil, commit_sha: nil)
        if pr_number
          # Direct PR number provided (from pull_request event or detected merged PR)
          deploy_labels_strings = @github_client.get_deploy_labels(pr_number)
          deploy_labels = deploy_labels_strings.map { |label| Entities::DeployLabel.new(label) }.select(&:valid?)

          if deploy_labels.empty?
            return Entities::Result.failure(
              error_message: "No deployment labels found on PR ##{pr_number}"
            )
          end

          return Entities::Result.success(
            merged_pr_number: pr_number,
            deploy_labels: deploy_labels,
            raw_labels: deploy_labels_strings
          )
        else
          # Search for merged PR using branch and commit (existing logic)
          # TODO: Implement branch-based PR search if needed
          Entities::Result.failure(error_message: "Branch-based PR search not implemented yet")
        end
      rescue => error
        Entities::Result.failure(error_message: "Failed to retrieve PR labels: #{error.message}")
      end
    end
  end
end
