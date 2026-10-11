# AI-generated (Claude)
Pod::Spec.new do |s|
  s.name           = 'GitSync'
  s.version        = '1.0.0'
  s.summary        = 'Git over SSH for syncing the logbook'
  s.description    = 'Commits, fetches and pushes the logbook file through libgit2 (with libssh2 and OpenSSL).'
  s.author         = ''
  s.homepage       = 'https://github.com/libgit2/libgit2'
  s.license        = { :type => 'GPL-2.0' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  unless File.directory?(File.join(__dir__, 'ios/vendor/libgit2.xcframework'))
    raise 'git-sync: ios/vendor/libgit2.xcframework is missing - run modules/git-sync/ios/vendor/build/build-libgit2.sh'
  end

  # Linked by explicit path, for the reason given in SsrfCore.podspec: a
  # static-library xcframework through `vendored_frameworks` becomes a bare
  # -l flag with no search path. The app target performs the final link, so it
  # gets the flag too.
  #
  # The per-SDK path goes into a variable of this pod's own rather than into
  # OTHER_LDFLAGS[sdk=...]: CocoaPods cannot merge an SDK-conditional setting
  # that two pods both set (SsrfCore does), and drops one of them. A plain
  # OTHER_LDFLAGS is merged.
  git2_ldflags = lambda do |root|
    {
      'GIT_SYNC_LIBGIT2[sdk=iphoneos*]' =>
        "#{root}/ios/vendor/libgit2.xcframework/ios-arm64/libgit2-combined.a",
      'GIT_SYNC_LIBGIT2[sdk=iphonesimulator*]' =>
        "#{root}/ios/vendor/libgit2.xcframework/ios-arm64_x86_64-simulator/libgit2-simulator.a",
      'OTHER_LDFLAGS' => '$(inherited) "$(GIT_SYNC_LIBGIT2)"',
    }
  end
  s.user_target_xcconfig = git2_ldflags.call('$(PODS_ROOT)/../../modules/git-sync')

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    # libgit2's headers, reached by search path rather than listed as pod
    # headers so they stay out of the module umbrella.
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/ios/vendor/include"',
  }.merge(git2_ldflags.call('$(PODS_TARGET_SRCROOT)'))

  # libgit2 is built against the SDK's zlib.
  s.libraries = 'z'

  s.source_files = 'ios/*.{h,m,swift}'
  s.public_header_files = 'ios/*.h'
end
