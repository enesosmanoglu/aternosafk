const mineflayer = require('mineflayer')
const cmd = require('mineflayer-cmd').plugin
let data = require('./config');

let actions = ['forward', 'back', 'left', 'right']

let pi = Math.PI;
let moveInterval = 2; // 2 second movement interval
let maxRandom = 5; // 0-5 seconds added to movement interval (randomly)

if (typeof data.hosts === "string") {
    try {
        data.hosts = JSON.parse(data.hosts)
    } catch (error) {
        if (data.hosts.includes(',')) {
            let hosts = []
            data.hosts.split(',').forEach(host => {
                hosts.push(host.trim())
            });
            data.hosts = hosts;
        } else {
            data.hosts = [data.hosts]
        }
    }
}

if (!data.hosts.length)
    return console.error("Couldn't found host(s) to connect. Please add host(s) to config!")

for (let i = 0; i < data.hosts.length; i++) {
    const host = data.hosts[i];
    if (!host.includes('.')) {
        host += ".aternos.me"
    }

    if (host.includes(':')) {
        let hostData = host.split(':')
        createBot(hostData[0], hostData[1])
    } else {
        createBot(host)
    }
}

function createBot(host = data.hosts[0], port = 25565, options = { host, port, username: data.username }, bot = mineflayer.createBot(options)) {
    bot.options = options;
    bot.log = () => console.log(`[${options.host}:${options.port}]`, ...Object.values(arguments));
    bot.reconnect = () => {
        bot.quit();
        bot.end();
        bot.log(`Reconnecting in ${data.reconnect_wait_seconds} secs.`);
        setTimeout(() => createBot(host, port, options), data.reconnect_wait_seconds * 1000);
    }
    bot.states = {
        lasttime: -1,
        moving: false,
        connected: false,
        lastAction: null,
    }

    bot.loadPlugin(cmd);

    bot.on('login', function () {
        bot.log(`Logged in with '${options.username}'`);
        //bot.chat("hello");
    });

    bot.on('time', function () {
        if (!bot.states.connected)
            return;

        if (data.auto_night_skip) {
            if (bot.time.timeOfDay >= 13000) {
                bot.chat('/time set day');
            }
        }

        if (bot.states.lasttime < 0) {
            bot.states.lasttime = bot.time.age;
        } else {
            let randomadd = Math.random() * maxRandom * 20;
            let interval = moveInterval * 20 + randomadd;
            if (bot.time.age - bot.states.lasttime > interval) {
                if (bot.states.moving) {
                    bot.setControlState(bot.states.lastAction, false);
                    bot.states.moving = false;
                } else {
                    let yaw = Math.random() * pi - (0.5 * pi);
                    let pitch = Math.random() * pi - (0.5 * pi);
                    bot.look(yaw, pitch, false);
                    bot.states.lastAction = actions[Math.floor(Math.random() * actions.length)];
                    bot.setControlState(bot.states.lastAction, true);
                    bot.states.moving = true;
                    bot.activateItem();
                }
                bot.states.lasttime = bot.time.age;
            }
        }
    });

    bot.on('spawn', function () {
        bot.log('[SPAWN]');
        bot.states.connected = true;
    });

    bot.on('death', function () {
        bot.log('[DEATH]');
        bot.emit("respawn");
    });

    bot.on('kicked', function (reason, loggedIn) {
        try {
            reason = JSON.parse(reason.replace(/\n/g, " ")).text
        } catch (error) {
            //console.log(error)
        }
        bot.log("");
        if (reason.includes("This server is offline")) {
            bot.log("Server is currently offline. Please start server firstly!");
            if (reason.includes('.aternos.me'))
                bot.log("https://aternos.org/server/")
        } else if (reason.includes("Server not found")) {
            bot.log("Server not found! Be sure that you typed correctly.");
            if (reason.includes('.aternos.me'))
                bot.log("https://aternos.org/server/")
        } else {
            bot.log("[KICKED]", reason);
            bot.log("[WAS LOGIN BEFORE KICKING?]", loggedIn);
        }
        bot.log("");
    });

    bot.on('error', function (err) {
        bot.log("[ERROR]", err.message);
    });

    bot.on('end', () => {
        bot.states.connected = false;
        bot.reconnect();
    })
}