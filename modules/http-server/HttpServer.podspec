# AI-generated (Claude)
Pod::Spec.new do |s|
  s.name           = 'HttpServer'
  s.version        = '1.0.0'
  s.summary        = 'A minimal HTTP/1.1 listener whose responses come from JavaScript'
  s.description    = 'Accepts plain HTTP on the local network (Network.framework) and hands each request to JS, which answers it. Backs the MCP server in Settings.'
  s.author         = ''
  s.homepage       = 'https://github.com/agrippa1994/subsurface-mobile'
  s.license        = { :type => 'GPL-2.0' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'ios/*.swift'
end
