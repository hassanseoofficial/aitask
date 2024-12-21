// server.js
const express = require('express');
const OpenAI = require('openai');
const fs = require('fs').promises;
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse POST data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: 'sk-proj-h7pXLwRS7z1Ep9KuPM6JT3BlbkFJ3XTMWFhg72xVEdI6nUof'  // Replace with your API key
});

const ASSISTANT_ID = 'asst_N11nccaS8RrqUeAMaqNXSo7m';

// Simple logging function
async function createLog(fileName, logContent) {
  const date = new Date();
  const formattedDate = date.toISOString().split('T')[0];
  const timestamp = date.toISOString();
  const logEntry = `${timestamp} ${JSON.stringify(logContent)}\n\n`;
  
  try {
    await fs.appendFile(`${formattedDate}_${fileName}`, logEntry);
  } catch (error) {
    console.error('Error writing to log:', error);
  }
}

// Create a new thread
async function createThread() {
  try {
    const thread = await openai.beta.threads.create();
    return thread;
  } catch (error) {
    console.error('Error creating thread:', error);
    throw error;
  }
}

// Add message to thread
async function addMsgToThread(msg, threadId) {
  try {
    const message = await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: msg
    });
    return message;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}

// Run the thread
async function runThread(threadId) {
  try {
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID
    });
    return run;
  } catch (error) {
    console.error('Error running thread:', error);
    throw error;
  }
}

// Retrieve run status
async function retrieveRun(threadId, runId) {
  try {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    return run;
  } catch (error) {
    console.error('Error retrieving run:', error);
    throw error;
  }
}

// POST endpoint to handle email analysis
app.post('/analyze', async (req, res) => {
  try {
    const emailBody = req.body.EmailBody;
    
    if (!emailBody) {
      return res.status(400).json({ error: 'EmailBody parameter is required' });
    }

    // Create new thread
    const thread = await createThread();
    await createLog('assistant.log', { event: 'Thread created', threadId: thread.id });

    // Add message to thread
    await addMsgToThread(emailBody, thread.id);

    // Run the thread
    const run = await runThread(thread.id);
    
    // Wait for processing (15 seconds)
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check run status
    const runStatus = await retrieveRun(thread.id, run.id);

    if (runStatus.status === 'completed') {
      // Get the latest message
      const messages = await openai.beta.threads.messages.list(thread.id);
      const assistantResponse = messages.data[0].content[0].text.value;
      
      res.json({ response: assistantResponse });
    } else {
      res.status(500).json({ error: 'Processing not completed', status: runStatus.status });
    }

  } catch (error) {
    console.error('Error processing request:', error);
    await createLog('error.log', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
