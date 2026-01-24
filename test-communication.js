/**
 * Test Suite for Socket.IO and MongoDB Communication
 * Tests all critical functionality
 */

const mongoose = require('mongoose');
const io = require('socket.io-client');
const http = require('http');

// ANSI Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}`)
};

let passedTests = 0;
let failedTests = 0;

// Test 1: MongoDB Connection
async function testMongoDBConnection() {
  log.section('TEST 1: MongoDB Connection');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    log.success('MongoDB Connected successfully');
    log.info(`Database: ${mongoose.connection.name}`);
    log.info(`Host: ${mongoose.connection.host}`);
    log.info(`Port: ${mongoose.connection.port}`);
    
    passedTests++;
    return true;
  } catch (error) {
    log.error(`MongoDB Connection Failed: ${error.message}`);
    log.warning('Make sure MongoDB is running on mongodb://localhost:27017');
    log.warning('Or update MONGODB_URI in .env file');
    failedTests++;
    return false;
  }
}

// Test 2: User Model
async function testUserModel() {
  log.section('TEST 2: User Model Schema');
  
  try {
    const User = require('./models/User');
    
    // Create a test user
    const testUser = new User({
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123'
    });
    
    await testUser.save();
    log.success('User model works and data saved to MongoDB');
    log.info(`Created user: ${testUser.email} (ID: ${testUser._id})`);
    
    // Verify retrieval
    const retrievedUser = await User.findById(testUser._id);
    if (retrievedUser) {
      log.success('User retrieved from MongoDB successfully');
      log.info(`Retrieved: ${retrievedUser.email}`);
    }
    
    // Cleanup
    await User.deleteOne({ _id: testUser._id });
    log.success('Test data cleaned up');
    
    passedTests++;
    return testUser;
  } catch (error) {
    log.error(`User Model Test Failed: ${error.message}`);
    failedTests++;
    return null;
  }
}

// Test 3: Conversation Model
async function testConversationModel(userId1, userId2) {
  log.section('TEST 3: Conversation Model');
  
  try {
    const Conversation = require('./models/Conversation');
    
    const conversation = new Conversation({
      participants: [userId1, userId2],
      isGroup: false
    });
    
    await conversation.save();
    log.success('Conversation created successfully');
    log.info(`Conversation ID: ${conversation._id}`);
    
    const retrieved = await Conversation.findById(conversation._id).populate('participants');
    if (retrieved) {
      log.success('Conversation retrieved successfully');
      log.info(`Participants: ${retrieved.participants.length}`);
    }
    
    return conversation._id;
  } catch (error) {
    log.error(`Conversation Model Test Failed: ${error.message}`);
    failedTests++;
    return null;
  }
}

// Test 4: Message Model
async function testMessageModel(conversationId, userId) {
  log.section('TEST 4: Message Model');
  
  try {
    const Message = require('./models/Message');
    
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      content: 'Test message from test suite'
    });
    
    await message.save();
    log.success('Message created successfully');
    log.info(`Message ID: ${message._id}`);
    log.info(`Content: "${message.content}"`);
    
    const retrieved = await Message.findById(message._id).populate('sender', 'email');
    if (retrieved) {
      log.success('Message retrieved successfully');
      log.info(`Sender: ${retrieved.sender.email}`);
      log.info(`Created at: ${retrieved.createdAt}`);
    }
    
    return message._id;
  } catch (error) {
    log.error(`Message Model Test Failed: ${error.message}`);
    failedTests++;
    return null;
  }
}

// Test 5: JWT Token Generation
async function testJWTGeneration() {
  log.section('TEST 5: JWT Token Generation');
  
  try {
    const { generateToken, verifyToken } = require('./config/jwt');
    
    const userId = 'test-user-id-123';
    const token = generateToken(userId);
    
    if (!token) {
      throw new Error('Token generation returned empty');
    }
    
    log.success('JWT token generated successfully');
    log.info(`Token length: ${token.length} characters`);
    
    const decoded = verifyToken(token);
    if (decoded && decoded.userId === userId) {
      log.success('JWT token verified successfully');
      log.info(`Decoded userId: ${decoded.userId}`);
    } else {
      throw new Error('Token verification failed');
    }
    
    passedTests++;
  } catch (error) {
    log.error(`JWT Test Failed: ${error.message}`);
    failedTests++;
  }
}

