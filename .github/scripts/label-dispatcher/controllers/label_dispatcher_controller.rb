# Controller for label dispatcher functionality
# Coordinates service detection and label management operations

module Interfaces
  module Controllers
    class LabelDispatcherController
      def initialize(
        detect_services_use_case:,
        manage_labels_use_case:,
        presenter:
      )
        @detect_services = detect_services_use_case
        @manage_labels = manage_labels_use_case
        @presenter = presenter
      end

      # Dispatch labels for a PR based on changed files
      def dispatch_labels(pr_number:, base_ref: nil, head_ref: nil)
        # Detect changed services
        detection_result = @detect_services.execute(base_ref: base_ref, head_ref: head_ref)
        return @presenter.present_error(detection_result) if detection_result.failure?

        # Manage labels if in GitHub Actions and PR number provided
        if ENV['GITHUB_ACTIONS'] && pr_number && @manage_labels
          required_labels = detection_result.deploy_labels.map(&:to_s)
          manage_result = @manage_labels.execute(pr_number: pr_number, required_labels: required_labels)
          return @presenter.present_error(manage_result) if manage_result.failure?

          # Update deployment comment
          comment_result = @manage_labels.update_deployment_comment(
            pr_number: pr_number,
            deploy_labels: detection_result.deploy_labels,
            changed_files: detection_result.changed_files
          )
          # Note: Don't fail if comment update fails, just log it
          if comment_result.failure?
            puts "Warning: Failed to update deployment comment: #{comment_result.error_message}"
          end

          labels_added = manage_result.labels_added
          labels_removed = manage_result.labels_removed
        else
          labels_added = []
          labels_removed = []
        end

        @presenter.present_label_dispatch_result(
          deploy_labels: detection_result.deploy_labels,
          labels_added: labels_added,
          labels_removed: labels_removed,
          changed_files: detection_result.changed_files
        )
      end

      # Test detection without PR interaction
      def test_detection(base_ref: nil, head_ref: nil)
        detection_result = @detect_services.execute(base_ref: base_ref, head_ref: head_ref)
        return @presenter.present_error(detection_result) if detection_result.failure?

        @presenter.present_label_dispatch_result(
          deploy_labels: detection_result.deploy_labels,
          labels_added: [],
          labels_removed: [],
          changed_files: detection_result.changed_files
        )
      end

      # Simulate GitHub Actions environment locally
      def simulate_github_actions(pr_number:, base_ref: nil, head_ref: nil)
        puts "🎭 Simulating GitHub Actions environment..."

        # Set up GitHub Actions environment
        original_github_actions = ENV['GITHUB_ACTIONS']
        original_github_env = ENV['GITHUB_ENV']

        ENV['GITHUB_ACTIONS'] = 'true'
        ENV['GITHUB_ENV'] = '/tmp/github_env'
        File.write(ENV['GITHUB_ENV'], '')

        begin
          dispatch_labels(pr_number: pr_number, base_ref: base_ref, head_ref: head_ref)

          if File.exist?(ENV['GITHUB_ENV'])
            puts "\n📋 Generated Environment Variables:"
            puts File.read(ENV['GITHUB_ENV'])
          end
        ensure
          # Restore original environment
          ENV['GITHUB_ACTIONS'] = original_github_actions
          ENV['GITHUB_ENV'] = original_github_env
          File.delete('/tmp/github_env') if File.exist?('/tmp/github_env')
        end
      end
    end
  end
end
