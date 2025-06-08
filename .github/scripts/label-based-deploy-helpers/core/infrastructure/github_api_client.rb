require_relative '../interfaces/gateways/github_gateway'
require 'octokit'

class GitHubApiClient < GitHubGateway
  def initialize(token:, repository:)
    @client = Octokit::Client.new(access_token: token)
    @repository = repository
  end

  def get_deploy_labels(pr_number)
    labels = @client.labels_for_issue(@repository, pr_number)
    labels.map(&:name).select { |name| name.start_with?('deploy:') }
  rescue Octokit::Error => error
    raise "Failed to get PR labels: #{error.message}"
  end

  def add_label_to_pr(pr_number, label)
    @client.add_labels_to_an_issue(@repository, pr_number, [label])
  rescue Octokit::Error => error
    raise "Failed to add label #{label}: #{error.message}"
  end

  def remove_label_from_pr(pr_number, label)
    @client.remove_label(@repository, pr_number, label)
  rescue Octokit::NotFound
  rescue Octokit::Error => error
    raise "Failed to remove label #{label}: #{error.message}"
  end

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

  def create_pr_comment(pr_number, content)
    @client.add_comment(@repository, pr_number, content)
  rescue Octokit::Error => error
    raise "Failed to create PR comment: #{error.message}"
  end

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

  def determine_label_color(label_name)
    if label_name.include?(':production')
      'ff0000'
    elsif label_name.include?(':staging')
      'ffaa00'
    elsif label_name.include?(':develop')
      '00aa00'
    else
      '0052cc'
    end
  end
end
