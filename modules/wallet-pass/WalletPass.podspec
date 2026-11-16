# AI-generated (Claude)
Pod::Spec.new do |s|
  s.name           = 'WalletPass'
  s.version        = '1.0.0'
  s.summary        = 'Hands a signed .pkpass to Apple Wallet'
  s.description    = 'Presents the system add-pass sheet for a pass built and signed in JavaScript, and draws the system Add to Apple Wallet button.'
  s.author         = ''
  s.homepage       = 'https://github.com/agrippa1994/subsurface-mobile'
  s.license        = { :type => 'GPL-2.0' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PassKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'ios/*.swift'
end
