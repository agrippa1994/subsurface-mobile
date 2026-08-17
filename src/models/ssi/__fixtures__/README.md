# SSI payload fixtures

`ssi-create-dive-keys.json` is the sorted key set of a `save_divelog` request
captured from the SSI mobile app, minus `internalPk` - a primary key from that
app's own on-device database, which nothing outside it can supply.

It exists as a fixture rather than as a read of the capture itself so
`converter.test.ts` does not depend on the ssi-log project being checked out
next to this one. Regenerate it from a fresh capture if SSI's payload changes:

    python3 -c "import json;json.dump(sorted(k for k in json.load(open(CAPTURE)) if k!='internalPk'),open('ssi-create-dive-keys.json','w'),indent=0)"
