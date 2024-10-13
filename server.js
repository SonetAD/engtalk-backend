const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server);

let waitingUsers = [];
const activeCalls = new Map(); // Store ongoing calls

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle users ready for a call
  socket.on('readyForCall', () => {
    if (waitingUsers.length > 0) {
      const matchedUser = waitingUsers.pop(); // Match with the last waiting user
      console.log(`Matching ${socket.id} with ${matchedUser}`);

      // Notify both users that they are matched
      socket.emit('matched', { userId: matchedUser, role: 'receiver' });
      io.to(matchedUser).emit('matched', { userId: socket.id, role: 'caller' });

      // Store the active call
      activeCalls.set(socket.id, matchedUser);
      activeCalls.set(matchedUser, socket.id);
    } else {
      console.log(`${socket.id} is waiting for a match`);
      waitingUsers.push(socket.id); // Add user to the waiting queue
    }
  });

  // Handle offer from a user
  socket.on('offer', ({ offer, targetUserId }) => {
    if (offer && targetUserId) {
      console.log(`Offer from ${socket.id} to ${targetUserId}:`);
      socket.to(targetUserId).emit('offer', { offer, userId: socket.id });
    } else {
      console.error('Invalid offer or targetUserId');
    }
  });

  // Handle answer from a user
  socket.on('answer', ({ answer, targetUserId }) => {
    if (answer && targetUserId) {
      console.log(`Answer from ${socket.id} to ${targetUserId}:`);
      socket.to(targetUserId).emit('answer', { answer, userId: socket.id });
    } else {
      console.error('Invalid answer or targetUserId');
    }
  });

  // Handle peer disconnection
  socket.on('peerDisconnected', () => {
    console.log('Peer disconnected');
    if (activeCalls.has(socket.id)) {
      const peerId = activeCalls.get(socket.id);
      if (peerId) {
        io.to(peerId).emit('peerDisconnected'); // Notify the peer that the user has disconnected
        activeCalls.delete(peerId);
        activeCalls.delete(socket.id);
      }
    }
  });
  
  socket.on('icecandidate', ({ candidate, targetUserId }) => {
    if (candidate && targetUserId) {
      console.log(`ICE candidate from ${socket.id} to ${targetUserId}:`);
      socket.to(targetUserId).emit('icecandidate', { candidate, userId: socket.id });
    } else {
      console.error('Invalid ICE candidate or targetUserId');
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    // Remove the user from the waiting queue if they disconnect while waiting
    waitingUsers = waitingUsers.filter((userId) => userId !== socket.id);

    // Check if the user was in an active call
    if (activeCalls.has(socket.id)) {
      const peerId = activeCalls.get(socket.id);
      if (peerId) {
        io.to(peerId).emit('peerDisconnected');
        activeCalls.delete(peerId);
      }
      activeCalls.delete(socket.id);
    }
  });
});

// Set the server to listen on port 3000
server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
