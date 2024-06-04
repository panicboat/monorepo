class WorkflowBase
  private attr_reader :service, :owner, :namespace, :kind, :name
  def initialize(service, owner, namespace, kind, name)
    @service = service
    @owner = owner
    @namespace = namespace
    @kind = kind
    @name = name
  end
end
