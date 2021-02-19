const mineflayer = require('mineflayer');
const initMcData = require('minecraft-data');
const pathfinder = require('mineflayer-pathfinder').pathfinder
const Movements = require('mineflayer-pathfinder').Movements
const { GoalNear, GoalGetToBlock } = require('mineflayer-pathfinder').goals
let data = require('./config');

let actions = ['forward', 'back', 'left', 'right'];
let bedTypes = [
    'white_bed',
    'orange_bed',
    'magenta_bed',
    'light_blue_bed',
    'yellow_bed',
    'lime_bed',
    'pink_bed',
    'gray_bed',
    'light_gray_bed',
    'cyan_bed',
    'purple_bed',
    'blue_bed',
    'brown_bed',
    'green_bed',
    'red_bed',
    'black_bed',
];

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
    let host = data.hosts[i];
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

function createBot(host = data.hosts[0], port = 25565, options = { host, port, username: data.username, hideErrors: false }, bot = mineflayer.createBot(options)) {
    bot.loadPlugin(pathfinder);
    bot.movement = {};
    bot.options = options;
    bot.log = function () { console.log(`[${host}:${port}]`, ...Object.values(arguments)); }
    bot.reconnect = () => {
        bot.quit();
        bot.end();
        bot.log(`Reconnecting in ${data.reconnect_wait_seconds} secs.`);
        setTimeout(() => createBot(host, port, options), data.reconnect_wait_seconds * 1000);
    }
    bot.states = {
        lastTime: -1,
        moving: false,
        connected: false,
        lastAction: null,
    }

    bot.on('login', function () {
        bot.data = initMcData(bot.version);
        bot.log(`Logged in with username '${options.username}'`);
        //bot.chat("hello");
    });

    bot.on('chat', function (username, message) {
        if (username == bot.username)
            return;

        if (message == '!autosleep') {
            data.auto_sleep = !data.auto_sleep;
            if (data.auto_sleep)
                bot.chat('Auto sleeping is activated :)')
            else
                bot.chat('Auto sleeping is deactivated :(')
        }
    })

    bot.on('time', function () {
        if (!bot.states.connected)
            return;

        // Adding tps to bot time & removing bigInts
        delete bot.time.bigAge;
        delete bot.time.bigTime;
        bot.time.tps = bot.time.age - bot.time.ageBefore || 20;
        //console.log(JSON.stringify(bot.time));

        if (bot.time.timeOfDay >= 13000 && !bot.isSleeping) {
            if (data.auto_night_skip) {
                bot.chat('/time add 11000');
            } else if (data.auto_sleep) {
                let bedBlocks = bot.findBlocks({
                    matching: bedTypes.map(bedName => bot.data.blocksByName[bedName].id),
                    count: 10,
                }).map(vec3 => bot.blockAt(vec3))

                goToBed();
                function goToBed(i = 0) {
                    const bedBlock = bedBlocks[i];
                    bot.movement.moveNear(bedBlock, 2);
                    const goal_reached = async () => {
                        try {
                            await bot.sleep(bedBlock);
                        } catch (error) {
                            bot.log(error.message);
                            if (error.message.includes('Server rejected transaction'))
                                return bot.reconnect();
                            if (i != bedBlocks.length - 1)
                                setTimeout(() => {
                                    goToBed(++i);
                                }, 2000);
                        }
                        bot.removeListener('goal_reached', goal_reached);
                    };
                    bot.on('goal_reached', goal_reached)
                }

            }
        }
        if (!bot.isSleeping) {
            if (bot.states.lastTime < 0) {
                bot.states.lastTime = bot.time.age;
            } else {
                let interval = (data.move_for_seconds_min + Math.random() * (data.move_for_seconds_max - data.move_for_seconds_min)) * bot.time.tps;
                if (bot.time.age - bot.states.lastTime > interval) {
                    if (!bot.states.moving) {
                        let yaw = (Math.random() - 0.5) * Math.PI;
                        let pitch = (Math.random() - 0.5) * Math.PI;
                        bot.look(yaw, pitch, false);

                        bot.states.lastAction = actions[~~(Math.random() * actions.length)];
                    }
                    bot.states.moving = !bot.states.moving;
                    bot.setControlState(bot.states.lastAction, bot.states.moving);
                    bot.states.lastTime = bot.time.age;
                }
            }
        }

        bot.time.ageBefore = bot.time.age;
    });

    bot.on('spawn', function () {
        bot.movement.default = new Movements(bot, bot.data);
        bot.movement.moveNear = (x, y, z, range = 1) => {
            try {
                if (!y || !z) {
                    if (y) {
                        range = y;
                    }
                    z = x.position.z;
                    y = x.position.y;
                    x = x.position.x;
                }
                bot.pathfinder.setMovements(bot.movement.default);
                bot.pathfinder.setGoal(new GoalNear(x, y, z, range));
            } catch (error) {
                //console.log(error.message)
            }
        }
        bot.movement.moveToBlock = (block) => {
            try {
                let { x, y, z } = block.position;
                bot.pathfinder.setMovements(bot.movement.default);
                bot.pathfinder.setGoal(new GoalGetToBlock(x, y, z), true);
            } catch (error) {
                //console.log(error.message)
            }
        }
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