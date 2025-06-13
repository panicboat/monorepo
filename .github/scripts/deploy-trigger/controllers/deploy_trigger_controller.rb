# Controller for deploy trigger functionality

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

      # Trigger deployment from branch push
      def trigger_from_branch(branch_name:)
        # Step 1: Determine target environment from branch
        env_result = @determine_target_environment.execute(branch_name: branch_name)
        return @presenter.present_error(env_result) if env_result.failure?

        target_environment = env_result.target_environment

        # Step 2: Get merged PR labels
        pr_result = @get_merged_pr_labels.execute(branch_name: branch_name)
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
          branch_name: branch_name
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

      # Trigger deployment from PR labels - determines environment from PR branch
      def trigger_from_pr_labels(pr_number:)
        # Step 1: Get labels and branch name from specific PR
        pr_result = get_pr_labels_directly(pr_number)
        return @presenter.present_error(pr_result) if pr_result.failure?

        deploy_labels = pr_result.deploy_labels
        # Use branch name from PR API
        current_branch = pr_result.source_branch

        # Step 2: Determine target environment from PR's source branch
        env_result = @determine_target_environment.execute(branch_name: current_branch)
        return @presenter.present_error(env_result) if env_result.failure?

        target_environment = env_result.target_environment

        # Step 3: Validate deployment safety
        safety_result = @validate_deployment_safety.execute(
          deploy_labels: deploy_labels,
          merged_pr_number: pr_number,
          branch_name: current_branch
        )
        return @presenter.present_error(safety_result) if safety_result.failure?

        # Step 4: Generate deployment matrix with target environment
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
          branch_name: current_branch,
          target_environment: target_environment,
          safety_status: safety_result.safety_status
        )
      end

      # Test deployment workflow without actual execution
      def test_deployment_workflow(branch_name:)
        puts "🧪 Testing deployment workflow for branch: #{branch_name}"

        begin
          trigger_from_branch(branch_name: branch_name)
        rescue => error
          puts "Test completed with error (expected in test mode): #{error.message}"
        end
      end

      # Simulate GitHub Actions environment for testing
      def simulate_github_actions(branch_name:)
        puts "🎭 Simulating GitHub Actions environment..."

        original_github_actions = ENV['GITHUB_ACTIONS']
        original_github_env = ENV['GITHUB_ENV']

        ENV['GITHUB_ACTIONS'] = 'true'
        ENV['GITHUB_ENV'] = '/tmp/github_env'
        File.write(ENV['GITHUB_ENV'], '')

        begin
          trigger_from_branch(branch_name: branch_name)

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

      # Get current branch name
      def get_current_branch_name
        # In GitHub Actions, use GITHUB_REF_NAME
        if ENV['GITHUB_REF_NAME']
          ENV['GITHUB_REF_NAME']
        else
          # Fallback to git command for local testing
          `git branch --show-current`.strip
        end
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
    end
  end
end
