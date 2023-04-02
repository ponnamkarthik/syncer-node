// Create an app where user can be authenticated and then connect to a WebSocket server
// Multiple users with same accounts will login form different devices
// and those users need to be on the same chat room

// Path: index.js
const express = require('express');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const app = express();

// Define a secret key for signing JWT tokens
const secretKey = 'mysecretkey';

// Define a route for user login
app.post('/login', (req, res) => {
    // Validate user credentials
    const { username, password } = req.body;
    if (username === 'user' && password === 'password') {
        // Generate a JWT token for the user
        const token = jwt.sign({ username }, secretKey, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});
// Create a WebSocket server
const server = new WebSocket.Server({ port: 8080 });

// Map to store user subscriptions to topics/rooms
const userSubscriptions = new Map();

// Listen for WebSocket connections
server.on('connection', (socket, request) => {
    // Extract the JWT token from the request URL
    const token = new URL(request.url, 'http://localhost').searchParams.get('token');

    try {
        // Verify the JWT token
        const decoded = jwt.verify(token, secretKey);
        const username = decoded.username;
        console.log(`User ${username} connected to WebSocket`);

        // Subscribe the user to a room/topic
        if (!userSubscriptions.has(username)) {
            // If the user is not already subscribed, create a new Set for subscriptions
            userSubscriptions.set(username, new Set());
        }
        const userRooms = userSubscriptions.get(username);

        // Listen for messages from the client
        socket.on('message', (message) => {
            console.log(`Received message: ${message}`);

            // Broadcast the message to all clients subscribed to the room/topic
            userRooms.forEach((client) => {
                if (client !== socket && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        });

        // Add the client socket to the user's subscriptions
        userRooms.add(socket);
    } catch (error) {
        console.error(`WebSocket authentication failed: ${error.message}`);
        socket.close();
    }

    // Remove the client socket from the user's subscriptions on close
    socket.on('close', () => {
        console.log('WebSocket disconnected');
        userSubscriptions.forEach((rooms, username) => {
            if (rooms.has(socket)) {
                rooms.delete(socket);
                console.log(`User ${username} unsubscribed from room`);
            }
        });
    });
});
