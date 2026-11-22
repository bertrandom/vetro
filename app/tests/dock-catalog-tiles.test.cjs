'use strict';
// The fork's fixed row: five input tiles named after the device on them, then the two pills; Netflix and Plex also send an MQTT message.
const assert = require('assert').strict;
const catalog = require('../service/dock-catalog.js');
const hex = s => Buffer.from(s).toString('hex');

assert.equal(catalog.fixedTiles, true, 'on by default');

const parsed = catalog.parse([
    'F|csfs', 'O|d/webapp@aaa', 'O|d/webapp@bbb',
    'R|' + hex('aaa') + '|' + hex('Netflix') + '|' + hex('org.tizen.netflix-app') + '|0',
    'R|' + hex('bbb') + '|' + hex('Shield') + '|' + hex('com.example.shield') + '|0'
].join('\n'));
const built = catalog.build(parsed);
assert.deepEqual(built.entries.map(e => e.slug), ['netflix-2', 'shield-2'], 'apps called Netflix or Shield do not take the tiles\' slugs (and pictures)');

const lines = catalog.tsv(built).trim().split('\n');
assert.ok(lines[0].startsWith('#'));
assert.deepEqual(lines.slice(1), [
    'netflix\tNetflix\tsource:13', 'plex\tPlex\tsource:13', 'shield\tShield\tsource:13', 'snes\tSNES\tsource:14', 'xbox\tXbox\tsource:16',
    'allapps\tAll apps\tpanel:allapps', 'samsunghome\tSamsung Home\tsys:com.samsung.tv.csfs'
], 'the row: Netflix, Plex and the Shield on HDMI 1, the SNES on HDMI 2, the Xbox on HDMI 4, then All apps and Samsung Home');
assert.ok(lines.slice(1, 6).every(l => l.split('\t').length === 3), 'no row key: the row cannot be edited from the launcher');
assert.ok(catalog.allAppsTsv(built).includes('\torg.tizen.netflix-app\t'), 'All apps still lists the apps');
assert.equal(catalog.inputsTsv(built).trim().split('\n').length - 1, 5, 'the Sources page still lists TV and HDMI 1-4');

assert.deepEqual(catalog.tileMessage('plex'), {topic: 'vetro', payload: '{"action":"change_input","input":"plex"}'});
assert.deepEqual(catalog.tileMessage('netflix'), {topic: 'vetro', payload: '{"action":"change_input","input":"netflix"}'});
assert.equal(catalog.tileMessage('shield'), null, 'other tiles send nothing');
assert.equal(catalog.tileMessage('__proto__'), null, 'only listed tiles');

(async () => {
    const out = ['F|csfs', 'O|d/webapp@aaa', 'R|' + hex('aaa') + '|' + hex('Netflix') + '|' + hex('org.tizen.netflix-app') + '|0'].join('\n');
    const r = await catalog.load(async () => ({exit_code: 0, stdout: out}));
    assert.equal(r.count, 0, 'no Home-row apps in the row');
    assert.deepEqual(r.tsv.trim().split('\n').slice(1).map(l => l.split('\t')[0]), ['netflix', 'plex', 'shield', 'snes', 'xbox', 'allapps', 'samsunghome']);
    console.log('PASS dock catalog tiles: the fixed input tiles open the row, Netflix and Plex carry their MQTT messages');
})().catch(e => { console.error(e); process.exitCode = 1; });
