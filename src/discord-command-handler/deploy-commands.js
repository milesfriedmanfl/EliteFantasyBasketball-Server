import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Check for list of commands to deploy passed as arguments
const commandsToDeploy = process.argv.slice(2);

// Grab all the command files from the commands directory
console.log(`Grabbing commands from commands directory...`);
const commandsMetadata = [];
const commandFiles = fs.readdirSync(`${__dirname}/commands`)
    .filter(file => file.endsWith('.js')) // Filter out non .js files
    .reduce((filteredCommandFiles, file) => { // Filter by args
        if (commandsToDeploy && commandsToDeploy.length > 0) {
            const fileName = file.split('.')[0];
            for (let i = 0; i < commandsToDeploy.length; i++) {
                const commandName = commandsToDeploy[i];
                if (fileName === commandName) { return [...filteredCommandFiles, file]; }
            }
            return filteredCommandFiles;
        }
    }, []);

let rest;
(async () => {
    // Grab the metadata of each command for deployment
    console.log(`Parsing metadata for each command...`);
    for (const file of commandFiles) {
        const command = await import(`${__dirname}/commands/${file}`);
        commandsMetadata.push(command.default.metadata);
    }

    // Construct and prepare an instance of the REST module
    console.log(`Creating rest discord js rest module with token...`);
    rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

    // Deploy commands
    try {
        console.log(`Queuing up ${commandsMetadata.length} application (/) commands with metadata: \n \t ${JSON.stringify(commandsMetadata)}.`);
        console.log(`Started refreshing ${commandsMetadata.length} application (/) commands.`);
        console.log(`Refreshing commands using endpoint: ${Routes.applicationGuildCommands(process.env.APP_ID, process.env.GUILD_ID)}`)

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.APP_ID, process.env.GUILD_ID),
            { body: commandsMetadata },
        );

        console.log(`Successfully reloaded ${(data)?.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();