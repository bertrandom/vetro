'use strict';
// POST /dock/pressed: the launcher reports a tile press, and a tile with an MQTT message publishes it.
const assert = require('assert').strict;
const EventEmitter = require('events');
const path = require('path');

const published = [];
let connected = true;
const bridgeModule = Object.assign({}, require('../service/mqtt-bridge.js'), {
    MqttBridge: function () {
        this.event = function () {}; this.start = function () {}; this.setTopics = function () {}; this.configure = function () {};
        this.status = function () { return {connected: connected, state: 'connected', events: []}; };
        this.publish = function (topic, payload) { if (!connected) throw Error('MQTT disconnected'); published.push([topic, payload]); };
    }
});
const service = require('./service-harness.cjs')(path.resolve(__dirname, '..'), {dependencies: {'./mqtt-bridge.js': bridgeModule}});

function press(body, address) {
    return new Promise(resolve => {
        const req = new EventEmitter();
        req.method = 'POST'; req.url = '/dock/pressed'; req.socket = {remoteAddress: address || '127.0.0.1'};
        let status;
        const res = {setHeader() {}, writeHead: n => { status = n; }, end: data => resolve({status, body: JSON.parse(data)})};
        service.router(req, res);
        req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end');
    });
}

(async () => {
    const c = service.context;
    assert.ok(c.PORT > 0 && c.dock.startScript().includes(' --notify-port ' + c.PORT + ' '), 'the service hands the launcher its own port');

    let r = await press({slug: 'plex'});
    assert.equal(r.status, 200); assert.equal(r.body.sent, 1);
    assert.deepEqual(published, [['vetro', '{"action":"change_input","input":"plex"}']], 'Plex sends its message to "vetro"');

    r = await press({slug: 'netflix'});
    assert.equal(r.status, 200); assert.equal(r.body.sent, 1);
    assert.deepEqual(published[1], ['vetro', '{"action":"change_input","input":"netflix"}'], 'so does Netflix');

    r = await press({slug: 'shield'});
    assert.equal(r.status, 200); assert.equal(r.body.sent, 0);
    assert.equal(published.length, 2, 'a tile without a message sends nothing');

    r = await press({slug: 'plex'}, '192.168.1.20');
    assert.equal(r.status, 403); assert.equal(published.length, 2, 'only the TV itself may report presses');

    r = await press({slug: 'Bad Slug!'});
    assert.equal(r.status, 400);

    connected = false;
    r = await press({slug: 'plex'});
    assert.equal(r.status, 503); assert.match(r.body.error, /disconnected/, 'a broker that is down is reported, not hidden');

    console.log('PASS dock pressed: the Netflix and Plex tiles publish their MQTT messages; other tiles and other hosts do not');
})().catch(e => { console.error(e); process.exitCode = 1; });
