module.exports = {
    hosts: process.env.hosts || ["huzunlumumya","nnaynay"],
    username: process.env.username || "zosman",
    auto_night_skip: process.env.auto_night_skip || false,
    reconnect_wait_seconds: process.env.reconnect_wait_seconds || 10,
}