require_relative 'workflow_base'

class WorkflowTemplate < WorkflowBase
  def create
    data = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'WorkflowTemplate',
      metadata: { name: name, },
      spec: {}
    }
  end
end
