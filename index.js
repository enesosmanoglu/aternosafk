const mineflayer = require('mineflayer');
const initMcData = require('minecraft-data');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear, GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const config = require('./config');

const actions = ['forward', 'back', 'left', 'right'];
const bedTypes = ['white_bed', 'orange_bed', 'magenta_bed', 'light_blue_bed', 'yellow_bed', 'lime_bed', 'pink_bed', 'gray_bed', 'light_gray_bed', 'cyan_bed', 'purple_bed', 'blue_bed', 'brown_bed', 'green_bed', 'red_bed', 'black_bed'];

if (typeof config.hosts === "string") {
    try {
        config.hosts = JSON.parse(config.hosts)
    } catch (error) {
        if (config.hosts.includes(',')) {
            let hosts = []
            config.hosts.split(',').forEach(host => {
                hosts.push(host.trim())
            });
            config.hosts = hosts;
        } else {
            config.hosts = [config.hosts]
        }
    }
}

if (!config.hosts.length)
    return console.error("Couldn't found host(s) to connect. Please add host(s) to config!")

for (let i = 0; i < config.hosts.length; i++) {
    let host = config.hosts[i];
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

function createBot(host = config.hosts[0], port = 25565, options = { host, port, username: config.username, hideErrors: false }, bot = mineflayer.createBot(options)) {
    setTimeout(() => {
        bot.log("Stopping bot after too long running.")
        bot.reconnect();
    }, 30 * 60 * 1000);
    bot.config = Object.assign({}, config);
    bot.loadPlugin(pathfinder);
    bot.movement = {};
    bot.options = options;
    bot.log = function () { console.log(`[${host}:${port}]`, ...Object.values(arguments)); }
    bot.reconnect = () => {
        bot.quit();
        bot.end();
        bot.log("Reconnecting in", bot.config.reconnect_wait_seconds, bot.config.reconnect_wait_seconds < 60 ? "seconds." : "minutes.");
        setTimeout(() => createBot(host, port), bot.config.reconnect_wait_seconds * 1000);
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

        if (!message.startsWith(bot.config.prefix))
            return;

        let cmd = message.slice(bot.config.prefix.length);

        if (cmd === "time") {
            bot.chat(bot.time.timeOfDay);
        } else if (cmd === "autosleep") {
            bot.config.auto_sleep = !bot.config.auto_sleep;
            if (bot.config.auto_sleep)
                bot.chat('Auto sleeping is activated :)');
            else
                bot.chat('Auto sleeping is deactivated :(');
        } else if (cmd === "autonightskip") {
            bot.config.auto_night_skip = !bot.config.auto_night_skip;
            if (bot.config.auto_night_skip)
                bot.chat('Auto night skipping is activated :)');
            else
                bot.chat('Auto night skipping is deactivated :(');
        } else if (cmd.startsWith("prefix")) {
            bot.config.prefix = cmd.replace("prefix", "").trim()[0];
            bot.chat("Prefix changed to `" + bot.config.prefix + "`");
        }
    })

    let bedBlocks = [];
    let bedBlock;
    function goToBed(i = 0) {
        bot.lasti = i;
        bedBlock = bedBlocks[i];
        bot.movement.moveNear(bedBlock, 2);
    }
    const goal_reached = async () => {
        try {
            await bot.sleep(bedBlock);
        } catch (error) {
            bot.log(error.message);
            if (error.message.includes('Server rejected transaction'))
                return bot.reconnect();
            if (bot.lasti != bedBlocks.length - 1)
                setTimeout(() => {
                    goToBed(++bot.lasti);
                }, 2000);
        }
    };
    bot.on('goal_reached', goal_reached)

    bot.findBedsAndSleep = () => {
        bedBlocks = bot.findBlocks({
            matching: bedTypes.map(bedName => bot.data.blocksByName[bedName].id),
            count: 10,
        }).map(vec3 => bot.blockAt(vec3));

        goToBed();
    }

    bot.on('time', function () {
        if (!bot.states.connected)
            return;

        bot.onlinePlayers = Object.keys(bot.players).filter(u => u != bot.username);

        if (bot.changeBefore.doDaylightCycle != bot.time.doDaylightCycle) {
            bot.log('doDaylightCircle changed to', bot.time.doDaylightCycle)

            if (!bot.time.doDaylightCycle) {
                if (bot.config.auto_night_skip) {
                    bot.changeBefore.auto_night_skip = bot.config.auto_night_skip;
                    bot.config.auto_night_skip = false;
                    bot.log("Auto night skip deactivated!")
                }
                if (bot.config.auto_sleep) {
                    bot.changeBefore.auto_sleep = bot.config.auto_sleep;
                    bot.config.auto_sleep = false;
                    bot.log("Auto sleep deactivated!")
                }
            } else {
                if (bot.changeBefore.auto_night_skip) {
                    bot.config.auto_night_skip = true;
                    bot.log("Auto night skip activated!")
                }
                if (bot.changeBefore.auto_sleep) {
                    bot.config.auto_sleep = true;
                    bot.log("Auto sleep activated!")
                }
            }

            bot.changeBefore.doDaylightCycle = bot.time.doDaylightCycle;
        }

        // Auto stop time when there is no players in-game
        if (bot.config.auto_stop_time) {
            if (!bot.onlinePlayers.length && bot.time.doDaylightCycle) {
                // freeze time
                bot.log('There is no players left. Freezing time...')
                bot.chat('/gameRule doDaylightCycle false');
            }
            else if (bot.onlinePlayers.length && !bot.time.doDaylightCycle) {
                bot.log('There are players online. Time is advancing.')
                bot.chat('/gameRule doDaylightCycle true');
            }
        }

        // Adding tps to bot time & removing bigInts
        delete bot.time.bigAge;
        delete bot.time.bigTime;
        bot.time.tps = bot.time.age - bot.time.ageBefore || 20;
        //console.log(JSON.stringify(bot.time));

        if (bot.time.timeOfDay >= 13000 && !bot.isSleeping) {
            if (bot.config.auto_night_skip) {
                bot.chat('/time add 11000');
            } else if (bot.config.auto_sleep) {
                bot.findBedsAndSleep();
            }
        }
        if (!bot.isSleeping) {
            if (bot.states.lastTime < 0) {
                bot.states.lastTime = bot.time.age;
            } else {
                let interval = (bot.config.move_for_seconds_min + Math.random() * (bot.config.move_for_seconds_max - bot.config.move_for_seconds_min)) * bot.time.tps;
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
        bot.chat('/setidletimeout 0');
        if (bot.config.auto_creative_mode)
            bot.chat('/gamemode creative');

        bot.onlinePlayers = Object.keys(bot.players).filter(u => u != bot.username);
        bot.log("Online Players", bot.onlinePlayers);

        bot.changeBefore = { doDaylightCycle: bot.time.doDaylightCycle };

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

    bot.on('playerJoined', player => {
        bot.log(player.username, "joined the game")
    })
    bot.on('playerLeft', player => {
        bot.log(player.username, "left the game")
    })

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
        } else if (reason.includes("This server is currently waiting in queue")) {
            let waitingTimeText = reason.split("Estimated waiting time is §aca. ")[1].split('&8.')[0];
            let waitingTimeSeconds = parseInt(waitingTimeText.match(/\d/g).join(''));
            if (waitingTimeText.includes("minute")) {
                waitingTimeSeconds *= 60;
            }
            bot.config.reconnect_wait_seconds = ~~(waitingTimeSeconds / 2);

            bot.log("This server is currently waiting in queue.");
            bot.log("Estimated waiting time is ca.", waitingTimeText);
            if (reason.includes('.aternos.me')) {
                bot.log("Do not forget to confirm server :)")
                bot.log("https://aternos.org/server/")
            }
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