# GitHub API client for interacting with GitHub repositories
# Handles PR labels, comments, and repository operations

module Infrastructure
  class GitHubClient
    def initialize(token:, repository:)
      @client = Octokit::Client.new(access_token: token)
      @repository = repository
    end

    # Get all deploy labels from a PR
    def get_deploy_labels(pr_number)
      labels = @client.labels_for_issue(@repository, pr_number)
      labels.map(&:name).select { |name| name.start_with?('deploy:') }
    rescue Octokit::Error => error
      raise "Failed to get PR labels: #{error.message}"
    end

    # Add a label to a PR
    def add_label_to_pr(pr_number, label)
      @client.add_labels_to_an_issue(@repository, pr_number, [label])
    rescue Octokit::Error => error
      raise "Failed to add label #{label}: #{error.message}"
    end

    # Remove a label from a PR
    def remove_label_from_pr(pr_number, label)
      @client.remove_label(@repository, pr_number, label)
    rescue Octokit::NotFound
      # Label doesn't exist on PR, ignore
    rescue Octokit::Error => error
      raise "Failed to remove label #{label}: #{error.message}"
    end

    # Ensure a label exists in the repository
    def ensure_label_exists(label_name)
      @client.label(@repository, label_name)
    rescue Octokit::NotFound
      color = determine_label_color(label_name)
      @client.add_label(@repository, label_name, color, {
        description: 'Auto-generated deployment label'
      })
    rescue Octokit::Error => error
      raise "Failed to ensure label exists #{label_name}: #{error.message}"
    end

    # Create a comment on a PR
    def create_pr_comment(pr_number, content)
      @client.add_comment(@repository, pr_number, content)
    rescue Octokit::Error => error
      raise "Failed to create PR comment: #{error.message}"
    end

    # Update or create a tagged comment on a PR
    def update_pr_comment(pr_number, content, tag)
      comments = @client.issue_comments(@repository, pr_number)
      existing_comment = comments.find { |comment| comment.body.include?("<!-- #{tag} -->") }

      tagged_content = content + "\n\n<!-- #{tag} -->"

      if existing_comment
        @client.update_comment(@repository, existing_comment.id, tagged_content)
      else
        @client.add_comment(@repository, pr_number, tagged_content)
      end
    rescue Octokit::Error => error
      raise "Failed to update PR comment: #{error.message}"
    end

    private

    # Determine label color based on environment
    def determine_label_color(label_name)
      if label_name.include?(':production')
        'ff0000'  # Red for production
      elsif label_name.include?(':staging')
        'ffaa00'  # Orange for staging
      elsif label_name.include?(':develop')
        '00aa00'  # Green for develop
      else
        '0052cc'  # Blue for others
      end
    end
  end
end
