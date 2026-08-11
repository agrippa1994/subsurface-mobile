# AI-generated (Claude)
Pod::Spec.new do |s|
  s.name           = 'SsrfCore'
  s.version        = '1.0.0'
  s.summary        = 'Subsurface C++ core bridged to React Native'
  s.description    = 'Native module owning the in-memory Subsurface divelog. Task 02 ships only the build plumbing.'
  s.author         = ''
  s.homepage       = 'https://github.com/subsurface/subsurface'
  s.license        = { :type => 'GPL-2.0' }
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    # Pods build as framework targets here, so Swift reaches the Objective-C++
    # facade through the generated umbrella header (public_header_files below),
    # not through a bridging header - those are rejected in framework targets.
    'DEFINES_MODULE' => 'YES',
    # The Subsurface core requires C++17 or newer; keep libc++ to match RN.
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/cpp"'
  }

  # Objective-C/Swift glue lives in ios/, portable C++ in cpp/. The podspec sits
  # at the module root so CocoaPods can reach both (file patterns must not
  # escape the pod root).
  s.source_files = 'ios/**/*.{h,m,mm,swift}', 'cpp/**/*.{h,hpp,c,cpp}'

  # Only the Objective-C facade may enter the umbrella header: the cpp/ headers
  # are C++ and would break the module map for Swift/Objective-C consumers.
  s.public_header_files = 'ios/**/*.h'
  s.private_header_files = 'cpp/**/*.{h,hpp}'
end
