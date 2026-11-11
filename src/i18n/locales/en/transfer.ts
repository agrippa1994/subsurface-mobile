// AI-generated (Claude)
export default {
  csv: {
    details: {
      label: 'Profile samples',
      description: 'The samples as downloaded from the dive computer.',
    },
    summary: {
      label: 'Dive summary',
      description: 'One row of dive details, without the profile.',
    },
    profile: {
      label: 'Computed profile',
      description: 'Everything the profile diagram computes, sample by sample.',
    },
  },
  import: {
    added_one: '{{count}} dive added',
    added_other: '{{count}} dives added',
    merged_one: '{{count}} dive already in the logbook',
    merged_other: '{{count}} dives already in the logbook',
    failed_one: '{{count}} file could not be read',
    failed_other: '{{count}} files could not be read',
    nothing: 'Nothing to import.',
    summary_one: '{{parts}}. The logbook now holds {{count}} dive.',
    summary_other: '{{parts}}. The logbook now holds {{count}} dives.',
  },
};
