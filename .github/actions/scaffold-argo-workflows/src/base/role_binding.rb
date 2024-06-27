require_relative 'workflow_base'

class Base::RoleBinding < Base::WorkflowBase
  def create
    data = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { name: "#{name}", },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: name,
        }
      ],
      roleRef: {
        kind: 'Role',
        name: 'argo-workflows-default-executor-role',
        apiGroup: 'rbac.authorization.k8s.io',
      }
    }
  end
end
