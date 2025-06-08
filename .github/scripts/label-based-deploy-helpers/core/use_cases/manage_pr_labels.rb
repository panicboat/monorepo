class ManagePrLabels
  def initialize(github_gateway:)
    @github_gateway = github_gateway
  end

  def execute(pr_number:, required_labels:)
    current_deploy_labels = @github_gateway.get_deploy_labels(pr_number)

    labels_to_add = required_labels - current_deploy_labels
    labels_to_remove = current_deploy_labels - required_labels

    required_labels.each do |label|
      @github_gateway.ensure_label_exists(label)
    end

    labels_to_remove.each do |label|
      @github_gateway.remove_label_from_pr(pr_number, label)
    end

    labels_to_add.each do |label|
      @github_gateway.add_label_to_pr(pr_number, label)
    end

    Result.success(
      labels_added: labels_to_add,
      labels_removed: labels_to_remove,
      final_labels: required_labels
    )
  rescue => error
    Result.failure(error_message: error.message)
  end
end
