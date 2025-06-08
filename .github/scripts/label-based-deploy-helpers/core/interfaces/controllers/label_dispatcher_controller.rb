require_relative '../../use_cases/detect_changed_services'
require_relative '../../use_cases/manage_pr_labels'

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

  def dispatch_labels(pr_number:, base_ref: nil, head_ref: nil)
    detection_result = @detect_services.execute(base_ref: base_ref, head_ref: head_ref)
    return @presenter.present_error(detection_result) if detection_result.failure?

    if ENV['GITHUB_ACTIONS'] && pr_number && @manage_labels
      required_labels = detection_result.deploy_labels.map(&:to_s)
      manage_result = @manage_labels.execute(pr_number: pr_number, required_labels: required_labels)
      return @presenter.present_error(manage_result) if manage_result.failure?

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
end
