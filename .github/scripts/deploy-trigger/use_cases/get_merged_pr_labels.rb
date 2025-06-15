# Use case for retrieving labels from merged PR
# Also retrieves branch information from GitHub API

module UseCases
  module DeployTrigger
    class GetMergedPrLabels
      def initialize(github_client:)
        @github_client = github_client
      end

      # Execute merged PR label retrieval with known PR number or branch search
      def execute(pr_number: nil, branch_name: nil)
        if pr_number
          # Get PR information including branch name and labels
          pr_info = @github_client.get_pr_info(pr_number)
          deploy_labels_strings = pr_info[:labels]
          source_branch = pr_info[:head_ref]

          deploy_labels = deploy_labels_strings.map { |label| Entities::DeployLabel.new(label) }.select(&:valid?)

          if deploy_labels.empty?
            # It is assumed to be normal even if the label is not found because there is a service that is not deployed.
            # return Entities::Result.failure(
            #   error_message: "No deployment labels found on PR ##{pr_number}"
            # )
          end

          return Entities::Result.success(
            merged_pr_number: pr_number,
            deploy_labels: deploy_labels,
            raw_labels: deploy_labels_strings,
            source_branch: source_branch
          )
        else
          # Search for merged PR using branch (existing logic)
          # TODO: Implement branch-based PR search if needed
          Entities::Result.failure(error_message: "Branch-based PR search not implemented yet")
        end
      rescue => error
        Entities::Result.failure(error_message: "Failed to retrieve PR labels: #{error.message}")
      end
    end
  end
end
