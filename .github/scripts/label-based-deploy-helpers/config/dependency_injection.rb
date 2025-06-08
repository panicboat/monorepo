require 'dry-container'
require 'dry-auto_inject'

class DependencyContainer
  def self.configure
    @container ||= build_container
  end

  def self.resolve(name)
    configure[name]
  end

  private

  def self.build_container
    container = Dry::Container.new

    # Infrastructure Layer
    container.register(:file_client) { FileSystemClient.new }
    container.register(:config_client) { YamlConfigClient.new }
    container.register(:github_client) do
      GitHubApiClient.new(
        token: ENV['GITHUB_TOKEN'] || raise('GITHUB_TOKEN is required'),
        repository: ENV['GITHUB_REPOSITORY'] || raise('GITHUB_REPOSITORY is required')
      )
    end

    # Gateways
    container.register(:file_gateway) { container[:file_client] }
    container.register(:config_gateway) { container[:config_client] }
    container.register(:github_gateway) { container[:github_client] }

    # Presenters
    container.register(:github_actions_presenter) { GitHubActionsPresenter.new }
    container.register(:console_presenter) { ConsolePresenter.new }

    # Use Cases
    container.register(:detect_changed_services) do
      DetectChangedServices.new(
        file_gateway: container[:file_gateway],
        config_gateway: container[:config_gateway]
      )
    end

    container.register(:generate_deployment_matrix) do
      GenerateDeploymentMatrix.new(config_gateway: container[:config_gateway])
    end

    container.register(:determine_branch_deployments) do
      DetermineBranchDeployments.new(
        file_gateway: container[:file_gateway],
        config_gateway: container[:config_gateway]
      )
    end

    # GitHub Actions environment only
    if ENV['GITHUB_ACTIONS']
      container.register(:manage_pr_labels) do
        ManagePrLabels.new(github_gateway: container[:github_gateway])
      end
    end

    # Controllers
    container.register(:label_dispatcher_controller) do
      presenter = ENV['GITHUB_ACTIONS'] ? container[:github_actions_presenter] : container[:console_presenter]

      LabelDispatcherController.new(
        detect_services_use_case: container[:detect_changed_services],
        manage_labels_use_case: ENV['GITHUB_ACTIONS'] ? container[:manage_pr_labels] : nil,
        presenter: presenter
      )
    end

    container.register(:deploy_trigger_controller) do
      presenter = ENV['GITHUB_ACTIONS'] ? container[:github_actions_presenter] : container[:console_presenter]

      DeployTriggerController.new(
        generate_matrix_use_case: container[:generate_deployment_matrix],
        determine_branch_deployments_use_case: container[:determine_branch_deployments],
        github_gateway: container[:github_gateway],
        presenter: presenter
      )
    end

    container
  end
end
