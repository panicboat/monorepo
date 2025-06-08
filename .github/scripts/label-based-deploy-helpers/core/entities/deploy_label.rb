class DeployLabel
  attr_reader :service, :environment, :stack

  def initialize(label_string)
    @raw_label = label_string
    parse_label!
  end

  def self.from_components(service:, environment:, stack: 'terragrunt')
    new("deploy:#{service}:#{environment}:#{stack}")
  end

  def to_s
    stack == 'terragrunt' ? "deploy:#{service}:#{environment}" : "deploy:#{service}:#{environment}:#{stack}"
  end

  def valid?
    !service.nil? && !environment.nil? && !stack.nil?
  end

  def ==(other)
    return false unless other.is_a?(DeployLabel)
    service == other.service && environment == other.environment && stack == other.stack
  end

  private

  def parse_label!
    parts = @raw_label.split(':')

    return unless parts.length >= 3 && parts[0] == 'deploy'

    @service = parts[1]
    @environment = parts[2]
    @stack = parts[3] || 'terragrunt'
  end
end
