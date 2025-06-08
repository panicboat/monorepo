class ConsolePresenter
  def present_label_dispatch_result(deploy_labels:, labels_added:, labels_removed:, changed_files:)
    puts "🏷️  Label Dispatch Results".colorize(:blue)
    puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
    puts "Labels Added: #{labels_added.join(', ')}" if labels_added.any?
    puts "Labels Removed: #{labels_removed.join(', ')}" if labels_removed.any?
    puts "Changed Files: #{changed_files.length} files"
  end

  def present_deployment_matrix(matrix_items:, deploy_labels:)
    puts "🚀 Deployment Matrix".colorize(:green)
    puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"

    matrix_items.each do |item|
      puts "  #{item[:service]}:#{item[:environment]} -> #{item[:working_directory]}"
    end
  end

  def present_branch_deployment_result(deploy_labels:, branch_name:)
    puts "🌿 Branch Deployment Detection".colorize(:blue)
    puts "Branch: #{branch_name}"
    puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
  end

  def present_error(result)
    puts "❌ Error: #{result.error_message}".colorize(:red)
    exit 1
  end
end
