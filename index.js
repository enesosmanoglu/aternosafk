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
    if (host.includes(':')) {
        let hostData = host.split(':')
        createBot(hostData[0], hostData[1])
    } else {
        createBot(host)
    }
}

function createBot(host = data.hosts[0], port = 25565, options = { host, port, username: data.username }, bot = mineflayer.createBot(options)) {
    bot.log = function () {
        console.log(`[${options.host}:${options.port}] ${Object.values(arguments).join(' ')}`)
    }

    let lasttime = -1;
    let moving = 0;
    let connected = 0;
    let lastAction;

    bot.loadPlugin(cmd)

    bot.on('login', function () {
        bot.log(`Logged in with '${options.username}'`)
        //bot.chat("hello");
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
            let randomadd = Math.random() * maxRandom * 20;
            let interval = moveInterval * 20 + randomadd;
            if (bot.time.age - lasttime > interval) {
                if (moving == 1) {
                    bot.setControlState(lastAction, false);
                    moving = 0;
                    lasttime = bot.time.age;
                } else {
                    let yaw = Math.random() * pi - (0.5 * pi);
                    let pitch = Math.random() * pi - (0.5 * pi);
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

    bot.on('kicked', function (reason, loggedIn) {
        try {
            reason = JSON.parse(reason.replace(/\n/g, " ")).text
        } catch (error) {
            console.log(error)
        }
        bot.log("[KICKED]", reason)
        bot.log("[LOGGEDIN]", loggedIn)
        bot.quit()
        bot.end()
        bot.log('Reconnecting in 10 secs.')
        setTimeout(() => {
            createBot(host, port, options)
        }, 10000);
    });
    bot.on('error', function (err) {
        bot.log("[ERROR]", err.message)
        bot.quit()
        bot.end()
        bot.log('Reconnecting in 10 secs.')
        setTimeout(() => {
            createBot(host, port, options)
        }, 10000);
    });
}