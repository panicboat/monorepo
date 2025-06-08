class GitHubGateway
  def get_deploy_labels(pr_number)
    raise NotImplementedError
  end

  def add_label_to_pr(pr_number, label)
    raise NotImplementedError
  end

  def remove_label_from_pr(pr_number, label)
    raise NotImplementedError
  end

  def ensure_label_exists(label_name)
    raise NotImplementedError
  end

  def create_pr_comment(pr_number, content)
    raise NotImplementedError
  end

  def update_pr_comment(pr_number, content, tag)
    raise NotImplementedError
  end
end
