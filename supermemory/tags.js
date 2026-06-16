const crypto = require('node:crypto');
const { execSync } = require('node:child_process');
const os = require('node:os');
const CONFIG = require('./config.js');

function sha16(input) {
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function getUserTag() {
    let email;
    try {
        email = execSync('git config user.email', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (_) {
        // git not available or not in a repo
    }
    if (!email) {
        email = os.userInfo().username;
    }
    const hash = sha16(email);
    return CONFIG.userContainerTag || `${CONFIG.containerTagPrefix}_user_${hash}`;
}

function getProjectTag(directory) {
    const hash = sha16(directory);
    return CONFIG.projectContainerTag || `${CONFIG.containerTagPrefix}_project_${hash}`;
}

function getTags(directory) {
    return {
        user: getUserTag(),
        project: getProjectTag(directory),
    };
}

module.exports = { getUserTag, getProjectTag, getTags };
