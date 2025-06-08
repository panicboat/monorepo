require_relative '../../use_cases/generate_deployment_matrix'
require_relative '../../use_cases/determine_branch_deployments'

class DeployTriggerController
  def initialize(
    generate_matrix_use_case:,
    determine_branch_deployments_use_case:,
    github_gateway:,
    presenter:
  )
    @generate_matrix = generate_matrix_use_case
    @determine_branch_deployments = determine_branch_deployments_use_case
    @github_gateway = github_gateway
    @presenter = presenter
  end

  def trigger_from_labels(pr_number:)
    if ENV['GITHUB_ACTIONS']
      deploy_labels_strings = @github_gateway.get_deploy_labels(pr_number)
    else
      deploy_labels_strings = ['deploy:github-oidc-auth:develop']
    end

    deploy_labels = deploy_labels_strings.map { |label| DeployLabel.new(label) }.select(&:valid?)
    generate_and_present_matrix(deploy_labels)
  end

  def trigger_from_branch(branch_name:)
    result = @determine_branch_deployments.execute(branch_name: branch_name)
    return @presenter.present_error(result) if result.failure?

    @presenter.present_branch_deployment_result(
      deploy_labels: result.deploy_labels,
      branch_name: branch_name
    )
  end

  def test_branch_deployment(branch_name:)
    result = @determine_branch_deployments.execute(branch_name: branch_name)
    return @presenter.present_error(result) if result.failure?

    puts "🌿 Branch: #{branch_name}"
    puts "Deploy Labels: #{result.deploy_labels.map(&:to_s).join(', ')}"
  end

  private

  def generate_and_present_matrix(deploy_labels)
    matrix_result = @generate_matrix.execute(deploy_labels: deploy_labels)
    return @presenter.present_error(matrix_result) if matrix_result.failure?

    @presenter.present_deployment_matrix(
      matrix_items: matrix_result.matrix_items,
      deploy_labels: deploy_labels
    )
  end
end
