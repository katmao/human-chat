const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
// You'll need to download your service account key from Firebase Console
// Go to Project Settings > Service Accounts > Generate New Private Key
const serviceAccount = require('./path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportHumanInteractionLogs() {
  try {
    console.log('Starting export of human interaction logs...');
    
    // Get all documents from human_interactions collection
    const snapshot = await db.collection('human_interactions').get();
    
    if (snapshot.empty) {
      console.log('No human interaction logs found.');
      return;
    }
    
    const logs = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings for JSON export
        startTime: data.startTime?.toDate?.()?.toISOString() || data.startTime,
        endTime: data.endTime?.toDate?.()?.toISOString() || data.endTime,
        messages: data.messages?.map(msg => ({
          ...msg,
          timestamp: msg.timestamp?.toDate?.()?.toISOString() || msg.timestamp
        })) || []
      });
    });
    
    // Create export directory if it doesn't exist
    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }
    
    // Export as JSON
    const jsonPath = path.join(exportDir, `human-interactions-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(logs, null, 2));
    console.log(`✅ Exported ${logs.length} logs to: ${jsonPath}`);
    
    // Export as CSV
    const csvPath = path.join(exportDir, `human-interactions-${new Date().toISOString().split('T')[0]}.csv`);
    const csvContent = generateCSV(logs);
    fs.writeFileSync(csvPath, csvContent);
    console.log(`✅ Exported CSV to: ${csvPath}`);
    
    // Print summary
    printSummary(logs);
    
  } catch (error) {
    console.error('Error exporting logs:', error);
  }
}

function generateCSV(logs) {
  const headers = [
    'ID',
    'Session ID',
    'Start Time',
    'End Time',
    'Duration (seconds)',
    'Total Messages',
    'Participant 1 Messages',
    'Participant 2 Messages',
    'System Messages',
    'First Message',
    'Last Message'
  ];
  
  const rows = logs.map(log => [
    log.id,
    log.sessionId,
    log.startTime,
    log.endTime || '',
    log.duration || '',
    log.messageCount || 0,
    log.participant1MessageCount || 0,
    log.participant2MessageCount || 0,
    log.systemMessageCount || 0,
    log.messages?.[0]?.content || '',
    log.messages?.[log.messages.length - 1]?.content || ''
  ]);
  
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function printSummary(logs) {
  console.log('\n📊 SUMMARY:');
  console.log(`Total interactions: ${logs.length}`);
  
  const totalMessages = logs.reduce((sum, log) => sum + (log.messageCount || 0), 0);
  const totalDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
  const avgDuration = logs.length > 0 ? Math.round(totalDuration / logs.length) : 0;
  
  console.log(`Total messages: ${totalMessages}`);
  console.log(`Average duration: ${avgDuration} seconds`);
  
  // Find most active sessions
  const mostActive = logs
    .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
    .slice(0, 5);
  
  console.log('\n🔥 Most Active Sessions:');
  mostActive.forEach((log, index) => {
    console.log(`${index + 1}. Session ${log.sessionId}: ${log.messageCount} messages, ${log.duration}s`);
  });
}

// Run the export
exportHumanInteractionLogs(); 