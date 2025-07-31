import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../src/firebase';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json or csv
    const limitCount = parseInt(searchParams.get('limit') || '100');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('Exporting human interaction logs...');

    // Build query
    let q = query(
      collection(db, 'human_interactions'),
      orderBy('startTime', 'desc'),
      limit(limitCount)
    );

    // Add date filters if provided
    if (startDate) {
      q = query(q, where('startTime', '>=', new Date(startDate)));
    }
    if (endDate) {
      q = query(q, where('startTime', '<=', new Date(endDate)));
    }

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return NextResponse.json({ 
        message: 'No logs found',
        count: 0 
      });
    }

    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings
        startTime: data.startTime?.toDate?.()?.toISOString() || data.startTime,
        endTime: data.endTime?.toDate?.()?.toISOString() || data.endTime,
        messages: data.messages?.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp?.toDate?.()?.toISOString() || msg.timestamp
        })) || []
      };
    });

    if (format === 'csv') {
      const csvContent = generateCSV(logs);
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="human-interactions-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Return JSON by default
    return NextResponse.json({
      message: 'Export successful',
      count: logs.length,
      data: logs
    });

  } catch (error) {
    console.error('Error exporting logs:', error);
    return NextResponse.json(
      { error: 'Failed to export logs' },
      { status: 500 }
    );
  }
}

function generateCSV(logs: any[]) {
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