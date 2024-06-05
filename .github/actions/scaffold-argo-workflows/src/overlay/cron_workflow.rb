require_relative 'workflow_base'

class Overlay::CronWorkflow < Overlay::WorkflowBase
  def create
    data = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'CronWorkflow',
      metadata: { name: name, },
      spec: {}
    }
  end
end
