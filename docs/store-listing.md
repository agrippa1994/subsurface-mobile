# App Store listing

**Not pursued** - the store route is out of scope, see `release.md`. Kept
because the wording, and the privacy answers in particular, describe the app
accurately and were reviewed like anything else in the repo.

Copy for App Store Connect, if that ever happens.

## Name and subtitle

- **Name:** Subsurface
- **Subtitle:** Your dive log, on your phone

## Promotional text

Import your Suunto dives or your Subsurface logbook, see every profile, and
keep the file - it stays on your phone, in the format the desktop app reads.

## Description

Subsurface is a dive log. This is the mobile companion to the desktop
application, built on the same core, reading and writing the same file.

- Import dives from Suunto Dive Manager (DM4 and DM5 databases, .sde archives
  and the XML and JSON the Suunto app exports).
- Open and save Subsurface logbooks (.ssrf). What you export here opens
  unchanged on the desktop, because it is the same serializer.
- See each dive's profile: depth, water temperature, tank pressure, the
  decompression ceiling and the events your computer recorded. Pinch to zoom,
  drag to read off a moment.
- Statistics across your whole log, or filtered to a year or a dive site.
- Edit dives, dive sites and buddies.

Your logbook is a file in the app, not a row in someone's database. There is no
account, no sync service, and nothing is uploaded anywhere.

Subsurface is free software under the GNU General Public License version 2.
Source: https://github.com/agrippa1994/subsurface-mobile

## Keywords

dive log, scuba, diving, logbook, suunto, dive profile, freediving, decompression

## Support and marketing URLs

- Support: https://github.com/agrippa1994/subsurface-mobile/issues
- Marketing: https://github.com/agrippa1994/subsurface-mobile

## App privacy answers

- **Data collected: none.** No identifiers, no usage data, no diagnostics sent
  anywhere. Problems are written to a log on the device that the user can read,
  share or delete from Settings.
- **Tracking: no.**
- **Third-party SDKs that collect data: none.**

## Export compliance

The app makes no network calls and contains no encryption beyond what the OS
provides. Answer "No" to the encryption question.

## Age rating

4+. No user-generated content shared between users, no web browsing.

## What to Test (TestFlight)

The full version of this list, with the value each step must produce, is
`device-acceptance.md` - that document is the one to run. The short form here
is what a tester would be shown.

1. Import a Suunto export or a .ssrf logbook (Settings > Import dives, or
   "Open in Subsurface" from Files or Mail).
2. Browse the dive list, open a dive, scrub and zoom the profile.
3. Check the statistics tab, including a year or site filter.
4. Edit a dive, a dive site and a buddy; force-quit and reopen to confirm the
   change stuck.
5. Export the logbook and open it in desktop Subsurface - it must load without
   complaint.

Please report anything that does not survive step 4 or 5: the file is the
source of truth, and losing part of it is the worst thing this app can do.

## Licence note for review

The app links the GPL-2.0 Subsurface core. Set a custom EULA to the GPL-2.0
text in App Store Connect rather than accepting the standard one - see
docs/release.md.
