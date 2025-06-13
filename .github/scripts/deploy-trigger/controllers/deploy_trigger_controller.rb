# Controller for deploy trigger functionality
# Orchestrates the complete deployment workflow based on Issue #107 strategy

module Interfaces
  module Controllers
    class DeployTriggerController
      def initialize(
        determine_target_environment_use_case:,
        get_merged_pr_labels_use_case:,
        filter_labels_by_environment_use_case:,
        validate_deployment_safety_use_case:,
        generate_matrix_use_case:,
        presenter:
      )
        @determine_target_environment = determine_target_environment_use_case
        @get_merged_pr_labels = get_merged_pr_labels_use_case
        @filter_labels_by_environment = filter_labels_by_environment_use_case
        @validate_deployment_safety = validate_deployment_safety_use_case
        @generate_matrix = generate_matrix_use_case
        @presenter = presenter
      end

      # Trigger deployment from branch push (main workflow)
      def trigger_from_branch(branch_name:, commit_sha: nil)
        commit_sha ||= get_current_commit_sha

        # Step 1: Determine target environment from branch
        env_result = @determine_target_environment.execute(branch_name: branch_name)
        return @presenter.present_error(env_result) if env_result.failure?

        target_environment = env_result.target_environment

        # Step 2: Get merged PR labels
        pr_result = @get_merged_pr_labels.execute(
          branch_name: branch_name,
          commit_sha: commit_sha
        )
        return @presenter.present_error(pr_result) if pr_result.failure?

        deploy_labels = pr_result.deploy_labels
        merged_pr_number = pr_result.merged_pr_number

        # Step 3: Filter labels by target environment
        filter_result = @filter_labels_by_environment.execute(
          deploy_labels: deploy_labels,
          target_environment: target_environment
        )
        return @presenter.present_error(filter_result) if filter_result.failure?

        filtered_labels = filter_result.filtered_labels

        # Step 4: Validate deployment safety
        safety_result = @validate_deployment_safety.execute(
          deploy_labels: filtered_labels,
          merged_pr_number: merged_pr_number,
          branch_name: branch_name,
          commit_sha: commit_sha
        )
        return @presenter.present_error(safety_result) if safety_result.failure?

        # Step 5: Generate deployment matrix
        matrix_result = @generate_matrix.execute(
          deploy_labels: deploy_labels,
          target_environment: target_environment
        )
        return @presenter.present_error(matrix_result) if matrix_result.failure?

        # Present results
        @presenter.present_deployment_matrix(
          deployment_targets: matrix_result.deployment_targets,
          deploy_labels: filtered_labels,
          branch_name: branch_name,
          target_environment: target_environment,
          merged_pr_number: merged_pr_number,
          safety_status: safety_result.safety_status
        )
      end

      # Trigger deployment from PR labels (alternative workflow)
      def trigger_from_pr_labels(pr_number:, target_environment: nil)
        # Get labels from specific PR
        pr_result = get_pr_labels_directly(pr_number)
        return @presenter.present_error(pr_result) if pr_result.failure?

        deploy_labels = pr_result.deploy_labels

        # If no target environment specified, this is an error for this method
        if target_environment.nil?
          return @presenter.present_error(
            Entities::Result.failure(
              error_message: "Target environment must be specified when using from_pr command. " \
                            "Use --target-environment option or determine environment from branch context."
            )
          )
        end

        # Generate deployment matrix with target environment
        matrix_result = @generate_matrix.execute(
          deploy_labels: deploy_labels,
          target_environment: target_environment
        )
        return @presenter.present_error(matrix_result) if matrix_result.failure?

        # Present results
        @presenter.present_deployment_matrix(
          deployment_targets: matrix_result.deployment_targets,
          deploy_labels: deploy_labels,
          pr_number: pr_number,
          target_environment: target_environment
        )
      end

      # Test deployment workflow without actual execution
      def test_deployment_workflow(branch_name:, commit_sha: nil)
        puts "🧪 Testing deployment workflow for branch: #{branch_name}"

        begin
          trigger_from_branch(branch_name: branch_name, commit_sha: commit_sha)
        rescue => error
          puts "Test completed with error (expected in test mode): #{error.message}"
        end
      end

      # Simulate GitHub Actions environment for testing
      def simulate_github_actions(branch_name:, commit_sha: nil)
        puts "🎭 Simulating GitHub Actions environment..."

        original_github_actions = ENV['GITHUB_ACTIONS']
        original_github_env = ENV['GITHUB_ENV']

        ENV['GITHUB_ACTIONS'] = 'true'
        ENV['GITHUB_ENV'] = '/tmp/github_env'
        File.write(ENV['GITHUB_ENV'], '')

        begin
          trigger_from_branch(branch_name: branch_name, commit_sha: commit_sha)

          if File.exist?(ENV['GITHUB_ENV'])
            puts "\n📋 Generated Environment Variables:"
            puts File.read(ENV['GITHUB_ENV'])
          end
        ensure
          ENV['GITHUB_ACTIONS'] = original_github_actions
          ENV['GITHUB_ENV'] = original_github_env
          File.delete('/tmp/github_env') if File.exist?('/tmp/github_env')
        end
      end

      private

      # Get current commit SHA (fallback for testing)
      def get_current_commit_sha
        `git rev-parse HEAD`.strip
      rescue
        'unknown'
      end

      # Get PR labels directly without searching
      def get_pr_labels_directly(pr_number)
        unless @get_merged_pr_labels
          return Entities::Result.failure(error_message: "GitHub client not available")
        end

        # Use existing use case with direct PR number
        @get_merged_pr_labels.execute(pr_number: pr_number)
      end

      # Infer target environment from label patterns
      def infer_environment_from_labels(deploy_labels)
        # DeployLabel only contains service information, not environment
        # Environment should be determined from branch name or explicitly provided
        nil
      end
    end
  end
end
