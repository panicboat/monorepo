require_relative 'workflow_base'

class Base::ServiceAccount < Base::WorkflowBase
  def create
    data = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: { name: name, },
    }
  end
end
