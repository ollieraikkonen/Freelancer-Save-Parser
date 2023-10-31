// Imports
import ini from '@nodecraft/ini';
import fs from 'fs';
import path from 'path';
import hash from 'freelancer-hash';

/**
 * Decodes the name string in the .fl files.
 * @returns {string} containing the name in the UTF-16 format.
 */
String.prototype.hexDecode = function () {
    // Filter out line breaks
    let hexes = this.match(/.{1,4}/g) || [];
    // For each character, convert from hex back into decimal and get the char code in UTF-16
    let name = '';
    for (let i = 0; i < hexes.length; i++) {
        name += String.fromCharCode(parseInt(hexes[i], 16));
    }
    return name;
}

/**
 * Used to grab all .fl files in a directory recursively.
 * @param {string} directory The directory that you wish to search for .fl files in.
 * @returns {string[]} containing the file paths of all .fl files in the directory.
 */
const traverseDirectory = (directory) => {
    let playerFilePaths = [];
    fs.readdirSync(directory).forEach(file => {
        let fullPath = path.join(directory, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            playerFilePaths.push(...traverseDirectory(fullPath));
        } else if (fullPath.slice(-2) == 'fl') {
            playerFilePaths.push(fullPath);
        }
    });
    return playerFilePaths;
}

/**
 * Compares two player's ranks for use in sortPlayerFiles()
 * @param {number} a 
 * @param {number} b 
 * @returns {number} Positive or negative decides which one is sorted first
 */
const compareRank = (a, b) => {
    return parseInt(a.rank) - parseInt(b.rank);
}

/**
 * Compares two player's namees for use in sortPlayerFiles()
 * @param {string} a 
 * @param {string} b 
 * @returns {number} Positive or negative decides which one is sorted first
 */
const compareName = (a, b) => {
    return a.name.localeCompare(b.name);
}

/**
 * Compares two player's last activity for use in sortPlayerFiles()
 * @param {date} a 
 * @param {date} b 
 * @returns {number} Positive or negative decides which one is sorted first
 */
const compareLastSeen = (a, b) => {
    return a.lastseen - b.lastseen;
}

class Parser {
    /**
     * Constructor for the class. Initializes FLHash for use when parsing the save files.
     * @param {string} installDirectory The DATA directory for Freelancer. Used for FLHash to get names 
     */
    constructor(installDirectory) {
        this.hash = new hash.FreelancerHash(installDirectory);
    }

   /**
    * 
    * @param {string} sort Name, Rank, LastSeen - Sort by one of these fields
    * @param {string} direction Optional - Desc - Add this to sort in descending order 
    * @returns {object} The Parser object for method chaining
    */
    sortPlayerFiles(sort, direction) {
        switch (sort) {
            case 'Name':
                this.players = this.players.sort(compareName);
                break;
            case 'Rank':
                this.players = this.players.sort(compareRank);
                break;
            case 'LastSeen':
                this.players = this.players.sort(compareLastSeen);
                break;
        }
        if (direction == 'Desc')
            this.players = this.players.reverse();
        return this;
    }

    /**
     * 
     * @param {string} saveLocation The location of the player files
     * @param {string} range Optional - Amount of days. To be used with next parameter. e.g. Setting Range to 7 and RangeType to 'LastSeen' will filter the results to show only the players who have been seen in the last 7 days.
     * @param {string} rangeType Optional - LastSeen, Created - Which field to use in the range
     * @returns {object} The Parser object for method chaining
     */
    parsePlayerFiles(saveLocation, range, rangeType = 'LastSeen') {
        this.players = [];
        let playerFiles = traverseDirectory(saveLocation);

        for (const pf of playerFiles) {
            let config = ini.parse(fs.readFileSync(pf, 'utf8'), { inlineArrays: true });

            if (Object.keys(config).length != 0) {
                let p = {};
                p.lastseen = fs.statSync(pf).mtime;
                p.created = fs.statSync(pf).birthtime;

                if (range) {
                    let dateAfter = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
                    if (rangeType == 'LastSeen' && p.lastseen < dateAfter)
                        continue;
                    else if (rangeType == 'Created' && p.created < dateAfter)
                        continue;
                }
                if (config.Player) {
                    p.name = config.Player.name.hexDecode();
                    p.system = config.Player.system;
                    p.rank = parseInt(config.Player.rank);
                    p.pvpkills = parseInt(config.Player.num_kills);
                    p.money = parseInt(config.Player.money);
                    p.shiparch = this.hash.getNickname(Number(config.Player.ship_archetype));
                    p.base = config.Player.base ? config.Player.base : 'In Space';
                    p.faction = config.Player.rep_group ? config.Player.rep_group : 'Freelancer';

                    if (config.mPlayer) {
                        p.timePlayed = config.mPlayer.total_time_played ? config.mPlayer.total_time_played : 0;
                        p.basesVisited = config.mPlayer.base_visited ? Array.isArray(config.mPlayer.base_visited) ? config.mPlayer.base_visited.length : 1 : 0;
                        p.systemsVisited = config.mPlayer.sys_visited ? Array.isArray(config.mPlayer.sys_visited) ? config.mPlayer.sys_visited.length : 1 : 0;
                        p.holesVisited = config.mPlayer.holes_visited ? Array.isArray(config.mPlayer.holes_visited) ? config.mPlayer.holes_visited.length : 1 : 0;

                        p.missions = 0;
                        if (config.mPlayer.rm_completed) {
                            if (Array.isArray(config.mPlayer.rm_completed)) {
                                for (const m of config.mPlayer.rm_completed)
                                    p.missions += parseInt(m.split(',')[1]);
                            }
                            else
                                p.missions = parseInt(config.mPlayer.rm_completed.split(',')[1]);
                        }

                        p.kills = 0;
                        if (config.mPlayer.ship_type_killed) {
                            if (Array.isArray(config.mPlayer.ship_type_killed)) {
                                for (const k of config.mPlayer.ship_type_killed)
                                    p.kills += parseInt(k.split(',')[1]);
                            }
                            else
                                p.kills = parseInt(config.mPlayer.ship_type_killed.split(',')[1]);
                        }
                    }
                }
                this.players.push(p);
            }
        }
        return this;
    }
};

export default { Parser }
