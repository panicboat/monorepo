# Use case for managing PR labels based on detected changes
# Handles adding and removing deployment labels on PRs

module UseCases
  module LabelManagement
    class ManageLabels
      def initialize(github_client:)
        @github_client = github_client
      end

      # Execute label management for a PR
      def execute(pr_number:, required_labels:)
        current_deploy_labels = @github_client.get_deploy_labels(pr_number)

        labels_to_add = required_labels - current_deploy_labels
        labels_to_remove = current_deploy_labels - required_labels

        # Ensure all required labels exist in the repository
        required_labels.each do |label|
          @github_client.ensure_label_exists(label)
        end

        # Remove outdated labels
        labels_to_remove.each do |label|
          @github_client.remove_label_from_pr(pr_number, label)
        end

        # Add new labels
        labels_to_add.each do |label|
          @github_client.add_label_to_pr(pr_number, label)
        end

        Entities::Result.success(
          labels_added: labels_to_add,
          labels_removed: labels_to_remove,
          final_labels: required_labels,
          current_labels: current_deploy_labels
        )
      rescue => error
        Entities::Result.failure(error_message: error.message)
      end

      # Update PR comment with deployment information
      def update_deployment_comment(pr_number:, deploy_labels:, changed_files:)
        content = build_deployment_comment_content(deploy_labels, changed_files)
        tag = 'auto-deployment-info'

        @github_client.update_pr_comment(pr_number, content, tag)

        Entities::Result.success(comment_updated: true)
      rescue => error
        Entities::Result.failure(error_message: error.message)
      end

      private

      # Build the content for deployment information comment
      def build_deployment_comment_content(deploy_labels, changed_files)
        content = "## 🚀 Auto-Deployment Information\n\n"

        if deploy_labels.any?
          content += "### Detected Services\n"
          deploy_labels.each do |label|
            content += "- **#{label.service}**\n"
          end
          content += "\n"

          content += "### Deployment Labels Applied\n"
          deploy_labels.each do |label|
            content += "- `#{label.to_s}`\n"
          end
        else
          content += "No deployment targets detected for this PR.\n"
        end

        content += "\n### Changed Files (#{changed_files.length})\n"
        if changed_files.length <= 20
          changed_files.each { |file| content += "- `#{file}`\n" }
        else
          content += "<details>\n<summary>Show all #{changed_files.length} changed files</summary>\n\n"
          changed_files.each { |file| content += "- `#{file}`\n" }
          content += "\n</details>\n"
        end

        content += "\n---\n*This comment is automatically updated when the PR changes.*"
        content
      end
    end
  end
end
