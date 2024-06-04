require_relative './base'
require_relative './overlay'

def main(workspace, service, owner, namespace, kind, name, overlays, is_create_blank_patches)
  kubernetes_path = "#{workspace}/#{service}/kubernetes"
  # Base
  Base.new("#{kubernetes_path}/base/#{namespace}", service, owner, namespace, kind, name).create(is_create_blank_patches)
  # Overlays
  targets = Dir.glob("#{kubernetes_path}/overlays/*").map { |overlay| File.basename(overlay) }
  targets = overlays.split(',') if targets.empty?
  targets.each do |overlay|
    environment = File.basename(overlay)
    unless ['prebuilt'].include?(environment)
      is_overlay_target = overlays.include?(environment)
      Overlay.new("#{kubernetes_path}/overlays/#{environment}/#{namespace}", service, owner, namespace, kind, name).create(is_overlay_target, is_create_blank_patches)
    end
  end
end

workspace = ENV.fetch('WORKSPACE')
service = ENV.fetch('SERVICE')
owner = ENV.fetch('OWNER')
namespace = ENV.fetch('NAMESPACE')
kind = ENV.fetch('KIND')
name = ENV.fetch('NAME')
overlays = ENV.fetch('OVERLAYS')
is_create_blank_patches = ENV.fetch('IS_CREATE_BLANK_PATCHES') == 'true'

main(workspace, service, owner, namespace, kind, name, overlays, is_create_blank_patches)
