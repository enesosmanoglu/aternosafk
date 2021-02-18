let env = {
    hosts: [],
    username: "idleosman",
    reconnect_wait_seconds: 10,
    auto_night_skip: false,
    auto_sleep: true,
    move_for_seconds_min: 2,
    move_for_seconds_max: 7,
}

for (let key in process.env) {
    let keyL = key.toLocaleLowerCase();
    if (key in env || keyL in env) {
        env[keyL] = process.env[key];
    }
}

module.exports = env;