class GitHubActionsPresenter
  def present_label_dispatch_result(deploy_labels:, labels_added:, labels_removed:, changed_files:)
    if ENV['GITHUB_ENV']
      File.open(ENV['GITHUB_ENV'], 'a') do |f|
        f.puts "DEPLOY_LABELS=#{deploy_labels.map(&:to_s).to_json}"
        f.puts "LABELS_ADDED=#{labels_added.to_json}"
        f.puts "LABELS_REMOVED=#{labels_removed.to_json}"
        f.puts "HAS_CHANGES=#{deploy_labels.any?}"
        f.puts "CHANGED_FILES=#{changed_files.to_json}"
        f.puts "SERVICES_DETECTED=#{deploy_labels.map(&:service).uniq.to_json}"
      end
    end

    puts "::set-output name=deploy_labels::#{deploy_labels.map(&:to_s).to_json}"
    puts "::set-output name=has_changes::#{deploy_labels.any?}"

    puts "🏷️ Label Dispatch Completed"
    puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
    puts "Labels Added: #{labels_added.join(', ')}" if labels_added.any?
    puts "Labels Removed: #{labels_removed.join(', ')}" if labels_removed.any?
  end

  def present_deployment_matrix(matrix_items:, deploy_labels:)
    if ENV['GITHUB_ENV']
      File.open(ENV['GITHUB_ENV'], 'a') do |f|
        f.puts "DEPLOYMENT_TARGETS=#{matrix_items.to_json}"
        f.puts "HAS_TARGETS=#{matrix_items.any?}"
        f.puts "DEPLOY_LABELS=#{deploy_labels.map(&:to_s).to_json}"
      end
    end

    puts "::set-output name=targets::#{matrix_items.to_json}"
    puts "::set-output name=has_targets::#{matrix_items.any?}"

    puts "🚀 Deployment Matrix Generated"
    puts "Targets: #{matrix_items.length} deployment(s)"
    matrix_items.each do |item|
      puts "  #{item[:service]}:#{item[:environment]} -> #{item[:working_directory]}"
    end
  end

  def present_branch_deployment_result(deploy_labels:, branch_name:)
    matrix_items = deploy_labels.map { |label| generate_matrix_item_for_label(label) }

    if ENV['GITHUB_ENV']
      File.open(ENV['GITHUB_ENV'], 'a') do |f|
        f.puts "DEPLOYMENT_TARGETS=#{matrix_items.to_json}"
        f.puts "HAS_TARGETS=#{deploy_labels.any?}"
        f.puts "DEPLOY_LABELS=#{deploy_labels.map(&:to_s).to_json}"
        f.puts "BRANCH_NAME=#{branch_name}"
      end
    end

    puts "🌿 Branch Deployment Detection"
    puts "Branch: #{branch_name}"
    puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
  end

  def present_error(result)
    puts "::error::#{result.error_message}"

    if ENV['GITHUB_ENV']
      File.open(ENV['GITHUB_ENV'], 'a') do |f|
        f.puts "ERROR_OCCURRED=true"
        f.puts "ERROR_MESSAGE=#{result.error_message}"
      end
    end

    exit 1
  end

  private

  def generate_matrix_item_for_label(deploy_label)
    {
      service: deploy_label.service,
      environment: deploy_label.environment,
      stack: deploy_label.stack,
      working_directory: "#{deploy_label.service}/terragrunt/envs/#{deploy_label.environment}",
      terraform_version: "1.5.7",
      terragrunt_version: "0.53.2"
    }
  end
end
