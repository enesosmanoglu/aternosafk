const mineflayer = require('mineflayer')
const cmd = require('mineflayer-cmd').plugin
let data = require('./config');

var lasttime = -1;
var moving = 0;
var connected = 0;

var actions = ['forward', 'back', 'left', 'right']
var lastAction;

var pi = Math.PI;
var moveInterval = 2; // 2 second movement interval
var maxRandom = 5; // 0-5 seconds added to movement interval (randomly)

var bot = mineflayer.createBot({
    host: data.host,
    port: data.port,
    username: data.username
});

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

bot.loadPlugin(cmd)

bot.on('login', function () {
    console.log("Logged In")
    bot.chat("hello");
});

bot.on('time', function (time) {
    if (data.auto_night_skip == "true") {
        if (bot.time.timeOfDay >= 13000) {
            bot.chat('/time set day')
        }
    }
    if (connected < 1) {
        return;
    }
    if (lasttime < 0) {
        lasttime = bot.time.age;
    } else {
        var randomadd = Math.random() * maxRandom * 20;
        var interval = moveInterval * 20 + randomadd;
        if (bot.time.age - lasttime > interval) {
            if (moving == 1) {
                bot.setControlState(lastAction, false);
                moving = 0;
                lasttime = bot.time.age;
            } else {
                var yaw = Math.random() * pi - (0.5 * pi);
                var pitch = Math.random() * pi - (0.5 * pi);
                bot.look(yaw, pitch, false);
                lastAction = actions[Math.floor(Math.random() * actions.length)];
                bot.setControlState(lastAction, true);
                moving = 1;
                lasttime = bot.time.age;
                bot.activateItem();
            }
        }
    }
});

bot.on('spawn', function () {
    connected = 1;
});

bot.on('death', function () {
    bot.emit("respawn")
});

