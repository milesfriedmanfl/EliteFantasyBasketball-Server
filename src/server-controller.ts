import fs from 'fs';
import { Server } from './server.js';

const lockFilePath = './server.lock';

// Check if the lock file exists
if (fs.existsSync(lockFilePath)) {
    console.error('Server is already running.');
    process.exit(1);
}

// Create the lock file
fs.writeFileSync(lockFilePath, '');

// Start server
const server = Server.Instance as Server;
server.start();

// Listen for the SIGINT signal (Ctrl+C) to initiate shutdown
process.on('SIGINT', () => {
    server.stop();
    // Remove the lock file
    fs.unlinkSync(lockFilePath);
    // process.exit(0);
});

// Handle server crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    // Remove the lock file
    fs.unlinkSync(lockFilePath);
    // process.exit(1);
});