// Test 6: Socket.IO Connection
async function testSocketIOConnection() {
  log.section('TEST 6: Socket.IO Connection');
  
  return new Promise((resolve) => {
    try {
      // Start a test server
      const testServer = http.createServer();
      const testIO = require('socket.io')(testServer, {
        cors: { origin: '*' }
      });
      
      testServer.listen(5001, () => {
        log.info('Test Socket.IO server started on port 5001');
        
        // Connect client
        const client = io('http://localhost:5001', {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5
        });
        
        const timeout = setTimeout(() => {
          log.error('Socket.IO connection timeout (5 seconds)');
          client.disconnect();
          testServer.close();
          failedTests++;
          resolve();
        }, 5000);
        
        client.on('connect', () => {
          clearTimeout(timeout);
          log.success('Socket.IO client connected successfully');
          log.info(`Socket ID: ${client.id}`);
          
          passedTests++;
          client.disconnect();
          testServer.close();
          resolve();
        });
        
        client.on('connect_error', (error) => {
          clearTimeout(timeout);
          log.error(`Socket.IO connection error: ${error.message}`);
          failedTests++;
          client.disconnect();
          testServer.close();
          resolve();
        });
      });
    } catch (error) {
      log.error(`Socket.IO Test Failed: ${error.message}`);
      failedTests++;
      resolve();
    }
  });
}

// Test 7: Server Health Check
async function testServerHealth() {
  log.section('TEST 7: Server Health Check');
  
  try {
    const response = await fetch('http://localhost:5000/health');
    
    if (response.ok) {
      const data = await response.json();
      log.success('Server is running and healthy');
      log.info(`Health check response: ${JSON.stringify(data)}`);
      passedTests++;
    } else {
      log.error(`Server returned status: ${response.status}`);
      failedTests++;
    }
  } catch (error) {
    log.error(`Server not running or unreachable: ${error.message}`);
    log.warning('Make sure the server is running with: npm run dev');
    failedTests++;
  }
}

// Test 8: Database Collections Verification
async function testDatabaseStructure() {
  log.section('TEST 8: Database Collections & Indexes');
  
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    log.success('Connected to database successfully');
    log.info(`Found ${collections.length} collections:`);
    
    collections.forEach(col => {
      log.info(`  • ${col.name}`);
    });
    
    // Check indexes on users collection
    const User = require('./models/User');
    const indexes = await User.collection.getIndexes();
    
    if (indexes && indexes.email_1) {
      log.success('Email index exists on Users collection');
    }
    
    passedTests++;
  } catch (error) {
    log.error(`Database Structure Test Failed: ${error.message}`);
    failedTests++;
  }
}

// Main Test Runner
async function runAllTests() {
  console.clear();
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   CHAT BACKEND - MongoDB & Socket.IO Test Suite           ║
║   Date: ${new Date().toLocaleString()}          ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Test MongoDB Connection First
  const mongoConnected = await testMongoDBConnection();
  
  if (!mongoConnected) {
    log.section('TESTS ABORTED');
    log.error('MongoDB connection failed - cannot continue tests');
    log.warning('Install MongoDB and start it:');
    log.info('  # Linux/Mac:');
    log.info('  brew services start mongodb-community');
    log.info('  # Or with Docker:');
    log.info('  docker run -d -p 27017:27017 --name mongodb mongo');
    process.exit(1);
  }

  // Run other tests
  await testJWTGeneration();
  
  // Create test users for model tests
  const user1 = await testUserModel();
  const user2 = await testUserModel();
  
  if (user1 && user2) {
    const convId = await testConversationModel(user1._id, user2._id);
    if (convId) {
      await testMessageModel(convId, user1._id);
    }
    
    // Cleanup conversations and messages
    const Conversation = require('./models/Conversation');
    const Message = require('./models/Message');
    await Conversation.deleteMany({});
    await Message.deleteMany({});
  }
  
  await testDatabaseStructure();
  
  // Test Server Health
  await testServerHealth();
  
  // Test Socket.IO
  await testSocketIOConnection();

  // Summary
  log.section('TEST RESULTS SUMMARY');
  
  const totalTests = passedTests + failedTests;
  const percentage = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
  
  console.log(`
  Total Tests:    ${totalTests}
  ${colors.green}Passed:         ${passedTests}${colors.reset}
  ${colors.red}Failed:         ${failedTests}${colors.reset}
  Success Rate:   ${percentage}%
  `);

  if (failedTests === 0) {
    log.success('All tests passed! Your backend is working correctly! 🎉');
  } else {
    log.warning(`${failedTests} test(s) failed. Review the errors above.`);
  }

  // Disconnect MongoDB
  await mongoose.disconnect();
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
